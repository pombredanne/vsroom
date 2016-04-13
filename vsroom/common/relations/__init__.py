deps = dict()

deps[('subtype','wind')] = [dict(sector='energy',service='grid',type='wind',basis='weather')]
deps[('subtype','thunder')] = [dict(sector='energy',service='grid',subtype='thunder',basis='weather')]
deps[('subtype','snowstorm')] = [dict(sector='transport',service='roads',type='snowstorm',basis='weather'),
                               dict(sector='transport', service='airports',type='snowstorm',basis='weather')]
deps[('subtype','temperature')] = [dict(sector='water',service='cooling',type='temperature',basis='weather')]

def assign_affected_targets(event):
    events = list()
    etype = event.value('subtype', None)
    if ('subtype', etype) in deps:
        for add in deps[('subtype', etype)]:
            event2 = events.Event(event)
            for k,v in add.iteritems():
                event2.clear(k)
                event2.update(k,[v])
                events.append(event2)
    return events
