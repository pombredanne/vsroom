from abusehelper.core import events
import time
import re


from vsroom.common import sanitizer
from vsroom.common import timeconversion

# sanitizer.Sanitizer is the base class for a simple sanitizer bot.
class EmhiEESanitizer(sanitizer.Sanitizer):
    # .sanitize(event) is the hook method for sanitizing events. This
    # is the only method you have to implement to create a basic
    # normalizer, sanitizer, modifier or filter.

    def _convert(self,timestr):
        if timestr.find('day') > -1:
            time_tuple = time.strptime(timestr, "%Y-%m-%d day")
            start = time.strftime("%Y-%m-%d 12:00",time_tuple)
            end = time.strftime("%Y-%m-%d 18:00",time_tuple)


        if timestr.find('night') > -1:
            time_tuple = time.strptime(timestr, "%Y-%m-%d night")
            start = time.strftime("%Y-%m-%d 00:00",time_tuple)
            end = time.strftime("%Y-%m-%d 06:00",time_tuple)

        return start,end
    def _temperature_problem(self,temp):
        try:
            temp = int(temp)
        except ValueError:
            raise ValueError, 'Could not convert %s to int.' % (temp)
        problem = 0
        if temp < -15: problem = 30
        if temp < -30: problem = 60
        if temp < -35: problem = 100
        # lower threshold for low-problem for testing
        if temp > 18: problem = 30
        if temp > 25: problem = 60
        if temp > 30: problem = 100
        return problem

    def _wind_problem(self,speed):
        try:
            speed = int(speed)
        except ValueError:
            raise ValueError, 'Could not convert %s to int.' % (speed)
        problem = 0
        # lower threshold for low-problem for testing
        if speed > 10: problem = 30
        if speed > 20: problem = 60
        if speed > 30: problem = 100
        return problem

    def sanitize(self, event):
        # if only one key (id) -> clearing event. No use to
        # add sanitized stuff
        if len(event.keys()) < 2:
            return [event]

        event.add('service','weather')
        # Return a list of events here. The list can contain 0-n events.
        absolute_time = event.value('time', False)
        if absolute_time:

            start,end = self._convert(absolute_time)
            event.add('start', str(start))
            event.add('end',str(end))

        if event.contains('tempmin') or event.contains('tempmax'):
            event.add('type','temperature')

        tempmin = event.value('tempmin', False)

        if tempmin:
            try:
                problem = self._temperature_problem(tempmin)
            except ValueError,e:
                self.log.info('%s' % (e))
                problem = 0
            if problem > 0:
                event.add('problem', str(problem))
                event.add('status', str(problem))
            else:
                event.add('status', '0')

        if event.contains('speedmin') or event.contains('speedmax'):
            event.add('type','wind')

        speedmax = event.value('speedmax',False)
        if speedmax:
            try:
                problem = self._wind_problem(speedmax)
            except ValueError,e:
                self.log.info('%s' % (e))
                problem = 0
            if problem > 0:
                event.add('problem', str(problem))
                event.add('status', str(problem))
            else:
                event.add('status','0')
                             
        start = event.value('start', None)
        if start == None: 
            print 'start was none'
            delta = 0
        else:
            delta = timedelta(start)
            print 'delta', delta
        if delta > -1 and delta < 2:
            event.add('timing', 'within 1 day')
        elif delta < 4:
            event.add('timing', 'within 3 days')
        elif delta >3:
            event.add('timing', 'within more than 3 days')
        else:  
            self.log.info('%s is not an expected delta value in event#id %s' % (str(delta),event.value('id','None')))

        wtype = event.value('type', None)

        range = ''
        if wtype == 'temperature':
            range = "%s-%sC" % (event.value('tempmin',''), event.value('tempmax'))
        if wtype == 'wind':
            range = "%s-%s m/s" % (event.value('speedmin',''), event.value('speedmax',''))

        event.add('organization', 'EMHI')
        event.add('description', '%s - %s - %s - %s - %s' % (event.value('time',''),
                                                           event.value('organization',''), 
                                                           event.value('area',''),
                                                           event.value('type',''),
                                                           range
                                                           ))
        return [event]
    
def timedelta(str):
    from datetime import date
    seconds = timeconversion.datetime2seconds(str)
    dstdate = date.fromtimestamp(seconds)
    today = date.today()
    delta = abs(dstdate-today)
    return delta.days

if __name__ == "__main__":
    # Execute the sanitizer bot based on the command line options.
    EmhiEESanitizer.from_command_line().execute()

