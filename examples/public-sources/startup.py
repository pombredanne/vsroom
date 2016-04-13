import os
from abusehelper.core.config import *
from abusehelper.core.startup import *

def locate(*path):
    base_dir, _ = os.path.split(__file__)
    return os.path.abspath(os.path.join(base_dir, *path))


class Bot(object):
    # The default credentials which for logging in to the XMPP
    # service.

    xmpp_jid="xmpp_user@example.com"
    xmpp_password="xmpp_password"

    #twitter
    consumer_key=None
    consumer_secret=None
    access_token_key=None
    access_token_secret=None
    # Bots that provide services gather in lobby.  This room
    # is used for communicating configuration to different
    # bots.
    service_room="vsr"
            

    def __init__(self, name, **attrs):
        self.attrs = dict(
            # Overwrite these only when you really know what you are doing.
            bot_name=name,
            module="vsroom.common."+name,
            
            # Uncomment the following line, and instead of printing to the
            # console the bots will log to files.
            #log_file=relative_path("log", name + ".log"),

            xmpp_jid=self.xmpp_jid,
            xmpp_password=self.xmpp_password,
            service_room=self.service_room,

            )
        self.attrs.update(attrs)

    def startup(self):
        return self.attrs

def configs():

    #load bots from abusehelper.core

    yield Bot("runtime", module="abusehelper.core.runtime", config=relative_path("runtime.py"))
    yield Bot("roomgraph", module="abusehelper.core.roomgraph")
    #historian is an exception, it should keep state
    yield Bot("historian", module="vsroom.common.historian4",
              bot_state_file=relative_path("state", "historian.state"))

    # load bots from common/ directory
    common = ['energiaee', 'tallinnairport', 'tix', 'emhiee']
    for name in common:
        yield Bot(name)
        yield Bot("%s.sanitizer" % (name),module="vsroom.common.sanitizers.%s" % (name))

    # possibility to lauch several meteoalarm bots for different countries.
    weather = dict()
    weather['ee'] = 'http://www.meteoalarm.eu/documents/rss/ee.rss'

    for country, url in weather.iteritems():
        yield Bot("meteoalarm.%s" % (country), 
                  module="vsroom.common.meteoalarm",
                  url=url,
                  cc=country)
        yield Bot("meteoalarm.%s.sanitizer" % (country), 
                  module="vsroom.common.sanitizers.meteoalarm")

    yield Bot("xmppmicroblog", module="vsroom.common.xmppmicroblogbot",room=Bot.service_room+".microblogs")
    yield Bot("twitterbot", module="vsroom.common.twitterbot",
              consumer_key=Bot.consumer_key,
              consumer_secret=Bot.consumer_secret,
              access_token_key=Bot.access_token_key,
              access_token_secret=Bot.access_token_secret,
              poll_interval=60)
    yield Bot("twitterbot.relations", module="vsroom.common.relations.twitter")
    yield Bot("presence",module="vsroom.common.presencebot",xmpp_rooms=Bot.service_room+".status")
    yield Bot("abusehelper.sanitizer",module="vsroom.common.sanitizers.ah")
