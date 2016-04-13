import xml.etree.cElementTree as etree
import time
from xml.etree.ElementTree import ElementTree
from xml.parsers.expat import ExpatError

from abusehelper.core import events, bot,utils
from idiokit import util,threado,timer
import re
from vsroom.common import id
from vsroom.common import geo

TABLE_REX = re.compile("(<table.*?>.*?</table>)", re.I | re.S)

class MeteoAlarmBot(bot.PollingBot):
    poll_interval = bot.IntParam(default=60)
    url = bot.Param(default="http://www.meteoalarm.eu/documents/rss/ee.rss")
    cc = bot.Param(default="EE")
    # You can also have file: url for testing,e.g.
    # url = "file:///<path>/vsroom/examples/public-sources/custom/ee.rss"
    
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
        try:
            tree.parse(fileobj)
        except ExpatError,e:
            self.log.error("Parsing source failed, %r", e)
            return


        tree = tree.findall('channel')
        new_events = dict()
        for event in parse(tree):
            event.add('source',self.url)
            event.add('organization','Meteoalarm')        
            event.add('cc', self.cc)
            area = event.value('area',False)

            if area not in geo.cache:
                self.log.warning('Area %s can not be turned into geocoordinates.' % ( area ))

            if area in geo.cache:
                event.add('latitude', geo.cache[area][0])
                event.add('longitude', geo.cache[area][1])


            eid = id.create_id(event, 'area','day','wtype')
            #debug to follow that bug was actually fixed
            if event.values('id',False): self.log.warning('Event already had id: %s' % (event.values('id')))
            event.add('id',eid)
            new_events[eid] = event

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

    def _parse_body(event, table):
        #each warning is in own body, 
        for body in re.findall('<tbody.*?>(.*?)</tbody>',table,re.I|re.S):
            problem_event = events.Event(event)

            #add multi-warning support if it turns out that source reports them
            descr = re.search('<td align="left">.*?en:.*?(.*?)<p>',body, re.I|re.S)

            if descr:
                descr = descr.group(1)
                problem_event = _add(problem_event,'description', descr)
                
            valid = re.search('<p>(.*)</p>',body)
            if valid:
                valid = valid.group(1)
                valid = re.sub('<.*?>','',valid)
                problem_event = _add(problem_event,'valid',valid)
                
            for lvl, wtype in re.findall('(lvlbox\d{1,2}.gif).*?(wtype\d{1,2}.gif)',body,re.I|re.S):
                problem_event = _add(problem_event,'level',lvl)
                problem_event = _add(problem_event,'wtype',wtype)
            

            yield problem_event

    def _add(event,k,v):
        decode = util.guess_encoding

        key = decode(k.lower().strip())
        value = decode(v.strip())
        
        event.add(key,value)
        return event

    for item in tree:
        for generic in item.findall('item/*'):
            if generic.tag == 'title':
                location = generic.text

            if generic.tag == 'description':
                description = generic.text

                if description != None:
                    for table in re.findall('<table.*?>(.*?)</table>',description,re.I|re.S):
                        for day in re.findall('<th align="left">(.*?)</th>',table,re.I|re.S):
                            current_day = day.strip()
                            
                        for head in re.findall('<thead.*?>(.*?)</thead>',table,re.I|re.S):
                            event = events.Event()
                            if event.values('id',False): print 'new event, but still id: ' ,event.values('id')
                            event = _add(event, 'area', location)
                            event = _add(event, 'day', current_day)
                            if current_day == "Tomorrow":
                                event = _add(event, 'timing', 'within 1 day')
                            lvl = re.search('(lvlbox\d.gif)',head,re.I|re.S)
                            if lvl:
                                event = _add(event,'generic_level',lvl.group(1))
                            if event.values('id',False): print 'head has id', event.values('id')
                            event1 = events.Event(event)
                            yield event

                        for problem_event in _parse_body(event1, table):
                            yield problem_event

if __name__ == '__main__':
   MeteoAlarmBot.from_command_line().execute()    
