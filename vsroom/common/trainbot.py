from abusehelper.core import bot, events
from abusehelper.contrib.rssbot.rssbot import RSSBot

class TrainBot(RSSBot):
    feeds = bot.ListParam("RSS feed urls.")

    def create_event(self, **keys):
        id = keys.get("guid", None)
        location = keys.get("{http://www.georss.org/georss}point", None)
        if None in [id, location]:
            return None

        event = events.Event()
        event.add("feed", "VR")
        event.add("id", id)

        url = keys.get("source", None)
        if url:
            event.add("source", url)

        location = location.split(" ")
        latitude = location[0]
        longitude = location[1]
        event.add("latitude", latitude)
        event.add("longitude", longitude)

        description = "Train %s" % id
        _from = keys.get("from", None)
        if _from:
            event.add("from", _from)
            description += " from %s" % _from

        to = keys.get("to", None)
        if to:
            event.add("to", to)
            description += " to %s" % to

        event.add("description", description)

        direction = keys.get("dir", None)
        if direction:
            event.add("direction", direction)

        return event

if __name__ == "__main__":
    TrainBot.from_command_line().run()
