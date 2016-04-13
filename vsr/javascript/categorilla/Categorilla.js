(function(exports) {
    "use strict";

    var requestAnimationFrame = window.requestAnimationFrame ||
                                window.webkitRequestAnimationFrame ||
                                function(callback) {
                                    setTimeout(callback, 10);
                                };

    var hsvFill = ["000000", "00000", "0000", "000", "00", "0", ""];
    var hsv = function(h, s, v) {
        // Hue (h), saturation (s) and value (v) should be values
        // between 0.0 and 1.0 (inclusive). Returns color in
        // format #RRGGBB.

        h = (h * 6) % 6;
        s = Math.max(Math.min(s, 1.0), 0.0);
        v = Math.max(Math.min(v, 1.0), 0.0);

        var max = v;
        var min = v * (1 - s);
        var mid = min + (max - min) * (1 - Math.abs(1 - h % 2));
        var maxMidMin = [max, mid, min, min, mid, max];

        var r = (255 * maxMidMin[((h + 0) % 6) | 0]) | 0;
        var g =  (255 * maxMidMin[((h + 4) % 6) | 0]) | 0;
        var b = (255 * maxMidMin[((h + 2) % 6) | 0]) | 0;

        var total = ((r << 16) + (g << 8) + b).toString(16);
        return "#" + hsvFill[total.length] + total;
    };

    exports.CategorillaDelegate = new Class({
        xy: function(x, y) {
            var val = ((0x1337 ^ ((x + 17) * 11 * (y + 31) * 19)) & 0xff) / 0xff;
            return {
                "value": val,
                "count": val <= 0.8 ? 1 : 0
            }
        },

        x: function(x) {
            var val = ((0x1337 ^ ((x + 17) * 11 * (0 + 31) * 19)) & 0xff) / 0xff;
            return {
                "label": "label " + x,
                "value": val * 20,
                "count": 1
            }
        },

        y: function(y) {
            var val = ((0x1337 ^ ((y + 17) * 11 * (y + 31) * 19)) & 0xff) / 0xff;
            return {
                "label": "label " + y,
                "value": val * 20,
                "count": 1
            }
        },

        array: new Array(30),

        xIds: function() {
            return this.array;
        },

        yIds: function() {
            return this.array;
        }
    });

    var barSize = function(value) {
        var minValue = 0.05;
        if (value === 0) {
            return minValue;
        }

        var DIVISION = 10;
        var STEP_LOG = 2;

        var step = Math.log(Math.abs(value)+1) / Math.log(STEP_LOG);
        var r = (DIVISION-1) / DIVISION;
        var sum = (1/DIVISION) * (1-Math.pow(r, step)) / (1-r);

        if (value < 0) {
            return minValue - minValue * sum;
        }
        return minValue + (1-minValue) * sum;
    };

    exports.Categorilla = new Class({
        initialize: function(container, delegate) {
            this.container = document.id(container);
            this.delegate = delegate;

            this.canvasArea = new Element("div", {
                "styles": {
                    "position": "relative",
                    "width": "100%",
                    "height": "100%"
                }
            });
            this.canvas = new Element("canvas", {
                "style": {
                    "margin": 0,
                    "border": 0,
                    "padding": 0
                }
            });
            this.canvas.width = 0;
            this.canvas.height = 0;
            this.canvasArea.grab(this.canvas);

            this.box = new Element("div", {
                "styles": {
                    "position": "absolute",
                    "margin": 0,
                    "padding": 0,
                    "border": "none",

                    // Webkit in OSX 10.7.1: Box shadow + 3D webkit-transform
                    // causes incorrect scroll bars, so we use a separate div
                    // for shadows.
                    "box-shadow": "0px 0px 10px rgba(0, 0, 0, 0.3)"
                }
            });
            this.scroller = new Element("div", {
                "styles": {
                    "position": "absolute",
                    "margin": 0,
                    "padding": 0,
                    "border": "none",
                    "overflow": "auto"
                }
            });
            this.scrollArea = new Element("div", {
                "styles": {
                    "width": "100%",
                    "height": "100%"
                }
            });
            this.scroller.grab(this.scrollArea);
            this.container.grab(this.canvasArea);
            this.container.grab(this.box);
            this.container.grab(this.scroller);

            this.context = this.canvas.getContext("2d");
            this.size = 40;
            this.left = 0;
            this.top = 0;

            this.hover = null;

            this._boundHover = this._hover.bind(this);
            this._boundLeave = this._leave.bind(this);
            this.canvas.addEvents({
                "mousemove": this._boundHover,
                "mouseleave": this._boundLeave
            });
            this.scroller.addEvents({
                "mousemove": this._boundHover
            });

            this.canvas.addEventListener("mousewheel", this._wheel.bind(this), false);
            this.scroller.addEventListener("mousewheel", this._wheel.bind(this), false);
            this.scroller.addEventListener("scroll", this._scroll.bind(this), false);

            this._needsRelayout = false;
            this._repaintScheduled = false;
            this.relayout();
        },

        repaint: function() {
            if (this._repaintScheduled) return;

            var _this = this;
            requestAnimationFrame(function() {
                if (_this._needsRelayout) {
                    _this._relayout();
                }
                _this._repaint();

                _this._needsRelayout = false;
                _this._repaintScheduled = false;
            });
            this._repaintScheduled = true;
        },

        relayout: function() {
            this._needsRelayout = true;
            this.repaint();
        },

        forEachView: function(func, ctx) {
            func.call(ctx, this.canvas);
            func.call(ctx, this.scrollArea);
        },

        _relayout: function() {
            var width = this.container.offsetWidth;
            var height = this.container.offsetHeight;

            if (height !== this.canvas.height || width !== this.canvas.width) {
                this.canvas.height = height;
                this.canvas.width = width;
                this.canvas.style.width = width + "px";
                this.canvas.style.height = height + "px";
            }

            var xCount = Math.max(this.delegate.xIds().length, 1);
            var yCount = Math.max(this.delegate.yIds().length, 1);

            var maxScrollWidth = Math.floor(xCount * this.size);
            var maxScrollHeight = Math.floor(yCount * this.size);

            this.scrollArea.style.minWidth = maxScrollWidth + "px";
            this.scrollArea.style.minHeight = maxScrollHeight + "px";

            this.scroller.style.maxHeight = (height - 150) + "px";
            this.scroller.style.maxWidth = (width - 150) + "px";
            this.scroller.style.minHeight = Math.min(height - 150, maxScrollHeight) + "px";
            this.scroller.style.minWidth = Math.min(width - 150, maxScrollWidth) + "px";

            this.left = Math.round(width / 2 - this.scroller.offsetWidth / 2);
            this.top = Math.round(height / 2 - this.scroller.offsetHeight / 2);
            this.scroller.style.left = this.left + "px";
            this.scroller.style.top = this.top + "px";

            this.box.style.left = this.left + "px";
            this.box.style.top = this.top + "px";
            this.box.style.width = this.scroller.offsetWidth + "px";
            this.box.style.height = this.scroller.offsetHeight + "px";
        },

        _pointOffset: function(event) {
            var point = new WebKitPoint(event.page.x, event.page.y);
            point = webkitConvertPointFromPageToNode(this.canvas, point);
            return point;
        },

        _scroll: function() {
            this.repaint();
        },

        _wheel: function(event) {
            var deltaX = event.wheelDeltaX;
            if (deltaX == null) deltaX = 0;

            var deltaY = event.wheelDeltaY;
            if (deltaY == null) deltaY = event.wheelDelta;
            if (deltaY == null) deltaY = 0;

            if (!event.altKey) {
                var left = this.scroller.scrollLeft;
                var width = this.scrollArea.clientWidth;

                if ((deltaX < 0 && left >= width - this.scroller.clientWidth)
                    || (deltaX > 0 && left <= 0)) {
                    event.preventDefault();
                    event.stopPropagation();
                    return false;
                }

                return true;
            }

            this.size = Math.min(Math.max(this.size * (1 + deltaY / 1200), 4), 100);
            this.relayout();

            event.preventDefault();
            event.stopPropagation();
            return false;
        },

        _leave: function(event) {
            this.hover = null;
            this.repaint();
        },

        _hover: function(event) {
            var point = this._pointOffset(event);
            this.hover = point;
            this.repaint();
        },

        _repaint: function() {
            // Colors

            var hue = 0.51;
            var saturation = 0.4;

            var bgHue = (hue - 0.3) % 1.0;
            var backgroundFill = hsv(bgHue, 0.01, 1.0);
            var backgroundStroke = hsv(bgHue, 0.02, 0.4);
            var gridFill = hsv(bgHue, 0.02, 0.93);
            var hoverFill = "black";
            var hoverAlpha = "0.04";

            var cellFill = hsv(hue, saturation, 0.85);
            var cellStroke = hsv(hue, saturation, 0.7);
            var barFill = cellFill;
            var barStroke = hsv(hue, saturation / 2, 0.4);
            var labelFill = "white";
            var headerFill = hsv(hue, saturation / 2, 0.2);

            // Offsets etc.

            var width = this.canvas.width;
            var height = this.canvas.height;

            var xIds = this.delegate.xIds();
            var yIds = this.delegate.yIds();

            var xCount = xIds.length;
            var yCount = yIds.length;
            var size = this.size;

            var xOffset = this.left;
            var yOffset = this.top;
            var fontSize = Math.min(size - 2, 12);

            var areaWidth = this.scroller.clientWidth;
            var areaHeight = this.scroller.clientHeight;

            var totalWidth = this.scroller.offsetWidth;
            var totalHeight = this.scroller.offsetHeight;

            var xPos = this.scroller.scrollLeft;
            var yPos = this.scroller.scrollTop;
            var cellStartX = Math.floor(xPos / size);
            var cellStartY = Math.floor(yPos / size);
            var cellOffsetX = xPos % size;
            var cellOffsetY = yPos % size;
            var cellWidth = Math.ceil((areaWidth + cellOffsetX) / size);
            var cellHeight = Math.ceil((areaHeight + cellOffsetY) / size);

            if (this.hover) {
                var x = Math.floor((this.hover.x - xOffset + cellOffsetX) / size);
                var y = Math.floor((this.hover.y - yOffset + cellOffsetY) / size);

                var hover = { x: x, y: y };

                var xHover = (x >= 0 && x < cellWidth) ? xIds[x + cellStartX] : null;
                var yHover = (y >= 0 && y < cellHeight) ? yIds[y + cellStartY] : null;
                this.delegate.setSelected(xHover, yHover);
            } else {
                this.delegate.unsetSelected();
            }

            this.context.clearRect(0, 0, width, height);

            // Cells & grid

            this.context.save();
            this.context.beginPath();
            this.context.rect(xOffset, yOffset, areaWidth, areaHeight);
            this.context.closePath();
            this.context.clip();

            // Grid

            this.context.fillStyle = backgroundFill;
            this.context.fillRect(xOffset, yOffset, areaWidth, areaHeight);

            this.context.fillStyle = gridFill;
            for (var x = 1; x <= cellWidth; x++) {
                this.context.fillRect(-cellOffsetX + x * size + xOffset, yOffset, 1, areaHeight);
            }
            for (var y = 1; y < cellHeight; y++) {
                this.context.fillRect(xOffset, -cellOffsetY + y * size + yOffset, areaWidth, 1);
            }

            // Cells

            var cellMargin = Math.min(5, size / 10);

            this.context.fillStyle = cellFill;
            this.context.strokeStyle = cellStroke;
            this.context.textBaseline = "middle";
            this.context.textAlign = "center";

            var yMax = Math.min(yCount-cellStartY, cellHeight);
            var xMax = Math.min(xCount - cellStartX, cellWidth);

            for (var x = 0; x < xMax; x++) {
                for (var y = 0; y < yMax; y++) {
                    var item = this.delegate.xy(xIds[x + cellStartX], yIds[y + cellStartY]);
                    if (item.count === 0) continue;

                    var value = item.value;

                    var cellSize = size - 2 * cellMargin;
                    var left = xOffset + (x + 0.5) * size - cellSize / 2 - cellOffsetX;
                    var top = yOffset + (y + 0.5) * size - cellSize / 2 - cellOffsetY;

                    this.context.globalAlpha = 0.2 + 0.8 * value;
                    this.context.fillRect(left, top, cellSize, cellSize);
                    this.context.globalAlpha = 1;
                    this.context.strokeRect(left + 0.5, top + 0.5, cellSize, cellSize);

                    var metrics = this.context.measureText(value).width;
                    var scale = (cellSize - 6) / Math.max(metrics, fontSize);
                    var cutoff = 1;

                    if (fontSize * scale > cutoff) {
                        this.context.save();
                        this.context.globalAlpha = Math.min(1.0, (fontSize * scale - cutoff));

                        this.context.translate(left + cellSize / 2, top + cellSize / 2);
                        this.context.scale(scale, scale);

                        this.context.fillStyle = "rgba(0, 0, 0, 0.4)";
                        this.context.fillText(value, 0, 0);
                        this.context.restore();
                    }
                }
            }

            this.context.restore();

            // Y axis

            var maxBarWidth = Math.min(size * 4, xOffset);
            var maxBarHeight = Math.min(size * 4, yOffset);

            this.context.save();

            this.context.beginPath();
            this.context.rect(0, yOffset + 1.5, width, areaHeight - 3);
            this.context.closePath();
            this.context.clip();

            for (var y = 0; y < yMax; y++) {
                var item = this.delegate.y(yIds[y + cellStartY]);
                if (item.count === 0) continue;

                var val = barSize(item.value);
                var barWidth = val * maxBarWidth;
                this.context.globalAlpha = 0.3 + 0.7 * val;
                this.context.fillStyle = barFill;
                this.context.fillRect(xOffset - barWidth, yOffset + y * size + cellMargin - cellOffsetY, barWidth, size-cellMargin*2);

                this.context.globalAlpha = 1.0;
                this.context.strokeStyle = barStroke;
                this.context.strokeRect(xOffset - barWidth + 0.5, yOffset + y * size + cellMargin + 0.5 - cellOffsetY, barWidth, size-cellMargin*2);
            }

            if (this.hover) {
                var y = hover.y;
                if (y >= 0 && y < cellHeight) {
                    this.context.fillStyle = hoverFill;
                    this.context.globalAlpha = hoverAlpha;
                    this.context.fillRect(0, yOffset + y * size + 1 - cellOffsetY, width, size-1);
                    this.context.globalAlpha = 1.0;
                }
            }

            this.context.restore();

            this.context.save();
            this.context.font = fontSize + "px helvetica";
            this.context.textBaseline = "middle";
            this.context.textAlign = "left";
            this.context.fillStyle = labelFill;

            for (var y = 0; y < yMax; y++) {
                var item = this.delegate.y(yIds[y + cellStartY]);
                if (fontSize < 7) continue;

                var opacity = 1.0;
                var half = size / 2;
                var pos = y * size + size / 2 + fontSize / 6 - cellOffsetY;
                if (pos < 0) {
                    opacity = Math.max((half + pos) / half, 0);
                } else if (pos > areaHeight) {
                    opacity = Math.max((half - (pos - areaHeight)) / half, 0);
                }

                this.context.globalAlpha = Math.pow(opacity, 8);
                this.context.fillText(item.label, xOffset + totalWidth + fontSize / 2, yOffset + pos);
            }

            this.context.restore();

            var yHeader = this.delegate.yHeader();
            if (yHeader !== null) {
                this.context.font = "14px helvetica";
                this.context.textBaseline = "bottom";
                this.context.textAlign = "left";
                this.context.fillStyle = headerFill;
                this.context.fillText(yHeader, xOffset + totalWidth + 6, yOffset);
            }

            // X axis

            this.context.save();
            this.context.beginPath();
            this.context.rect(xOffset + 1.5, 0, areaWidth - 3, height);
            this.context.closePath();
            this.context.clip();

            for (var x = 0; x < xMax; x++) {
                var item = this.delegate.x(xIds[x + cellStartX]);
                if (item.count === 0) continue;

                var val = barSize(item.value);
                var barHeight = val * maxBarHeight;
                this.context.globalAlpha = 0.3 + 0.7 * val;
                this.context.fillStyle = barFill;
                this.context.fillRect(xOffset + x * size + cellMargin - cellOffsetX, yOffset - barHeight, size-cellMargin*2, barHeight);

                this.context.globalAlpha = 1.0;
                this.context.strokeStyle = barStroke;
                this.context.strokeRect(xOffset + x * size + cellMargin + 0.5 - cellOffsetX, yOffset - barHeight + 0.5, size-cellMargin*2, barHeight);
            }

            if (this.hover) {
                var x = hover.x;
                if (x >= 0 && x < cellWidth) {
                    this.context.fillStyle = hoverFill;
                    this.context.globalAlpha = hoverAlpha;
                    this.context.fillRect(xOffset + x * size + 1 - cellOffsetX, 0, size-1, height);
                    this.context.globalAlpha = 1.0;
                }
            }

            this.context.restore();

            this.context.save();
            this.context.font = fontSize + "px helvetica";
            this.context.textBaseline = "middle";
            this.context.textAlign = "left";
            this.context.fillStyle = labelFill;

            for (var x = 0; x < xMax; x++) {
                var item = this.delegate.x(xIds[x + cellStartX]);
                if (fontSize < 7) continue;

                var opacity = 1.0;
                var half = size / 2;
                var pos = x * size + size / 2 - fontSize / 6 - cellOffsetX;
                if (pos < 0) {
                    opacity = Math.max((half + pos) / half, 0);
                } else if (pos > areaWidth) {
                    opacity = Math.max((half - (pos - areaWidth)) / half, 0);
                }

                this.context.save();
                this.context.globalAlpha = Math.pow(opacity, 8);
                this.context.translate(xOffset + pos, yOffset + totalHeight + fontSize / 2);
                this.context.rotate(Math.PI / 3);
                this.context.fillText(item.label, 0, 0);
                this.context.restore();
            }

            this.context.restore();

            var xHeader = this.delegate.xHeader();
            if (xHeader !== null) {
                this.context.save();
                this.context.translate(xOffset + totalWidth + 2, yOffset + totalHeight + 6);
                this.context.rotate(Math.PI / 3);

                this.context.font = "14px helvetica";
                this.context.textBaseline = "bottom";
                this.context.textAlign = "left";
                this.context.fillStyle = headerFill;
                this.context.fillText(xHeader, 0, 0);

                this.context.restore();
            }

            this.context.strokeStyle = backgroundStroke;
            this.context.strokeRect(xOffset + 0.5, yOffset + 0.5, areaWidth - 1, areaHeight - 1);
        }
    });
})(this);
