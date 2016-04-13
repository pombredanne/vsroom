import time
import re

from vsroom.common import timeconversion
from vsroom.common import sanitizer


# sanitizer.Sanitizer is the base class for a simple sanitizer bot.
class AbuseHelperSanitizer(sanitizer.Sanitizer):
    # .sanitize(event) is the hook method for sanitizing events. This
    # is the only method you have to implement to create a basic
    # normalizer, sanitizer, modifier or filter.
    def sanitize(self, event):
        # if only one key (id) -> clearing event. No use to
        # add sanitized stuff

        # Return a list of events here. The list can contain 0-n events.
        descr = event.value('decription', False)
        if descr:
            event.add('description', descr)
            event.clear('decription')

        time_sec = event.value('time', False)
        if time_sec:
            event.clear('time')
            event.add('time', timeconversion.seconds2iso(time_sec))
        return [event]
    
if __name__ == "__main__":
    # Execute the sanitizer bot based on the command line options.
    AbuseHelperSanitizer.from_command_line().execute()
