var forEachPair = function(array1, array2, func, context) {
    for (var i = 0, len1 = array1.length; i < len1; i++) {
        var item1 = array1[i];

        for (var j = 0, len2 = array2.length; j < len2; j++) {
            func.call(context, item1, array2[j]);
        }
    }
};

var GroupContainer = new Class({
    initialize: function() {
        this._orders = null;
        this._groups = new Container();
        this.count = 0;

        this.events = new Container();
    },

    forEachCellForId: function(id, func, context) {
        var groups = this._groups;

        this.events.get(id, []).forEach(function(parsed) {
            var cell = groups.get(parsed.group).get(parsed.name);
            func.call(context, cell);
        });
    },

    orders: function() {
        if (!this._orders) {
            var orders = new Container();
            var index = 0;
            var groupIndex = 0;
            var groups = this._groups;
            
            groups.keys().sort().forEach(function(group) {
                orders.set(group, {
                    index: groupIndex,
                    firstCellIndex: index,
                    cells: new Container()
                });
                groupIndex += 1;

                groups.get(group).keys().sort().forEach(function(key) {
                    orders.get(group).cells.set(key, index);
                    index += 1;
                });
            });
            this._orders = orders;
        }
        return this._orders;
    },
    
    groupIndex: function(group) {
        var order = this.orders().get(group);
        return order === null ? null : order.index;
    },

    firstKeyIndex: function(group) {
        var order = this.orders().get(group);
        return order === null ? null : order.firstCellIndex;
    },

    keyIndex: function(group, key) {
        var order = this.orders().get(group);
        return order === null ? null : order.cells.get(key);
    },

    groupCount: function() {
        return this._groups.count();
    },

    keyCount: function() {
        return this.count;
    },

    handle: function(events, parserFunc, context) {
        events.forEach(function(info, id) {
            var oldList = this.events.pop(id);
            if (!oldList && !info) return;

            var parsedList = null;
            if (info) {
                parsedList = parserFunc.call(context, info);
                if (parsedList.length) {
                    this.events.set(id, parsedList);
                }
            }

            (parsedList || []).forEach(function(parsed) {
                if (!this._groups.contains(parsed.group)) {
                    this._orders = null;
                    this._groups.set(parsed.group, new Container());
                }
                var group = this._groups.get(parsed.group);                

                if (!group.contains(parsed.name)) {
                    this._orders = null;
                    this.count += 1;
                    group.set(parsed.name, {
                        info: parsed,
                        value: null,
                        events: new Container(),
                        refcounts: new Container(),
                        element: null
                    });
                }
                var cell = group.get(parsed.name);
                cell.events.set(id, parsed.event);
                cell.refcounts.set(id, cell.refcounts.get(id, 0) + 1);
                cell.value = null;
            }, this);

            (oldList || []).forEach(function(old) {
                var group = this._groups.get(old.group);
                var cell = group.get(old.name);

                var refcount = cell.refcounts.get(id, 0);
                refcount -= 1;
                if (refcount <= 0) {
                    cell.events.pop(id);
                    cell.refcounts.pop(id);
                } else {
                    cell.refcounts.set(id, refcount);
                }
                
                if (cell.events.count() === 0) {
                    this._orders = null;
                    this.count -= 1;
                    group.pop(old.name);
                    if (cell.element) cell.element.destroy();
                } else {
                    cell.value = null;
                }
                
                if (group.count() === 0) {
                    this._orders = null;
                    this._groups.pop(old.group);
                }
            }, this);
        }, this);
    },

    groups: function() {
        return this._groups.keys();
    },

    forEach: function(func, context) {
        this._groups.forEach(function(obj, group) {
            obj.forEach(function(cell, key) {
                func.call(context, cell, key, group, this);
            }, this);
        });
    }
});

var ClassificationPointerInfo = new Class({
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
                var value = keyValues.get(key);

                var values = event.values(key);
                if (values.length <= 0) values = [""];

                if (values.indexOf(value) < 0) {
                    return false;
                }
            }
            return true;
        };
    },
    
    formatTip: function() {
        var lines = [];
        
        var keyValues = this.keyValues;
        keyValues.keys().sort().forEach(function(key) {
            lines.push(key + ": " + keyValues.get(key));
        });
        
        if (this.combiner) {
            var value = (this.value.count > 0) ? this.value.value : "-";
            lines.push(this.combiner.title + ": " + value);
        }
        var count = this.value.totalCount;
        var eventText = (count === 1 ? 
                         $tr("ui.eventSingular", "event") :
                         $tr("ui.eventPlural", "events"));
        lines.push(count + " " + eventText);
        
        return lines.join("\n");        
    }
});

