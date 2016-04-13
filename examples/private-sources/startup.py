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

    # Bots that provide services gather in lobby.  This room
    # is used for communicating configuration to different
    # bots.
    service_room="vsr"
    
    vsr_mail_user=None
    vsr_mail_password=None
    vsr_mail_server=None
    vsr_mail_port=None
    seire_filter=None
    aso_filter=None

    def __init__(self, name, **attrs):
        self.attrs = dict(
            # Overwrite these only when you really know what you are doing.
            bot_name=name,
            module="abusehelper.core."+name,
            
            # Uncomment the following line, and the bots will keep
            # persistent state.
            #
            # Don't enable state for now, because VSR (historian4) state logic 
            # is different from AbuseHelper. States should not be kept over 
            # the restart.
            #
            #bot_state_file=relative_path("state", name + ".state"),

            # Uncomment the following line, and instead of printing to the
            # console the bots will log to files.
            #log_file=relative_path("log", name + ".log"),

            xmpp_jid=self.xmpp_jid,
            xmpp_password=self.xmpp_password,
            service_room=self.service_room
            )
        self.attrs.update(attrs)

    def startup(self):
        return self.attrs

def configs():

    #load bots from abusehelper.core
    yield Bot("runtime", 
            config=relative_path("runtime.py"))

    # load bots from custom/ directory
    yield Bot("seire",  module="vsroom.common.seire",
              mail_user=Bot.vsr_mail_user,
              mail_password=Bot.vsr_mail_password,
              mail_server=Bot.vsr_mail_server,
              mail_port=Bot.vsr_mail_port,
              filter=Bot.seire_filter,
              )

    yield Bot("nagios.aso", module="vsroom.common.nagiosmailreport",
              mail_user=Bot.vsr_mail_user,
              mail_password=Bot.vsr_mail_password,
              mail_server=Bot.vsr_mail_server,
              mail_port=Bot.vsr_mail_port,
              organization='aso',
              filter=Bot.aso_filter)

    yield Bot("nagios.aso.sanitizer", module="vsroom.common.sanitizers.nagiosmailreport")
    yield Bot("seire.sanitizer", module="vsroom.common.sanitizers.seire")
    yield Bot("abusehelper.sanitizer", module="vsroom.common.sanitizers.ah")

    #netpilots = ['netpilot-malware','netpilot-portals','netpilot-phishing','netpilot-spam']
    netpilots = []
    for netpilot in netpilots:
        yield Bot(netpilot, module="abusehelper.contrib.bridgebot.bridgebot",
                  xmpp_src_jid='<username>',
                  xmpp_src_password='<password>',
                  xmpp_src_room=netpilot.split('-')[1],
                  xmpp_dst_jid=Bot.xmpp_jid,
                  xmpp_dst_password=Bot.xmpp_password,
                  xmpp_dst_room='vsr.sources.%s' % (netpilot))

    #for netpilot in netpilots:
    #    yield Bot('%s.sanitizer' % (netpilot), module=relative_path('custom','%s.sanitizer.py' % (netpilot)))
