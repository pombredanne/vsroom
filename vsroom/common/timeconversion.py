import time
import calendar
import functools

# Time parsing

_time_parsers = []

def parse_time(time_value, timezone=0):
    """
    >>> parse_time("2010-08-09 18:00")
    1281376800
    >>> parse_time("2010-08-09 18:00:00 EEST")
    1281376800
    >>> parse_time("09.08.2010 18:00")
    1281376800
    >>> parse_time("09.08.2010 18:00:00")
    1281376800
    >>> parse_time("Sun Aug  9 18:00:00 EEST 2010")
    1281376800
    >>> parse_time("09/08/10 06:00 PM")
    1281376800
    >>> parse_time("09/08/10 06:00 pm")
    1281376800
    >>> parse_time("9/8/10 06:00 pm")
    1281376800
    >>> parse_time("9/8/10 6:00 pm")
    1281376800
    >>> parse_time("9/8/10 18:00:00")
    1281376800
    >>> parse_time("09.08.10 18:00:00")
    1281376800

    >>> parse_time(1281366000.0)
    1281366000.0
    >>> parse_time("1281366000.0")
    1281366000.0
    """

    for index, parser in enumerate(_time_parsers):
        result = parser(time_value)
        if result is None:
            continue

        # Move the matching parser closer to being the first
        # one tried the next time.
        if index > 0:
            _time_parsers[index] = _time_parsers[index-1]
            _time_parsers[index-1] = parser

        return result - timezone
    return None

def parse_format(time_value, format):
    try:
        time_tuple = time.strptime(time_value, format)
    except (ValueError, TypeError):
        return None
    return calendar.timegm(time_tuple)

# Populate the global parser list with a bunch of parsers that each
# parse some simple defined format. %Z means "survive from timezone
# definition", not "handle timezone correctly".
for format in ["%d.%m.%Y %H:%M", 
               "%d.%m.%Y %H:%M:%S",
               "%a %b %d %H:%M:%S %Z %Y", 
               "%Y-%m-%d %H:%M", 
               '%d/%m/%y %I:%M %p', 
               '%d/%m/%y %H:%M:%S',
               '%d/%m/%Y %H:%M',
               '%d/%m/%Y %H:%M:%S',
               '%d.%m.%y %H:%M:%S',
               '%Y-%m-%d %H:%M:%S %Z']:
    parser = functools.partial(parse_format, format=format)
    _time_parsers.append(parser)

def parse_postfix(time_value):
    try:
        time_tuple = time.strptime(time_value, "%b %d %H:%M:%S")
    except (ValueError, TypeError):
        return None

    local_tuple = time.gmtime()
    year = local_tuple[0]
    if local_tuple[1:] < time_tuple[1:]:
        year -= 1
    time_tuple = (year,) + time_tuple[1:]
    return time.mktime(time_tuple)
_time_parsers.append(parse_postfix)

def parse_seconds(seconds):
    try:
        return float(seconds)
    except (ValueError, TypeError):
        return None
_time_parsers.append(parse_seconds)

# Time formatting

def format_time(value=None, format="%Y-%m-%d %H:%M"):
    """
    >>> format_time("2010-08-09 18:00")
    '2010-08-09 18:00'

    >>> format_time("this is not a time")
    Traceback (most recent call last):
    ...
    ValueError: invalid time value 'this is not a time'
    """

    seconds = time.time() if value is None else parse_time(value)
    if seconds is None:
        raise ValueError("invalid time value %r" % value)

    seconds = time.gmtime(seconds)
    return time.strftime(format, seconds)

# Backwards compatibility

datetime2seconds = parse_time
local_iso = format_time
seconds2iso = format_time
