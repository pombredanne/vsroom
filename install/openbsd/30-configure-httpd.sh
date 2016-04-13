openssl genrsa -out /etc/ssl/private/server.key 1024  
openssl req -new -key /etc/ssl/private/server.key -out /etc/ssl/private/server.csr                                        
openssl x509 -req -days 365 -in /etc/ssl/private/server.csr -signkey /etc/ssl/private/server.key -out /etc/ssl/server.crt 
cat <<EOF >>/etc/rc.conf.local        
httpd_flags="-u -DSSL"
EOF
cat httpd.patch  |patch /var/www/conf/httpd.conf 
