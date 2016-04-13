from abusehelper.core import bot, events, utils
from idiokit import threado, timer
from abusehelper.core.config import load_module
id =  load_module("../../common/id.py")

class PositiumBot(bot.PollingBot):
    def feed_keys(self, path, **keys):
        return [path]

    @threado.stream
    def poll(inner, self, path):
        yield timer.sleep(1)
        self.log.info('Fetching population data from %s.' % path)

        try:
            info, fileobj = yield inner.sub(utils.fetch_url(path))
        except utils.FetchUrlFailed, fuf:
            self.log.error("Failed to fetch %s." % path)
            return
        except ValueError:
            try:
                fileobj = open(path, "r")
            except IOError:
                self.log.error("Failed to read %s." % path)
                return

        columns = fileobj.readline().rstrip().split(",")

        try:
            code = columns.index('"LAU_CODE"')
            start = columns.index('"TIME_FROM"')
            end = columns.index('"TIME_TO"')
            total = columns.index('"TOTAL"')
        except:
            return

        ftime = None
        count = 0
        for line in fileobj:
            line = line.rstrip().split(",")
            if not ftime:
                ftime = line[start]
            elif line[start] != ftime:
                break

            event = events.Event()
            event.add("from", line[start])
            event.add("to", line[end])
            event.add("lau_code", str(int(line[code].strip('"'))))
            event.add("population", line[total])
            event.add('id', id.create_id(event,'lau_code'))
            inner.send(event)
            count += 1

        if count > 0:
            self.log.info('Found population data for %i places.' % count)

if __name__ == "__main__":
    PositiumBot.from_command_line().execute()
