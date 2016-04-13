import os
import time
import math
import errno
import marshal
import collections

import idiokit
from idiokit import timer, xmlcore
from idiokit.xmpp.jid import JID
from abusehelper.core import bot, events, taskfarm, services
from vsroom.common import eventdb

NS = "vsr#historian"

try:
    import json
    JSONDecodeError = ValueError
except ImportError:
    import simplejson as json
    JSONDecodeError = getattr(json, "JSONDecodeError", ValueError)

def current_time(multiplier=10**6):
    return time.time() * multiplier

def is_valid(event):
    """Return whether an event contains values for keys other than "id".

    >>> event = events.Event()
    >>> is_valid(event)
    False
    >>> event.add("id", "1")
    >>> is_valid(event)
    False
    >>> event.add("other", "2")
    >>> is_valid(event)
    True
    """

    contains_other = False
    for key in event.keys():
        if key != "id":
            contains_other = True
            break
    return event.contains("id") and contains_other

class Timeout(Exception):
    pass

class EventDB(object):
    def __init__(self, filename):
        self.db = eventdb.Writer(filename)

        self.jids = dict()
        self.ids = dict()

    def commit(self):
        self.db.commit(current_time())

    def close(self):
        self.db.close(current_time())

    def add_event(self, jid, event):
        timestamp = current_time()

        ids = event.values("id")
        if not ids:
            obj = dict((x, list(event.values(x))) for x in event.keys())
            self.db.append_obj(timestamp, timestamp, marshal.dumps(obj))
            return

        for id in ids:
            copy = events.Event(event)
            copy.clear("id")
            copy.add("id", id)

            if is_valid(copy):
                obj = dict((x, list(copy.values(x))) for x in copy.keys())
                self._open(timestamp, id, jid, marshal.dumps(obj))
            else:
                self._close(timestamp, id)

    def purge_jid(self, jid):
        ids = list(self.jids.get(jid, ()))
        for id in ids:
            self._close(current_time(), id)

    def _close(self, timestamp, id):
        if id in self.ids:
            jid = self.ids.pop(id)
            ids = self.jids.get(jid, set())
            ids.discard(id)
            if not ids:
                self.jids.pop(jid, None)
        self.db.set_obj(timestamp, id, None)

    def _open(self, timestamp, id, jid, obj):
        self._close(timestamp, id)

        self.ids[id] = jid
        self.jids.setdefault(jid, set()).add(id)
        self.db.set_obj(timestamp, id, obj)

    def query(self, start=None, end=None):
        start = None if start is None else start * 10**6
        end = None if end is None else end * 10**6

        self.commit()
        for start, end, obj in self.db.query(start, end):
            start = int(start * 10**-6)
            end = None if end is None else int(end * 10**-6)
            yield start, end, marshal.loads(obj)

    def histogram(self, id, h_start, h_end, step):
        self.commit()

        step = 2**max(0, int(math.ceil(math.log(step, 2))))
        h_start = step * math.floor(h_start / step)
        h_end = step * math.ceil(h_end / step)

        deltas = dict()
        deltas[h_start] = 0
        for start, end, obj in self.db.query(h_start * 10**6, h_end * 10**6):
            start *= 10**-6
            start -= start % step
            deltas[start] = deltas.get(start, 0) + 1

            if end is not None:
                end *= 10**-6
                end += step - end % step
                deltas[end] = deltas.get(end, 0) - 1

        data = list()
        count = 0
        for time, delta in sorted(deltas.items()):
            count += delta
            if h_start <= time < h_end:
                if not data or data[-1]["value"] != count:
                    data.append(dict(offset=int(time-h_start), value=count))

        result = dict(id=id, start=h_start, end=h_end, step=step, values=data)
        element = xmlcore.Element("histogram", xmlns=NS)
        element.text = json.dumps(result)
        return element

