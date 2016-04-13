# coding: utf-8
from abusehelper.core import events
from idiokit import util
import time
import re
from vsroom.common import sanitizer
from vsroom.common import timeconversion
from datetime import datetime
import re

# sanitizer.Sanitizer is the base class for a simple sanitizer bot.
class EmhiEESanitizer(sanitizer.Sanitizer):
    # .sanitize(event) is the hook method for sanitizing events. This
    # is the only method you have to implement to create a basic
    # normalizer, sanitizer, modifier or filter.
    def sanitize(self, event):
        #if only id, this is a clear event.
        if len(event.keys()) == 1:
            return [event]
        # if only one key (id) -> clearing event. No use to
        # add sanitized stuff

        event = self._translate_keys(event)

        event.add('sector','comm')
        event.add('service', 'data') 
        event.add('type', 'interruption')
        event.add('organization', 'Elion')

        if event.value('county',False):
            event.add('area',event.value('county'))

        if event.contains('service name'):
            event.add('subtype',event.value('service name'))
        else:
            event.add('subtype', 'undefined')

        started = event.value('started', False)
        if started:
            start_seconds = timeconversion.datetime2seconds(started)
            start_iso = timeconversion.seconds2iso(start_seconds)
            event.add('start', str(start_iso))


        planned_end = event.value('planned end', '')
        if planned_end == '':
            event.clear('planned end')
            event.add('planned end', 'unknown')
        else:
            end_seconds  = timeconversion.datetime2seconds(planned_end)
            end_iso = timeconversion.seconds2iso(end_seconds)
            if end_iso == None:
                self.log.warning('Could not convert %s to seconds.' % (planned_end))
            else:
                event.add('end',end_iso)
                event.clear('planned end')
                event.add('planned end',end_iso)

        try:
            problem = self._get_problem(event)
            event.add('problem', problem)
            event.add('status', problem)
        except ValueError, e:
            self.log.warning('Could not analyze problem: %s' % (e))

        description = event.value('description','')
        
        subtype = event.value('subtype',False)
        if subtype:
            subtype = re.sub('ELION SEIRE \*\*\* ','',subtype)
            event.clear('subtype')
            event.add('subtype', subtype)

        status = self._get_status(event)

        description = "%s - %s - %s" % (
            timeconversion.seconds2iso(time.time()), 
            event.value('organization',''),
            description)

        event.clear('description')
        event.add('description', description)

        # Return a list of events here. The list can contain 0-n events.
        return [event]

    def _get_status(self,event):
        status = ''
        try:
            problem = event.value('problem','0')
            problem = int(problem)
        except ValueError, e:
            return status
        if problem > 49:
            status = 'warning'
        if problem > 74:
            status = 'alert'
        return status
    def _get_problem(self,event):
        problem = '0'
        affected_clients = event.value('affected_clients',False)
        
        try:
            affected_clients = int(affected_clients)
        except ValueError:
            raise ValueError, 'Could not convert "%s" to value.' % (affected_clients)

        if affected_clients > 10:
            problem = '25'
        if affected_clients > 1000:
            problem = '50'
        if affected_clients > 2000:
            problem = '75'

        return problem
    def _translate_keys(self,event):
        translations = dict()
        translations = {
            'ci':'asset',
            'sr':'id',
            'maakond':'county',
            'affected site':'description',
            'teenus':'service name',
            'affected clients':'affected_clients',
            'affected ci-s':'affected systems',
            u'ennustatav l\xf5pp':'planned end',
            'alguse aeg':'started',
            u'rikke l\xf5pp': 'end',
            'classification': 'classification',
            'classification2':'classification2'
            }
        for key in event.keys():
            if key in translations:
                translation = translations[key]
                values = event.values(key)
                event.update(translation,values)
                event.clear(key)

        return event
    
# sanitizer.Sanitizer is the base class for a simple sanitizer bot.    
if __name__ == "__main__":
    # Execute the sanitizer bot based on the command line options.
    EmhiEESanitizer.from_command_line().execute()
