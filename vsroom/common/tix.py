from idiokit import threado,timer
from abusehelper.core import events, bot, utils
import re, urllib2,time
from vsroom.common.id import create_id

class Tix(bot.PollingBot):
    poll_interval = bot.IntParam(default=300)
    threshold = bot.IntParam(default=2,help="How many % in/out utilization must change before reporting.")

    baseurl = "http://tix.estpak.ee/traffic/"
    page = "tix-sw1.html"
    sw1 = baseurl + page
    customers = "http://tix.estpak.ee/?members"

    prev_ports = dict()


    @threado.stream
    def poll(inner, self,something):
        yield timer.sleep(3)
        self.log.info("Downloading %r", self.sw1)
        try:
            info, fileobj = yield inner.sub(utils.fetch_url(self.sw1))
        except utils.FetchUrlFailed, fuf:
            self.log.error("Downloading failed: %r", fuf)
            return
        self.log.info("Downloaded")


        for event in self.parse_sw1(fileobj,self.baseurl):
            send = self.enough_delta(event,self.threshold)
            if send:
                inner.send(event)

            
    def parse_sw1(self, fileobject,baseurl):

        txt = fileobject.read()
        subpages = re.findall('A HREF="(.*?.html)"',txt)

        for page in subpages:
            self.log.info('Downloading %r.' % (page))
            fileobject=urllib2.urlopen(baseurl + page)
            txt = fileobject.read()
            descr = re.findall('<td>Description:</td> <td>(.*) </td>',txt)[0]
            port = descr.split(" ")[0]
            customer = " ".join(descr.split(" ")[1:])
            #find the daily stats part
            reg = '<!-- Begin `Daily\'.*?'
            reg += '<table>.*?'
            #find the 'in' statistics
            reg += '<tr class="in">.*?'
            #pick the statistics
            reg += '<td>(.*?)</td>.*?<td>(.*?)</td>.*?<td>(.*?)</td>.*?'
            #find the 'out' statistics
            reg += '<tr class="out">.*?'
            #pick the statistics
            reg += '<td>(.*?)</td>.*?<td>(.*?)</td>.*?<td>(.*?)</td>.*?'
            #stop
            reg += '<!-- End `Daily'
            stats = re.findall(reg,txt,re.S)[0]
            inmax = stats[0]
            inavg = stats[1]
            incur = stats[2]
            outmax = stats[3]
            outavg = stats[4]
            outcur = stats[5]
            inmbs = re.search('^(\S+)',incur).group(1)
            inutilization = re.search('\((.*?)%\)',incur).group(1)
            outmbs = re.search('^(\S+)',outcur).group(1)
            oututilization = re.search('\((.*?)%\)',outcur).group(1)
            event = events.Event()

            now = str(int(time.time()))
            event.add('start', now)
            event.add('end',now)
            event.add('source', self.baseurl + page)
            event.add('organization', 'TIX')
            event.add('port',port)
            event.add('subtype','exchange')
            event.add('customer',customer)
            event.add('area', 'Tallinn')
            event.add('latitude', '59.4388619')
            event.add('longitude','24.7544715')

            event.add('inmbs',str(int(float(inmbs))))
            event.add('inutilization', str(int(round(float(inutilization)))))
            event.add('outmbs', str(int(float(outmbs))))
            event.add('oututilization', str(int(round(float(oututilization)))))

            event.add('id', create_id(event,'port','customer'))
            yield event

    def enough_delta(self, event, threshold=5):
        """Check if the utilization has changed significantly enough from previous reporting."""
        port = event.value('port',None)

        # if the bot does not know the port, it will report it as the delta 
        # for it was significant enough.
        if port == None: 
            self.log.warning('No port defined in TIX event, can not deduce delta for '+ 
                             'in/out utilizaton. Forwarding event.')
            self.prev_ports[port] = event
            return True

        if port not in self.prev_ports:
            self.prev_ports[port] = event
            return True

        if port in self.prev_ports:
            prev_event =  self.prev_ports[port]

            previnutilization = prev_event.value('inutilization',None)
            prevoututilization = prev_event.value('oututilization',None)
            
            inutilization = event.value('inutilization',None)
            oututilization = event.value('oututilization',None)

            try: 
                indelta = abs(int(previnutilization) - int(inutilization))
                outdelta = abs(int(prevoututilization) - int(oututilization))
            except ValueError, e:
                self.prev_ports[port] = event
                self.log.warning('Can not count delta from following utilization values: ' +
                                 'Previn: %s%%. In: %s%%. Prevout: %s%%. Out: %s%%' % (previnutilization, 
                                                                                       inutilization, 
                                                                                       prevoututilization, 
                                                                                       oututilization))
                return True
            
            if indelta >= threshold or outdelta >= threshold:
                self.prev_ports[port] = event
                return True


if __name__ == "__main__":
    Tix.from_command_line().execute()    

