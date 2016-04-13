(function(exports) {
    var PopUp = exports.PopUp = new Class({
        initialize: function() {
            this._container = new Element("div", {
                "class": "popup-container",
                "events": {
                    "click": function(event) {
                        this.hide();
                        event.stopPropagation();
                        event.preventDefault();
                        return false;
                    }.bind(this)
                }
            });

            this._popup = new Element("div", {
                "class": "popup"
            }).inject(this._container);

            this._built = this.build();
            if (this._built && this._built.title) {
                new Element("div", {
                    "class": "popup-title",
                    "text": this._built.title
                }).inject(this._popup);
            }

            this._closeButton = new Element("div", {
                "class": "popup-close-button",
                "events": {
                    "click": function() {
                        this.hide();
                    }.bind(this)
                }
            }).inject(this._popup);

            this._content = new Element("div", {
                "class" : "popup-content",
                "events": {
                    "click": function(event) {
                        event.stopPropagation();
                    }
                }
            }).inject(this._popup);

            if (this._built && this._built.element) {
                this._content.grab(this._built.element);
            }
        },

        build: function() {
            return null;
        },

        show: function() {
            this._container.inject(document.id(document.body));
            if (this._built && this._built.show) {
                this._built.show.apply(this._built, arguments);
            }
        },

        hide: function() {
            if (this._built && this._built.hide) {
                this._built.hide.apply(this._built, arguments);
            }
            this._container.dispose();
        },

        destroy: function() {
            if (this._built && this._built.destroy) {
                this._built.destroy.apply(this._built, arguments);
            }
            this._container.destroy();
        }
    });
})(this);
