var LoginForm = new Class({
    Implements: [Events, Options],
    options: {
        authUrl: null,
        rememberUsername: true
    },

    initialize: function(options){
        this.setOptions(options);

        this.element = new Element("div", { 
            "class": "login-form",
            "styles": {
                "display": "none"
            }
        });
        document.id(document.body).grab(this.element);

        this.build();
        this.setHeader($tr("ui.login.prompt", "Please log in"));
        this.setInfo("");
        this.attach();
    },

    build: function() {
        var table = new Element("table", {
            align: "middle"
        });
        this.username = new Element("input", {
            "class": "field"
        });
        this.password = new Element("input", {
            "class": "field", 
            type: "password"
        });
        this.loginButton = new Element("input", {
            type: "submit", 
            value: $tr("ui.login.submit", "Log in")
        });
        this.header = new Element("td", {
            "class": "header", 
            colspan: 2
        });
        this.info = new Element("td", {
            "class": "info", 
            colspan: 2
        });
        table.adopt(
            new Element("tr").grab(this.header),
            new Element("tr").grab(this.info),
            new Element("tr", {align: "right"}).adopt(
                new Element("td").grab(
                    new Element("label", {
                        "for": "loginJID", 
                        "text": $tr("ui.login.jid", "JID") + ":"
                    })),
                new Element("td").grab(this.username)),
            new Element("tr", {align: "right"}).adopt(
                new Element("td").grab(
                    new Element("label", {
                        "for": "loginPass", 
                        "text": $tr("ui.login.password", "Password") + ":"
                    })),
                new Element("td").grab(this.password)),
            new Element("tr").adopt(
                new Element("td"),
                new Element("td").grab(this.loginButton)));
        this.loginform = new Element("form").grab(table);
        this.element.grab(this.loginform);
    },

    attach: function() {
        this.loginform.addEvent("submit",function(event){
            event.preventDefault();
            if (this.options.rememberUsername){
                Cookie.write("username", this.username.value);
            }
            this.fireEvent("login", [this.username.value, this.password.value]);
        }.bind(this));
    },

    show: function(){
        if (this.options.rememberUsername && Cookie.read("username")) {
            this.username.set("value", Cookie.read("username"));
        }
        this.element.setStyle("display","");
        this.element.fade("in");
        return this;
    },

    hide: function(){
        this.element.fade("out");
        return this;
    },

    disable: function(){
        this.element.getElements("input").set("disabled", true);
        return this;
    },

    enable: function(){
        this.element.getElements("input").set("disabled", false);
        return this;
    },

    setHeader: function(text){
        this.header.set("text", text);
        return this;
    },

    setInfo: function(text){
        this.info.set("text", text);
        return this;
    },

    autologin: function(){
        if (this.options.authUrl) {
            var autologinRequest = new Request.JSON({
                url: this.options.authUrl,
                onSuccess: function(json) {
                    this.fireEvent('login',[json.jid, json.password]);
                }.bind(this),
                onFailure: function(xhr) {
                    this.fireEvent('failure');
                }.bind(this)
            }).send();
        }
        return this;
    }
});