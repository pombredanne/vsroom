import idiokit
from idiokit import timer
from abusehelper.core import bot, taskfarm

class RoomBot(bot.ServiceBot):
    def __init__(self, *args, **keys):
        bot.ServiceBot.__init__(self, *args, **keys)

        self.room_handlers = taskfarm.TaskFarm(self._handle_room)

    @idiokit.stream
    def _handle_room(self, name):
        self.log.info("Joining room %r", name)
        room = yield self.xmpp.muc.join(name, self.bot_name)
        self.log.info("Joined room %r", name)

        try:
            yield room
        finally:
            self.log.info("Left room %r", name)

    def to_room(self, name):
        return self.room_handlers.inc(name) | idiokit.consume()

    def from_room(self, name):
        return idiokit.consume() | self.room_handlers.inc(name)

import heapq
import operator

class Window(object):
    """
    A base class for calculating an aggregated value from a sliding
    event time window.
    """

    def __init__(self, window_time):
        self.window_time = window_time
        self.window = list()

    def value(self):
        """
        Return the aggregated value, None if there is no
        value. Override this method for custom functionality.
        """
        return None

    def added(self, event):
        """
        Add an event to the aggregated result. Override this method
        for custom functionality.
        """
        pass

    def discarded(self, event):
        """
        Remove an event from the aggregated result. Override this
        method for custom functionality.
        """
        pass

    def push(self, current_time, event):
        """
        Add an event to the aggregation time window.
        """
        expire_time = current_time + self.window_time
        heapq.heappush(self.window, (expire_time, event))
        self.added(event)

    def expire(self, current_time):
        """
        Expire events from the aggregation time window. Return True if
        some event was expired, False otherwise.
        """
        result = False

        while self.window and self.window[0][0] <= current_time:
            _, event = heapq.heappop(self.window)
            self.discarded(event)
            result = True

        return result

class Count(Window):
    """
    Count the events inside the time window.
    """

    count = 0

    def added(self, event):
        self.count += 1

    def discarded(self, event):
        self.count -= 1

    def value(self):
        return self.count if self.count > 0 else None

def parse_float(string):
    try:
        return float(string)
    except ValueError:
        return None

class Combiner(Window):
    """
    Create an aggregated value by running a binary function over the
    events (for some key) in the time window.
    """

    func = staticmethod(lambda x, y: None)

    def __init__(self, input_key, *args, **keys):
        Window.__init__(self, *args, **keys)

        self.input_key = input_key
        self.values = dict()

    def added(self, event):
        self.values[event] = event.value(self.input_key, None, parse_float)

    def discarded(self, event):
        del self.values[event]

    def value(self):
        result = None
        for value in self.values.itervalues():
            if value is None:
                continue

            if result is None:
                result = value
            else:
                result = self.func(result, value)
        return result

class Max(Combiner):
    """
    Calculate the maximum event key value.
    """
    func = staticmethod(max)

class Min(Combiner):
    """
    Calculate the minimum event key value.
    """
    func = staticmethod(min)

class Sum(Combiner):
    """
    Calculate the sum of event key values.
    """
    func = staticmethod(operator.add)

import time
import hashlib
from abusehelper.core import events

class OverviewBot(RoomBot):
    def __init__(self, *args, **keys):
        RoomBot.__init__(self, *args, **keys)
        self._aggregates = dict(self.aggregates())

    def aggregates(self):
        return dict(max=Max,
                    min=Min,
                    count=Count,
                    sum=Sum)

    @idiokit.stream
    def throttle(self, throttle_time):
        """
        Ensure that updates for a given event id are sent at least
        throttle_time apart.
        """

        sleeper = timer.sleep(1.0)

        ids = dict()
        queue = list()

        while True:
            yield timer.sleep(1.0)

            item = yield idiokit.next()
            current_time = time.time()

            id, event = item
            previous, _, update_time = ids.get(id, (None, None, None))
            if update_time is None:
                update_time = current_time + 1.0
                heapq.heappush(queue, (update_time, id))
            ids[id] = previous, event, update_time

            while queue and queue[0][0] <= current_time:
                _, id = heapq.heappop(queue)

                previous, next, _ = ids[id]
                if previous == next == None:
                    del ids[id]
                    continue

                if previous != next:
                    if next is None:
                        event = events.Event()
                    else:
                        event = events.Event(next)
                    event.add("id", id)
                    yield idiokit.send(event)

                if previous != next:
                    update_time = current_time + throttle_time
                    heapq.heappush(queue, (update_time, id))
                else:
                    update_time = None
                ids[id] = next, next, update_time

    @idiokit.stream
    def aggregate(self, group_keys, window_info):
        """
        Create aggregated events and ids for them.
        """

        group_keys = tuple(set(group_keys))
        key_groups = dict()

        while True:
            yield timer.sleep(1.0)

            event = yield idiokit.next()
            
            current_time = time.time()
            updated = set()

            key = tuple(tuple(sorted(event.values(x))) for x in group_keys)
            updated.add(key)
                
            if key not in key_groups:
                windows = []
                for constructor, keys, output_key in window_info:
                    windows.append((constructor(**keys), output_key))
                key_groups[key] = windows
                
            for window, output_key in key_groups[key]:
                window.push(current_time, event)

            for key, windows in list(key_groups.iteritems()):
                any_expired = False
                for window, _ in windows:
                    any_expired = window.expire(current_time) or any_expired

                if not (any_expired or key in updated):
                    continue

                output = None

                for window, output_key in windows:
                    value = window.value()
                    if value is None:
                        continue

                    if output is None:
                        output = events.Event()
                    output.add(output_key, unicode(value))

                id = hashlib.md5(repr(key)).hexdigest()
                if output is not None:
                    for group_key, group_values in zip(group_keys, key):
                        output.update(group_key, group_values)

                yield idiokit.send(id, output)
                if output is None:
                    del key_groups[key]

    @idiokit.stream
    def session(self, state, src_room, dst_room,
                group_keys=[], aggregates=[], throttle_time=10.0):
        aggregate_list = list()
        for original_aggregate in aggregates:
            aggregate = dict(original_aggregate)

            try:
                name = aggregate.pop("name")
                output_key = aggregate.pop("output_key")
            except KeyError, error:
                self.log.error("No key %r defined in %r"
                               % (error.args[0], original_aggregate))
                raise

            try:
                aggregate_cls = self._aggregates[name]
            except KeyError:
                self.log.error("No aggregate type %r available" % (name,))
                raise

            aggregate_list.append((aggregate_cls, aggregate, output_key))

        yield (self.from_room(src_room) 
               | events.stanzas_to_events()
               | self.aggregate(group_keys, aggregate_list)
               | self.throttle(throttle_time)
               | events.events_to_elements()
               | self.to_room(dst_room))

if __name__ == "__main__":
    OverviewBot.from_command_line().execute()
