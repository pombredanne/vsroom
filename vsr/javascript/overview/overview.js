$tr.use((new URI()).get("data").lang);

var dataAdapter = function(type) {
    return function(container) {
        var adapted = new type(container);

        adapted.observe({
            history: function(_, history, old) {
                if (old) {
                    old.observer.unobserve();
                    old.listener.unlisten();
                    old.view.destroy();
                }

                if (!history) {
                    adapted.set("data", null);
                    return null;
                }

                var data = new Container();

                var view = history.view();

                var listener = view.listen({
                    added: function(item) {
                        data.set(item.id, item.event);
                    },
                    removed: function(item) {
                        data.pop(item.id);
                    }
                });

                var observer = adapted.observe({
                    focus: function(_, focus, previous) {
                        focus = focus === null ? Number.MAX_VALUE : focus;

                        if (focus !== previous) {
                            view.setView(focus, focus);
                        }

                        return focus;
                    }
                });

                adapted.set("data", data);

                return {
                    view: view,
                    listener: listener,
                    observer: observer
                };
            }
        });

        return adapted;
    };
};

var DEFAULT_VIEW_MAPPINGS = {
    "map": {
        "type": dataAdapter(PolymapsView),
        "name": $tr("ui.viewNames.map", "Map"),
        "settings": {
            "bounds": {
                "left": -168,
                "right": 190,
                "top": 80,
                "bottom": -50
            }
        }
    },

    "classification": {
        "type": dataAdapter(ClassificationView),
        "name": $tr("ui.viewNames.classification", "Classification"),
        "settings": {}
    },

    "list": {
        "type": dataAdapter(ListView),
        "name": $tr("ui.viewNames.list", "List"),
        "settings": {}
    },

    "chart": {
        "type": dataAdapter(ChartView),
        "name": $tr("ui.viewNames.chart", "Chart"),
        "settings": {}
    },

    "keymap": {
        "type": dataAdapter(KeyMap),
        "name": $tr("ui.viewNames.keymap", "Keymap"),
        "settings": {}
    },

    "categorilla": {
        "type": dataAdapter(CategorillaView),
        "name": $tr("ui.viewNames.categorilla", "Categorilla"),
        "settings": {}
    },

    "timeline": {
        "type": TimeLine,
        "name": $tr("ui.viewNames.timeline", "Timeline"),
        "settings": {}
    }
};

var DEFAULT_SETTINGS = {
    "authUrl":  "../common/auth_credentials.php",
    "boshUrl": "/bosh/"
};

