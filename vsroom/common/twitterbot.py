# depends on bleeding edge http://code.google.com/p/python-twitter/
# depends on http://github.com/simplegeo/python-oauth2
#  which depends on http://pypi.python.org/packages/source/s/setuptools/
#
# Due to the fact that twitter uses oauth, you need to do this dance to use this bot.
# 
# 0. create twitter account, if you don't have one
#
# 1. register 'twitter application:
#    http://dev.twitter.com/apps/new
#
# 2. once you are done pick the consumer key and consumer secret from
#    the resulting web page
#
# 3. from python-twitter api directory, run 
#    'python get_access_token.py'
#
# 4. go to the url it prints, see the pin code in shown in your browser, and
#    give it to the get_access_token.py
# 
# 5. copy & paste the produced twitter access token key and access
#    token secret for using it with this bot

try:
    import json
    JSONDecodeError = ValueError
except ImportError:
    import simplejson as json
    JSONDecodeError = getattr(json, "JSONDecodeError", ValueError)

from abusehelper.core import bot,events
from idiokit import threado,timer
import twitter
import re,time
import socket
from urllib2 import URLError
from vsroom.common import id
from vsroom.common import timeconversion

class TwitterBot(bot.PollingBot):
    consumer_key = bot.Param()
    consumer_secret = bot.Param()
    access_token_key = bot.Param()
    access_token_secret = bot.Param()
    old_tweets = dict()

    def feed_keys(self, user, **keys):
        return [user]

    @threado.stream
    def poll(inner,self,user):
        yield timer.sleep(1)
        new_tweets = dict()
        api = twitter.Api(consumer_key=self.consumer_key,
                          consumer_secret=self.consumer_secret,
                          access_token_key=self.access_token_key,
                          access_token_secret=self.access_token_secret)
        try: 
            userobj = api.GetUser(user)
            friends = api.GetFriends()
        except (URLError,twitter.TwitterError,ValueError,JSONDecodeError,socket.error), e:
            self.log.error("Twitter error: %s." % (e))
            return 
        self.log.info('Fetching status for %s' % userobj.name)
        for friend in [userobj] + friends:
            status = friend.GetStatus()
            name = friend.screen_name
            if status == None: continue
            start = status.GetCreatedAtInSeconds()
            new_tweets[name] = friend

        #dedup
        for name, friend in new_tweets.iteritems():
            # 1. is this the same event that was sent previously, and
            # 2. is this older event than the recent one (twitter api 
            #    sometimes returns non-latest tweet)
            old_friend = self.old_tweets.get(name)
            if old_friend == None:
                event = self.get_event(friend)
                inner.send(event)
                continue
            old_tweet = self.old_tweets.get(name).GetStatus()
            new_tweet = friend.GetStatus()
            prev_created = old_tweet.GetCreatedAtInSeconds()
            new_created = new_tweet.GetCreatedAtInSeconds()
            
            if prev_created < new_created:
                event = self.get_event(friend)
                inner.send(event)

        self.old_tweets = new_tweets

    def get_event(self,user):
        status = user.GetStatus()
        update = status.GetCreatedAtInSeconds()
        name = user.name.lower()
        followers_count = user.GetFriendsCount()
        statuses_count = user.GetStatusesCount()
        event = events.Event()
        event.add('user',user.name.lower())
        now = timeconversion.local_iso()
        event = blogparse(event, status.text)
        event.add('description', "%s - %s - %s" % (now, name, status.text.lower()))
        event.add('type', 'microblog')
        event.add('subtype','twitter')
        event.add('followers',unicode(followers_count))
        event.add('statuses_count', unicode(statuses_count))
        event.add('src',user.name.lower())
        event.add('dst','followers')
        
        

        event.add('id',id.create_id(event,'user'))
        event.add('start', timeconversion.seconds2iso(update))
        return event

def blogparse(event,txt):

    for _,dst in re.findall('(^|\s){0,1}@([^\s|:]+)',txt):
        event.add('dst', dst)

    for k,v in fuzzy(txt): 
        event.add(k.lower(),v.lower())

    for k,v in tags(txt): 
        k = k.lower()
        v = v.lower()
        #tags override fuzzy
        event.clear(k)
        event.add(k,v)

    for k,v in keyvalues(txt):
        k = k.lower()
        v = v.lower()
        #keyvalues override tags
        event.clear(k)
        event.add(k,v)
    return event

def fuzzy(txt):
    problem = re.search('problem|Problem|PROBLEM|warning|Warning|WARNING',txt)
    if problem:

        yield ('status', '20')
        yield ('problem', '20')

    alert = re.search('alert|Alert|ALERT',txt)
    if alert:
        yield ('status','75')
        yield ('problem', '75')

    ok = re.search('ok|Ok|OK',txt)
    if ok: 
        yield('status','0')

def tags(txt):
    tags = re.findall('#([^"][^=|^\s]+)',txt)
    for tag in tags:
        yield tag, '1'

def keyvalues(txt):
    kvs = re.findall('#([^"][^\s]+)=([^"][^\s]+)',txt)
    for k,v in kvs:
        yield k,v
    
    #spaces in key and value
    kvs = re.findall('#"([^"]+)"="([^"]+)"',txt)
    for k,v in kvs:
        yield k,v

    #spaces in value
    kvs = re.findall('#([^"][^\s]+)="([^"]+)"',txt)
    for k,v in kvs:
        yield k,v

    #spaces in key
    kvs = re.findall('#"([^"]+)"=([^"][^\s]+)',txt)
    for k,v in kvs:
        yield k,v

def test():
    msgs = list()
    msgs.append('Hello world')
    msgs.append('We have problems.')
    msgs.append('Alert foo bar')
    msgs.append('everythig OK')
    msgs.append('i want to #tag #tag2')
    msgs.append('key value #sector=comm')
    msgs.append(u'aaa #"key space"="value space"')
    msgs.append('key valuespace #sector="tele of comm" and problem')
    msgs.append('key valuespace #sector x=telecomm"')
    msgs.append('#"foo2"="bar2"')
    msgs.append('#starttag key valuespace #key="value space"')
    for msg in msgs:
        for fuz in fuzzy(msg): print ' fuz:', fuz
        for tag in tags(msg): print ' tag:', tag
        for kv in keyvalues(msg): print '  kv:', kv

if __name__ == "__main__":
    TwitterBot.from_command_line().execute()
#    test()
