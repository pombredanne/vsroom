from abusehelper.core import events
import time
import re

from vsroom.common import sanitizer
from vsroom.common import timeconversion

relations = dict()

relations[('user','emt')] = [dict(sector='comm',service='mobile',basis='organization')]
relations[('user','esteid')] = [dict(sector='comm',service='auth',basis='organization')]
relations[('user','f-secure')] = [dict(sector='comm',service='abuse',basis='organization')]
relations[('user','linxtelecom')] = [dict(sector='comm',service='data',basis='organization')]
relations[('user','seb bank')] = [dict(sector='finance',service='general',basis='organization')]
relations[('user','swedbank')] = [dict(sector='finance',service='general',basis='organization')]
relations[('user','shadowserver')] = [dict(sector='comm',service='abuse',basis='organization')]
relations[('user','team cymru')] = [dict(sector='comm',service='abuse',basis='organization')]

def assign_affected_targets(event):
    event_list = list()
    subtype = event.value('user', None)
    if ('user', subtype) in relations:
        for add in relations[('user', subtype)]:
            event2 = events.Event(event)
            for k,v in add.iteritems():
                event2.clear(k)
                event2.update(k,[v])
                event_list.append(event2)
    else:
        return [event]
    return event_list

class WeatherRelationsGenerator(sanitizer.Sanitizer):

    def sanitize(self, event):
        # if only one key (id) -> clearing event. No use to
        # add sanitized stuff
        if len(event.keys()) < 2:
            return [event]

        events = assign_affected_targets(event)
        return events
    
if __name__ == "__main__":
    # Execute the sanitizer bot based on the command line options.
    WeatherRelationsGenerator.from_command_line().execute()
