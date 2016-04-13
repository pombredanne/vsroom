def handler(req):
    from mod_python import apache
    import certificate
    import xmppregister
    import random
    import string
    import config
    req.content_type = "text/plain"
    cert = certificate.Cert(req,req.subprocess_env,debug=False)

    sanitized_user = cert.get_user()
    #host = req.subprocess_env['SSL_TLS_SNI']
    host = config.server
    password = "".join(random.sample(string.letters+string.digits, 16))
    if 'SSL_CLIENT_I_DN_OU' in req.subprocess_env:
    
        reg = xmppregister.XMPPRegister(req)
        result = reg.handle_user_ejabberd(sanitized_user,host,password)
    req.write(result)
    return apache.OK
