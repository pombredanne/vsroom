from abusehelper.core import rules
from abusehelper.core.runtime import *
from abusehelper.core.config import load_module

startup = load_module("startup")

class Source(object):
    prefix = startup.Bot.service_room
    countryservices = prefix + ".services"

    def __init__(self, name,**keys):
        self.name = name

        for key, value in keys.items():
            setattr(self, key, value)

    def __iter__(self):
        services_specific = self.prefix + ".services." + self.name

        yield (Session(self.name)
               | Room(services_specific)
               | Session(self.name + ".sanitizer")
               | Room(self.countryservices))

class InternetAbuse(object):
    prefix = startup.Bot.service_room

    def __init__(self, name,source='abuse',**keys):
        self.name = name
        self.source = source

        for key, value in keys.items():
            setattr(self, key, value)

    def __iter__(self):
        yield (Room(self.prefix + "." + self.source + "." + self.name)
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
    yield Source("seire")
    yield Source("nagios.aso")
    yield InternetAbuse("abusehelper","source")
    yield InternetAbuse("netpilot-spam")
    yield InternetAbuse("netpilot-malware")
    yield InternetAbuse("netpilot-portals")
    yield InternetAbuse("netpilot-phishing")
    yield Historian("source.abusehelper")
