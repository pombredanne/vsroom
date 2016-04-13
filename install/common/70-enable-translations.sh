. ../00-settings.sh

cd ../../vsr/javascript/

lang=""
for i in $(ls contrib/translations/*)
do
   lang="${lang}\n    <script src=\"../$i\" charset=\"UTF-8\"></script>"
done


# using python to avoid sed interoperability issues between different OSes.

[ ! -f overview/index.html ] && myerr "Could not find overview/index.html from $(pwd)"
cat overview/index.html | python -c "
import re
import sys
x = sys.stdin.read()
print re.sub('<!-- <script src=\"INSERT_LOCALIZATION_FILE_HERE\"></script> -->','${lang}', x)
" >${WEBROOT}/overview/index.html

echo ${WEBROOT}/overview/index.html

chmod a+r ${WEBROOT}/overview/index.html



#<!-- <script src="INSERT_LOCALIZATION_FILE_HERE"></script> -->/$lang/g'

