import xml.etree.cElementTree as etree
from xml.etree.ElementTree import ElementTree
from abusehelper.core import events,bot,utils
from idiokit import util,threado,timer


from vsroom.common import id

class EmhiEE(bot.PollingBot):
    poll_interval = bot.IntParam(default=60)
    url = "http://www.emhi.ee/ilma_andmed/xml/forecast.php?lang=eng"
    @threado.stream
    def poll(inner, self,something):
        yield timer.sleep(1)
        self.log.info("Downloading %r", self.url)
        try:
            info, fileobj = yield inner.sub(utils.fetch_url(self.url))
        except utils.FetchUrlFailed, fuf:
            self.log.error("Downloading failed: %r", fuf)
            return
        self.log.info("Downloaded")
        tree = ElementTree()
        tree.parse(fileobj)
        tree = tree.findall('forecast')
        for event in parse(tree):
            inner.send(event)

@threado.stream
def parse(inner,tree):
    def _add(event,k,v):
        decode = util.guess_encoding

        key = decode(k.lower().strip())
        value = decode(v.strip())
        
        if key == 'tempmax' or key == 'tempmin':
            key = 'temp'
        event.add(key,value)
        event.add('time', date + " " +nightday)
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
        for nightday in 'night', 'day':
            for generic in forecast.findall('*'):
                event = events.Event()
                for k,v in _walk(generic.findall('*')):
                    event = _add(event,k,v)
                    event = _add(event, 'time', date + " " +nightday)
                inner.send(event)
                for place in forecast.findall(nightday + '/place'):
                    event = events.Event()
                    for k,v in _walk(place.findall('*')):
                        event = _add(event,k,v)
                        event = _add(event, 'time', date + " " +nightday)
                    event.add('id', id.create_id(event,'name','time'))
                    inner.send(event)

                for place in forecast.findall(nightday + '/wind'):
                    event = events.Event()
                    for k,v in _walk(place.findall('*')):
                        event = _add(event,k,v)

                    event.add('id', id.create_id(event,'name','time'))
                    inner.send(event)


def test():
    tree = ElementTree()
    tree.parse("blah2.xml")
    tree = tree.findall('forecast')
    parse(tree)

if __name__ == '__main__':
    EmhiEE.from_command_line().execute()    
#    test()
