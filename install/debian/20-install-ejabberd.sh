#!/bin/sh

. ../00-settings.sh

if [ ! -f /etc/debian_version ]; then 
	myerr "Cannot determine Debian version"
	exit 1
fi

if grep -Eiq -e 'squeeze|6.0' /etc/debian_version; then
	# Running on Debian squeeze 
	apt-get -y install ejabberd
	exit 0
fi

if grep -Eiq -e 'lenny|5.0' /etc/debian_version; then 
	# Running on Debian Lenny, will install recent ejabberd package from testing
	# Configure Apt

	cat > /etc/apt/apt.conf << EOF
APT::Default-Release "stable";
EOF

	# Setup the testing source
	cat >> /etc/apt/sources.list << EOF

# Testing repository for ejabberd package:
deb http://ftp.debian.org/debian testing main
deb-src http://ftp.debian.org/debian testing main
EOF
	# Updating packages list and installing the ejabberd from testing
	apt-get update
	apt-get -y -t testing install ejabberd
fi
 