var SharePopUp = new Class({
    Extends: PopUp,

    _selectAll: function(event) {
        event.target.focus();
        event.target.select();
    },

    build: function() {
        var content = new Element("div", {
            "class": "share"
        });

        var urlContainer = new Element("fieldset").inject(content);
        urlContainer.grab(new Element("legend", {
            "text": $tr("ui.link", "url")
        }));
        var urlElement = new Element("input", {
            "class": "url",
            "readonly": "true",
            "events": {
                "click": this._selectAll
            }
        }).inject(urlContainer);

        var rosterContainer = new Element("fieldset").inject(content);
        rosterContainer.grab(new Element("legend", {
            "text": "room members"
        }));
        var rosterElement = new Element("select", {"class":"roster"}).inject(rosterContainer);

        var xmppShare = new Element("button", {
            "text": "Share",
            "events": {
                "click": function() {
                    if (!this.xmpp_conn) return;

                    var index = rosterElement.options.selectedIndex;
                    var option = rosterElement.options[index];
                    var jid = option.value;
                    var url = option.getProperty('share-url');

                    var msg = $msg({
                        "to": jid,
                        "type": "chat"
                    });
                    msg.c("body");
                    msg.t(url);
                    msg.up();
                    msg.c("x", {"xmlns": "vsr#share"});
                    this.xmpp_conn.send(msg.tree());
                }.bind(this)
            }
        }).inject(rosterContainer);

        var jsonContainer = new Element("fieldset").inject(content);
        jsonContainer.grab(new Element("legend", {
            "text": $tr("ui.json", "json")
        }));
        var jsonElement = new Element("textarea", {
            "class": "json",
            "readonly": "true",
            "events": {
                "click": this._selectAll
            }
        }).inject(jsonContainer);

        var csvContainer = new Element("fieldset").inject(content);
        csvContainer.grab(new Element("legend", {
            "text": $tr("ui.csv", "csv")
        }));
        var csvElement = new Element("textarea", {
            "class": "json",
            "readonly": "true",
            "events": {
                "click": this._selectAll
            }
        }).inject(csvContainer);

        return {
            "title": $tr("ui.share", "Share"),

            "element": content,

            "show": function(state, csv, roster) {
                var uri = new URI();
                var data = uri.get("data");
                data.state = JSON.stringify(state);
                uri.set("data", data);

                urlElement.set("value", uri.toString());
                urlElement.focus();
                urlElement.select();

                if (roster) {
                    if (!this.roster) {
                        this.roster = [];
                    }
                    for (var i=0; i<this.roster.length; i++) {
                        this.roster[i].destroy();
                    }

                    var roster_keys = Object.keys(roster);
                    for (var i=0; i<roster_keys.length; i++) {
                        var client_jid = roster[roster_keys[i]][0];
                        var client_type = roster[roster_keys[i]][1];

                        var element = new Element("option", {
                            "value": roster_keys[i],
                            "text": client_jid + "'s " + client_type,
                            "share-url": uri.toString()
                        });
                        element.inject(rosterElement);
                        this.roster.push(element);
                    }
                }

                jsonElement.set("text", JSON.stringify(state, null, 4));

                csvElement.set("text", csv);
            }
        };
    }
});

var NewViewPopUp = new Class({
    Extends: PopUp,

    build: function() {
        var content = new Element("div", {
            "class": "menu"
        });

        var boundHide = this.hide.bind(this);

        return {
            "title": $tr("ui.newView", "New view"),

            "element": content,

            "show": function(options, callback, context) {
                (new Container(options)).forEach(function(info, id) {
                    var option = new Element("div", {
                        "class": "menu-item",
                        "text": info.name,
                        "events": {
                            "click": function() {
                                callback.call(context, info, id);
                                boundHide();
                            }
                        }
                    });
                    content.grab(option);
                });
            },

            "hide": function() {
                content.getChildren().destroy();
            }
        };
    }
});

var HelpPopUp = new Class({
    Extends:PopUp,

    build:function () {
        var content = new Element("div", {
            "class":"help"
        });

        return {
            "title":$tr("ui.help.help", "Help"),

            "element":content,

            "show":function (options, callback, context) {
                var keys = {
                    "General":[
                        ["&#8592;", $tr("ui.help.previous", "Previous view")],
                        ["&#8594;", $tr("ui.help.next", "Next view")],
                        ["&#8595;", $tr("ui.help.zoomOut", "Zoom out")],
                        ["&#8593;", $tr("ui.help.zoomIn", "Zoom in")],
                        ["shift &#8592;", $tr("ui.help.moveLeft", "Move current view to left")],
                        ["shift &#8594;", $tr("ui.help.moveRight", "Move current view to right")],
                        ["hold&nbsp;left-click", $tr("ui.help.hold", "Show detailed information about events")]
                    ],
                    "Timeline and Categorilla":[
                        ["alt scroll", $tr("ui.help.zoomInOut", "Zoom in and out")]
                    ],
                    "Map":[
                        ["shift drag", $tr("ui.help.zoomSelect", "Zoom to selected area")]
                    ]
                };

                var tb = new Element("tbody");
                content.grab(new Element("table").grab(tb));

                Object.each(keys, function (keys, topic) {
                    tb.grab(new Element("tr").grab(new Element("th[colspan=2]").appendText(topic)));

                    keys.each(function (key) {
                        tb.grab(new Element("tr").adopt(
                            new Element("td").set("html", key[0].split(" ").map(
                                function (k) {
                                    return "<span>" + k + "</span>";
                                }).join(" + ")),
                            new Element("td").appendText(key[1])
                        ));
                    });
                });
            },

            "hide":function () {
                content.getChildren().destroy();
            }
        };
    }
});

