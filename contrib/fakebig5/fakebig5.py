# (c) 2011: Hillar Aarelaid and Clarified Networks

from abusehelper.core import bot,events

from idiokit import timer, threado
from idiokit.xmlcore import Element
from abusehelper.core.config import load_module
import random


SECTORS = ['communication','transport','finance','energy','waste']

#TODO add more REAL services..
SERVICES = {}
SERVICES[SECTORS[0]]=['media','phone','data']
SERVICES[SECTORS[1]]=['air','road','rail','water','space']
SERVICES[SECTORS[2]]=['cash','cards','netbanks','interbanking','cold','silver']
SERVICES[SECTORS[3]]=['generator','highV distr','lowV distr']
SERVICES[SECTORS[4]]=['water','waste']


TYPES = ['high load','low buffer','no service']
#TODO rename subtypes to reasons,and ad more REAL reasons..
SUBTYPES = {}
SUBTYPES[TYPES[0]]=['customers+', 'hardware-','attack']
SUBTYPES[TYPES[1]]=['supply delay','high load','bomb','whatever other reason']
SUBTYPES[TYPES[2]]=['natural force','mechanical error','human error','attack']




class FakeBig5Bot(bot.XMPPBot):
    room_dst = bot.Param("the destination room")

    @threado.stream
    def main(inner,self):
        conn = yield self.xmpp_connect()
        dst = yield conn.muc.join(self.room_dst, self.bot_name)
        self.log.info("Joined room %r", self.room_dst),dst

        yield generate() | events_to_elements_with_delay_element() |  dst | threado.dev_null()


@threado.stream
def events_to_elements_with_delay_element(inner):

    while True:
        event = yield inner

        stamp = event.value('start')
        eid = event.value('id')
        body = Element("body")
        body.text = events._escape(unicode(event))
        #set delay for faking the event arrival time
        delay = Element("delay")
        delay.text = "Greetings earthlings"
        delay.set_attr("xmlns", 'urn:xmpp:delay')
        strstamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.strptime(stamp,"%Y-%m-%d %H:%M:%S"))
        delay.set_attr("stamp", strstamp)
        inner.send(body, event.to_element(),delay)

        stamp = event.value('end')
        body = Element("body")
        close_event = events.Event()
        close_event.add('id',eid)
        body.text = events._escape(unicode(close_event))
        #set delay for faking the event arrival time
        delay = Element("delay")
        delay.text = "Greetings earthlings"
        delay.set_attr("xmlns", 'urn:xmpp:delay')
        strstamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.strptime(stamp,"%Y-%m-%d %H:%M:%S"))
        delay.set_attr("stamp", strstamp)
        inner.send(body, close_event.to_element(),delay)

@threado.stream
def generate(inner,delay=10):

    #make some random for last week
    for i in range(0,300):
        inner.send(create_a_event(60*60*24*7))
    #ddos tartu university for 4 days scaling up ..
    for i in range(0,100):
        inner.send(create_a_event(60*60*24*4,0,2,1,2,58.36,58.37,26.68,26.69))
    for i in range(0,200):
        inner.send(create_a_event(60*60*24*3,0,2,1,2,58.36,58.37,26.68,26.69))
    for i in range(0,300):
        inner.send(create_a_event(60*60*24*2,0,2,1,2,58.36,58.37,26.68,26.69))
    #and add some traffic accidents in Parnu road
    for i in range(0,100):
        inner.send(create_a_event(60*60*24*2,1,1,None,None,58.3,59.4,24.6,24.8))

    #more big dynamo load, spin faster.. ;)
    for i in range(0,100):
        inner.send(create_a_event(60*60*24*4,3,0,0,1, 59.27,59.35,26.75,27.8))
    for i in range(0,100):
        inner.send(create_a_event(60*60*24*3,3,0,0,1, 59.28,59.34,26.75,27.8))
    for i in range(0,100):
        inner.send(create_a_event(60*60*24*2,3,0,0,1, 59.29,59.33,26.75,27.8))


    while True:
        #keep bombing rail between narva and tallinn for last 3 hours ...
        inner.send(create_a_event(60*60*3,1,2,1,2, 59.29,59.33,24.75,27.8))
        yield timer.sleep(delay)

# ---------------------------------


def create_a_event(n_timespan = 60*60, #default last hour only
                   n_sector = None,
                   n_service = None,
                   n_type = None,
                   n_reason = None,
                   lae = 57.8, # default is EE
                   law = 59.39,
                   lon = 23.5,
                   los = 28):

        event = events.Event()
        #set time and place
        event.add('latitude',str(random.uniform(lae,law)))
        event.add('longitude',str(random.uniform(lon,los)))
        event.add('time', gettime(random.randint(1,n_timespan)))
        #something wrong with this...vsr does not take start end 'in' ;(
        event.add('start', gettime(random.randint(1,n_timespan)))
        event.add('end', gettime(-(random.randint(1,n_timespan))))
        # create some damage numbers
        i = random.randint(1,10)
        v = random.randint(1,10)
        event.add('impact',str(i)) #humans
        event.add('value',str(v)) #money
        event.add('damage',str((i*v/10))) #humans*money
        # ..sector, service..
        sector = getsector(n_sector)
        event.add('sector',sector)
        service = getservice(sector,n_service)
        event.add('service',service)
        #what is a problem
        type = gettype(n_type)
        event.add('type', type)
        reason = getreason(type,n_reason)
        event.add('reason',reason)
        #who had (reported) problem
        provider = getprovider(service)
        customer = getcustomer(provider)
        event.add('provider',provider)
        #make customers report more than providers
        #providers are buzzy anyway with their problem,
        #and customers just waiting...
        g = random.randint(0,9)
        if g < 7:
            event.add('customer',customer)
        myid = ''+sector+service+type+reason+provider
        event.add('id',myid)
        return event






import time
def gettime(minus=0):
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(time.time() - minus))

def getsector(n=None):
    if n==None: n = random.randint(0,len(SECTORS)-1)
    return SECTORS[n]

def getservice(s,n=None):
    if n == None : n = random.randint(0,len(SERVICES[s])-1)
    print s,n
    return  SERVICES[s][n]

def gettype(n=None):
    if n==None: n = random.randint(0,len(TYPES)-1)
    return TYPES[n]

def getreason(s,n=None):
    if n == None : n = random.randint(0,len(SUBTYPES[s])-1)
    return  SUBTYPES[s][n]

def getprovider(service):
    return str(random.randint(1,99))+'_provider'

def getcustomer(provider):
    return str(random.randint(1,99))+'_customer'


if __name__ == '__main__':
    FakeBig5Bot.from_command_line().run()




