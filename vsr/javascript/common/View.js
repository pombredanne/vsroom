(function(exports) {
    "use strict";

    var now = Date.now;

    var urlRex = /https?:\/\/[^<>\s]+\.[^<>\s]+/i;
    var elementize = function(txt) {
        if (urlRex.test(txt)) {
            return new Element('a', {
                href: txt,
                text: txt,
                target: '_blank',
                rel: 'noreferer'
            });
        }
        return document.createTextNode(txt);
    };

    var Updater = exports.Updater = function() {
    };

    Updater.prototype = {
        DEFAULT_UPDATE_DELAY: 40,

        _updateTimeout: null,
        _updateImmediatelyBound: null,

        cancelUpdate: function() {
            if (this._updateTimeout) {
                clearTimeout(this._updateTimeout.handle);
                this._updateTimeout = null;
            }
        },

        updateImmediately: function() {
            this.cancelUpdate();
            this.doUpdate();
        },

        update: function(delay) {
            delay = (arguments.length < 1) ? this.DEFAULT_UPDATE_DELAY : delay;

            var timeout = this._updateTimeout;
            var time = now() + delay;
            if (timeout && timeout.time <= time) return;

            if (timeout) {
                clearTimeout(timeout.handle);
            }
            if (!this._updateImmediatelyBound) {
                var _this = this;
                this._updateImmediatelyBound = function() {
                    _this.updateImmediately();
                };
            }
            this._updateTimeout = {
                "time": time,
                "handle": setTimeout(this._updateImmediatelyBound, delay)
            };
        },

        doUpdate: function() {
        }
    };

    var View = exports.View = new Class({
        Implements: Updater,

        initialize: function(container) {
            this.container = document.id(container);
            this._width = this.container.offsetWidth;
            this._height = this.container.offsetHeight;

            var _this = this;
            setTimeout(function() { _this.relayout() }, 0);

            this.toolTip = new ToolTip(this.container);
            this.toolTrip = new ToolTrip(this.container);
        },

        destroy: function() {
            this.toolTip.destroy();
            this.toolTrip.destroy();
        },

        setToolTip: function(obj) {
            this.toolTip.set(this.formatToolTip(obj));
        },

        formatToolTip: function(obj) {
            return obj;
        },

        setToolTrip: function(obj) {
            this.toolTrip.set(this.formatToolTrip(obj));
        },

        width: function() {
            return this._width;
        },

        height: function() {
            return this._height;
        },

        eventOffset: function(event) {
            var offsetX = event.offsetX;
            if (offsetX != null) {
                return {
                    "x": offsetX,
                    "y": event.offsetY
                };
            }

            var layerX = event.layerX;
            if (layerX != null) {
                return {
                    "x": layerX,
                    "y": event.layerY
                };
            }

            var point = new WebKitPoint(event.pageX, event.pageY);
            point = webkitConvertPointFromPageToNode(event.target, point);
            return {
                "x": point.x,
                "y": point.y
            };
        },

        relayout: function() {
            this._width = this.container.offsetWidth;
            this._height = this.container.offsetHeight;
            this.update(0.0);
        }
    });

    var PointerInfo = exports.PointerInfo = new Class({
        initialize: function() {
        },

        createFilter: function() {
            return function(id, event) {
                return false;
            };
        },

        select: function(data, seed) {
            var selected = new Container(seed);
            var filter = this.createFilter();

            data.forEach(function(event, id) {
                var seeded = selected.get(id);
                if (seeded !== event) {
                    if (filter(id, event)) {
                        selected.set(id, event);
                    } else if (seeded) {
                        selected.pop(id);
                    }
                }
            });

            return selected;
        },

        formatTip: function(data) {
            return "";
        }
    });

    var EmptyPointerInfo = new Class({
        Extends: PointerInfo,

        select: function() {
            return new Container();
        },

        formatTip: function() {
            return null;
        }
    });
    PointerInfo.EMPTY = new EmptyPointerInfo();

    PointerInfo.IGNORED = null;

    var PointerView = exports.PointerView = new Class({
        _currentInfo: null,

        _handleInfo: function(info) {
            if (info === PointerInfo.IGNORED) {
                return;
            }
            if (info === this._currentInfo) {
                return;
            }
            this._currentInfo = info;
            this.setToolTip(info);
        },

        listenPointerEvents: function(element, pointerEvents, ctx) {
            pointerEvents = new Container(pointerEvents);

            var pointerEnter = pointerEvents.get("enter");
            var pointerPoint = pointerEvents.get("point");
            var pointerLeave = pointerEvents.get("leave");

            var _this = this;

            var enter = function(event) {
                var info = null;
                if (pointerEnter) info = pointerEnter.call(ctx);
                if (pointerPoint) info = pointerPoint.call(ctx, event.event);
                _this._handleInfo(info);
            };
            var point = function(event) {
                var info = pointerPoint.call(ctx, event);
                _this._handleInfo(info);
            };
            var leave = function(event) {
                if (pointerLeave) pointerLeave.call(ctx);
                _this._handleInfo(null);
            };

            var mouse = null;
            var start = function(event) {
                if (mouse !== null) {
                    return false;
                }
                mouse = {
                    "timer": setTimeout(show, 400),
                    "x": event.clientX,
                    "y": event.clientY
                };
                window.addEventListener("mousemove", move, true);
                return true;
            };
            var end = function(event) {
                if (!mouse) {
                    return false;
                }
                clearTimeout(mouse.timer);
                mouse = null;
                return true;
            };
            var move = function(event) {
                if (!mouse) {
                    return true;
                }

                if ((Math.abs(mouse.x-event.clientX) > 5) ||
                    (Math.abs(mouse.y-event.clientY) > 5)) {
                    end();
                } else {
                    event.stopPropagation();
                }
            };
            var select = function(toggle) {
                var data = _this.get("data");
                if (!data || !_this._currentInfo) {
                    _this.set("selected", null);
                    return;
                }

                var selected = _this._currentInfo.select(data);
                if (toggle && selected.equals(_this.get("selected"))) {
                    _this.set("selected", null);
                } else {
                    _this.set("selected", selected);
                }
            };
            var show = function() {
                if (end()) {
                    select(false);
                    _this.setToolTrip(true);
                    _this.setToolTip(null);
                }
            };
            var checkButton = function(event) {
                return event.button === 0 && !event.ctrlKey;
            };
            var down = function(event) {
                if (!checkButton(event.event)) {
                    return true;
                }
                if (_this._currentInfo !== PointerInfo.IGNORED) {
                    start(event.event);
                }
                event.preventDefault();
                return false;
            };
            var up = function(event) {
                if (!checkButton(event.event)) {
                    return true;
                }
                if (end()) {
                    select(true);
                    event.preventDefault();
                    return false;
                }
            };

            element.addEvents({
                "mouseenter": enter,
                "mouseleave": leave,
                "mousedown": down,
                "mouseup": up
            });
            if (pointerPoint) {
                element.addEventListener("mousemove", point, false);
            }

            return {
                unlisten: function() {
                    element.removeEventListener("mousemove", point, false);
                    element.removeEvents({
                        "mouseenter": enter,
                        "mouseleave": leave,
                        "mousedown": down,
                        "mouseup": up
                    });
                }
            };
        },

        formatToolTip: function(info) {
            if (!info) return null;
            return info.formatTip(this.get("data") || new Container());
        },

        formatToolTrip: function(value) {
            if (!value) return null;

            var selected = this.get("selected");
            if (!selected) return null;

            var data = this.get("data");
            var content = null;

            selected.forEach(function(value, id) {
                var event = data.get(id);
                if (!event) return null;

                var keys = new Container();
                event.forEach(function(value, key) {
                    var values = keys.get(key) || [];
                    values.push(value);
                    keys.set(key, values);
                });

                if (keys.count() === 0) {
                    return;
                }

                if (!content) {
                    content = new Element("div");
                }

                var item = new Element("div", {
                    "class": "tooltrip-item"
                });

                keys.forEach(function(values, key) {
                    var keyValue = new Element("div", {
                        "class": "tooltrip-key-value"
                    });

                    keyValue.grab(new Element("div", {
                        "class": "tooltrip-key",
                        "text": key + ": "
                    }));

                    if (values.length === 1) {
                        keyValue.grab(new Element("div", {
                            "class": "tooltrip-value-single"
                        }).adopt(elementize(values[0])));
                    } else {
                        var ul = new Element("ul", {
                            "class": "tooltrip-value-list"
                        });
                        values.forEach(function(value) {
                            ul.grab(new Element("li", {
                                "class": "tooltrip-value-multi"
                            }).adopt(elementize(value)));
                        });
                        keyValue.grab(ul);
                    }
                    item.grab(keyValue);
                });

                content.grab(item);
            });

            return content;
        }
    });

    var CanvasView = exports.CanvasView = new Class({
        Extends: View,

        initialize: function(container) {
            this.parent(container);

            this.canvas = new Element("canvas");
            this.canvas.setStyles({
                position: "relative",
                width: "100%",
                height: "100%"
            });
            this.context = this.canvas.getContext("2d");
            this.container.grab(this.canvas);
        },

        doUpdate: function() {
            var canvas = this.canvas;
            var width = this.width();
            var height = this.height();
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
            }
            this.paint(this.context);
        },

        paint: function(ctx) {
        }
    });
})(this);

