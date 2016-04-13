var parseTime = function(value) {
    var parsed = Number(value);
    if (!isNaN(parsed)) {
	return parsed * 1000;
    }

    return (new Date().parse(value)).getTime();
};

var ChartPointerInfo = new Class({
    Extends: PointerInfo,
    
    initialize: function(start, end, keyKey, key, valueKey, combiner) {
        this.start = start;
        this.end = end;
        
        this.keyKey = keyKey;
        this.key = key;
        this.valueKey = valueKey;
        
        this.combiner = combiner;
    },

    createFilter: function() {
        var startKey = $tr("events.start", "start");
        var endKey = $tr("events.end", "end");
        
        var key = this.key;
        var keyKey = this.keyKey;
        var valueKey = this.valueKey;
        
        var filterStart = this.start;
        var filterEnd = this.end;
        
        return function(id, event) {
            var keys = event.values(keyKey);
            if (keys.indexOf(key) < 0) {
                return false;
            }
            
            var value = event.value(valueKey, null, Number);
            var start = event.value(startKey, null, parseTime);
            var end = event.value(endKey, null, parseTime);
            if (value === null || end === null || start === null) {
                return false;
            }
            
            return (filterStart < end) && (start < filterEnd);
        };
    },
    
    formatTip: function(data) {
        var events = this.select(data);
        if (events.count() === 0) {
            return null;
        }

        var content = [];
        content.push($tr("ui.eventCount", "# events") + ": " + events.count());
        
        if (this.combiner) {
            var combined = Combiner.combineEach(this.combiner, events);
            content.push(this.combiner.title + ": " + combined.value);
        }
        return content.join("\n");
    }
});

