import socket
socket.setdefaulttimeout(20)
import time as _time
import httplib
try:
    import json
except ImportError:
    import simplejson as json

from idiokit import threado
from abusehelper.core import events, bot, taskfarm, services
from abusehelper.core.config import load_module

from decimal import Decimal, ROUND_HALF_UP, InvalidOperation

placecache = dict()

def getPlaceInfo(event):

    lat = event.value("latitude", None)
    lng = event.value("longitude", None)

    if not lat or not lng:
        return

    if (lat,lng) in placecache:
        return placecache[lat,lng]

    connection = httplib.HTTPConnection("ws.geonames.org")
    page = "/findNearbyPlaceNameJSON?lat=%s&lng=%s" % (lat, lng)
    connection.request("GET", page)


    response = connection.getresponse()
    if response.status != 200:
        return

    data = response.read()
    json_data = json.loads(data)
    if not json_data:
        return

    geonames = json_data.get("geonames", None)
    if not geonames:
        return

    info = dict()
    for key in geonames[0]:
        if key == "population":
            info["population"] = unicode(geonames[0][key])
        elif key.startswith("adminName"):
            info['county'] = unicode(geonames[0][key])

    if len(placecache) < 1000000:
        placecache[(lat,lng)] = info
    return info

def format_time(time_tuple=None):
    if time_tuple is None:
        time_tuple = _time.gmtime()
    return _time.strftime("%Y-%m-%d %H:%M:%S UTC", time_tuple)

def time(string, format="%Y-%m-%d %H:%M:%S"):
    try:
        parsed = _time.strptime(string, format)
    except ValueError:
        return None

    if _time.gmtime() < parsed:
        return None
    return format_time(parsed)

def ip(string):
    try:
        socket.inet_pton(socket.AF_INET, string)
    except socket.error:
        try:
            socket.inet_pton(socket.AF_INET6, string)
        except socket.error:
            return None
    return string

class Sanitizer(bot.ServiceBot):
    def __init__(self, **keys):
        bot.ServiceBot.__init__(self, **keys)
        self.rooms = taskfarm.TaskFarm(self.handle_room)
        self.srcs = taskfarm.Counter()

    @threado.stream
    def handle_room(inner, self, name):
        self.log.info("Joining room %r", name)
        room = yield inner.sub(self.xmpp.muc.join(name, self.bot_name))
        self.log.info("Joined room %r", name)
        try:
            yield inner.sub(events.events_to_elements()
                            | room
                            | events.stanzas_to_events()
                            | self.distribute(name))
        finally:
            self.log.info("Left room %r", name)

    @threado.stream
    def distribute(inner, self, name):
        while True:
            event = yield inner

            rooms = set(map(self.rooms.get, self.srcs.get(name)))
            rooms.discard(None)

            if not rooms:
                continue

            for sanitized_event in self.sanitize(event):
                for common_sanitized_event in self.common_sanitize(sanitized_event):
                    for room in rooms:
                        room.send(common_sanitized_event)

    @threado.stream
    def session(inner, self, _, src_room, dst_room, **keys):
        self.srcs.inc(src_room, dst_room)
        try:
            yield inner.sub(self.rooms.inc(src_room) | self.rooms.inc(dst_room))
        except services.Stop:
            inner.finish()
        finally:
            self.srcs.dec(src_room, dst_room)

    def common_sanitize(self,event):
        info = False
        try:
            info = getPlaceInfo(event)
        except (socket.error, httplib.HTTPException), e:
            self.log.warning('Could not get location information ' +
                             'for lat=%s, long=%s from ws.geonames.org: %s' % (event.value('latitude','None'),
                                                                              event.value('longitude','None'),
                                                                              e))

        if info:
            for key in info:
                event.add(key, info[key])
        return [event]

    def sanitize(self, event):
        return [event]


