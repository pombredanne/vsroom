import time
import re

from vsroom.common import sanitizer
from vsroom.common import timeconversion

typeconversion = dict()
typeconversion['wtype1.gif'] = 'wind'
typeconversion['wtype2.gif'] = 'snow'
typeconversion['wtype3.gif'] = 'thunder'
typeconversion['wtype4.gif'] = 'fog'
typeconversion['wtype5.gif'] = 'temperature'
typeconversion['wtype6.gif'] = 'cold'
typeconversion['wtype8.gif'] = 'fire'
typeconversion['wtype10.gif'] = 'rain'


problemconversion = dict()
problemconversion['lvlbox1.gif'] = 0
problemconversion['lvlbox2.gif'] = 30
problemconversion['lvlbox3.gif'] = 60
problemconversion['lvlbox4.gif'] = 90

# sanitizer.Sanitizer is the base class for a simple sanitizer bot.
class MeteoAlarmSanitizer(sanitizer.Sanitizer):

    def _get_problem(self,level):

        if level in problemconversion:
            return problemconversion[level]
        self.log.info('Can not interpret problem level %s ' % ( level )  )
        return level

    def _get_type(self,type):

        if type in typeconversion:
            return typeconversion[type]
        self.log.info('Can not interpret weather type %s.' % ( type )  )

        return type

    def sanitize(self, event):
        # if only one key (id) -> clearing event. No use to
        # add sanitized stuff
        if len(event.keys()) < 2:
            return [event]

        # variables for description
        now_iso = timeconversion.seconds2iso(time.time())

        event.add('service','weather')
        types = event.values('wtype')

        for type in types:
            event.add('type',self._get_type(type))

        problems = event.values('level')
        for problem in problems:
            problemvalue = self._get_problem(problem)
            event.add('problem','true')
            event.add('status',str(problemvalue))

        generic_level = event.value('generic_level',False)
        if generic_level == 'lvlbox1.gif':
            event.add('status','0')
                
        # Return a list of events here. The list can contain 0-n events.
        event.clear('description') # source has in some cases also 'description' tag
        status = event.value('type', None)
        if status == None:
            status = 'no warnings'

        description = '%s - %s - %s - %s' % \
            (now_iso, 
             event.value('organization',''),
             event.value('area',''),
             status)
        event.add('description', description)

        return [event]
    
if __name__ == "__main__":
    # Execute the sanitizer bot based on the command line options.
    MeteoAlarmSanitizer.from_command_line().execute()
