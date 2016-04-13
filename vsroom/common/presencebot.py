#!/usr/bin/python


from idiokit import threado
from idiokit.jid import JID
from abusehelper.core import bot, events

from abusehelper.core.config import load_module
from vsroom.common import timeconversion

class PresenceBot(bot.XMPPBot):
    xmpp_rooms = bot.ListParam("comma separated list of XMPP "+
                               "rooms presencebot should watch. "+
                               "(e.g. room@conference.example.com, "+
                               "room2@conference.example.com)")
                               
    @threado.stream
    def main(inner, self):
        xmpp = yield inner.sub(self.xmpp_connect())
        rooms = list()
        for name in self.xmpp_rooms:
            self.log.info("Joining room %r", name)
            room = yield inner.sub(xmpp.muc.join(name, self.bot_name))
            self.log.info("Joined room %r", name)
            roompipe = yield inner.sub(room | self.xmpp_to_log(room.nick_jid, room.participants) | events.events_to_elements() | room)
            rooms.append(roompipe)
        for room in rooms:
            print 'room', room
            yield inner.sub(threado.pipe(room))

    def joined(self,name):
        event = events.Event()
        start = timeconversion.local_iso()
        event.add('description', '%s - room - %s present. ' % (start, name.resource))
        event.add('id', name.resource)
        event.add('type', 'presence')
        return event

                       
    @threado.stream
    def xmpp_to_log(inner, self, own_jid, participants):
        in_room = set()
        for participant in  participants:
            in_room.add(participant.name.resource)
            event = self.joined(participant.name)
            inner.send(event)

        while True:
            elements = yield inner
            for message in elements:

                sender = JID(elements.get_attr("from"))
                if sender == own_jid:
                    continue
                if sender.resource is None:
                    continue

                resource = sender.resource.encode("unicode-escape")
                bare = unicode(sender.bare()).encode("unicode-escape")

                type = message.get_attr("type", None)
                if type == "unavailable":
                    if sender.resource in in_room:
                        in_room.discard(sender.resource)
                        self.log.info("* %s left the room %s.", resource, bare)
                        #clear event
                        event = events.Event()
                        event.add('id', sender.resource)
                        inner.send(event)
                else:
                    if sender.resource not in in_room:
                        in_room.add(sender.resource)
                        self.log.info("* %s entered the room %s.", sender.resource, bare)
                        event = self.joined(sender)
                        inner.send(event)

if __name__ == "__main__":
    PresenceBot.from_command_line().run()
