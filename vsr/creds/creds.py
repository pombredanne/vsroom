#!/usr/bin/python

import re,unicodedata,sys,os
from idiokit import jid
import time
import string
import random
import re
import subprocess


ejabberdctl_paths = ['/Applications/ejabberd-2.1.5/bin/ejabberdctl', '/usr/sbin/ejabberdctl']

class Credentials:
    def __init__(self,req,env,debug=False):
        self.req = req
        self.environment = env
        self.debug = debug

    def sanitize(self,cn):
        # first be nice and just remove accents from the string
        nkfd = unicodedata.normalize('NFKD', cn)
        sanitized =  u"".join([c for c in nkfd if not unicodedata.combining(c)])

        # After that, filter all remaining non-allowed characters.
        asciichars=list()
        for c in sanitized:
            if c in string.ascii_letters or c == ',' or c.isdigit():
                asciichars.append(c)
            else:
                continue
        return u"".join(asciichars)

    def cn2name_sdcs(self,cn):
        cn_items = str2dict(cn.split("/"))
        email = cn_items['emailAddress']
        email = re.sub("@","%",email)
        return email

    def cn2name_esteid(self,cn):
        cn_items = str2dict(cn.split("/"))
        cn = cn_items['CN'].decode('unicode-escape')
        cn = self.sanitize(unicode(cn))
        (surname,forename,serial) = cn.split(",")
        return "%s.%s.%s" % (forename.lower(), surname.lower(), serial)

    def handle_user_ejabber(self,jid,password):
        def _run_ejabberdctl(cmnd):
            try:
                process = subprocess.Popen(cmnd.split(" "),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,env={"HOME": "/tmp"})
            except (subprocess.CalledProcessError, OSError) ,e:
                self.req.write('Error when calling "%s" - %s.\nArglist: %s' % (cmnd,e,",".join(cmnd.split(" "))))
            
            returncode = process.wait()
            msg = process.stdout.read()
            return returncode,msg


        found=False
        for ejabberdctl_executable in ejabberdctl_paths:
            if os.path.isfile(ejabberdctl_executable):
                found=True
                break
        if not found:
            self.req.write('No suitable ejabberdctl executable found from hardcoded options.\n')
            return 'No suitable executable found.'

        # ejabberdctl change_password implicitely registers user if it didn't exists
        cmnd = "sudo %s change_password %s %s %s" % (ejabberdctl_executable, jid.node, jid.domain, password)
        returncode, msg = _run_ejabberdctl(cmnd)
        if self.debug:
            self.req.write("cmnd: %s\n" % (",".join(cmnd.split(" "))))
            self.req.write("result: %s %s\n" % (returncode,msg))

        if returncode != 0:
            return 'Failed to register user: %s\n' % (jid.node)
                       
        stri = "%s:%s\n" % (jid.node,password)
        return stri

    def client_cert(self,environment):
        issuer = self.environment['SSL_CLIENT_I_DN_OU']
        if issuer == 'ESTEID': func = self.cn2name_esteid
        elif issuer == 'Secure Digital Certificate Signing': func = self.cn2name_sdcs
        elif issuer == 'Testsertifikaadid': func = self.cn2name_esteid
        else:
            return 'Unsupported issuer: %s' % (issuer)
    
        try:
            name = func(self.environment['SSL_CLIENT_S_DN'])
        except ValueError, e:
            self.req.write("Failed to parse name from the certificate.\n")
            return "Error.\n"
        host = self.environment['SSL_SERVER_S_DN']
        user_jid = "%s@%s" % (name, self.environment['SSL_SERVER_S_DN_CN'])
        user_jid = jid.JID(user_jid)
        password = "".join(random.sample(string.letters+string.digits, 16))
        stri = self.handle_user_ejabber(user_jid,password)
        return stri

    def register_and_print(self):
        if 'SSL_CLIENT_I_DN_OU' in self.environment:
            stri = self.client_cert(self.environment)
            self.req.write(stri)
        elif self.req.user != None:
            self.req.write("%s:%s\n" % (req.user, req.get_basic_auth_pw()))
        else:
            self.req.write('None of the supported methods were available.\n')

def str2dict(iterable,delimiter="="):
    mydict = dict()
    for item in iterable:
        item = item.strip()
        
        if len(item) == 0: continue
        k,v = item.split(delimiter,1)
        mydict[k] = v
        
    return mydict
    

# this is called by mod-python
def handler(req):
    from mod_python import apache
    req.content_type = "text/plain"
    environment = req.subprocess_env
    creds = Credentials(req,req.subprocess_env)
    creds.register_and_print()
    return apache.OK


### Tests


def testenv(envtxt):
    vars = dict()
    vars = str2dict(envtxt.split('\n'))
    return vars

class FakeReq():
    def __init__(self):
        self.subprocess_env = None

    def write(self,txt):
        sys.stdout.write(txt)


if __name__ == "__main__":
    testenv = testenv(open(sys.argv[1],'r').read())
    req = FakeReq()
    creds = Credentials(req,testenv,debug=True)    
    creds.register_and_print()
