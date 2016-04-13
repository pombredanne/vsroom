import re
import unicodedata
import string
import random
def str2dict(iterable,delimiter="="):
    mydict = dict()
    for item in iterable:
        item = item.strip()
        
        if len(item) == 0: continue
        k,v = item.split(delimiter,1)
        mydict[k] = v
        
    return mydict

class Cert:
    def __init__(self,req,env,debug=False):
        self.req = req
        self.environment = env
        self.debug = debug

        self.issuer_specific_methods = dict()
        self.issuer_specific_methods['ESTEID'] = self._cn2name_esteid
        self.issuer_specific_methods['Testsertifikaadid'] = self._cn2name_esteid
        self.issuer_specific_methods['Secure Digital Certificate Signing'] = self._cn2name_sdcs

        if debug:
          for k,v in self.environment.iteritems():
             self.req.write('%s = %s\n' % (k,v))


    def sanitize(self,cn):
        # first be nice and just remove accents from the string
        nkfd = unicodedata.normalize('NFKD', cn)
        sanitized =  u"".join([c for c in nkfd if not unicodedata.combining(c)])

        # After that, filter all remaining non-allowed characters.
        sanitized_chars=list()
        for c in sanitized:
            if c in string.ascii_letters or c == ',' or c.isdigit():
                sanitized_chars.append(c)
            else:
                continue
        return u"".join(sanitized_chars)

    def get_issuer(self):
        issuer =  self.environment['SSL_CLIENT_I_DN_OU']
        if issuer in self.issuer_specific_methods:
            return issuer
        else:
            return 'Unsupported issuer: %s' % (issuer)

    def get_user(self):
        issuer = self.environment['SSL_CLIENT_I_DN_OU']
        sanitized_user = self.issuer_specific_methods[issuer](self.environment['SSL_CLIENT_S_DN'])
        return sanitized_user

    def get_s_dn(self):
        return self.environment['SSL_CLIENT_S_DN']

    def _cn2name_sdcs(self,cn):
        cn_items = str2dict(cn.split("/"))
        email = cn_items['emailAddress']
        email_sanitized = re.sub("@","%",email)
        return email_sanitized

    def _cn2name_esteid(self,cn,sanitize=False):
        cn_items = str2dict(cn.split("/"))
        cn = cn_items['CN']
        cn = self.sanitize(unicode(cn.decode('unicode-escape')))
        (surname,forename,serial) = cn.split(",")
        cn = "%s.%s.%s" % (forename.lower(), surname.lower(), serial)
        return cn

    def xmpp_register_and_print_credentials(self):
        if 'SSL_CLIENT_I_DN_OU' in self.environment:
            user = self.get_user()
            password = "".join(random.sample(string.letters+string.digits, 16))
            login_credentials = self.handle_user_ejabber(user_jid,password)
            self.req.write(login_credentials)
        else:
            self.req.write('SSL_CLIENT_I_DN_OU not available.\n')
