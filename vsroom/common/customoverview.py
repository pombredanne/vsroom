import time
import collections
from overviewbot import OverviewBot, Window

def format_time(timestamp):
    return time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime(timestamp))

class CustomWindow(Window):
    def __init__(self, input_key, *args, **keys):
        Window.__init__(self, *args, **keys)

        self.input_key = input_key
        self.values = dict()

    def added(self, event):
        for value in event.values(self.input_key):
            self.values[value] = self.values.get(value, 0) + 1

    def discarded(self, event):
        for value in event.values(self.input_key):
            self.values[value] = self.values.get(value, 0) - 1
            if self.values[value] <= 0:
                del self.values[value]

    def value(self):
        if not self.values:
            return None

        if len(self.values) == 1:
            return self.values.keys()[0]

        return "%d unique values" % len(self.values)

class _Seen(Window):
    def __init__(self, *args, **keys):
        Window.__init__(self, *args, **keys)

        self._times = collections.deque()

    def added(self, _):
        self._times.append(time.time())

    def discarded(self, _):
        self._times.popleft()

    def _firstseen(self):
        if self._times:
            return format_time(self._times[0])
        return None

    def _lastseen(self):
        if self._times:
            return format_time(self._times[-1])
        return None

class FirstSeen(_Seen):
    def value(self):
        return self._firstseen()

class LastSeen(_Seen):
    def value(self):
        return self._lastseen()

class CustomOverviewBot(OverviewBot):
    def aggregates(self):
        result = dict(OverviewBot.aggregates(self))
        result["custom"] = CustomWindow
        result["firstseen"] = FirstSeen
        result["lastseen"] = LastSeen
        return result

if __name__ == "__main__":
    CustomOverviewBot.from_command_line().execute()