(function(exports) {
    var FieldSet = exports.FieldSet = new Class({
        initialize: function(fields, options) {
            this.fields = fields;
            this.options = new Container(options);
        },

        build: function() {
            var set = new Element("fieldset", {
                "class": "fieldset"
            });

            if (this.options.contains("legend")) {
                set.grab(new Element("legend", {
                    "class": "fieldset-legend",
                    "text": this.options.get("legend")
                }));
                set.addClass("with-legend");
            } else {
                set.addClass("without-legend");
            }

            if (this.options.contains("class")) {
                set.addClass(this.options.get("class"));
            }

            var args = [];
            args.push.apply(args, arguments);

            var built = [];
            this.fields.forEach(function(field) {
                var obj = field.build.apply(field, args);
                built.push(obj);
                set.grab(obj.element);
                obj.element.addClass("fieldset-field");
            });

            return {
                "element": set,

                "destroy": function() {
                    built.forEach(function(obj) {
                        obj.destroy();
                    });
                    this.element.destroy();
                }
            };
        }
    });

    var InputField = exports.InputField = new Class({
        initialize: function(observable, key, options) {
            this.observable = observable;
            this.key = key;
            this.options = options;
        },

        createElement: function(options) {
            return new Element("input", {
                "type": options.get("type", "text"),
                "placeholder": options.get("placeholder")
            });
        },

        bindElement: function(element, observable, key, options) {
            var observableInput = new ObservableInput(element);

            var validator = null;
            var validate = options.get("validate");
            if (validate) {
                validator = observable.observe(key, function(_, value) {
                    if (validate(value)) {
                        element.addClass("valid");
                        element.removeClass("invalid");
                    } else {
                        element.addClass("invalid");
                        element.removeClass("valid");
                    }
                });
            }

            return {
                "binding": observable.bind(key, observableInput, "value"),
                "validator": validator
            };
        },

        unbindElement: function(binding) {
            binding.binding.unbind();
            if (binding.validator) binding.validator.unobserve();
        },

        destroyElement: function(element) {
            element.removeEvents();
            element.destroy();
        },

        build: function() {
            var options = new Container(this.options);

            var main = new Element("div", {
                "class": "inputfield"
            });
            if (options.contains("class")) {
                main.addClass(options.get("class"));
            }

            if (options.contains("label")) {
                var label = new Element("label", {
                    "class": "inputfield-label",
                    "text": options.get("label")
                });
                main.addClass("with-label");
                main.grab(label);
            } else {
                main.addClass("without-label");
            }

            var element = this.createElement(options);
            element.addClass("inputfield-input");
            main.grab(element);

            var key = this.key;
            var observable = this.observable;
            var binding = this.bindElement(element, observable, key, options);

            var _this = this;
            return {
                "element": main,

                "destroy": function() {
                    _this.unbindElement(binding);
                    _this.destroyElement(element);
                    this.element.destroy();
                }
            };
        }
    });

    var CheckboxField = exports.CheckboxField = new Class({
        Extends: InputField,

        createElement: function(options) {
            var element = new Element("input", {
                "type": "checkbox",
                "placeholder": options.get("placeholder")
            });

            this.checkbox = element;
            this.observable.observe(this.key, function(_, value) {
                if (value) {
                    this.checkbox.setProperty("checked", true);
                }
                else {
                    this.checkbox.setProperty("checked", false);
                }
            }.bind(this));

            return element;
        }
    });

})(this);

