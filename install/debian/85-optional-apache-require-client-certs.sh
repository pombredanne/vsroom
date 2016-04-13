. ../00-settings.sh


#copy the recent version of usernamebased htaccess
if [ -f ${WEBROOT}/.htaccess ]
then
 mv ${WEBROOT}/.htaccess .htaccess-usernamebased-disabled
fi

cat vsroom-ssl-cert.patch | patch /etc/apache2/sites-available/vsroom-ssl


