. ../00-settings.sh

[ "${EJABBER_USER}x" == "x" ] && myerr "EJABBER_USER is not defined."

now=$(date +%Y-%m-%d-%H-%M)

# Make sure that OS original is backed up and re-runs don't override it. 

CFG=/etc/ejabberd/ejabberd.cfg 

if [ ! -f ${CFG}.orig ]
then
   cp ${CFG} ${CFG}.orig || myerr "Could not back up ejabber config file."
fi
echo "Switching localhost from /etc/ejabberd/ejabberd.cfg to one defined in your 00-settings.sh..."
cat /etc/ejabberd/ejabberd.cfg.orig |sed -e "s/hosts, \[\"localhost\"/hosts, \[\"${bot_host}\"/g" >/etc/ejabberd/ejabberd.cfg
echo "Done."

cat ejabberd-2.1.5.patch | patch /etc/ejabberd/ejabberd.cfg 
chown root:${EJABBER_USER} /etc/ejabberd/ejabberd.cfg
chmod 640 /etc/ejabberd/ejabberd.cfg

openssl req -new -nodes -x509 -newkey rsa:4096 -days 365 -keyout /etc/ejabberd/myserver.pem -out /etc/ejabberd/myserver.pem 
chown root:_ejabberd /etc/ejabberd/myserver.pem
chmod 640 /etc/ejabberd/myserver.pem
