(function(exports) {
    var max = Math.max;
    var min = Math.min;
    var floor = Math.floor;
    var ceil = Math.ceil;
    var round = Math.round;

    var SECOND = 1000;
    var MINUTE = 60 * SECOND;
    var HOUR = 60 * MINUTE;
    var DAY = 24 * HOUR;
    var MONTH = 31 * DAY;
    var YEAR = 365 * DAY;

    var timeStack = [
        [SECOND, "%H:%M:%S", [1, 5, 15]],
        [MINUTE, "%H:%M", [1, 5, 15]],
        [HOUR, "%H:%M", [1, 3]],
        [DAY, "%Y-%m-%d", [1, 2, 4]],
        [MONTH, "%Y-%m", [1, 3, 6]],
        [YEAR, "%Y", [1, 5, 10, 50, 100]]
    ];

    var getSpacing = function(pixelPerSecond, threshold) {
        threshold = threshold || 70;

        for (var i = 0, iLen = timeStack.length; i < iLen; i++) {
            var timeLevel = timeStack[i];

            var baseUnit = timeLevel[0];
            var format = timeLevel[1];
            var unitSteps = timeLevel[2];

            for (var j = 0, jLen = unitSteps.length; j < jLen; j++) {
                var spacing = baseUnit * unitSteps[j];
                if (pixelPerSecond * spacing < threshold) continue;

                return {
                    format: format,
                    spacing: spacing
                };
            }
        }

        return null;
    };

    var barSize = function(value) {
        var minValue = 0.02;
        if (value === 0) {
            return minValue;
        }

        var DIVISION = 10;
        var STEP_LOG = 4;

        var step = Math.log(Math.abs(value)+1) / Math.log(STEP_LOG);
        var r = (DIVISION-1) / DIVISION;
        var sum = (1/DIVISION) * (1-Math.pow(r, step)) / (1-r);

        if (value < 0) {
            return minValue - minValue * sum;
        }
        return minValue + (1-minValue) * sum;
    };

    exports.TimeLine = new Class({
        Extends: View,
        Implements: [Options, Observable],

        options: {
            now: Date.now,

            stepPixels: 15,
            stepMinimum: SECOND,
            stepMaximum: MONTH
        },

        width: function() {
            return Math.max(this.parent(), 1);
        },

        height: function() {
            return Math.max(this.parent(), 1);
        },

        xToTime_: function(x) {
            var width = this.width();
            var visible = this.visibleSpan_();

            return visible.start + x * (visible.end - visible.start) / width;
        },

        timeToX_: function(time) {
            var width = this.width();
            var visible = this.visibleSpan_();

            return width * (time - visible.start) / (visible.end - visible.start);
        },

        calcScrollBars_: function() {
            var visible = this.visibleSpan_();
            var scrollable = this.scrollableSpan_();

            var pixelsPerUnit = this.width() / (visible.end - visible.start);
            var start = min(scrollable.start, visible.start);
            var end = max(scrollable.end, visible.end);

            return {
                left: floor((visible.start - start) * pixelsPerUnit),
                width: floor(pixelsPerUnit * (end - start))
            };
        },

        relayout: function() {
            this.parent();

            this.canvas.width = this.width();

            if (this.width() <= 0) return;

            this.zoomBy_(1, this.width() / 2.0);
            this.alignScrollBars_();
        },

        totalSpan_: function() {
            var anchor = this.anchor_();
            var start = anchor;
            var end = anchor;

            var history = this.get("history");
            var span = history && history.span();
            if (span) {
                start = min(span.start, start);
                end = max(span.end, end);
            }

            var step = this.stepSize_();
            return {
                start: step * floor(start / step),
                end: step * ceil(end / step)
            };
        },

        visibleSpan_: function() {
            var info = this.spanInfo_;
            var start = info.start;

            if (info.following) {
                start += this.anchor_();
            }

            return {
                start: start,
                end: start + info.width
            };
        },

        scrollableSpan_: function() {
            var total = this.totalSpan_();
            var visible = this.visibleSpan_();
            var width = visible.end - visible.start;
            var margin = width / 10.0;

            return {
                start: min(total.start - margin, visible.start, total.end + margin - width),
                end: max(total.end + margin, visible.end)
            };
        },

        updateNow_: function() {
            this.now_ = this.options.now();
            this.alignScrollBars_();
        },

        anchor_: function() {
            var now = this.now_;
            var step = this.stepSize_();
            return step * ceil(now / step);
        },

        initialize: function(container, options) {
            this.parent(container);
            this.setOptions(options);

            this.now_ = this.options.now();
            this.spanInfo_ = {
                start: -15 * 60 * 1000,
                width: 16 * 60 * 1000,
                following: true
            };

            this.canvas = new Element("canvas");

            this.scroller = new Element("div", {
                styles: {
                    position: "absolute",
                    left: "0px",
                    right: "0px",
                    top: "0px",
                    bottom: "0px",
                    overflow: "hidden",
                    "overflow-x": "auto"
                }
            });

            this.area = new Element("div", {
                styles: {
                    width: "0px",
                    height: "100%"
                }
            });

            this.scroller.grab(this.area);
            this.container.grab(this.canvas);
            this.container.grab(this.scroller);

            this.context = this.canvas.getContext("2d");

            this.set({
                "history": null,
                "focus": null,
                "freeze": null,
                "valueCombiner": null
            });

            this.histogram = null;
            this.combiner = null;

            this.observe({
                "focus": this.update,
                "freeze": this.update,

                "history": function(key, value, old) {
                    if (old) old.forEach(function(listener) {
                        listener.unlisten();
                    });

                    if (this.histogram) {
                        this.histogram.destroy();
                        this.histogram = null;
                    }

                    this.update();

                    if (!value) return null;

                    this.histogram = new Histogram(value);
                    this.histogram.setCombiner(this.combiner);

                    return [
                        value.listen("added", this.invalidate_, this),
                        value.listen("removed", this.invalidate_, this),
                        value.listen("spanChanged", this.invalidate_, this)
                    ];
                },

                "valueCombiner": function(key, value) {
                    this.combiner = EVENT_COMBINERS.create(value);
                    if (this.histogram) {
                        this.histogram.setCombiner(this.combiner);
                        this.update();
                    }
                }
            }, this);

            var mouseEvent = function(event) {
                if (this.get("freeze")) return;

                var x = this.eventOffset(event.event).x - this.scroller.scrollLeft;
                var width = this.width();
                var time = this.xToTime_(x);

                if (this.get("focus") === time) return;

                this.setToolTip(time);
                this.set("focus", time);
            }.bind(this);

            this.container.addEvents({
                "click": function(event) {
                    this.set("freeze", !this.get("freeze"));
                    mouseEvent(event);
                }.bind(this),

                "mouseleave": function(event) {
                    if (!this.get("freeze") && this.get("focus") !== null) {
                        this.set("focus", null);
                    }
                }.bind(this),

                "mousemove": mouseEvent
            });

            this.scroller.addEventListener("mousewheel", this.wheel_.bind(this), true);
            this.scroller.addEventListener("scroll", this.scroll_.bind(this), false);
        },

        invalidate_: function(item) {
            var visible = this.visibleSpan_();
            if (visible.start < item.end && visible.end > item.start) {
                this.update(200);
            }
        },

        zoomBy_: function(factor, origin) {
            var info = this.spanInfo_;
            var visible = this.visibleSpan_();

            var width = visible.end - visible.start;

            var steps = this.width() / this.options.stepPixels;
            var maxFactor = this.options.stepMaximum * steps / width;
            var minFactor = this.options.stepMinimum * steps / width;
            factor = max(minFactor, min(maxFactor, factor));
            if (factor === 1.0) return;

            var x = visible.start + width * origin / this.width();

            info.start = x + (visible.start - x) * factor;
            info.width *= factor;
            info.following = false;

            this.update(0.0);
            this.alignScrollBars_();
        },

        follow_: function(following) {
            var info = this.spanInfo_;
            if (info.following === following) return;

            var span = this.visibleSpan_();
            if (following) {
                info.start = span.start - this.anchor_();
            } else {
                info.start = span.start;
            }
            info.width = span.end - span.start;
            info.following = following;
        },

        wheel_: function(event) {
            this.update();

            var deltaX = event.wheelDeltaX;
            if (deltaX == null) deltaX = 0;

            var deltaY = event.wheelDeltaY;
            if (deltaY == null) deltaY = event.wheelDelta;
            if (deltaY == null) deltaY = 0;

            if (!event.altKey) {
                var left = this.scroller.scrollLeft;
                var width = this.area.clientWidth;

                if (deltaX < 0 && left >= width - this.width()) {
                    this.follow_(true);
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                }

                this.follow_(false);
                if (deltaX > 0 && left <= 0) {
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                }

                return true;
            }

            var offset = this.eventOffset(event);
            var factor = 1 + deltaY / 1200;
            this.zoomBy_(factor, offset.x - this.scroller.scrollLeft);

            event.preventDefault();
            event.stopPropagation();
            return false;
        },

        alignScrollBars_: function() {
            var bars = this.calcScrollBars_();
            if (this.scroller.scrollLeft !== bars.left ||
                this.area.clientWidth !== bars.width) {

                this.barInfo_ = bars;
                this.area.style.width = bars.width + "px";
                this.scroller.scrollLeft = bars.left;
            }

            var height = this.scroller.scrollHeight;
            if (this.canvas.height !== height) {
                this.canvas.height = height;
                this.updateImmediately();
            }
        },

        scroll_: function(event) {
            var bars = this.calcScrollBars_();
            var left = this.scroller.scrollLeft;
            var width = this.area.clientWidth;
            if (left === bars.left && width === bars.width) {
                return;
            }

            var delta = left - bars.left;
            this.follow_(delta > 0 && left >= width - this.width());

            var info = this.spanInfo_;
            var unitsPerPixel = info.width / this.width();
            info.start += delta * unitsPerPixel;

            this.update(0.0);

            event.preventDefault();
            event.stopPropagation();
            return false;
        },

        stepSize_: function() {
            var minStep = this.options.stepMinimum;
            var size = this.options.stepPixels * this.spanInfo_.width / this.width();
            var power = floor(Math.log(size / minStep) / Math.log(2));
            power = Math.max(power, 0);
            return minStep * Math.pow(2, power);
        },

        formatToolTip: function(time) {
            if (time === null) return null;

            var item = this.histogram && this.histogram.find(time);
            if (!item) return null;

            var lines = [];
            lines.push($tr("ui.eventCount", "# events")+": "+item.totalCount);

            if (this.combiner) {
                var value = (item.count > 0) ? item.value : "-";
                lines.push(this.combiner.title + ": " + value);
            }
            return lines.join("\n");
        },

        doUpdate: function(ctx) {
            this.updateNow_();

            var ctx = this.context;
            var height = this.canvas.height;
            var width = this.canvas.width;
            if (width === 0 || height === 0) {
                return;
            }

            this.update(Math.max(100.0, this.stepSize_() / 2.0));

            ctx.fillStyle = "#eee";
            ctx.fillRect(0, 0, width, height);

            var total = this.totalSpan_();
            var left = Math.max(this.timeToX_(total.start), -10);
            var right = Math.min(this.timeToX_(total.end), width + 10);

            this.drawHistogram(ctx);
            this.drawFocus(ctx);
            this.drawGrid(ctx);

            ctx.globalAlpha = 0.5;
            ctx.fillStyle = "rgb(220, 220, 230)";
            if (left > 0) {
                ctx.fillRect(0, 0, Math.min(left, width), height);
            }
            if (right < width) {
                ctx.fillRect(Math.max(right, 0), 0, width - Math.max(right, 0), height);
            }
            ctx.globalAlpha = 1.0;

            ctx.save();
            ctx.fillStyle = "black";
            ctx.textBaseline = "top";
            ctx.textAlign = "right";

            var info = this.spanInfo_;
            if (info.following) {
                ctx.globalAlpha = 0.7;
            } else {
                ctx.globalAlpha = 0.1;
            }
            ctx.fillText("LOCKED", width - 6, 2);
            ctx.restore();
        },

        drawHistogram: function(ctx) {
            var histogram = this.histogram;
            if (!histogram) return;

            var width = max(this.canvas.width, 1);
            var height = max(this.canvas.height - 14, 1);
            var total = this.totalSpan_();

            var start = max(this.xToTime_(0), total.start);
            var end = min(this.xToTime_(width), total.end);

            var granularity = this.stepSize_();
            var step = granularity * width / this.spanInfo_.width;

            histogram.setView(start, end, granularity);

            var minHeight = min(height, 3);
            var maxHeight = max(height - 8, minHeight);

            ctx.fillStyle = "rgb(160, 170, 200)";
            histogram.forEach(start, end, function(time, item) {
                var x = this.timeToX_(time);
                var y = height;
                if (item.totalCount > 0) {
                    y -= minHeight;
                }
                if (item.count > 0) {
                    y -= barSize(item.value) * (maxHeight - minHeight);
                }
                ctx.fillRect(x + 1.5, y, step - 2, height - y);
            }, this);
        },

        drawFocus: function(ctx) {
            var focus = this.get("focus");
            if (focus === null) return;

            var freeze = this.get("freeze");
            if (freeze) {
                ctx.fillStyle = "rgba(255, 0, 0, 0.7)";
            } else {
                ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
            }

            var height = this.canvas.height;
            var width = this.canvas.width;
            var x = this.timeToX_(focus);
            ctx.fillRect(x-1, 0, 2.0, height);
        },

        drawGrid: function(ctx) {
            var height = this.canvas.height;
            var width = this.canvas.width;

            var gridInfo = getSpacing(width / this.spanInfo_.width);
            if (!gridInfo) return;

            var spacing = gridInfo.spacing;
            var format = gridInfo.format;

            var end = this.xToTime_(width);
            var time = this.xToTime_(0);

            time += spacing - (time % spacing);
            time -= (new Date(time).getHours() % ceil(spacing / HOUR)) * HOUR;

            ctx.save();

            ctx.textBaseline = "bottom";
            ctx.fillStyle = "rgb(66, 98, 108)";

            while (time <= end) {
                if (spacing % DAY == 0) {
                    time = new Date(time + HOUR).setHours(0);
                }

                if (spacing >= MONTH) {
                    time = new Date(time).setDate(1);
                }

                var x = this.timeToX_(time);

                ctx.globalAlpha = 0.2;
                ctx.fillRect(x, 3, 1, height - 9);

                ctx.globalAlpha = 1.0;
                ctx.fillText(new Date(time).format(format), x + 5, height - 2);

                time += spacing;
            }

            ctx.restore();
        },

        dumpState: function() {
            return {
                "combiner": this.get("valueCombiner"),
                "view": {
                    "offset": this.spanInfo_.start,
                    "width": this.spanInfo_.width,
                    "locked": this.spanInfo_.following
                }
            };
        },

        loadState: function(state) {
            state = new Container(state);
            this.set("valueCombiner", state.get("combiner"));

            if (state.contains("view")) {
                var span = state.get("view");
                this.spanInfo_.start = span.offset;
                this.spanInfo_.width = span.width;
                this.spanInfo_.following = span.locked;
            }

            this.update();
            this.alignScrollBars_();
        },

        settingsView: function() {
            return new FieldSet([
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