var ClassificationView = new Class({
    Extends: View,
    Implements: [Observable, PointerView],

    initialize: function(container) {
        this.parent(container);

        this.set({
            "data": null,
            "selected": null,
            "xKey": null,
            "xGroupKey": null,
            "yKey": null,
            "yGroupKey": null,
            "valueCombiner": null
        });

        this.cells = new GroupContainer();
        this.xGroups = new GroupContainer();
        this.yGroups = new GroupContainer();
        this.xElements = new Container();
        this.yElements = new Container();

        this.combiner = null;
        this.buffer = new Container();
        this.invalidated = false;
        this.build();

        this.observe({
            "xKey": this.invalidate,

            "xGroupKey": this.invalidate,

            "yKey": this.invalidate,

            "yGroupKey": this.invalidate,

            "valueCombiner": function(key, item) {
                this.combiner = EVENT_COMBINERS.create(item);
                this.invalidate();
            },
            
            "selected": function(key, value, old) {
                if (old && old.value === value) return old;
                this.update();
                if (!value) return null;
                
                return {
                    value: value,
                    observer: value.observe(this.update, this)
                };
            },

            "data": function(key, value, old) {
                if (!value && !old) return null;
                if (old && old.value === value) return old;
                if (old && old.observer) old.observer.unobserve();
                
                var observer = null;
                if (value) {
                    observer = value.observe(function(id, event) {
                        this.buffer.set(id, event);
                        this.update();
                    }, this);
                }
                return {
                    value: value,
                    observer: observer
                };
            }
        }, this);
    },

    invalidate: function() {
        this.invalidated = true;
        this.update();
    },   

    build: function() {
        this.horizontal = new Element("div", {
            "class": "classification-horizontal",
            styles: {
                position: "absolute",
                top: 0,
                left: 0,
                right: 0
            }
        }).inject(this.container);
        
        this.vertical = new Element("div", {
            "class": "classification-vertical",
            styles: {
                position: "absolute",
                right: 0,
                bottom: 0
            }            
        }).inject(this.container);
        
        this.matrix = new Element("div", {
            "class": "classification-matrix",
            styles: {
                position: "absolute",
                bottom: 0,
                left: 0
            }
        }).inject(this.container);

        this._resize();
    },

    _resize: function() {
        var height = this.horizontal.getSize().y;
        var width = this.vertical.getSize().x;

        this.horizontal.style.right = width + "px";
        this.vertical.style.top = height + "px";
        this.matrix.style.top = height + "px";
        this.matrix.style.right = width + "px";

        this.horizontal._size = this.horizontal.getSize();
        this.vertical._size = this.vertical.getSize();
        this.matrix._size = this.matrix.getSize();
    },

    relayout: function() {
        this.parent();
        this._resize();
    },

    _parse: function(event) {
        var xKey = this.get("xKey");
        var yKey = this.get("yKey");        
        var xNames = xKey !== null ? event.values(xKey) : [""];
        var yNames = yKey !== null ? event.values(yKey) : [""];
        if (xNames.length === 0 || yNames.length === 0) return null;
        
        var xGroupKey = this.get("xGroupKey");
        var xGroups = xGroupKey !== null ? event.values(xGroupKey) : [""];
        xGroups = xGroups.length ? xGroups : [""];

        var yGroupKey = this.get("yGroupKey");
        var yGroups = yGroupKey !== null ? event.values(yGroupKey) : [""];
        yGroups = yGroups.length ? yGroups : [""];
        
        return {
            "xNames": xNames,
            "xGroups": xGroups,
            "yNames": yNames,
            "yGroups": yGroups,
            "event": event
        };
    },
    
    _xGroupHeaderSize: function() {
        return this.get("xGroupKey") === null ? 0 : 17
    },
    
    _yGroupHeaderSize: function() {
        return this.get("yGroupKey") === null ? 0 : 17
    },

    _combine: function(string1, string2) {
        var re = /\//g;
        return string1.replace(re, "//") + "/" + string2.replace(re, "//");
    },

    doUpdate: function() {
        if (this.invalidated) {
            this.invalidated = false;

            var data = this.get("data");
            if (data) {
                data.forEach(function(event, id) {
                    this.buffer.set(id, event);
                }, this);
            }
        }

        this.buffer.forEach(function(event, id) {
            this.buffer.set(id, event ? this._parse(event) : null);
        }, this);

        this.cells.handle(this.buffer, function(info) {
            var result = [];
            var re = /\//g;

            forEachPair(info.xGroups, info.yGroups, function(xGroup, yGroup) {
                forEachPair(info.xNames, info.yNames, function(x, y) {
                    result.push({
                        "group": xGroup.replace(re, "//") + "/" + yGroup.replace(re, "//"),
                        "name": x.replace(re, "//") + "/" + y.replace(re, "//"),
                        "xGroup": xGroup,
                        "yGroup": yGroup,
                        "xName": x,
                        "yName": y,
                        "event": info.event
                    });
                });
            });
            return result;
        });
        this.xGroups.handle(this.buffer, function(info) {
            var result = [];
            forEachPair(info.xGroups, info.xNames, function(group, name) {
                result.push({
                    "group": group,
                    "name": name,
                    "event": info.event
                });
            });
            return result;
        });
        this.yGroups.handle(this.buffer, function(info) {
            var result = [];
            forEachPair(info.yGroups, info.yNames, function(group, name) {
                result.push({
                    "group": group,
                    "name": name,
                    "event": info.event
                });
            });
            return result;
        });
        this.buffer.clear();

        this._positionHistogram("xGroupKey", this.xGroups, this.horizontal, true);
        this._positionHistogram("yGroupKey", this.yGroups, this.vertical, false);
        this._positionMatrix(this.cells, this.xGroups, this.yGroups, this.matrix);
    },

    _calcValue: function(cell) {
        if (cell.value.count === 0) {
            return 0;
        }

        var minValue = 0.05;
        if (cell.value.value === 0) {
            return minValue;
        }

        var DIVISION = 10;
        var STEP_LOG = 2;

        var value = Math.abs(cell.value.value);
        var step = Math.log(value+1) / Math.log(STEP_LOG);
        var r = (DIVISION-1) / DIVISION;
        var sum = (1/DIVISION) * (1-Math.pow(r, step)) / (1-r);

        if (cell.value.value < 0) {
            return minValue - minValue * sum;
        }
        return minValue + (1-minValue) * sum;
    },

    _positionHistogram: function(groupProperty, groups, container, isHorizontal) {
        if (isHorizontal) {
            var groupHeaderSize = this._xGroupHeaderSize();
        } else {
            groupHeaderSize = this._yGroupHeaderSize();
        }
        
        var size = container._size;
        size = isHorizontal ? size.x : size.y;
        size = (size - groups.groupCount() * groupHeaderSize) / (groups.keyCount() || 1);

        if (isHorizontal) {
            var elements = this.xElements;
        } else {
            elements = this.yElements;
        }
        var groupKey = this.get(groupProperty);
        var sorted = groupKey != null ? groups.groups().sort() : [];
        sorted.forEach(function(group, index) {
            var groupIndex = groups.groupIndex(group);
            var firstKeyIndex = groups.firstKeyIndex(group);

            var next = sorted[index+1];
            if (next == null) {
                var nextKeyIndex = groups.keyCount();
            } else {
                nextKeyIndex = groups.firstKeyIndex(next);
            }

            var left = size * firstKeyIndex + groupIndex * groupHeaderSize;
            var right = left + (nextKeyIndex - firstKeyIndex) * size + groupHeaderSize;

            var element = elements.get(group);
            if (!element) {
                element = new Element("div", {
                    "class": "classification-group",
                    "styles": {
                        "position": "absolute"
                    }
                });
                element._container = new Element("div", {
                    "class": "classification-group-container"
                }); 
                element._text = new Element("div", {
                    "class": "classification-group-text",
                    "text": group
                });
                element._container.grab(element._text);
                element.grab(element._container);
                container.grab(element);
                elements.set(group, element);
            }

            var style = element.style;
            style.top = (isHorizontal ? 0 : left) + "px";
            style.height = isHorizontal ? "100%" : ((right-left) + "px");
            style.left = (isHorizontal ? left : 0) + "px";
            style.width = isHorizontal ? ((right-left) + "px") : "100%"
        });
        elements.forEach(function(element, group) {
            if (groups.groupIndex(group) !== null) return;
            element.destroy();
            elements.pop(group);
        }, this);

        groups.forEach(function(cell, key, group) {
            var index = groups.keyIndex(group, key);
            var groupIndex = groups.groupIndex(group);
            var decorate;
            
            var pos = size * index + (groupIndex + 1) * groupHeaderSize;
            if (!cell.value) {
                decorate = true;
                cell.value = Combiner.combineEach(this.combiner, cell.events);
            }
            
            if (!cell.element) {
                decorate = true;

                cell.element = new Element("div", {
                    "class": "classification-label",
                    "styles": {
                        "position": "absolute"
                    }
                });

                this.listenPointerEvents(cell.element, {
                    "enter": function() {
                        var keys = new Container();
                        if (isHorizontal) {
                            if (this.get("xGroupKey")) {
                                keys.set(this.get("xGroupKey"), group);
                            }
                            if (this.get("xKey")) {
                                keys.set(this.get("xKey"), key);
                            }
                        } else {
                            if (this.get("yGroupKey")) {
                                keys.set(this.get("yGroupKey"), group);
                            }
                            if (this.get("yKey")) {
                                keys.set(this.get("yKey"), key);
                            }
                        }
                        
                        return new ClassificationPointerInfo(keys, 
                                                             cell.value, 
                                                             this.combiner);
                    }
                }, this);

                cell.element.addEvent("mouseleave", function() {
                    this.setToolTip(null);
                }.bind(this));
                
                cell.element._container = new Element("div", {
                    "class": "classification-label-container"
                });
                cell.element._histogram = new Element("div", {
                    "class": "classification-label-histogram"
                });
                cell.element._text = new Element("div", {
                    "class": "classification-label-text",
                    "text": key
                });
                cell.element._container.grab(cell.element._histogram);
                cell.element._container.grab(cell.element._text);
                cell.element.grab(cell.element._container);
                container.grab(cell.element);
            }

            var style = cell.element.style;
            style.top = (isHorizontal ? 0 : pos) + "px";
            style.height = isHorizontal ? "100%" : (size + "px");
            style.left = (isHorizontal ? pos : 0) + "px";
            style.width = isHorizontal ? (size + "px") : "100%";
            
            if (decorate) {
                var value = this._calcValue(cell);
                var percentage = (100 * (1-value)) + "%";
                if (isHorizontal) {
                    cell.element._histogram.style.top = percentage;
                } else {
                    cell.element._histogram.style.right = percentage;
                }
            }
        }, this);
    },

    _positionMatrix: function(groups, x, y, container) {
        var xGroupHeaderSize = this._xGroupHeaderSize();
        var yGroupHeaderSize = this._yGroupHeaderSize();
        
        var size = container._size;
        var xSize = (size.x - x.groupCount() * xGroupHeaderSize) / (x.keyCount() || 1);
        var ySize = (size.y - y.groupCount() * yGroupHeaderSize) / (y.keyCount() || 1);

        groups.forEach(function(cell) {
            var xIndex = x.keyIndex(cell.info.xGroup, cell.info.xName);
            var yIndex = y.keyIndex(cell.info.yGroup, cell.info.yName);
            var xGroupIndex = x.groupIndex(cell.info.xGroup);
            var yGroupIndex = y.groupIndex(cell.info.yGroup);

            var cx = xSize * xIndex + (xGroupIndex + 1) * xGroupHeaderSize;
            var cy = ySize * yIndex + (yGroupIndex + 1) * yGroupHeaderSize;
            var decorate;

            if (!cell.value) {
                decorate = true;
                cell.value = Combiner.combineEach(this.combiner, cell.events);
            }

            if (!cell.element) {
                decorate = true;

                cell.element = new Element("div", {
                    "class": "classification-cell",
                    "styles": {
                        "position": "absolute"
                    }
                });
                container.grab(cell.element);

                this.listenPointerEvents(cell.element, {
                    "enter": function() {
                        var keys = new Container();
                        if (this.get("xGroupKey")) {
                            keys.set(this.get("xGroupKey"), cell.info.xGroup);
                        }
                        if (this.get("xKey")) {
                            keys.set(this.get("xKey"), cell.info.xName);
                        }
                        if (this.get("yGroupKey")) {
                            keys.set(this.get("yGroupKey"), cell.info.yGroup);
                        }
                        if (this.get("yKey")) {
                            keys.set(this.get("yKey"), cell.info.yName);
                        }
                        
                        return new ClassificationPointerInfo(keys, 
                                                             cell.value, 
                                                             this.combiner);
                    }
                }, this);

                cell.element._background = new Element("div", {
                    "class": "classification-cell-background"
                });
                cell.element.grab(cell.element._background);
                
                cell.element._foreground = new Element("div", {
	            "class": "classification-cell-foreground"
	        });
                cell.element._background.grab(cell.element._foreground);
            }

            cell.element.removeClass("selected");

            var style = cell.element.style;
            style.left = cx + "px";
            style.top = cy + "px";
            style.width = xSize + "px";
            style.height = ySize + "px";

            if (decorate) {
                var value = this._calcValue(cell);
                cell.element._foreground.style.opacity = value;
            }
        }, this);

        var selected = this.get("selected");
        if (selected) {
            selected.forEach(function(_, id) {
                this.cells.forEachCellForId(id, function(cell) {
                    if (!cell.element) return;
                    cell.element.addClass("selected");
                });
            }, this);
        }
    },

    DUMP_KEYS: ["xKey", "xGroupKey", "yKey", "yGroupKey", "valueCombiner"],
    
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
                new InputField(this, "xGroupKey", {
                    "label": $tr("ui.settings.group", "group")
                }),
                new InputField(this, "xKey", {
                    "label": $tr("ui.settings.key", "key")
                })
            ], {
                "class": "axis",
                "legend": $tr("ui.settings.horizontal", "horizontal")
            }),
            
            new FieldSet([
                new InputField(this, "yGroupKey", {
                    "label": $tr("ui.settings.group", "group")
                }),
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
