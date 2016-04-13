. ../00-settings.sh
cat <<EOF > ${WEBROOT}/.htaccess
#
AuthName "VSR"
AuthType Basic
Require valid-user
AuthUserFile ${VSROOM_HOME}/.htpasswd
EOF

## HTTP polling

mkdir -p ${OS_WEBROOT}/portal/jabber
cat <<EOF > ${OS_WEBROOT}/portal/jabber/.htaccess
<IfModule mod_rewrite.c>
        RewriteEngine On
        RewriteRule ^(.*)$ http://localhost:5280/\$1 [P]
</IfModule>
EOF