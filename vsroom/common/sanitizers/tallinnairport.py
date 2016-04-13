import time
from vsroom.common import sanitizer
from vsroom.common import timeconversion

# sanitizer.Sanitizer is the base class for a simple sanitizer bot.
class TallinnAirportSanitizer(sanitizer.Sanitizer):
    # .sanitize(event) is the hook method for sanitizing events. This
    # is the only method you have to implement to create a basic
    # normalizer, sanitizer, modifier or filter.
    def sanitize(self, event):
        # if only one key (id) -> clearing event. No use to
        # add sanitized stuff
        if len(event.keys()) < 2:
            return [event]


        # Modify and create events here.
        utilization = event.value('utilization',None)
        try:
            uvalue = float(utilization)
        except ValueError, e:
            pass
        else:
            event.clear('status')
            event.clear('problem')
            if uvalue >99: 
                event.add('status','0')
            elif uvalue > 93:
                event.add('problem', '10')
                event.add('status', '10')
            else:
                event.add('problem', '50')
                event.add('status', '50')

        event.add("sector","transport")
        event.add("organization", "TLL")
        event.add("type", "utilization")
        event.add("asset","TLL")
        event.add("event type", "utilization")
        isotime = timeconversion.seconds2iso(time.time())
        description = "%s - %s - utilization: %s%% - %s" %  \
            (isotime, 
             event.value('organization',''),  
             utilization, 
             event.value('source','-'))
        event.add("description", description)


        # Return a list of events here. The list can contain 0-n events.
        return [event]
    
if __name__ == "__main__":
    # Execute the sanitizer bot based on the command line options.
    TallinnAirportSanitizer.from_command_line().execute()
