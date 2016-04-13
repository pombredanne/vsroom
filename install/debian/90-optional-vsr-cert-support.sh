. ../00-settings.sh
cd ../contrib/certificate-based-authentication

mydir=$(dirname $0)

if [ "${VSROOM_HOME}x" == "x" ]
then
    myerr 'VSROOM_HOME is not defined in settings. See the install instructions to edit the settings.'
    exit
fi

# registeration & login dependencies

mkdir -p ${VSROOM_HOME}/certificate-auth
cat <<EOF > ${VSROOM_HOME}/certificate-auth/.htaccess
AddHandler mod_python .py
PythonHandler register
PythonDebug On
SSLOptions +StdEnvVars
PythonPath "sys.path + ['/var/lib/vsroom/certificate-auth/']"
EOF

cat <<EOF > ${VSROOM_HOME}/certificate-auth/config.py
server = "${bot_host}"
EOF
for i in certificate.py xmppregister.py
do
    install -m 644 $i ${VSROOM_HOME}/certificate-auth/$i
done

cat <<EOF > ${VSROOM_HOME}/certificate-auth/htaccess-template
AddHandler mod_python .py
PythonHandler login
PythonDebug On
SSLOptions +StdEnvVars
PythonPath "sys.path + ['${VSROOM_HOME}/certificate-auth/']
PythonAutoReload On 
EOF

mkdir -p ${VSROOM_HOME}/certificates
chgrp ${WWW_GROUP} ${VSROOM_HOME}/certificates
chmod g+rw ${VSROOM_HOME}/certificates

grep -q ejabberdctl /etc/sudoers

if [ $? != 0 ]
then
    cat <<EOF >>/etc/sudoers
www-data ALL= (ejabberd) NOPASSWD: /usr/sbin/ejabberdctl
EOF
else
    echo 'Sudoers was already configured, skipping.'
fi
#authorization management
mkdir -p ${VSROOM_HOME}/scripts
install -m 644 vsr-populate-certficate-users.py ${VSROOM_HOME}/scripts/vsr-populate-certficate-users.py
install -m 644 htaccess-template ${VSROOM_HOME}/scripts/htaccess-template

#support for registeration

mkdir -p ${WEBROOT}/register
install -m 644 register.py ${WEBROOT}/register/register.py

cat <<EOF >${WEBROOT}/register/.htaccess
AddHandler mod_python .py
PythonHandler register
PythonDebug On
SSLOptions +StdEnvVars
PythonPath "sys.path + ['${VSROOM_HOME}/certificate-auth/']"
EOF

#support for login

mkdir -p ${WEBROOT}/login
install -m 644 login.py ${WEBROOT}/login/login.py

if [ -f ${WEBROOT}/.htaccess ]
then
 echo "Backing up the ${WEBROOT}/.htaccess to current directory"
 mv ${WEBROOT}/.htaccess .htaccess-usernamebased-disabled
fi


if [ -f ${VSROOM_HOME}/certificates/allowed.csv ]
then
    python ${VSROOM_HOME}/scripts/vsr-populate-certficate-users.py  >${WEBROOT}/login/.htaccess
else
    #generate stub by feeding a comment line to the populate script
    echo '#' | python ${VSROOM_HOME}/scripts/vsr-populate-certficate-users.py -  >${WEBROOT}/login/.htaccess
fi
echo '-----'
echo 
echo 'NOTE! Here is the configuration for login access. It MUST contain at least two SSLRequire lines!'
echo '------'
cat ${WEBROOT}/login/.htaccess
echo '------'

cat ${mydir}/../../vsr/javascript/common/LoginForm.js | sed -e 's%../common/auth_credentials.php%../login/login.py%g' >${WEBROOT}/common/LoginForm.js

