import re,sys,time

ej_time = re.compile('(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d) ===')

matchers = list()
matchers.append(re.compile('(Accepted authentication for \S+)'))
matchers.append(re.compile('(Failed authentication for \S+)'))
matchers.append(re.compile('(Accepted connection {{.*?})'))
matchers.append(re.compile('(Opened.*)'))
matchers.append(re.compile('(Close session.*)'))
matchers.append(re.compile('(\S+ MUC room.*)'))
matchers.append(re.compile('(user_available.*)'))
matchers.append(re.compile('(unset_presence.*)'))

def default_match(rex,row,isotime):
    match = re.search(rex,row)
    if match != None:
        return match.group(1)
    return False

def sanitize_ejabberd(ej_fd):
    isotime = None
    entries = dict()
    for line in ej_fd.readlines():
        line = line.strip()

        match = re.search(ej_time,line)
        if match != None:
            isotime = match.group(1)
            continue

        if isotime == None: continue

        found = False
        for matcher in matchers:
            hit = default_match(matcher,line,isotime)
            if hit:
                yield isotime, hit
                found=True
                break
        
        if found == False and len(line) != 0:
            #also add unparsable non-empty rows
            yield isotime, line


def sanitize_apache(apache_fd):
    isotime = None
    entries = dict()

    for line in apache_fd.readlines():
        lines = line.strip().split(" ")
        timestr =  lines[3]
        lines.pop(3)
        
        #We assume that the log files are in the 
        #same timezone (no timezone info in ejabberd log)
        #Thus throw the timezone info away.
        lines.pop(3)

        isotime = time.strftime("%Y-%m-%d %H:%M:%S", time.strptime(timestr,"[%d/%b/%Y:%H:%M:%S"))
        yield isotime," ".join(lines)

if __name__ == "__main__":
    hits = dict()

    if len(sys.argv) < 2 or len(sys.argv) > 3:
        sys.stderr.write("Usage: %s <ejabberd log> [apache log]\n" % sys.argv[0])
        sys.exit(1)

    if len(sys.argv) >=2:
        for isotime, hit in sanitize_ejabberd(open(sys.argv[1],'r')):
            if isotime not in hits:
                hits[isotime] = set()
            hits[isotime].add(hit)

    if len(sys.argv) == 3:
        for isotime, hit in sanitize_apache(open(sys.argv[2],'r')):
            if isotime not in hits:
                hits[isotime] = set()
            hits[isotime].add(hit)

    times = hits.keys()
    times.sort()
    for time in times:
        for hit in hits[time]:
            print time, hit
