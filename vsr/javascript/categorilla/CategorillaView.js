(function(exports) {
    "use strict";

    var tuple = function(x, y) {
        return x + "\x00" + y;
    };

    var numRex = /(-?\d+\.\d*|-?\d+)|([^-\d]+)/g;
    var numCmp = function(left, right) {
        var index = 0;
        var lLength = left.length;
        var rLength = right.length;

        while (index < lLength && index < rLength) {
            numRex.lastIndex = index;
            var lMatch = numRex.exec(left);

            numRex.lastIndex = index;
            var rMatch = numRex.exec(right);

            var lStr = lMatch[1];
            var rStr = rMatch[1];
            if (lStr != null && rStr != null) {
                var lNum = Number(lMatch[1]);
                var rNum = Number(rMatch[1]);
                if (lNum < rNum) return -1;
                if (lNum > rNum) return 1;
            } else if (lMatch[1] != null) {
                return -1;
            } else if (rMatch[1] != null) {
                return 1;
            } else {
                lStr = lMatch[2];
                rStr = rMatch[2];
            }

            if (lStr < rStr) return -1;
            if (lStr > rStr) return 1;

            index += lStr.length;
        }

        if (index < rLength) return -1;
        if (index < lLength) return 1;
        return 0;
    };

    var EventGrouper = new Class({
        initialize: function() {
            this.events = new Container();
            this.groups = new Container();
            this._ids = null;
        },

        ids: function() {
            if (this._ids === null) {
                this._ids = this.groups.keys();
                this._ids.sort(numCmp);
            }
            return this._ids;
        },

        count: function(name) {
            return this.groups.get(name, {
                "refcount": 0
            }).refcount;
        },

       event: function(name) {
            return this.groups.get(name, {
                "events": new Container()
            }).events;
        },

        set: function(id, event, groups) {
            this._ids = null;

            var old = this.events.pop(id, []);
            old.forEach(function(name) {
                var group = this.groups.get(name);

                group.refcount -= 1;
                if (group.refcount <= 0) {
                    this.groups.pop(name);
                } else {
                    group.events.pop(id);
                }
            }, this);

            if (groups.length > 0) {
                groups.forEach(function(name) {
                    var group = this.groups.get(name) || {
                        "refcount": 0,
                        "events": new Container()
                    };

                    group.refcount += 1;
                    group.events.set(id, event);

                    this.groups.set(name, group);
                }, this);

                this.events.set(id, groups);
            }
        }
    });

    var MyCategorillaDelegate = new Class({
        initialize: function() {
            this.xs = new EventGrouper();
            this.ys = new EventGrouper();
            this.xys = new EventGrouper();

            this.xKey = null;
            this.yKey = null;
            this.combiner = null;

        },

        xy: function(x, y) {
            var combined = Combiner.combineEach(this.combiner,  this.xys.event(tuple(x, y)));
            return {
                "count": combined.count,
                "value": combined.value
            };
        },

        x: function(x) {
    	var combined = Combiner.combineEach(this.combiner,  this.xs.event(x));
            return {
                "count": combined.count,
                "value": combined.value,
                "label": "" + x
            };
        },

        y: function(y) {
    	var combined = Combiner.combineEach(this.combiner,  this.ys.event(y));
            return {
                "count": combined.count,
                "value": combined.value,
                "label": "" + y
            };
        },

        xIds: function() {
            return this.xs.ids();
        },

        yIds: function() {
            return this.ys.ids();
        },

        xHeader: function() {
            return this.xKey;
        },

        yHeader: function() {
            return this.yKey;
        },

        set: function(id, event, xParser, yParser, context) {
            if (!event) {
                this.xs.set(id, null, []);
                this.ys.set(id, null, []);
                this.xys.set(id, null, []);
                return;
            }

            var xs = xParser.call(context, id, event);
            var ys = yParser.call(context, id, event);

            if (ys.length === 0) {
                xs = [];
            } else if (xs.length === 0) {
                ys = [];
            }

            var xys = [];
            for (var x = 0, xlen = xs.length; x < xlen; x++) {
                for (var y = 0, ylen = ys.length; y < ylen; y++) {
                    xys.push(tuple(xs[x], ys[y]));
                }
            }

            this.xs.set(id, event, xs);
            this.ys.set(id, event, ys);
            this.xys.set(id, event, xys);
        },

        selected: null,

        setSelected: function(x, y) {
            this.selected = { "x": x, "y": y };
        },

        unsetSelected: function() {
            this.selected = null;
        }
    });

    var CategorillaPointerInfo = new Class({
        Extends: PointerInfo,

        initialize: function(keyValues, value, combiner) {
            this.keyValues = keyValues;
            this.value = value;
            this.combiner = combiner;
        },

        createFilter: function() {
            var keyValues = this.keyValues;
            var keys = keyValues.keys();
            var length = keys.length;

            return function(id, event) {
                for (var i = 0; i < length; i++) {
                    var key = keys[i];
                    var values = keyValues.get(key);

                    var eventValues = event.values(key);
                    if (eventValues.length <= 0) values = [""];

                    for (var j = 0, len = values.length; j < len; j++) {
                        if (eventValues.indexOf(values[j]) < 0) {
                            return false;
                        }
                    }
                }
                return true;
            };
        },

        formatTip: function() {
            var lines = [];

            var keyValues = this.keyValues;
            keyValues.keys().sort().forEach(function(key) {
                keyValues.get(key).forEach(function(value) {
                    lines.push(key + ": " + value);
                });
            });

            if (this.combiner) {
                var value = (this.value.count > 0) ? this.value.value : "-";
                lines.push(this.combiner.title + ": " + value);
            }
            var count = this.value.count;
            var eventText = (count === 1 ?
                             $tr("ui.eventSingular", "event") :
                             $tr("ui.eventPlural", "events"));
            lines.push(count + " " + eventText);

            return lines.join("\n");
        }
    });

    var CategorillaView = exports.CategorillaView = new Class({
        Extends: View,
        Implements: [Observable, PointerView],

        initialize: function(container) {
            this.parent(container);

            this.delegate = new MyCategorillaDelegate();
            this.categorilla = new Categorilla(this.container, this.delegate);

            this.set({
                "selected": null,
                "data": null,
                "xKey": null,
                "yKey": null,
                "valueCombiner": null
            });

            this.combiner = null;
            this.invalidated = false;

            this.observe({
                 "xKey": this.invalidate,
                 "yKey": this.invalidate,

                 "valueCombiner": function(key, item) {
                     this.combiner = EVENT_COMBINERS.create(item);
                     this.invalidate();
                 },

                //     "selected": function(key, value, old) {
                //         if (old && old.value === value) return old;
                //         this.update();
                //         if (!value) return null;

                //         return {
                //             value: value,
                //             observer: value.observe(this.update, this)
                //         };
                //     },

                "data": function(key, value, observer) {
                    if (observer) observer.unobserve();

                    return !value ? null : value.observe(function(id, event) {
                        this.delegate.set(id, event, this.xParse, this.yParse, this);
                        this.update();
                    }, this);
                }
            }, this);

            this.categorilla.forEachView(function(view) {
                var add = function(keyValues, key, value) {
                    var values = keyValues.get(key) || [];
                    values.push(value);
                    keyValues.set(key, values);
                };

                this.listenPointerEvents(view, {
                    "point": function(event){
                        var selected = this.delegate.selected;
                        if (!selected) {
                            return PointerInfo.EMPTY;
                        }

                        var xKey = this.get("xKey");
                        var xVal = selected.x;

                        var yKey = this.get("yKey");
                        var yVal = selected.y;

                        var value = null;
                        var keyValues = new Container();
                        if (xVal != null && yVal != null) {
                            value = this.delegate.xy(xVal, yVal);
                            if (xKey !== null) {
                                add(keyValues, xKey, xVal);
                            }
                            if (yKey !== null && (xKey !== yKey || xVal !== yVal)) {
                                add(keyValues, yKey, yVal);
                            }
                        } else if (yVal != null) {
                            value = this.delegate.y(yVal);
                            if (yKey != null) {
                                add(keyValues, yKey, yVal);
                            }
                        } else if (xVal != null) {
                            value = this.delegate.x(xVal);
                            if (xKey !== null) {
                                add(keyValues, xKey, xVal);
                            }
                        }

                        if (!value || value.count === 0) {
                            return PointerInfo.EMPTY;
                        }
                        return new CategorillaPointerInfo(keyValues, value, this.combiner);
                    }
                }, this);
            }, this);
        },

        xParse: function(id, event) {
            var xKey = this.get("xKey");
            return xKey !== null ? event.values(xKey) : [""];
        },

        yParse: function(id, event) {
            var yKey = this.get("yKey");
            return yKey !== null ? event.values(yKey) : [""];
        },

        invalidate: function() {
            this.invalidated = true;
            this.delegate.xKey = this.get("xKey");
            this.delegate.yKey = this.get("yKey");
            this.delegate.combiner = this.combiner;
            this.update();
        },

        relayout: function() {
            this.parent();
            this.categorilla.relayout();
        },

        doUpdate: function() {
            if (this.invalidated) {
                var data = this.get("data");
                if (data) data.forEach(function(event, id) {
                    this.delegate.set(id, event, this.xParse, this.yParse, this);
                }, this);
            }

            this.categorilla.relayout();
        },

        DUMP_KEYS: ["xKey", "yKey", "valueCombiner"],

        dumpState: function() {
            var state = {};

            this.DUMP_KEYS.forEach(function(key) {
                state[key] = this.get(key)
            }, this);

            return state;
        },

        loadState: function(state) {
            state = new Container(state);

            this.DUMP_KEYS.forEach(function(key) {
                this.set(key, state.get(key));
            }, this);
        },

        settingsView: function() {
            return new FieldSet([
                new FieldSet([
                    new InputField(this, "xKey", {
                        "label": $tr("ui.settings.key", "key")
                    })
                ], {
                    "class": "axis",
                    "legend": $tr("ui.settings.horizontal", "horizontal")
                }),

                new FieldSet([
                    new InputField(this, "yKey", {
                        "label": $tr("ui.settings.key", "key")
                    })
                ], {
                    "class": "axis",
                    "legend": $tr("ui.settings.vertical", "vertical")
                }),

                new EVENT_COMBINERS.Input(this, "valueCombiner", {
                    "class": "combiner",
                    "legend": $tr("ui.settings.valueFunction", "value function")
                })
            ], {
                "class": "classification"
            });
        }
    });
})(this);