var NotificationToolTip = new Class({
    Extends: ToolTip,
    options: {
        containerClass: "tooltip notification"
    },
    show: function() {
        this.container.style.opacity = 0;
        this.container.style.display = "";
        this.container.style.opacity = 1;
        return this;
    },
    fade: function() {
        var item = this.item;
        this.container.style.opacity = 0;
        (function() {
            this.container.style.opacity = 1;
            if (item == this.item) this.set(null);
        }).delay(1000, this);
        return this;
    }
});

var Notification = new Class({

    initialize: function(el) {
        this.element = document.id(el);
        this.msgs = [];
        this.alerts = [];

        this.bound = {
            enter: this.list.bind(this)
        };

        this.tooltip = new NotificationToolTip(this.element);

        this.attach();
    },

    show: function() {
        var txt = this.msgs.length > 0 ? this.msgs[this.msgs.length - 1].msg : null;
        this.tooltip.show().set(txt);
        if (this.hidetimeout) clearTimeout(this.hidetimeout);
        this.hidetimeout = this.hide.delay(5000, this);
    },

    list: function() {
        if (this.hidetimeout) clearTimeout(this.hidetimeout);

        var txt = "", msg;
        for (var i = 1; i <= Math.min(this.msgs.length, 6); i++) {
            msg = this.msgs[this.msgs.length - i];
            txt += new Date(msg.time).format("short");
            txt += ": " + msg.msg + "\n";
        }
        this.tooltip.set(txt);
    },

    hide: function() {
        this.tooltip.fade();
    },

    attach: function() {
        this.element.addEvent('mouseenter', this.bound.enter);
    },

    detach: function() {
        this.element.removeEvent('mouseenter', this.bound.enter);
    },

    msg: function(msg, silent) {
        this.msgs.push({time: Date.now(), msg: msg});
        if (!silent || this.alerts.length > 0) this.show();
    },

    alert: function (alert) {
        this.alerts.push(alert);
        this.element.addClass('blink');
    },

    clear: function(alert) {
        this.alerts.erase(alert);
        if (this.alert.length == 0) this.element.removeClass('blink');
    }

});

