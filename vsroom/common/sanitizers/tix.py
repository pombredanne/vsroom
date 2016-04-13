import time
from vsroom.common import sanitizer
from vsroom.common import timeconversion



class TixSanitizer(sanitizer.Sanitizer):
    # .sanitize(event) is the hook method for sanitizing events. This
    # is the only method you have to implement to create a basic
    # normalizer, sanitizer, modifier or filter.
    def _get_problem(self,value):
        problem = value - 20
        if problem < 0:
            problem = 0
        return int(problem)

    def sanitize(self, event):
        # if only one key (id) -> clearing event. No use to
        # add sanitized stuff
        if len(event.keys()) < 2:
            return [event]

        event.add("sector","comm")
        event.add("service", "data")
        event.add("type", "utilization")

        inutilization = event.value('inutilization','')
        oututilization = event.value('oututilization','')
        try:
            inutilization_value = float(inutilization)
            oututilization_value = float(oututilization)
        except ValueError, e:
            pass
        else:
            value = max([inutilization_value,oututilization_value])
            problem = self._get_problem(value)
            if problem > 0:
                event.add('problem',unicode(problem))
            event.add('status', unicode(problem))

        isotime = timeconversion.seconds2iso(time.time())

        event.add("asset", "port: %s" % (event.value('customer','')))
        customer = event.value('customer','')
        
        description = '%s - %s - utilization: in/out %%: %s/%s - %s ' % \
            (isotime,event.value('organization',''),
             inutilization, oututilization, customer)
        event.add("description", description)

        # Return a list of events here. The list can contain 0-n events.
        return [event]
    
if __name__ == "__main__":
    # Execute the sanitizer bot based on the command line options.
    TixSanitizer.from_command_line().execute()
