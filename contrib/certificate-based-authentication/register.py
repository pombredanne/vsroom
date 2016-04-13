#!/usr/bin/python

import re,unicodedata,sys,os
from idiokit import jid
import string
import re
import subprocess

# this is called by mod-python
def handler(req):
    from mod_python import apache
    import certificate,time,random
    req.content_type = "text/plain"
    environment = req.subprocess_env

    cert = certificate.Cert(req,req.subprocess_env,debug=False)
    issuer = cert.get_issuer()
    sanitized_user = cert.get_user()
    user = cert.get_s_dn()

    try: 
        fd_r = open('/var/lib/vsroom/certificates/requests.csv','r')
    except IOError,e:
        if e.strerror == 'No such file or directory':
            # it is ok not to have any existing requests
            fd_r = None
            
    pending_requests = 0
    if fd_r != None:
        lines = fd_r.read()
        pending_requests = len(lines.split("\n"))
        if pending_requests > 500:
            #avoid hostile amount of requests, which could fill the disc, or memory (with regexp searches)
            req.write('Too many pending requests.')
            return apache.OK

        if re.search(user.decode('unicode-escape'), lines.decode('unicode-escape')):
            req.write('You already have a pending request.')
            return apache.OK

        fd_r.close()

    try: 
        fd_a = open('/var/lib/vsroom/certificates/allowed.csv','r')
        if re.search(user.decode('unicode-escape'), fd_a.read().decode('unicode-escape')):
            req.write('You should be on the access list. If you can not log in, contact your administrator.')
            fd_a.close()
            return apache.OK
    except IOError,e:
        if e.strerror == 'No such file or directory':
            # it is ok not to have any existing users
            pass        

    fd_a = open('/var/lib/vsroom/certificates/requests.csv','a')
    output = '%s;%s;%s\n' % (sanitized_user,user, issuer)
    fd_a.write(output)
    fd_a.close()

    req.write('Your request has been logged. Local admins will handle your request as soon as possible.\n')
    req.write('Request data:\n')
    req.write('  Sanitized username: %s\n' % (sanitized_user))
    req.write('  Issuer: %s\n' % (issuer))
    req.write('  Certificate S_DN: %s\n' % (user))


    return apache.OK
