. ../00-settings.sh

[ ! -z ${bot_host} ] || myerr "bot_host not defined in 00-settings.sh"
[ ! -z ${bot_password} ] || myerr "bot_password not defined in 00-settings.sh"

CRED_FILE=${VSROOM_HOME}/examples/startup-creds.py

if [ ! -f ${CRED_FILE} ]
then
    echo "Creating ${CRED_FILE}."
    cat <<EOF > ${CRED_FILE}
from startup import *
Bot.xmpp_jid = "${bot_username}@${bot_host}"
Bot.xmpp_password = "${bot_password}"
EOF
fi

chgrp ${VSR_USER} ${CRED_FILE}
chmod 640 ${CRED_FILE}

vsroompasswd ${bot_username} ${bot_password}

