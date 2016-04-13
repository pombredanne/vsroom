function ElementQueue(handler) {
    this.handler = handler;

    this.queue = [];
    this.interval = null;
    this.chunkSize = 25;

    var _this = this;
    this._process = function() {
        _this.process();
    };
}

ElementQueue.prototype = {
    push: function(element) {
        if (this.interval === null) {
            this.interval = setInterval(this._process, 0);
        }
        this.queue.push(element);
        return this;
    },
    
    process: function() {
        var elements = this.queue.splice(0, this.chunkSize);
        
        var handler = this.handler;
        for (var i = 0, length = elements.length; i < length; i++) {
            handler(elements[i]);
        }
        
        if (this.queue.length === 0 && this.interval !== null) {
            clearInterval(this.interval);
            this.interval = null;
        }
        return this;
    }
};

var parseStanzaDelay = (function() {
    var regexp = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;
    
    return function parseStanzaDelay(stanza, _default) {
        var children = stanza.childNodes;
        var timestamp = null;
        
        for (var i = 0, length = children.length; i < length; i++) {
            var child = children[i];
            if (!child.tagName) continue;
            if (child.tagName.toLowerCase() !== "delay") continue;
            if (child.getAttribute("xmlns") !== "urn:xmpp:delay") continue;
            
            var stamp = child.getAttribute("stamp");
            if (stamp === null) continue;
            
            var newStamp = stamp.match(regexp);
            if (newStamp === null) continue;
            
            newStamp.shift();
            newStamp[1] -= 1;
            timestamp = Date.UTC.apply(null, newStamp);
        }
        
        if (timestamp !== null) {
            return timestamp;
        } else if (arguments.length >= 2) {
            return _default;
        } else {
            return null;
        }
    }
}());

