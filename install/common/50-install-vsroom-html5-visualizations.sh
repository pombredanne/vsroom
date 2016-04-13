#!/bin/sh
. ../00-settings.sh

mydir=$(dirname $0)

##
## HTDOCS
##

cd ${mydir}/../../vsr/javascript

WWWDOCS="chartview chartview/* planner planner/* mapview mapview/*"
WWWDOCS="${WWWDOCS} mapview mapview/* mapview/*/* mapview/*/*/* common common/* common/counties/*"
WWWDOCS="${WWWDOCS} overview overview/*"
WWWDOCS="${WWWDOCS} classification classification/*"
WWWDOCS="${WWWDOCS} listview listview/*"
WWWDOCS="${WWWDOCS} polymaps polymaps/*"
WWWDOCS="${WWWDOCS} categorilla categorilla/*"
WWWDOCS="${WWWDOCS} keymap keymap/*"
WWWDOCS="${WWWDOCS} contrib contrib/translations contrib/translations/*"

for i in ${WWWDOCS}
do
    echo "${i} -> ${WEBROOT}/${i}"
    [ -d ${i} ] &&  mkdir -p ${WEBROOT}/${i}
    [ -f ${i} ] && install -m 644 $i ${WEBROOT}/${i}
done
cd ..
install -m 644 index.html ${WEBROOT}/index.html
install -m 644 main.css ${WEBROOT}/main.css

cd ${mydir}/../contrib/overview-configs/

overview_configs="${WEBROOT}/overview-configs/"
mkdir -p ${overview_configs}
chmod 755  ${overview_configs}
for i in *.json 
do
 install -m 644 ${i} ${overview_configs}/${i}
done