class QuerySet(object):
    def __init__(self):
        self.ids = dict()

    def __nonzero__(self):
        for query, amounts in self.ids.itervalues():
            if amounts:
                return True
        return False

    def start(self, jid, id, query):
        self.ids[(jid, id)] = query, collections.deque()

    def load(self, jid, id, size):
        if (jid, id) in self.ids:
            query, sizes = self.ids[(jid, id)]
            sizes.append(size)

    def discard_jid(self, discarded_jid):
        for (jid, id) in list(self.ids):
            if jid == discarded_jid:
                del self.ids[(jid, id)]

    def __iter__(self):
        for (jid, id), (query, sizes) in list(self.ids.iteritems()):
            if not sizes:
                continue

            events = list()
            result = dict(id=id)

            while sizes[0] > 0 and len(events) < 10:
                sizes[0] -= 1

                try:
                    start, end, event_dict = query.next()
                except StopIteration:
                    result.update(done=True)
                    del self.ids[(jid, id)]
                    break
                else:
                    event_info = dict(start=start, event=event_dict)
                    if end is not None:
                        event_info.update(end=end)
                    events.append(event_info)
                    result.update(events=events)

            result.update(remains=sizes[0])
            if sizes[0] <= 0:
                sizes.popleft()

            element = xmlcore.Element("dump", xmlns=NS)
            element.text = json.dumps(result)
            yield jid, element

class HistorianService(bot.ServiceBot):
    bot_state_file = bot.Param()

    def __init__(self, bot_state_file=None, **keys):
        bot.ServiceBot.__init__(self, bot_state_file=None, **keys)

        self.rooms = taskfarm.TaskFarm(self.handle_room)
        self.db_dir = bot_state_file
        try:
            os.makedirs(self.db_dir)
        except OSError, ose:
            if errno.EEXIST != ose.errno:
                raise ose

    @idiokit.stream
    def session(self, state, src_room):
        try:
            yield self.rooms.inc(src_room)
        except services.Stop:
            idiokit.stop()

    @idiokit.stream
    def handle_room(self, name):
        db_file = os.path.join(self.db_dir, name)
        db = EventDB(db_file)

        try:
            self.log.info("Joining room %r", name)
            room = yield self.xmpp.muc.join(name, self.bot_name)
            self.log.info("Joined room %r", name)

            try:
                yield room | self.parse(db) | self.commit(db)
            finally:
                self.log.info("Left room %r", name)
        finally:
            db.close()

    @idiokit.stream
    def _timeout(self, timeout):
        yield timer.sleep(timeout)
        raise Timeout()

    @idiokit.stream
    def parse(self, db):
        queries = QuerySet()

        while True:
            next = idiokit.next()
            if queries:
                idiokit.pipe(self._timeout(0.0), next)

            try:
                elements = yield next
            except Timeout:
                pass
            else:
                for element in elements.with_attrs("from"):
                    sender = JID(element.get_attr("from"))

                    if element.named("presence").with_attrs(type="unavailable"):
                        db.purge_jid(sender)
                        queries.discard_jid(sender)

                    for message in element.named("message"):
                        if not message.with_attrs(type="groupchat"):
                            continue

                        for event in events.Event.from_elements(message):
                            db.add_event(sender, event)

                    for query in element.named("message").children(ns=NS):
                        try:
                            args = json.loads(query.text)
                        except JSONDecodeError:
                            self.log.error("Invalid query data from %r: %r",
                                           sender, query.text)
                            continue

                        if "id" not in args:
                            self.log.error("Query without an ID from %r: %r",
                                           sender, args)
                            continue
                        id = args.get("id")

                        if query.named("start"):
                            start = args.get("start", None)
                            end = args.get("end", None)
                            queries.start(sender, id, db.query(start, end))
                            self.log.info("Start from %r: %r", sender, args)
                        elif query.named("load"):
                            if "size" in args:
                                queries.load(sender, id, args.get("size"))
                                self.log.debug("Load from %r: %r", sender, args)
                            else:
                                self.log.error("Load without an ID from %r: %r",
                                               sender, args)
                        elif query.named("histogram"):
                            start = args.get("start", None)
                            end = args.get("end", None)
                            step = args.get("step", None)
                            if None not in (start, end, step):
                                element = db.histogram(id, start, end, step)
                                self.xmpp.core.message(sender, element)
                                self.log.debug("Histogram from %r: %r",
                                               sender, args)
                        elif query.named("cancel"):
                            queries.cancel(sender, id)
                            self.log.info("Cancel from %r: %r", sender, args)

            for sender, element in queries:
                yield self.xmpp.core.message(sender, element)

    @idiokit.stream
    def commit(self, db, commit_interval=1.0):
        while True:
            yield timer.sleep(commit_interval)
            db.commit()

if __name__ == "__main__":
    HistorianService.from_command_line().execute()
