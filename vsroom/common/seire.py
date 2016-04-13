import re 
from idiokit import timer,util
import base64
from abusehelper.core.imapbot import IMAPBot,collect
from abusehelper.core import events
from idiokit import threado

# keep track of open cases so that only open ones are closed.
open_ids = set()

# keep track of closed id's, as source sometimes sends an update, which is not closed
closed_ids = set()


class SeireBot(IMAPBot):
    mailbox_ids = set()
    old_mailbox_ids = set()


    @threado.stream
    def parse(inner,self,txt):
        def _add(event,k,v):
            decode = util.guess_encoding
            
            key = decode(k.lower().strip())
            value = decode(v.strip())
        
            event.add(key,value)
            return event
        def _lineparser(txt):
            rows = txt.split('\n')
            for row in rows:
                row = row.strip()

                match = re.findall("^(.*?)=(.*?)$",row)
                if match:
                    for k,v in match:
                        k = k.strip()
                        v = v.strip()
                        yield k,v

        yield
        decode = util.guess_encoding

        event = events.Event()
        event.add('source',
                  'imap://%s/%s %s' % ( self.mail_server, self.mail_box, self.filter))
        for k,v in _lineparser(txt):
            if k.strip() == 'Affected CI-s':
                for ci in v.split(","):
                    event = _add(event,k,ci)
            elif k.strip() == 'SR':
                _add(event,'id',v)
                _add(event,'sr',v)
            else:
                event = _add(event, k,v)
        
        # keys and values collected, now dealing with the event and states.
        id = event.value('id',None)
        if u'rikke l\xf5pp' in event.keys():
            #case closed
            if id in open_ids:
                clearevent = events.Event() 
                clearevent.add('id',id)
                inner.send(clearevent)
                open_ids.remove(id)
                closed_ids.add(id)
            inner.finish(id)

        #if event actually has some contents, send forward
        if len(event.keys()) > 0 and id not in closed_ids:
            open_ids.add(id)
            inner.send(event)
            inner.finish(id)
                
        inner.finish(True)

    @threado.stream
    def handle_text_plain(inner,self,header,fileobj):
        try:
            content = fileobj.read()
            txt = base64.b64decode(content)
        except TypeError, e:
            self.log.warning("TypeError: %s\n%s" % (e,content))
            inner.finish()
        else:

            result = yield inner.sub(self.parse(txt))
            inner.finish(result)

    @threado.stream
    def handle(inner, self, parts):
        handle_default = getattr(self, "handle_default", None)

        for headers, fetch in parts:
            content_type = headers[-1].get_content_type()
            suffix = content_type.replace("-", "__").replace("/", "_")

            handler = getattr(self, "handle_" + suffix, handle_default)
            if handler is None:
                continue

            fileobj = yield inner.sub(fetch())
            skip_rest = yield inner.sub(handler(headers, fileobj))
            inner.finish(skip_rest)

    @threado.stream
    def fetch_mails(inner, self, filter):
        result, data = yield inner.sub(self.call("uid", "SEARCH", None, filter))
        if not data or not data[0]:
            return

        for uid in data[0].split():
            collected = yield inner.sub(self.walk_mail(uid) | collect())

            parts = list()
            for path, headers in collected:
                parts.append((headers, self.fetcher(uid, path)))
                
            if parts:
                top_header = parts[0][0][0]
                subject = top_header["Subject"] or "<no subject>"
                subject =  base64.b64decode(subject[10:])
                sender = top_header["From"] or "<unknown sender>"

                match = re.search('(<.*?>)$',sender)
                sender =  base64.b64decode(sender[10:])
                if match: 
                    sender = sender + " " + match.group(1)

                seire_id = yield inner.sub(self.handle(parts))
                self.mailbox_ids.add(seire_id)
                self.log.info("Done with mail %r from %r, id %r", subject, sender, seire_id)

            # UID STORE command flags have to be in parentheses, otherwise
            # imaplib quotes them, which is not allowed.
            yield inner.sub(self.call("uid", "STORE", uid, "+FLAGS", "(\\Seen)"))

        #track which mails have been removed since the last poll
        #and send clear event for the corresponding events
        changes = self.old_mailbox_ids.difference(self.mailbox_ids)
        if len(changes) > 0:
            self.log.info("Mails with following id's were removed from the mailbox: %r", ",".join(changes))
        for removed_id in changes:
            event = events.Event()
            event.add('id',removed_id)            
            inner.send(event)
        self.old_mailbox_ids = self.mailbox_ids
        self.mailbox_ids = set()



if __name__ == "__main__":
    SeireBot.from_command_line().execute()
