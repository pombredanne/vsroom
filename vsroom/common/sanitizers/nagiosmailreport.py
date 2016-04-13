from abusehelper.core import events, config
import time,re
from vsroom.common import sanitizer
from vsroom.common import timeconversion
from vsroom.common import geo

nagios_date_convert=dict()
nagios_date_convert[' sept '] = ' Sep '


class NagiosReportSanitizer(sanitizer.Sanitizer):    
    def sanitize(self, event):
        # if only one key (id) -> clearing event.
        if len(event.keys()) < 2:
            return [event]

        host = event.value('host','')
        event.clear('host')
        event.add('asset',host)
        match = re.search("^(.*?)-.*?.aso.ee",host)

        if match:
            area = match.group(1)
            area = area[0].upper() + area[1:]
            event.add('area', area)
            event = geo.add_geo_if_available(area,event)
            if event.value('latitude', False) == False:
                self.log.warning('No geocoordinates for %s.' % (area))

        state = event.value('state',None)
        if state != None:
            normalize_status = {'critical':'alert'}
            if state in normalize_status:
                state = normalize_status[state]
            event.clear('state')
            event.add('status',state)

        if event.contains('address'):
            addr = event.value('address')
            event.add('ip',addr)

        datetime = event.value('date/time','unknown')
        nagios_converts_t = "|".join(nagios_date_convert.keys())


        nagios_converts = re.compile(nagios_converts_t)
        if nagios_converts.search(datetime):
            for key in nagios_date_convert.keys():
                if re.search(key,datetime):
                    datetime = re.sub(key,nagios_date_convert[key],datetime)

        if datetime != 'unknown':
            seconds = timeconversion.datetime2seconds(datetime)
        else:
            seconds = time.time()
        isotime = timeconversion.seconds2iso(seconds)
        if isotime == None:
            isotime = "unknown"

        event.add('start',isotime)
        #we don't have data for estimating the level of problem, setting all to 10
        event.add('problem', 'true')
        event.add('status', '10')

        subtype = event.value('type',False)
        if subtype:
            event.add('subtype', subtype)
            event.clear('type')
        event.add('type', 'interruption')

        event.add('sector','comm')
        event.add('service', 'data')

        now_iso = timeconversion.seconds2iso(time.time())
        description = '%s - %s - %s: %s clients' % \
            (now_iso, event.value('organization',''),
             event.value('asset','')
             , event.value('affected_clients', '?'))

        event.add('description', description)
        return [event]

if __name__ == "__main__":

    NagiosReportSanitizer.from_command_line().execute()