(function(exports) {
    var parseNumber = Number;

    var EVENT_COMBINERS = exports.EVENT_COMBINERS = new Container({
        "max": {
            "title": "max",
            "combine": Math.max
        },

        "min": {
            "title": "min",
            "combine": Math.min
        },

        "sum": {
            "title": "sum",
            "combine": function(left, right) {
                return left + right;
            }
        }
    });

    EVENT_COMBINERS.create = function(item) {
        if (!item) return null;
        if (item.key === null) return null;

        var info = item.func && EVENT_COMBINERS.get(item.func);
        if (!info) return null;

        var key = item.key;
        return {
            "title": info.title + "(" + key + ")",

            "map": function(event) {
                return event.value(key, null, parseNumber)
            },

            "combine": info.combine
        };
    };

    var CombinerSelect = new Class({
        Extends: InputField,

        createElement: function() {
            var select = new Element("select", {
                "class": "select"
            });

            select.grab(new Element("option", {
                "value": "",
                "text": $tr("ui.settings.eventCount", "# events")
            }));

            return select;
        },

        bindElement: function(element) {
            return {
                binding: this.parent.apply(this, arguments),

                observer: EVENT_COMBINERS.observe(function(id, item, option) {
                    if (!item) {
                        if (option) option.destroy();
                        return null;
                    }

                    option = option || new Element("option", {
                        "value": id
                    }).inject(element);

                    option.set("text", item.title);
                    return option;
                })
            };
        },

        unbindElement: function(obj) {
            obj.observer.unobserve();
            this.parent(obj.binding);
        }
    });

    var CombinerInput = new Class({
        initialize: function(observable, key, options) {
            this.observable = observable;
            this.key = key;
            this.options = options;
        },

        build: function() {
            var state = new Observable({
                "func": null,
                "key": null
            });
            var select = new CombinerSelect(state, "func").build();
            var input = new InputField(state, "key").build();

            var div = new Element("div");
            div.grab(select.element);
            div.grab(input.element);

            var observers = [
                this.observable.observe(this.key, function(key, value) {
                    state.set({
                        "func": value ? value.func : null,
                        "key": value ? value.key : null
                    });
                }),

                state.observe(function() {
                    var func = state.get("func");
                    var key = state.get("key");
                    var old = this.observable.get(this.key);

                    if (!EVENT_COMBINERS.contains(func)) {
                        input.element.setStyle("visibility", "hidden");
                    } else {
                        input.element.setStyle("visibility", "");
                    }

                    if (!func) {
                        if (old) this.observable.set(this.key, null);
                    } else {
                        if (!old || old.func !== func || old.key !== key) {
                            this.observable.set(this.key, {
                                "func": func,
                                "key": key
                            });
                        }
                    }
                }, this)
            ];

            return {
                "element": div,

                "destroy": function() {
                    observers.forEach(function(observer) {
                        observer.unobserve();
                    });
                    input.destroy();
                    select.destroy();
                    div.removeEvents();
                    div.destroy();
                }
            };
        }
    });

    EVENT_COMBINERS.Input = new Class({
        Extends: FieldSet,

        initialize: function(observable, key, options) {
            this.parent([new CombinerInput(observable, key)], options);
        }
    });
})(this);
