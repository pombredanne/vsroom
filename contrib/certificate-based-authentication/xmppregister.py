import subprocess
import os
from idiokit import jid
ejabberdctl_paths = ['/Applications/ejabberd-2.1.5/bin/ejabberdctl', '/usr/sbin/ejabberdctl']

class XMPPRegister():
    def __init__(self,req,debug=False):
        self.req = req
        self.debug = debug

    def handle_user_ejabberd(self,user,host,password):
        def _run_ejabberdctl(cmnd):

            if self.debug:
                self.req.write('Running: %s\n' % (cmnd))
            try:
                process = subprocess.Popen(cmnd.split(" "),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,env={"HOME": "/tmp"})
            except (subprocess.CalledProcessError, OSError) ,e:
                self.req.write('Error when calling "%s" - %s.\nArglist: %s' % (cmnd,e,",".join(cmnd.split(" "))))
            
            returncode = process.wait()
            msg = process.stdout.read()
            return returncode,msg

        user_jid = "%s@%s" % (user, host)
        user_jid = jid.JID(user_jid)
        found=False
        # Be paranoid about which executables are allowed.
        for ejabberdctl_executable in ejabberdctl_paths:
            if os.path.isfile(ejabberdctl_executable):
                found=True
                break
        if not found:
            return 'No suitable executable found.'

        # ejabberdctl change_password implicitely registers user if it didn't exists
        cmnd = "sudo -u ejabberd %s change_password %s %s %s" % (ejabberdctl_executable, user_jid.node, user_jid.domain, password)
        returncode, msg = _run_ejabberdctl(cmnd)
        if self.debug:
            self.req.write("cmnd: %s\n" % (",".join(cmnd.split(" "))))
            self.req.write("result: %s %s\n" % (returncode,msg))

        if returncode != 0:
            return 'Failed to register user: %s\n' % (user_jid.node)
                       
        stri = "%s:%s\n" % (user_jid.node,password)
        return stri
