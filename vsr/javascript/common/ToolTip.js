var ToolTip = new Class({
    Implements: Options,

    options: {
        containerClass: "tooltip",
        contentClass: "tooltip-content"
    },

    initialize: function(attached, options) {
        this.setOptions(options);

        this.container = this.build();
        this.container.style.display = "none";
        document.id(document.body).grab(this.container);

        this.size = null;
        this.item = null;
        this.pos = null;

        this.windowSize = document.id(window).getSize();
        this.resize = function() {
            this.windowSize = document.id(window).getSize();
        }.bind(this);

        document.id(window).addEventListener("resize", this.resize, false);

        this._enter = function(event) {
            this._move(event.event);
        }.bind(this);

        this._move = function(event) {
            this.pos = { x: event.clientX, y: event.clientY };
            this._position();
        }.bind(this);

        this._leave = function(event) {
            this.pos = null;
            this.set(null);
        }.bind(this);

        this.attached = attached;
        this.attached.addEvent("mouseenter", this._enter);
        this.attached.addEventListener("mousemove", this._move, false);
        this.attached.addEvent("mouseleave", this._leave);
    },

    _position: function() {
        if (this.item === null || this.pos === null) return;

        if (!this.size) {
            this.container.style.display = "";
            this.size = this.container.getSize();
        }

        var x = this.pos.x;
        var y = this.pos.y;

        if (this.pos.y + 20 + this.size.y > this.windowSize.y) {
            y -= this.size.y + 5;
        } else {
            y += 15;
        }

        if (this.pos.x + 20 + this.size.x > this.windowSize.x) {
            x -= this.size.x + 5;
        } else {
            x += 15;
        }

        this.container.style.left = x + "px";
        this.container.style.top = y + "px";
    },

    destroy: function() {
        this.attached.removeEvent("mouseenter", this._enter);
        this.attached.removeEventListener("mousemove", this._move, false);
        this.attached.removeEvent("mouseleave", this._leave);

        document.id(window).removeEventListener("resize", this.resize, false);

        this.container.destroy();
    },

    set: function(item) {
        if (this.item === item) return;

        this.item = item;
        this.size = null;

        if (this.item === null) {
            this.container.style.display = "none";
        } else {
            this.decorate(this.container, item);
            this._position();
        }
    },

    build: function() {
        var content = new Element("div", {
            "class": this.options.contentClass
        });
        var container = new Element('div', {
            "class": this.options.containerClass,
            "styles": {
                "position": "fixed",
                "left": 0,
                "top": 0
            }
        }).adopt(content);

        container._content = content;
        return container;
    },

    decorate: function(container, item) {
        container._content.set("text", item);
    }
});

var ToolTrip = new Class({
    initialize: function(attached) {
        this.pos = null;
        this.element = null;

        this.build();

        this._enter = function(event) {
            this._move(event.event);
        }.bind(this);

        this._move = function(event) {
            this.pos = { x: event.clientX, y: event.clientY };
        }.bind(this);

        this.attached = attached;
        this.attached.addEvent("mouseenter", this._enter);
        this.attached.addEventListener("mousemove", this._move, false);
    },

    build: function() {
        this.shade = new Element("div", {
            "class": "tooltrip-shade",
            "styles": {
                "position": "fixed",
                "left": "0px",
                "right": "0px",
                "top": "0px",
                "bottom": "0px",
                "z-index": "10001"
            },
            "events": {
                "click": function(event) {
                    this.set(null)
                }.bind(this)
            }
        });

        this.container = new Element("div", {
            "class": "tooltrip",
            "styles": {
                "position": "absolute",
                "padding": "0px",
                "padding-left": "10px",
                "padding-right": "10px",
                "z-index": "10002"
            }
        }).inject(this.shade);

        this.content = new Element("div", {
            "class": "tooltrip-content",
            "styles": {
                "position": "relative"
            },
            "events": {
                "click": function(event) {
                    event.stopPropagation();
                    return false;
                }
            }
        }).inject(this.container);

        this.arrow = new Element("div", {
            "class": "tooltrip-arrow tooltrip-arrow-left"
        }).inject(this.container);
    },

    destroy: function() {
        this.attached.removeEvent("mouseenter", this._enter);
        this.attached.removeEventListener("mousemove", this._move, false);
        this.shade.destroy();
    },

    set: function(content) {
        if (this.element === content) {
            return;
        }

        if (this.element) {
            this.element.destroy();
            this.element = null;
        }
        this.element = content;

        if (content === null) {
            this.shade.dispose();
            return;
        }
        this.shade.inject(document.id(document.body));

        var x = this.pos.x;
        var y = this.pos.y;

        this.element = content;
        this.content.adopt(content);

        var windowSize = this.shade.getSize();
        var size = this.container.getSize();

        if (x <= windowSize.x / 2) {
            this.container.style.left = x + "px";
            this.container.style.right = "";

            this.arrow.removeClass("tooltrip-arrow-right");
            this.arrow.addClass("tooltrip-arrow-left");
        } else {
            this.container.style.left = "";
            this.container.style.right = (windowSize.x-x) + "px";

            this.arrow.removeClass("tooltrip-arrow-left");
            this.arrow.addClass("tooltrip-arrow-right");
        }

        var top = Math.min(Math.max(0, y-30), windowSize.y-size.y-40);
        this.container.style.top = top + "px";
        this.arrow.style.top = Math.min(Math.max(20, y-top-10), size.y) + "px";
    }
});

