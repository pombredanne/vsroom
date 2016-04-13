. ../00-settings.sh

a2enmod rewrite proxy proxy_http ssl php5
a2dissite default
a2dissite default-ssl
## Now that we've disabled default site, 
## remove also listen *:80.

cat <<EOF |patch /etc/apache2/ports.conf
--- ports.conf.orig     2010-06-04 11:16:15.000000000 +0300
+++ ports.conf  2010-06-04 11:16:21.000000000 +0300
@@ -5,8 +5,8 @@
 # Debian etch). See /usr/share/doc/apache2.2-common/NEWS.Debian.gz and
 # README.Debian.gz
 
-NameVirtualHost *:80
-Listen 80
+#NameVirtualHost *:80
+#Listen 80
 
 <IfModule mod_ssl.c>
     # If you add NameVirtualHost *:443 here, you will also have to change
EOF

## Create VSROOM SSL site

install -m 644 vsroom-ssl /etc/apache2/sites-available/vsroom-ssl

a2ensite vsroom-ssl

/etc/init.d/apache2 restart


