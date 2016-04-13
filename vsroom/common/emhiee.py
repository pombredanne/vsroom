import xml.etree.cElementTree as etree
from xml.etree.ElementTree import ElementTree
from abusehelper.core import events,bot,utils
from idiokit import util,threado,timer
from sys import exc_type as ParseError

#Elemtree throws different exception in python2.7
try:
  from xml.etree.ElementTree import ParseError
except ImportError:
    from xml.parsers.expat import ExpatError as ParseError

from abusehelper.core.config import load_module
from vsroom.common import id, geo

class EmhiEE(bot.PollingBot):
    poll_interval = bot.IntParam(default=60)
    url = "http://www.emhi.ee/ilma_andmed/xml/forecast.php?lang=eng"

    old_events = dict()
    @threado.stream
    def poll(inner, self,something):
        yield timer.sleep(5)
        self.log.info("Downloading %r", self.url)
        try:
            info, fileobj = yield inner.sub(utils.fetch_url(self.url))
        except utils.FetchUrlFailed, fuf:
            self.log.error("Downloading failed: %r", fuf)
            return
        self.log.info("Downloaded")
        tree = ElementTree()
        new_events = dict()
        try:
            tree.parse(fileobj)
        except (ParseError), e:
            self.log.info('Bad data from the source: %s', e)
            return
        tree = tree.findall('forecast')
        for event in parse(tree):
            event.add('source',self.url)
            if event.value('area',None) != None:
               area = event.value('area')
               if area not in geo.cache:
                self.log.warning('Area %s can not be turned into geocoordinates.' % ( area ))
               else:
                   event.add('latitude', geo.cache[area][0])
                   event.add('longitude', geo.cache[area][1])
            eid = event.value('id')
            new_events[eid] = event
            inner.send(event)

        # Bookkeeping
        for eid, event in new_events.iteritems():
            if self.old_events.get(eid, None) != event:
                inner.send(event)

        for eid in self.old_events:
            if eid not in new_events:
                clear = events.Event()
                clear.add("id", eid)
                inner.send(clear)
        self.old_events = new_events

def parse(tree):
    def _add(event,k,v):
        decode = util.guess_encoding

        key = decode(k.lower().strip())
        value = decode(v.strip())
        
        event.add(key,value)
        return event

    def _walk(tree,depth=0,path="",date=""):
        for node in tree:
            key = node.tag
            value = "%s" % (node.text)
            value = value.strip()
            if value != "":
                yield key, value


    for forecast in tree:
        if 'date' in forecast.attrib:
            date = forecast.attrib['date']
        # generic forecasts for estonia
        for nightday in 'night', 'day':
            for generic in forecast.findall('*'):
                
                ee_event = events.Event()
                for k,v in _walk(generic.findall('*')):
                    if len(v) > 120:
                        v = v[0:120] + "..."
                    ee_event = _add(ee_event,k,v)
                    ee_event = _add(ee_event, 'time', date + " " +nightday)
                    ee_event.add('area','Estonia')
            ee_event.add('id', id.create_id(ee_event,'name','time'))
            yield ee_event

        # cities
        # cities are lower in the hierarchy, below nigh/day, so we need to combine

        places = dict()
        for place in forecast.findall('night/place') + forecast.findall('night/wind'):
            name = place.find('name').text
            if name not in places:
                places[name] = set()

            for k,v in _walk(place.findall('*')):
                if k == 'phenomenon':
                    v = 'Night: ' + v
                
                places[name].add((k,v))
        for place in forecast.findall('day/place'):
            name = place.find('name').text
            if name not in places:
                places[name] = set()

            for k,v in _walk(place.findall('*')):
                if k == 'phenomenon':
                    v = 'Day: ' + v
                places[name].add((k,v))


        for place in places:
            place_event = events.Event()
            for k,v in places[place]:
                place_event = _add(place_event,k,v)
            place_event = _add(place_event, 'time', date + ' day')
            area = place_event.value('name', False)
            if area:
                place_event.clear('name')
                place_event.add('area', area)

            place_event.add('id', id.create_id(place_event,'area','time'))

            yield place_event

        # wind


def test():
    tree = ElementTree()
    tree.parse("test.xml")
    tree = tree.findall('forecast')
    parse(tree)

if __name__ == '__main__':
    EmhiEE.from_command_line().execute()    
#    test()
