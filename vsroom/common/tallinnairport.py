from idiokit import threado,timer
from abusehelper.core import bot
import re
from abusehelper.core import utils, events
import hashlib

# Note, create_id already in several places.
def create_id(event, *keys, **extra):
    digest = hashlib.md5()
    for key in sorted(extra.keys()):
        digest.update(extra[key].encode("utf-8"))

    for key in sorted(keys):
        for value in event.values(key):
            digest.update(value.encode("utf-8"))
    return digest.hexdigest()

class TallinnAirport(bot.PollingBot):
    poll_interval = bot.IntParam(default=300)

    @threado.stream
    def poll(inner, self,something):
        yield timer.sleep(2)

        depurl="http://xtra.tllapt.ee/taru/dep_en.html"
        arrurl="http://xtra.tllapt.ee/taru/arr_en.html"
        for ( subtype, url ) in [('departures', depurl), ('arrivals',arrurl)]:

            self.log.info("Downloading %r", url)
            try:
                info, fileobj = yield inner.sub(utils.fetch_url(url))
            except utils.FetchUrlFailed, fuf:
                self.log.error("Downloading failed: %r", fuf)
                return
            self.log.info("Downloaded")

            utilization = get_metrics(fileobj)
            event = events.Event()
            event.add('source',url)
            event.add('utilization',utilization)
            event.add('service','airports')
            event.add('subtype',subtype)
            event.add('id', create_id(event,'tallinnairpoirt','subtype'))
            event.add('longitude','24.799303')
            event.add('latitude','59.4165212')


            yield inner.send(event)
        
def get_metrics(fileobj):

    txt = fileobj.read()
    all = float(len(re.findall('tr class="even"|tr class="odd"',txt)))
    cancelled = float(len(re.findall('Cancelled',txt)))
    if all < 1: return 'No data'
    percentage =  (all - cancelled) / all * 100
    percentage = (str(int(round(percentage))))
    return percentage

if __name__ == "__main__":

    TallinnAirport.from_command_line().execute()

