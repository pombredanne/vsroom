mkdir /etc/apache2/ESTEID
cd /etc/apache2/ESTEID
wget http://www.sk.ee/certs/JUUR-SK.crt
wget http://www.sk.ee/certs/ESTEID-SK.crt
wget http://www.sk.ee/crls/esteid/esteid.crl
openssl x509 -in JUUR-SK.crt -inform DER -out JUUR-SK.pem
openssl x509 -in ESTEID-SK.crt -inform DER -out ESTEID-SK.pem
openssl crl -in esteid.crl -inform DER -out esteid.pem
rm *.crt esteid.crl
mv JUUR-SK.pem JUUR-SK.crt
mv ESTEID-SK.pem ESTEID-SK.crt
mv esteid.pem esteid.crl

wget https://www.startssl.com/certs/ca-bundle.pem
cat ca-bundle.pem ESTEID-SK.crt JUUR-SK.crt > CA_list.crt

aptitude -y install libapache2-mod-python sudo