var OverView = new Class({
    Implements: Observable,

    initialize: function() {
        this.history = new History();
        this.filteredHistory = new FilteredHistory(this.history);

        this.set({
            "selected": null,
            "focus": null,
            "freeze": null,
            "now": Date.now,
            "viewMappings": new Container(DEFAULT_VIEW_MAPPINGS)
        });

        //var tr = new Container($tr.flatten("events"));
    },

    _buildWith: function(selector, func) {
        var element = document.id(selector);
        if (element) {
            return func.call(this, element);
        }
        return null;
    },

    build: function() {
        this._buildWith("timelabel", function(element) {
            var timeLabel = new TimeLabel(element, {
                "now": this.get("now")
            });
            this.bind("focus", timeLabel, "value");

            this._buildWith("timeline-frame", function(timeline) {
                timeline.addClass("hidden");

                element.addEvent("click", function() {
                    document.id("timeline-frame").toggleClass("hidden");
                    this.timeline.relayout();
                    this.timeline.updateImmediately();
                    this.manager.relayout();
                }.bind(this));
            });
        });

        this._buildWith("new-view", function(newView) {
            newView.set("text", $tr("ui.newView", "New view"));

            var popup = new NewViewPopUp();

            newView.addEvents({
                "click": function(event) {
                    popup.show(DEFAULT_VIEW_MAPPINGS, function(info, id) {
                        this.manager.create(id);
                    }, this);
                    event.stopPropagation();
                    event.preventDefault();
                }.bind(this)
            });
        });

        this._buildWith("share", function(share) {
            share.set("text", $tr("ui.share", "Share"));

            var popup = new SharePopUp(this.connection);

            share.addEvents({
                "click": function(event) {
                    if (this.xmpp && !popup.xmpp_conn)
                        popup.xmpp_conn = this.xmpp.connection;

                    var roster = {};
                    var storage = window.sessionStorage;
                    if (storage && storage["roster"])
                        roster = JSON.parse(storage["roster"]);

                    popup.show(this.dumpState(), this.dumpData(), roster);
                    event.stopPropagation();
                    event.preventDefault();
                }.bind(this)
            });
        });

        this._buildWith("help", function(help) {
            help.set("text", "?");

            var popup = new HelpPopUp();

            help.addEvents({
                "click": function(event) {
                    popup.show();
                    event.stopPropagation();
                    event.preventDefault();
                }.bind(this)
            });
        });


        this.timeline = this._buildWith("timeline", function(element) {
            var view = new TimeLine(element, {
                "stepPixels": 9,
                "now": this.get("now")
            });

            view.set("history", this.history);
            this.bind("focus", view, "focus");
            this.bind("freeze", view, "freeze");

            return view;
        });

        this.filter = this._buildWith("filter", function(element) {
            var filter = new FilterView(element);

            filter.observe("filterFunc", function(_, filter) {
                this.filteredHistory.setFilter(filter);
            }, this);

            return filter;
        });

        this.manager = this._buildWith("mainpanel", function(element) {
            var manager = new ViewManager("mainpanel");
            var gesture = null;

            document.id(window).addEvents({
                "keydown": function(event) {
                    var tagRex = /^(button|input|textarea|select)$/i;
                    if (event.target.tagName.match(tagRex)) {
                        return;
                    }

                    if (event.key === "left") {
                        if (event.shift) {
                            manager.moveCurrentViewBy(-1);
                        } else {
                            manager.scrollBy(-1);
                        }
                    } else if (event.key === "right") {
                        if (event.shift) {
                            manager.moveCurrentViewBy(1);
                        } else {
                            manager.scrollBy(1);
                        }
                    } else if (event.key === "up") {
                        manager.zoomBy(-1);
                    } else if (event.key === "down") {
                        manager.zoomBy(1);
                    } else if (event.key === "enter") {
                        manager.zoomTo(0);
                    } else if (event.key === "delete") {
                        manager.remove();
                    } else {
                        return;
                    }
                    event.preventDefault();
                }.bind(this)});

            document.addEventListener("touchstart", function(event) {
                gesture = {e : [], type: null};
                if (event.touches.length == 3 || event.touches.length == 2) event.preventDefault();
            }, true);
            document.addEventListener("touchmove", function(event) {
                if (gesture) {
                    if (event.touches.length == 3 || event.touches.length == 2) {
                        var type = getSwipe(gesture.e, event.touches);
                        if (gesture.type && gesture.type != type && type != null) {
                            gesture = null;
                        } else if (type != null) {

                            var touches = [];
                            for (var i = 0; i < event.touches.length; i++) {
                                touches.push({
                                    pageX: event.touches[i].pageX,
                                    pageY: event.touches[i].pageY
                                });
                            }
                            gesture = {e : touches, type: type};
                        }

                        event.preventDefault();
                    } else {
                        gesture = null;
                    }
                }
            }, true);
            document.addEventListener("touchend", function() {
                if (!gesture) return;
                if (gesture.type == "left") {
                    manager.scrollBy(1);
                } else if (gesture.type == "right") {
                    manager.scrollBy(-1);
                } else if (gesture.type == "up") {
                    manager.zoomTo(Infinity);
                } else if (gesture.type == "down") {
                    manager.zoomTo(0)
                }
                gesture = null;
            }, true);
            document.addEventListener("touchcancel", function(event) {
                gesture = null;
            }, true);

            var getSwipe = function (t1, t2) {
                if (t1.length != t2.length) return false;
                var x,y,dir,tmp;

                for (var i = 0; i < t1.length; i++) {
                    x = t2[i].pageX - t1[i].pageX;
                    y = t2[i].pageY - t1[i].pageY;
                    if (x == 0 && y == 0) continue;
                    tmp = (Math.abs(x) > Math.abs(y)) * ((x > 0) + 2) + (Math.abs(x) <= Math.abs(y)) * (y > 0);
                    if (dir && tmp != dir) return null;
                    dir = tmp;
                }
                return ["up", "down", "left", "right"][dir];
            };

            this.bind("selected", manager, "selected");
            this.bind("freeze", manager, "freeze");
            this.bind("focus", manager, "focus");
            this.bind("viewMappings", manager, "viewMappings");

            manager.set("history", this.filteredHistory);

            return manager;
        });

        document.id(window).addEvents({
            "resize": function() {
                this.relayout();
            }.bind(this)
        });
    },

    relayout: function() {
        if (this.manager) this.manager.relayout();
        if (this.filter) this.filter.relayout();
        if (this.timeline) this.timeline.relayout();
    },

    dumpData: function() {
        var formatRow = function(values) {
            var result = [], val;
            for (var i = 0; i < values.length; i++) {
                val = String.from(values[i]);
                if (val === "") val = '""';
                else {
                    if (val.test('"')) val.replace(/"/g, '""');
                    if (val.test(',')) val = '"' + val + '"';
                }

                result.push(val);
            }
            return result.join(",");
        };

        var focus = this.get("focus");
        if (focus === null) focus = Number.MAX_VALUE;

        var data = [];
        var view = this.filteredHistory.view({
            start: focus,
            end: focus
        });
        view.forEach(function(item) {
            data.push(item.event);
        });
        view.destroy();

        var keys = new Container();
        data.forEach(function(event) {
            event.forEach(function(value, key) {
                keys.set(key, null);
            });
        });
        keys = keys.keys();

        var rows = [];
        rows.push(formatRow(keys));
        data.forEach(function(event) {
            var row = [];
            keys.forEach(function(key) {
                row.push(event.value(key, ""));
            });
            rows.push(formatRow(row));
        });

        return rows.join("\n");
    },

    dumpState: function() {
        var state = {};

        if (this.manager) {
            state.views = this.manager.dumpState();
        }

        if (this.filter) {
            var filter = this.filter.dumpState();
            if (filter) {
                state.filter = filter;
            }
        }

        if (this.timeline) {
            state.timeline = this.timeline.dumpState();
        }

        var focus = this.get("freeze") ? this.get("focus") : null;
        if (focus !== null) {
            state.focus = focus / 1000;
        }

        return state;
    },

    loadState: function(state) {
        state = new Container(state);

        var focus = state.get("focus", null);
        if (focus !== null) {
            this.set("focus", focus * 1000);
            this.set("freeze", true);
        }
        if (this.timeline && state.contains("timeline")) {
            this.timeline.loadState(state.get("timeline"));
        }
        if (this.manager && state.contains("views")) {
            this.manager.loadState(state.get("views"));
        }
        if (this.filter && state.contains("filter")) {
            this.filter.loadState(state.get("filter"));
        }
    }
});

var IncomingPopUp = new Class({
    Extends: PopUp,

    build: function() {
        var content = new Element("div");

        var boundHide = this.hide.bind(this);

        return {
            "title": $tr("ui.incomingView", "Incoming view"),

            "element": content,

            "show": function(user, url) {
                var html = "User "+user+" wants to share a ";
                html = html + "<a href='"+url+"' target='_blank'>view</a>";
                html = html + " with you. ";

                content.grab(new Element("div", {
                    "class": "notification",
                    "html": html
               }));
            },

            "hide": function() {
                content.getChildren().destroy();
            }
        };
    }
});

document.addEventListener("touchmove", function(event) {
    event.preventDefault();
}, false);

document.id(window).addEvent("domready", function() {
    var options = loadAndMerge(DEFAULT_SETTINGS, '../config.json', new URI().get("data"));
    var timeSpan = parseTimeSpan(options.timespan || "7d");

    var now = Date.now;
    var timeBase = Date.parse(options.timebase);
    if (timeBase && !isNaN(timeBase.getTime())) {
        now = (function() {
            var time = timeBase.getTime();
            return function() {
                return time;
            };
        })();
    }

    var overview = new OverView();

    var FIXTURES = [
        new AHEvent({ id: "1", start: "" + now(), end: "" + (now() + 1000) }),
        new AHEvent({ id: "2", start: "" + now(), end: "" + (now() + 1000) }),
        new AHEvent({ id: "3", longitude: "27.3", latitude: "58.5" }),
        new AHEvent({ id: "11", longitude: "27.5", latitude: "58.5" }),
        new AHEvent({ id: "12", longitude: "27.4", latitude: "58.5" }),
        new AHEvent({ id: "13", longitude: "27.3", latitude: "58.5" }),
        new AHEvent({ id: "21", longitude: "27.5", latitude: "58.5" }),
        new AHEvent({ id: "22", longitude: "27.4", latitude: "58.5" }),
        new AHEvent({ id: "23", longitude: "27.3", latitude: "58.5" }),
        new AHEvent({ id: "31", longitude: "27.5", latitude: "58.5" }),
        new AHEvent({ id: "32", longitude: "27.4", latitude: "58.5" }),
        new AHEvent({ id: "33", longitude: "27.3", latitude: "58.5" }),
        new AHEvent({ id: "41", longitude: "27.5", latitude: "58.5" }),
        new AHEvent({ id: "52", longitude: "27.4", latitude: "58.5" }),
        new AHEvent({ id: "53", longitude: "27.3", latitude: "58.5" }),
        new AHEvent({ id: "61", longitude: "27.5", latitude: "58.5" }),
        new AHEvent({ id: "62", longitude: "27.4", latitude: "58.5" }),
        new AHEvent({ id: "73", longitude: "27.3", latitude: "58.5" }),
        new AHEvent({ id: "161", longitude: "27.5", latitude: "58.5" }),
        new AHEvent({ id: "162", longitude: "27.4", latitude: "58.5" }),
        new AHEvent({ id: "173", longitude: "27.3", latitude: "58.5" }),
        new AHEvent({ id: "261", longitude: "27.5", latitude: "58.5" }),
        new AHEvent({ id: "262", longitude: "27.4", latitude: "58.5" }),
        new AHEvent({ id: "273", longitude: "27.3", latitude: "58.5" }),
        new AHEvent({ id: "361", longitude: "27.5", latitude: "58.5" }),
        new AHEvent({ id: "362", longitude: "27.4", latitude: "58.5" }),
        new AHEvent({ id: "373", longitude: "27.3", latitude: "58.5" }),
        new AHEvent({ id: "461", longitude: "27.5", latitude: "58.5" }),
        new AHEvent({ id: "462", longitude: "27.4", latitude: "58.5" }),
        new AHEvent({ id: "473", longitude: "27.3", latitude: "58.5" }),
        new AHEvent({ id: "561", longitude: "27.5", latitude: "58.5" }),
        new AHEvent({ id: "562", longitude: "27.4", latitude: "58.5" }),
        new AHEvent({ id: "573", longitude: "27.3", latitude: "58.5" }),
        new AHEvent({ id: "661", longitude: "27.5", latitude: "58.5" }),
        new AHEvent({ id: "762", longitude: "27.4", latitude: "58.5" }),
        new AHEvent({ id: "773", longitude: "27.3", latitude: "58.5" }),
        new AHEvent({ id: "861377382378", longitude: "27.5", latitude: "58.5" }),
        new AHEvent({ id: "8628374873287", longitude: "27.4", latitude: "58.5" }),
        new AHEvent({ id: "8734732984", longitude: "27.3", latitude: "58.5" })
    ];

    var handleFixtures = function(fixtures, delay) {
        delay = arguments.length > 1 ? delay : 1.0;

        var next = function() {
            if (fixtures.length === 0) return;

            overview.history.add(now(), null, fixtures.shift());
            setTimeout(next, delay);
        };

        next();
    };

    function guard(func, context) {
        try {
            func.call(context);
        } catch (e) {
            // At least Firefox 3.6 on OSX throws a DOMException if we try
            // to access window.sessionStorage or GET a local file.
            if (DOMException && (e instanceof DOMException)) {
            } else {
                throw e;
            }
        }
    }

    var loadState = function(view, stateData) {
        var state = null;

        guard(function() {
            var storage = window.sessionStorage;

            window.addEvent("unload", function() {
                if (!storage) return;
                storage["state"] = JSON.stringify(view.dumpState());
            });

            if (storage && storage["state"]) {
                state = JSON.parse(storage["state"]);
            }
        });

        guard(function() {
            if (state || !stateData) return;

            try {
                state = JSON.parse(stateData);
            } catch (e) {
                state = null;
            }

            if (state === null) {
                var request = new Request.JSON({
                    url: stateData,
                    onSuccess: function(json) {
                        view.loadState(json);
                    },
                    onFailure: function() {
                        alert("Couldn't open state file " + stateData);
                    }
                }).get();
            }
        });

        if (state) {
            view.loadState(state);
        }
    };

    function loadAndMerge() {
        var args = Array.from(arguments), results = {};
        args.each(function(arg) {
            if (typeOf(arg) == "string") {
                try {
                    new Request.JSON({
                        url: arg,
                        async: false,
                        onSuccess: function(json) {
                            results = Object.merge(results, json);
                        }
                    }).get();
                } catch (e) {
                }
            } else {
                results = Object.merge(results, arg);
            }
        });

        return results;
    }

    function parseTimeSpan(s) {
        var parts = new String(s).match(/^(\d+)([mwdh])$/);
        if (!parts) return false;

        var unit;
        switch (parts[2]) {
            case 'm' : unit = 30 * 24 * 60 * 60; break;
            case 'w' : unit = 7 * 24 * 60 * 60; break;
            case 'd' : unit = 24 * 60 * 60; break;
            case 'h' : unit = 60 * 60; break;
        }
        return parts[1] * unit;
    }

    var notify = new Notification('notification');

    if (options.room) {
        var xmpp = new XMPPClient(options.boshUrl, options.room, function(roomJid) {
            var vsr_client = $msg({
                "to": Strophe.getBareJidFromJid(roomJid),
                "type": "groupchat"
            });
            var platform = navigator.platform;
            if (platform !== "iPad" && platform !== "iPhone")
                platform = "browser";

            vsr_client.c("x", {"xmlns": "vsr#client", "type":platform,
                               "jid":Strophe.getBareJidFromJid(this.jid)});

            this.connection.addHandler(function(presence) {
                var children = presence.getChildren("x");
                var sender = presence.getAttribute("from");
                if (children.length == 0 || sender === roomJid) return true;

                var roster = {};
                var storage = window.sessionStorage;
                if (storage && storage["roster"])
                    roster = JSON.parse(storage["roster"]);

                var type = presence.getAttribute("type");
                if (Object.keys(roster).contains(sender) && type === "unavailable") {
                    delete roster[sender];
                    storage["roster"] =  JSON.stringify(roster);
                }
                else if (type !== "unavailable") {
                    this.connection.send(vsr_client.tree());
                }
                return true;
            }.bind(this), "http://jabber.org/protocol/muc#user", "presence",
                null, null, roomJid, {matchBare: true});

            this.connection.addHandler(function(elem) {
                var sender = elem.getAttribute("from");
                if (sender === roomJid) return true;

                var roster = {};
                var storage = window.sessionStorage;
                if (storage && storage["roster"])
                    roster = JSON.parse(storage["roster"]);

                if (Object.keys(roster).contains(sender)) return true;

                var children = elem.getChildren("x");
                var client_type = null;
                var client_jid = null;
                for (var i=0; i<children.length; i++) {
                    if (children[i].getAttribute("xmlns") !== "vsr#client")
                        continue;
                    client_type = children[i].getAttribute("type");
                    client_jid = children[i].getAttribute("jid");
                    break;
                }
                roster[sender] = [client_jid, client_type];
                storage["roster"] =  JSON.stringify(roster);
                return true;
            }, "vsr#client", "message", null, null, null, { matchBare: true });

            var incoming = new IncomingPopUp();
            this.connection.addHandler(function(elem) {
                var children = elem.getChildren("body");
                if (children.length == 0) return true;

                var url = Strophe.getText(children[0]);
                var sender = elem.getAttribute("from");

                var roster = {};
                var storage = window.sessionStorage;
                if (storage && storage["roster"])
                    roster = JSON.parse(storage["roster"]);

                var client = roster[sender];
                if (client.length >= 2) sender = client[0];

                incoming.show(sender, url);
                return true;
            }.bind(this), "vsr#share", "message", null, null, null,
                { matchBare: true });

            this.connection.send(vsr_client.tree());

            var NS = "vsr#historian";
            var msg = function(type, data) {
                var jid = Strophe.getBareJidFromJid(roomJid);
                var msg = $msg({
                    "to": jid + "/historian",
                    "type": "chat"
                });
                msg.c(type, { "xmlns": NS });
                msg.t(JSON.stringify(data));
                this.connection.send(msg.tree());
            }.bind(this);

            var parseHistory = function(history, element) {
                var nodes = element.childNodes;

                for (var i = 0, len = nodes.length; i < len; i++) {
                    var node = nodes[i];
                    if (!node.tagName) continue;
                    if (node.tagName.toLowerCase() !== "dump") continue;
                    if (node.getAttribute("xmlns") !== NS) continue;

                    var info = JSON.parse(node.textContent);

                    if (info.events) {
                        info.events.forEach(function(item) {
                            item = new Container(item);

                            var start = item.get("start", -Infinity) * 1000;
                            var end = item.get("end", Infinity) * 1000;
                            var event = new AHEvent(item.get("event"));

                            history.add(start, end, event);
                        });
                    }

                    if (!info.done && info.remains <= 0) {
                        msg("load", {
                            "id": info.id,
                            "size": 100
                        });
                    }
                }
            };

            var end = now() / 1000;
            msg("start", {
                "id": "now",
                "start": end - timeSpan,
                "end": end
            });
            for (var i = 0; i < 3; i++) {
                msg("load", {
                    "id": "now",
                    "size": 100
                });
            }

            return function(element) {
                var history = overview.history;
                parseHistory(history, element);

                var timestamp = parseStanzaDelay(element, Date.now());
                var events = AHEvent.fromElements(element.childNodes);
                events.forEach(function(event) {
                    history.add(timestamp, null, event);
                });
            };
        }, { authUrl: options.authUrl });

        overview.xmpp = xmpp;
        xmpp.addEvents({
            "disconnect": function() {
                notify.alert("reconnect");
                notify.msg("Disconnected from server.")
            },
            "join" : function(){
                notify.msg("Connected to server.", true);
                notify.clear("reconnect");
            }
        });
    } else {
        handleFixtures(FIXTURES, 100);
    }

    overview.set({
        "now": now
    });
    overview.build();
    loadState(overview, options.state);
});