var XMPPClient = new Class({
    Implements: [Events, Options],

    options: {
        authUrl :  null
    },

    initialize: function(boshUrl, roomNode, roomHandler, options) {
        this.roomHandler = roomHandler;
        this.roomNode = roomNode;
        this.setOptions(options);

        this.connectionStatus = null;
        this.connection = new Strophe.Connection(boshUrl);

        this.bound = {};
        this.bound.saveSession = this.saveSession.bind(this);

        this.login = new LoginForm({authUrl: options.authUrl});
        this.login.show();
        this.login.addEvents({
            "login": function(jid, pwd) {
                this.connect(jid, pwd);
            }.bind(this),
            "failure": function() {
                this._connect(Strophe.Status.DISCONNECTED);
            }.bind(this)
        });

        this.restoreSession(function() {
            this.login.enable().show();
            if (this.options.authUrl){
                this.login.autologin();
            }
        }.bind(this));
    },

    connect: function(jid, password) {
        this.jid = jid;
        this.login.disable();
        this.connection.connect(jid, password, this._connect.bind(this));
    },

    _connect: function(status, err) {
        if (this.connectionStatus != status){
            this.fireEvent('statusChange', status);
        }
        this.connectionStatus = status;
        if (err) {
            this.login.setInfo(err);
        } else {
            this.login.setInfo(" ")
        }

        if (status === Strophe.Status.CONNECTING) {
            this.login.setHeader($tr("ui.login.connecting", "Connecting"));
        } else if (status === Strophe.Status.CONNFAIL) {
            this.login.setHeader($tr("ui.login.connectionFailed", "Connection failed"));
            this.connection.disconnect();
        } else if (status === Strophe.Status.AUTHENTICATING) {
            this.login.setHeader($tr("ui.login.authenticating", "Authenticating"));
        } else if (status === Strophe.Status.AUTHFAIL) {
            this.login.setHeader($tr("ui.login.authenticationFailed", "Authentication failed"));
            this.connection.disconnect();
        } else if (status === Strophe.Status.CONNECTED) {
            this.login.setHeader($tr("ui.login.joining", "Joining"));
            this.connection.send($pres());
            this.join.delay(0, this);
        } else if (status === Strophe.Status.ATTACHED) {
            this.login.setHeader($tr("ui.login.attached", "Attached"));
            this.join.delay(0, this);
        } else if (status === Strophe.Status.DISCONNECTING) {
        } else if (status === Strophe.Status.DISCONNECTED) {
            document.id(window).removeEvent('unload', this.bound.saveSession);
            this.connection.reset();

            if (this.auth_success) {
                if (!this.reconn) {
                    this.fireEvent("disconnect");
                    this.reconn = 0;
                }

                this.login.autologin.delay(5000 * Math.min(this.reconn, 10), this.login);
                this.reconn++;
            } else {
                this.login.enable();
                this.login.show();

            }
        } else {
            this.login.setHeader($tr("ui.login.error", "Error"));
            this.connection.disconnect();
        }
    },

    join: function() {
        delete this.reconn;
        this.auth_success = true;
        var node = Strophe.getNodeFromJid(this.jid);
        var resource = node + "-" + Math.round(Math.random() * 1000000);
        var roomJid = this.roomJid = (Strophe.escapeNode(this.roomNode)
                                      + "@conference."
                                      + Strophe.getDomainFromJid(this.jid)
                                      + "/" + resource);
        this.connection.addHandler(this._join.bind(this), null, 
                                   "presence", null, null,
                                   roomJid, { matchBare: true });
        
        var presence = $pres({ to: roomJid });
        presence.c("x", {xmlns: "http://jabber.org/protocol/muc"})
                .c("history", { maxstanzas: "0" });
        this.connection.send(presence.tree());
    },

    _join: function(presence) {
        var roomJid = this.roomJid;
        var from = presence.getAttribute("from");
        var children = presence.getChildren("x");
        if (children.length == 0) return true;

        var x = children[0];
        var ns = x.getAttribute("xmlns");

        if (ns === "http://jabber.org/protocol/muc#user"
                && (x.getChildren("status[code=110]").length > 0
                || from === roomJid)) {
            roomJid = from;
        } else if (ns === "http://jabber.org/protocol/muc"
                && from === Strophe.getBareJidFromJid(roomJid)) {
            var errors = x.getChildren("error");
            if (x.getChildren("error")) {
                alert(errors);
                return false;
            }
            return true;
        } else {
            return true;
        }

        var handler = this.roomHandler(roomJid);
        if (handler) {
            var queue = new ElementQueue(handler);
            this.connection.addHandler(queue.push.bind(queue), 
                                       null, "message", null, null,
                                       roomJid, { matchBare: true });
        }
        
        this.login.hide();
        document.id(window).addEvent('unload', this.bound.saveSession);
        
        this.fireEvent('join', roomJid);
        this.login.setHeader.delay(1000, this.login, 
                                   $tr("ui.login.disconnected", "Disconnected"));
        
        return false;
    },

    saveSession: function() {
        var xmpp = this.connection;
        var storage = window.sessionStorage;
        if (xmpp.sid && xmpp.rid && storage && !this.reconn) {
            storage['strophe_jid'] = xmpp.jid;
            storage['strophe_expire'] = 10000 + Date.now();
            storage['strophe_rid'] = xmpp.rid;
            storage['strophe_sid'] = xmpp.sid;
        }
        xmpp.pause();
    },

    restoreSession: function(onFail) {
        var storage = window.sessionStorage;
        
        if (storage && storage['strophe_expire'] > Date.now()) {
            this.jid = storage['strophe_jid'];
            setTimeout(function(){
                this.connection.attach(storage['strophe_jid'],
                                       storage['strophe_sid'],
                                       storage['strophe_rid'],
                                       this._connect.bind(this));
            }.bind(this), 0);
            delete storage['strophe_expire'];
            this.login.hide();
            return true;
        }
        storage['roster'] = JSON.stringify({});
        onFail();
        return false;
    }

});
