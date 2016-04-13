<?php
$myusername = $_SERVER["REMOTE_USER"];
$mypassword = str_replace(array('\\', '"'), array('\\\\', '\"'), $_SERVER["PHP_AUTH_PW"]);
$mydomain = preg_replace('/^www\./', '', $_GET["host"] ? $_GET["host"] : $_SERVER["HTTP_HOST"]);
$myjid = preg_replace('/@/', '%', $myusername) . "@" . $mydomain;
printf('{ "jid": "%s", "password": "%s" }' . "\n", $myjid, $mypassword);
?>