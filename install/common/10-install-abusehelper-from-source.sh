TMPDIR=`mktemp -d /tmp/ah.XXXXXXXXXX` || exit 1

cd ${TMPDIR}

which curl
if [ $? -eq 0 ]; then
  GETTER=curl
else
  GETTER=wget
fi
URL=https://bitbucket.org/clarifiednetworks/abusehelper/get/tip.tar.gz

${GETTER} $URL >tip.tar.gz
tar -xzf tip.tar.gz
cd clarifiednetworks-abusehelper-*

OPTS=""
if [ ${#PREFIX} -ne 0 ]
then
    OPTS="--prefix=${PREFIX}"
else
    OPTS=""
fi
python setup.py install ${OPTS}

cd ${TMPDIR}/..
echo "Removing ${TMPDIR}"
rm -fr ${TMPDIR}
