. ../00-settings.sh

[ -z "${bot_host}" ] && myerr "Please define bot_host in settings as adviced in the documentation." 

CFG=/etc/ejabberd/ejabberd.cfg 
if [ ! -f ${CFG}.orig ]
then
   cp ${CFG} ${CFG}.orig
fi
cat ${CFG}.orig |sed -e "s/^{hosts, \[\"localhost\"\]}./{hosts, [\"${bot_host}\"]}./g" > ${CFG}

cat ejabberd.cfg.patch | patch $CFG


case ${os} in 
  "OpenBSD")
	user="_ejabberd"
	;;
  "Linux")
	user="ejabberd"
	;;
       *)
	myerr "Unsupported Operating System"
	;;
esac
chown root:${user} /etc/ejabberd/ejabberd.cfg
chmod 640 /etc/ejabberd/ejabberd.cfg

mkdir -p ${WEBROOT}/ejabberd-logs
chown ${EJABBER_USER} ${WEBROOT}/ejabberd-logs
chmod 755 ${WEBROOT}/ejabberd-logs
ls -ld ${WEBROOT}/ejabberd-logs

cat <<EOF > ${WEBROOT}/ejabberd-logs/.htaccess
#
AuthName "VSR"
AuthType Basic
Require <weblog_readers>
AuthUserFile ${VSROOM_HOME}/.htpasswd
EOF

echo "--------------"
echo "1. To restart ejabberd run:
  /etc/init.d/ejabberd restart
  sleep 4 # This is needed only when you are copypasting instructions, ejabberd takes a while to start.
  ejabberdctl status
"
