
. ../00-settings.sh

mkdir -p ${VSROOM_HOME}/examples

mydir=$(dirname $0)

rsync -av ${mydir}/../../examples/public-sources ${VSROOM_HOME}/examples/
rsync -av ${mydir}/../../examples/private-sources ${VSROOM_HOME}/examples/
mkdir -p ${VSROOM_HOME}/examples/public-sources/log
case $(uname) in 
   "OpenBSD")
        group="_vsroom"
        ;;
   "Linux")
        group="vsroom"
        ;;
        *)
        group="root"
        ;;
esac
chgrp $group ${VSROOM_HOME}/examples/public-sources/log
[ -d ${VSROOM_HOME}/examples/public-sources/state ] || mkdir -p ${VSROOM_HOME}/examples/public-sources/state
chgrp $group ${VSROOM_HOME}/examples/public-sources/state
chmod 770 ${VSROOM_HOME}/examples/public-sources/log
chmod 770 ${VSROOM_HOME}/examples/public-sources/state

mkdir -p ${VSROOM_HOME}/production

if [ ! -d ${VSROOM_HOME}/production/public-sources ]
then
    ln -s ${VSROOM_HOME}/examples/public-sources/ ${VSROOM_HOME}/production/
    ln -s ${VSROOM_HOME}/examples/startup-creds.py ${VSROOM_HOME}/production/
fi
