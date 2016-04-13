(function(exports) {
    "use strict";

    // Using translate(offset, 0px) for scrolling the strip element seems
    // to cause flicker on Safari and MobileSafari when
    // animated. translate3d(offset, 0px, 0px) on the other hand seems to
    // cause scrollbars to freak out in Safari. This can be alleviated by
    // settings -webkit-transition: translate3d(0px, 0px, 0px) in the
    // container elements.

    var SettingsPopUp = new Class({
        Extends: PopUp,

        initialize: function(view) {
            this.view = view;
            this.parent();
        },

        getTitle: function() {
            return "Settings"
        },

        build: function() {
            var built = this.view.settingsView().build();
            var container = new Element("div", {
                "class": "settings"
            });
            container.grab(built.element);

            return {
                "title": $tr("ui.settings", "Settings"),

                "element": container,

                "destroy": function() {
                    container.destroy();
                    built.destroy();
                }
            };

        }
    });

    var ViewManager = exports.ViewManager = new Class({
        Extends: View,
        Implements: Observable,

        DEFAULT_UPDATE_DELAY: 0.0,

        initialize: function(container) {
            this.parent(container);
            this.container.addClass("view-manager");
            this.container.setStyles({
                "overflow": "hidden"
            });

            this.strip = new Element("div", {
                "class": "strip",
                "styles": {
                    "position": "absolute",
                    "top": 0,
                    "left": 0,
                    "height": "100%",
                    "width": "100%"
                }
            }).inject(this.container);

            this.set({
                "viewMappings": null,
                "selected": null,
                "freeze": null,
                "focus": null,
                "history": null
            });

            this.views = [];
            this.origin = 0;
            this.current = 0;
            this.zoomLevel = 0;
            this._position();
        },

        create: function(type, name, args) {
            var mapping = (new Container(this.get("viewMappings"))).get(type);
            if (!mapping || !mapping.type) return null;
            mapping = new Container(mapping);

            var barContainer = new Element("div", {
                "class": "view-bar-container"
            });
            var bar = new Element("div", {
                "class": "view-bar"
            }).inject(barContainer);

            var settings = new Element("div", {
                "class": "clickable settings-button",
                "text": $tr("ui.settings", "Settings"),
                "events": {
                    "click": function() {
                        view.settings.show();
                    }.bind(this)
                }
            }).inject(bar);

            var title = new Element("input", {
                "class": "title",
                "type": "text",
                "value": (name == null ? mapping.get("name") : name) || ""
            }).inject(bar);

            var remove = new Element("div", {
                "class": "clickable remove-button",
                "text": $tr("ui.removeView", "Remove"),
                "events": {
                    "click": function() {
                        this.remove(this.views.indexOf(view));
                    }.bind(this)
                }
            }).inject(bar);

            var wrapper = new Element("div", {
                "class": "view-wrapper",
                "styles": {
                    "position": "absolute",
                    "top": 0,
                    "left": 0,
                    "width": "80%",
                    "height": "100%",
                    "visibility": "hidden"
                }
            });
            var container = new Element("div", {
                "class": "view-container",
                "styles": {
                    "-webkit-transform": "translate3d(0px, 0px, 0px)"
                }
            });
            wrapper.adopt(container, barContainer);
            this.strip.grab(wrapper);

            var constructor = mapping.get("type");
            var instance = new ViewFilterWrapper(new constructor(container));
            var view = {
                "type": type,
                "settings": new SettingsPopUp(instance),
                "title": title,
                "instance": instance,
                "container": container,
                "wrapper": wrapper,
                "hidden": true,
                "bindings": new Container({
                    "history": this.bind("history", instance, "history"),
                    "focus": this.bind("focus", instance, "focus"),
                    "freeze": this.bind("freeze", instance, "freeze"),
                    "selected": this.bind("selected", instance, "selected")
                })
            };

            container.addEventListener("mousedown", function(event) {
                var index = this.views.indexOf(view);
                if (index >= this.origin && index < this.origin + this.zoomLevel + 1) {
                    return;
                }

                if (document.activeElement && document.activeElement.blur) {
                    document.activeElement.blur();
                }

                this.scrollTo(index);
                event.stopPropagation();
                event.preventDefault();
                return false;
            }.bind(this), true);

            if (instance.loadState) {
                var settings = new Container(mapping.get("settings"));
                (new Container(args)).forEach(function(value, key) {
                    settings.set(key, value);
                });
                instance.loadState(settings.valueOf());
            }

            var index = this.views.length <= 0 ? 0 : this.current + 1;
            this.views.splice(index, 0, view);
            this.scrollTo(index);
            this.update(0.0);
        },

        scrollTo: function(index) {
            if (index >= this.views.length) {
                index = this.views.length-1;
            }
            if (index < 0) {
                index = 0;
            }

            if (this.current < this.views.length) {
                this.views[this.current].wrapper.removeClass("selected");
            }
            this.current = index;
            if (this.current < this.views.length) {
                this.views[this.current].wrapper.addClass("selected");
            }

            if (this.current < this.origin) {
                this.origin = this.current;
            } else if (this.origin + this.zoomLevel < this.current) {
                this.origin = this.current - this.zoomLevel;
            }

            this._position();
        },

        scrollBy: function(delta) {
            this.scrollTo(this.current + delta);
        },

        _position: function() {
            var width = this.width();

            var level = Math.max(Math.min(this.zoomLevel + 1, this.views.length), 1);
            var zoom = 1.0 / (level * 0.8 + 0.2);

            var index = this.current;
            if (index > this.views.length - level) {
                index = this.views.length - level;
            }

            var scale = "scale3d(" + zoom + ", " + zoom + ", 1)";

            var offset = (zoom * (10 - 80 * (this.origin + (level - 1) / 2))) + "%";
            var translate = "translate3d(" + offset + ", 0px, 0px)";

            this.strip.style.webkitTransformOrigin = "50% 50%";
            this.strip.style.webkitTransform = translate + " " + scale;
        },

        remove: function(index) {
            if (arguments.length === 0) {
                index = this.current;
            }
            if (index < 0 || index >= this.views.length) {
                return;
            }

            var view = this.views[index];
            this.views.splice(index, 1);

            view.bindings.forEach(function(binding, _) {
                binding.unbind();
            });
            view.bindings.forEach(function(_, key) {
                view.instance.set(key, null);
            });

            view.instance.destroy();
            view.container.destroy();
            view.wrapper.destroy();
            view.settings.destroy();

            if (this.current > index) {
                this.current -= 1;
            }
            this.scrollTo(this.current);
            this.zoomTo(this.zoomLevel);
            this.update();
        },

        zoomTo: function(level) {
            level = Math.max(Math.min(this.views.length-1, level), 0);
            this.zoomLevel = level;

            if (this.origin > this.current || this.current > this.origin + level) {
                this.origin = this.current;
            }
            if (this.origin > this.views.length - 1 - level) {
                this.origin = this.views.length - 1 - level;
            }

            this._position();
        },

        zoomBy: function(level) {
            this.zoomTo(this.zoomLevel + level);
        },

        moveCurrentViewTo: function(index) {
            if (this.views.length === 0) return;

            if (index < 0) {
                index = 0;
            } else if (index >= this.views.length) {
                index = this.views.length-1;
            }

            var view = this.views[this.current];
            this.views.splice(this.current, 1);

            this.views.splice(index, 0, view);
            this.current = index;

            this.update();
        },

        moveCurrentViewBy: function(delta) {
            this.moveCurrentViewTo(this.current + delta);
        },

        doUpdate: function() {
            var width = this.width();
            var height = this.height();

            this.views.forEach(function(view, index) {
                view.wrapper.style.left = (80 * index) + "%";
                if (view.hidden) {
                    view.wrapper.style.visibility = "";
                    view.hidden = false;
                }
                view.instance.relayout();
            });

            this.scrollTo(this.current);
        },

        dumpState: function() {
            return this.views.map(function(view) {
                var state = {
                    "type": view.type,
                    "name": view.title.value
                };

                if (view.instance.dumpState) {
                    var settings = new Container(view.instance.dumpState());
                    state.settings = settings.valueOf();
                }
                return state;
            });
        },

        loadState: function(state) {
            state.forEach(function(obj) {
                obj = new Container(obj);
                if (obj.contains("type")) {
                    var type = obj.get("type");
                    var name = obj.get("name");
                    this.create(type, name, obj.get("settings"));
                }
            }, this);

            this.scrollTo(0);
        }
    });
})(this);
