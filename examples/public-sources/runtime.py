from abusehelper.core import rules
from abusehelper.core.runtime import *
from abusehelper.core.config import load_module

startup = load_module("startup")

class CriticalService(object):
    prefix = startup.Bot.service_room
    services = prefix + ".services"

    def __init__(self, name,**keys):
        self.name = name

        for key, value in keys.items():
            setattr(self, key, value)

    def __iter__(self):
        sources_specific = self.prefix + ".services." + self.name

        yield (Session(self.name)
               | Room(sources_specific)
               | Session(self.name + ".sanitizer")
               | Room(self.services))

class Bridge(object):
    prefix = startup.Bot.service_room
    def __init__(self,name, src, dst):
        self.name = name
        self.src = src
        self.dst = dst

    def __iter__(self):
        yield (Room(self.prefix + "." + self.src)
               | Session('roomgraph')
               | Room(self.prefix + "." + self.dst))

class Twitter(object):
    
    def __init__(self, name,**keys):
        self.name = name
        self.keys = keys
        self.prefix = CriticalService.prefix
        for key, value in keys.items():
            setattr(self, key, value)

    def __iter__(self):
        sources_specific = self.prefix + "." + self.name + "." + self.keys['user']
        yield (Session(self.name,**self.keys)
               | Room(sources_specific)
               | Session("twitterbot.relations")
               | Room(self.prefix + "." + 'microblogs')
               | Session('roomgraph')
               | Room(self.prefix + "." + 'status'))

class Weather(object):
    prefix = startup.Bot.service_room
    services = CriticalService.services
    weather = prefix + ".weather"

    def __init__(self,name, **keys):
        self.name = name
        self.weather_specific = "%s.%s" % (self.weather, self.name)
        for key,value in keys.items():
            setattr(self, key, value)

    def __iter__(self):
        rule = rules.CONTAINS(type=self.name)
        yield (Session(self.name)
               | Room(self.weather_specific)
               | Session(self.name + ".sanitizer")
               | Room(self.weather))

class Relations(object):
    prefix = startup.Bot.service_room
    def __init__(self, name):
        self.name = name
        
    def __iter__(self):
        yield (Room(self.prefix + "." + self.name)
               | Session(self.name + ".relations")
               | Room(self.prefix + ".status"))

class InternetAbuse(object):
    prefix = startup.Bot.service_room

    def __init__(self, name,**keys):
        self.name = name

        for key, value in keys.items():
            setattr(self, key, value)

    def __iter__(self):
        yield (Room(self.prefix + ".source.abusehelper")
               | Session(self.name + ".sanitizer")
               | Room(self.prefix+ '.abuse'))

# This time we join historian separately from other classes
class Historian(object):
    prefix = startup.Bot.service_room

    def __init__(self, name,**keys):
        self.name = name

        for key, value in keys.items():
            setattr(self, key, value)

    def __iter__(self):
        yield (Room(self.prefix + "." + self.name)
               | Session('historian'))

def configs(): 

    #critical services
    yield CriticalService("energiaee")
    yield CriticalService("tallinnairport")
    yield CriticalService("tix")

    # information affecting to critical services
    yield Weather("meteoalarm.ee")
    yield Weather("emhiee")
    yield Bridge("weather","weather","status")
    yield InternetAbuse("abusehelper")

    yield Historian("weather")

    yield Relations("abuse")
    yield Historian("abuse")

    yield Bridge("services","services","status")

    yield Historian("services")
    yield Historian("status")
    yield Historian("microblogs")
    yield Twitter("twitterbot",user="vsroom")

