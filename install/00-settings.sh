## Variables for other installation scripts, like locations, usernames and passwords.

###############################################################
##
## Editing the lines below is mandatory prior the installation.
##

# What is the password that bot user will use. Just createa new one. 
bot_password=""

# If you don't enter anything, then I'll create a random password

if [ "x${bot_password}" = "x" ]; then
        bot_password=$(openssl rand 64 | md5sum | cut -d' ' -f1)
fi

# What is your server's hostname? (You can check it by running hostname -f)
bot_host=""

###############################################################
##
## Editing the lines below is optional.
##
bot_username="bot"

# The location for bots and misc support files.

VSROOM_HOME="/var/lib/vsroom"

VSROOM_WEBROOT="vsroom"
###############################################################
##
## Operating system specific settings.
## 
##

os=$(uname)

case ${os} in
 "Linux")
    OS_WEBROOT="/var/www"
    WWW_GROUP="www-data"
    EJABBER_USER="ejabberd"
    VSR_USER="vsroom"
    ;;
 "OpenBSD")
    OS_WEBROOT="/var/www/htdocs"
    WWW_GROUP="www"
    EJABBER_USER="_ejabberd"
    VSR_USER="_vsroom"
    ;;
 "Darwin")
    OS_WEBROOT="/var/www/"
    WWW_GROUP="_www"
    EJABBER_USER="nobody"
    ;;
esac

WEBROOT="${OS_WEBROOT}/${VSROOM_WEBROOT}"

##
## Editing the lines below is not recommended.
##

# Support functions for scripts
myerr() {
  echo "ERR: $*" 1>&2
  exit 1
}