var ChartView = new Class({
    Extends: CanvasView,
    Implements: [Observable, PointerView],

    initialize: function(container) {
        this.controls = new Element("div", {
            styles: {
                width: "100%",
                height: "10%"
            }
        }).inject(container);

        this.parent(new Element("div", {
            styles: {   
                width: "100%",
                height: "90%" 
            }   
        }).inject(container));

        this.set({
            "key": null,
            "valueKey": null,
            "data": null,
            "selected": null,
            "valueCombiner": null
        });

        this.combiner = null;
        this.vp = {left:null, bottom:null, width:null, height:null};
        this.events = new Container();
        this.charts = new Container();
        this.items = new Container();

        this.xpadding = 40;
        this.axis = 40;
        this.ypadding = 40;
        this.current = null;
        this.dragging = null;
        this.isZoomed = false;
        this.build();

        this.observe({
            "key": this.parse_all,
            "valueKey": this.parse_all,
            "valueCombiner": function(key, item) {
                this.combiner = EVENT_COMBINERS.create(item);
                this.update();
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
                        this.parse(id, event);
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

    build: function() {
        this.title = new Element("div", {
            styles: {
                "float": "left",
                "vertical-align": "middle"
            }
        }).inject(this.controls);

        var view_menu = new Element("div").inject(this.controls);
        this.menu = view_menu.addClass("chartview-menu");

        var menu = new Element("div", {
            "class": "menu left"
        });
        view_menu.grab(menu);

        this.header = new Element("div", {
            "class": "button menu-header",
            "text": $tr("ui.select", "select")
        }).inject(menu);

        this.menuitems = new Element("ul", {
            "class": "menu-list"
        }).inject(menu);

        this.listenPointerEvents(this.container, {
            "point": function(event) {
                if (this.dragging !== null) {
                    return null;
                }

                var eventX = this.eventOffset(event).x - this.xpadding;
                if (eventX < 0) {
                    return PointerInfo.IGNORED;
                }

                var start = this.canvasToChart(eventX-3, 0).x;
                var end = this.canvasToChart(eventX+3, 0).x;
                var keyKey = this.get("key");
                var valueKey = this.get("valueKey");
                if (keyKey === null || valueKey === null) {
                    return PointerInfo.EMPTY;
                }

                var chart = this.charts.get(this.current);
                if (!this.current || !chart) {
                    return PointerInfo.EMPTY;
                }

                return new ChartPointerInfo(start, end, keyKey, this.current,
                                            valueKey, this.combiner);
            }
        }, this);

        this.container.addEvents({
            "mousedown": function(event) {
                var eventX = this.eventOffset(event.event).x - this.xpadding;
                this.dragging = {
                    "mouse": eventX, 
                    "old": null, 
                    "pos": this.vp.left
                };
            }.bind(this),
 
            "mouseup": function(event) {
                this.stop_drag();
            }.bind(this),

            "mouseleave": function() {
                this.stop_drag();
            }.bind(this),

            "mousewheel": function(element){
                if (element.event.wheelDeltaY > 0) {
                    this.zoom(this.vp.width*0.01);
                } else {
                    this.zoom(this.vp.width*-0.01);
                }
            }.bind(this),

            "mousemove": function(event) {
                var eventX = this.eventOffset(event.event).x - this.xpadding;
                if (this.dragging !== null) {
                    this.drag(eventX);
                }
            }.bind(this)
        });
    },

    drag: function(x) {
        var chart = this.charts.get(this.current);
        if (!this.current || !chart) {
            return;
        }

        var old_pos = this.canvasToChart(this.dragging.mouse, 0);
        var new_pos = this.canvasToChart(x, 0);
        var vector = new_pos.x - old_pos.x;
        this.vp.left -= vector; 

        this.dragging.old = old_pos.x;
        this.dragging.mouse = x;
        this.dragging.pos = this.vp.left;

        var spring = this.canvasToChart(100,0).x-this.canvasToChart(0,0).x;

        if (this.vp.left < chart.size.xmin-spring) {
            this.vp.left = chart.size.xmin-spring;
        }
       
        if (this.vp.left+this.vp.width > chart.size.xmax+spring) {
            this.vp.left = chart.size.xmax+spring - this.vp.width;
        }

        this.update()
    },

    stop_drag: function() {
        var chart = this.charts.get(this.current)
        if (!this.current || !chart) {
            return;
        }  

        var padding = this.canvasToChart(15,0).x-this.canvasToChart(0,0).x;
        if (this.vp.left < chart.size.xmin-padding) {
            this.vp.left = chart.size.xmin-padding;
        }   
                
        if (this.vp.left+this.vp.width > chart.size.xmax+padding) {
            this.vp.left = chart.size.xmax+padding - this.vp.width;
            
        }

        this.dragging = null;
        this.update()
    },

    parse_all: function() {
        this.events.clear();
        this.charts.clear();

        this.select(null);
        var deleted = new Array();
        this.items.forEach(function(element, item) {
            element.destroy();
            deleted.include(item);
        }.bind(this));
        
        while (deleted.length > 0) {
            this.items.pop(deleted[0]);
            deleted.splice(0,1);
        }

        var data = this.get("data");
        if (data) {
            data.forEach(function(event, id) {
                this.parse(id, event);
            }, this);
        }
        this.update();
    },

    parse: function(id, event) {
        var keyKey = this.get("key");
        var valueKey = this.get("valueKey");
        if ((keyKey === null) || (valueKey === null)) return;

        this.vp = {left:null, bottom:null, width:null, height:null};

        if (!event) {
            this.removeEvent(id);
            this.updateMenu();
            return;
        }
        
        var key = event.value(keyKey);
        var value = event.value(valueKey, null, Number);
        var start = event.value($tr("events.start", "start"), null, parseTime);
        var end = event.value($tr("events.end", "end"), null, parseTime);
        if (key && value !== null && start !== null && end !== null) {
            this.setEvent(id, {key:key,value:value,start:start,end:end});
            
            var chart = this.charts.get(key);
            if (!chart.size.xmin || start < chart.size.xmin)
                chart.size.xmin = start;
            if (!chart.size.xmax || end > chart.size.xmax)
                chart.size.xmax = end;
            if (!chart.size.ymin || value < chart.size.ymin)
                chart.size.ymin = value;
            if (!chart.size.ymax || value > chart.size.ymax)
                chart.size.ymax = value;
            
            this.updateMenu(key);
            if (!this.current) this.select(key);
        }
    },
    
    setEvent: function(id, event) {
        var old = this.events.get(id); 
        if (old && old.key != event.key) {
            var chart = this.charts.get(old.key);
            if (chart != null) {
                chart.ids.erase(id);
                if (chart.ids.length < 1){
                    this.charts.pop(old.key);
                }
            } 
        }
        
        this.events.set(id, event);
        var chart = this.charts.get(event.key);
        if (!chart) {
            this.charts.set(event.key, {ids:new Array(), size:{xmin:null,
                                                               xmax:null,
                                                               ymin:null,
                                                               ymax:null}});
            chart = this.charts.get(event.key);
        }   
        chart.ids.include(id);
    },

    removeEvent: function(id) {
        var event = this.events.pop(id);
        
        if (event != null) {
            var chart = this.charts.get(event.key);
            
            if (chart != null) {
                chart.ids.erase(id);
                if (chart.ids.length < 1){
                    this.charts.pop(event.key);
                }
            }
        }
    },  

    updateMenu: function(newitem) {
        var deleted = new Array();
        this.items.forEach(function(element, item) {
            if (item != this.current && !this.charts.keys().contains(item)) {
                element.destroy();
                deleted.include(item);
            }
        }.bind(this));

        while (deleted.length > 0) {
            this.items.pop(deleted[0]);
            if (this.current == deleted[0]) {
                if (this.items.count() > 0) {
                    this.select(this.items.keys().sort()[0]);
                }
                else {
                    this.select(null);
                }
            }
            deleted.splice(0,1);
        }

        if (newitem != null && !this.items.contains(newitem)) {
            var item = new Element("li", {
                "class": "menu-list-item",
                "text": newitem
            }).inject(this.menuitems);
            item.addEvent("click", function() {
                this.select(newitem);
                this.update();
            }.bind(this));
            this.items.set(newitem, item);
        }
    },

    select: function(key) {
        this.vp = {left:null, bottom:null, width:null, height:null};
        this.isZoomed = false;

        this.current = key;  
        this.menu.setStyle("visibility", "visible");
        this.header.set("text", this.current);

        var chart = this.charts.get(key);
        if (!chart) {
            return;
        }

        var bounds = {
            "left": Infinity,
            "right": -Infinity,
            "top": 0,
            "bottom": 0
        };

        chart.ids.forEach(function(id) {
            var event = this.events.get(id);
            bounds.left = Math.min(bounds.left, event.start, event.end);
            bounds.right = Math.max(bounds.right, event.start, event.end);
            bounds.top = Math.max(bounds.top, event.value);
            bounds.bottom = Math.min(bounds.bottom, event.value);
        }.bind(this));
        
        var height = bounds.top - bounds.bottom;
        this.vp.height = 1.1 * height;
        
        if (bounds.bottom < 0) {
            this.vp.bottom = bounds.bottom - 0.05 * height;
        } else {
            this.vp.bottom = bounds.bottom;
        }

        this.vp.width = bounds.right - bounds.left;
        this.vp.left = bounds.left;
        var padding = this.canvasToChart(15,0).x-this.canvasToChart(0,0).x;
        this.vp.width += 2*padding;
        this.vp.left -= padding;
    },

    paint: function(ctx) {
        ctx.clearRect(0, 0, this.width(), this.height());

        ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
        ctx.fillRect(this.xpadding,0, this.width(),this.height()-this.ypadding);

        if (!this.vp.left) this.select(this.current);

        var chart = this.charts.get(this.current);
        if (this.current == null || chart == null) {
            ctx.strokeStyle = "black";
            ctx.beginPath();      
            ctx.moveTo(this.xpadding, 0);       
            ctx.lineTo(this.xpadding, this.height()-this.ypadding);
            ctx.lineTo(this.width(), this.height()-this.ypadding);
            ctx.stroke();
            ctx.closePath();
            return;
        }   

        this.title.set("text", this.get("key") + ": ");
        var selected = this.get("selected");
        var selections = new Array();
        var events = new Array();

        var max = null;
        chart.ids.forEach(function(id) {
            var event = this.events.get(id);
            if (event.value > max) max = event.value;

            var isSelected = selected && selected.contains(id);
            if (isSelected) {
                selections.include(event);
            } else {
                events.include(event);
            }
        }.bind(this));

        if (max) max = 15+ctx.measureText(max.toFixed(1).toString()).width;
        if (max > this.xpadding) this.xpadding = max;

        ctx.strokeStyle = "black";
        ctx.beginPath();      
        ctx.moveTo(this.xpadding, 0);       
        ctx.lineTo(this.xpadding, this.height()-this.ypadding);
        ctx.lineTo(this.width(), this.height()-this.ypadding);
        ctx.stroke();
        ctx.closePath();

	ctx.save();

	var NORMAL_COLOR = "#ccccff";
	var REVERSE_COLOR = "#ff4444";

	ctx.lineWidth = 1;
	ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
	ctx.globalAlpha = 0.7;
        events.forEach(function(event) {
	    ctx.fillStyle = (event.start <= event.end) ? NORMAL_COLOR : REVERSE_COLOR;
            this.drawBar(ctx, event.start, event.value, event.end);
        }.bind(this));

	ctx.lineWidth = 2;
	ctx.strokeStyle = "#000000";
	ctx.globalAlpha = 0.8;
        selections.forEach(function(event) {
	    ctx.fillStyle = (event.start <= event.end) ? NORMAL_COLOR : REVERSE_COLOR;
            this.drawBar(ctx, event.start, event.value, event.end);
            this.drawDot(ctx, (event.start + event.end) / 2, event.value, 5);
        }.bind(this));

	ctx.restore();

        this.drawYAxis(ctx);
        this.drawXAxis(ctx);

        var zero = this.chartToCanvas(0, 0);
        ctx.strokeStyle = "black";
        ctx.beginPath();
        ctx.moveTo(this.xpadding, zero.y);
        ctx.lineTo(this.width(), zero.y);
        ctx.stroke();
        ctx.closePath();
    },

    drawBar: function(ctx, x, y, x2) {
	var MIN_WIDTH = 1;
        var point = this.chartToCanvas(x, y);
        if (point.x < this.xpadding) point.x = this.xpadding;
        var point2 = this.chartToCanvas(x2, 0);
        if (point2.x < this.xpadding) return;

        var width = Math.max(parseInt(point2.x)-parseInt(point.x), MIN_WIDTH);
        var height = parseInt(point2.y)-parseInt(point.y);

	ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
        ctx.shadowOffsetX = 5.0;
        ctx.shadowOffsetY = 5.0;
        ctx.shadowBlur = 10.0;
	ctx.fillRect(parseInt(point.x), parseInt(point.y), width, height);
	ctx.restore();

	ctx.strokeRect(parseInt(point.x), parseInt(point.y), width, height);
    },

    drawYAxis: function(ctx) {
        if (this.vp.height == null) return;
        ctx.lineWidth = 1;
        ctx.strokeStyle = "black";
        ctx.fillStyle = "white";
        ctx.font = "12px sans-serif";

        var height = this.height()-this.ypadding;
        var canvas_cap = height/5;
        var cap = this.vp.height/5;

        for (var i=0; i<5; i++) {
            ctx.beginPath();
            ctx.moveTo(this.xpadding/2, height-i*canvas_cap);
            ctx.lineTo(this.xpadding, height-i*canvas_cap);
            ctx.stroke();

            var val = ((i*cap)+this.vp.bottom).toFixed(1);
            var text_length = this.xpadding-ctx.measureText(val).width-2;
            ctx.fillText(val, text_length, height-i*canvas_cap-5)
        }
    },

    drawXAxis: function(ctx) {
        if (this.vp.left == null) return;
        ctx.lineWidth = 1;
        ctx.strokeStyle = "black";
        ctx.fillStyle = "white";
        ctx.font = "11px sans-serif";

        var height = this.height()-this.ypadding;
        var canvas_cap = (this.width()-this.ypadding)/5;
        var cap = this.vp.width/5;
        var day = null;

        for (var i=0; i<5; i++) {
            ctx.beginPath();
            ctx.moveTo(this.xpadding+i*canvas_cap, height);
            ctx.lineTo(this.xpadding+i*canvas_cap, height+this.ypadding/2);
            ctx.stroke();

            var val = this.vp.left + i*cap;
            var temp = new Date(val).format("%a %b %d");
            if (day != null || temp != day) {
                day = temp;
                val = temp + " " + new Date(val).format("%H:%M:%S");
            }
            else {
                val = new Date(val).format("%H:%M:%S");
            }
            ctx.fillText(val, this.xpadding+i*canvas_cap+5, height+15);
        }
    },

    canvasToChart: function(cx, cy) {
        var width = this.width()-this.xpadding;
        var height = this.height()-this.ypadding;
        var canvas_left = this.vp.left/(this.vp.width/width);
        var canvas_w = width+Math.abs(canvas_left);
        var chart_w = this.vp.width+Math.abs(this.vp.left);
        var x = ((cx/(canvas_w))*chart_w)+this.vp.left;
        
        var canvas_bottom = this.vp.bottom/(this.vp.height/height);
        var canvas_h = height+Math.abs(canvas_bottom);
        var chart_h = this.vp.height+Math.abs(this.vp.bottom);
        var y = this.vp.height-((cy/(canvas_h))*chart_h)+this.vp.bottom;
        
        return {x:x, y:y};
    },  
    
    chartToCanvas: function(x, y) {
        var width = this.width()-this.xpadding;
        var height = this.height()-this.ypadding;
        var canvas_left = this.vp.left/(this.vp.width/width);
        var canvas_w = width+Math.abs(canvas_left);
        var chart_w = this.vp.width+Math.abs(this.vp.left);
        var cx = ((x/(chart_w))*canvas_w)-canvas_left+this.xpadding;
        
        var canvas_bottom = this.vp.bottom/(this.vp.height/height);
        var canvas_h = height+Math.abs(canvas_bottom);
        var chart_h = this.vp.height+Math.abs(this.vp.bottom);
        var cy = height-((y/(chart_h))*canvas_h)+canvas_bottom;

        return {x:cx, y:cy};
    },

    drawDot: function(ctx, x, y, size) {
        var point = this.chartToCanvas(x, y);
        if (point.x < this.xpadding) return;

        point = this.chartToCanvas(x, y);

        ctx.save();

        ctx.beginPath();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
        ctx.lineWidth = 2;
        ctx.fillStyle = "rgba(255, 255, 0, 1.0)";
        ctx.shadowColor = "rgba(0, 0, 0, 0.4)";

        ctx.arc(point.x, point.y, size, 0.0, 2 * Math.PI, false);

        ctx.save();

        ctx.shadowColor = "rgba(0, 0, 0, 0.4)";

        ctx.shadowOffsetX = 3.0;
        ctx.shadowOffsetY = 3.0;
        ctx.shadowBlur = 2.0;

        ctx.fill();
        ctx.restore();

        ctx.stroke();

        ctx.closePath();
        ctx.restore();
    },

    zoom: function(factor) {
        var chart = this.charts.get(this.current);
        if (!this.current || !chart) {
            return;
        }   
        this.isZoomed = true;

        var center = this.vp.left+(this.vp.width)/2;
        var point = center;

        var selected = this.get("selected");
        if (selected != null && selected.count() > 0) {
            var selection = this.events.get(selected.keys()[0]);
            if (selection == null) return;
            point = selection.start + (selection.end - selection.start)/2;
        }   

        var offset = center-point;

        this.vp.left -= offset;
        this.vp.left += factor;
        this.vp.width -= 2*factor;

        var padding = this.canvasToChart(15,0).x-this.canvasToChart(0,0).x;
        if (this.vp.left < chart.size.xmin-padding)
            this.vp.left = chart.size.xmin-padding;

        if (this.vp.left+this.vp.width > chart.size.xmax+padding)
            this.vp.left = chart.size.xmax+padding-this.vp.width;

        if (this.vp.width > chart.size.xmax-chart.size.xmin+2*padding) {
            this.vp.left = chart.size.xmin-padding;
            this.vp.width = chart.size.xmax-chart.size.xmin+2*padding;
            this.isZoomed = false;
        }
        this.update()
    },

    dumpState: function(){
        return {
            "key": this.get("key"),
            "valueKey": this.get("valueKey"),
            "valueCombiner": this.get("valueCombiner")
        };
    },

    loadState: function(state) {
        state = new Container(state);
        this.set({
            "key": state.get("key"),
            "valueKey": state.get("valueKey"),
            "valueCombiner": state.get("valueCombiner")
        });
    },

    settingsView: function() {
        return new FieldSet([
            new InputField(this, "key", {
                "label": $tr("ui.settings.key", "key")
            }),
            new InputField(this, "valueKey", {
                "label": $tr("ui.settings.value", "value")
            }),
            
            new EVENT_COMBINERS.Input(this, "valueCombiner", {
                "class": "combiner",
                "legend": $tr("ui.settings.valueFunction", "value function")
            })
        ]);
    }
});
