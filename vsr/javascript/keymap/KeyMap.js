(function(exports) {
    "use strict";

    var subdivide = function(values, result, horizontal, rect) {
        if (values.length <= 0) {
            return;
        }
        if (values.length === 1) {
            result.set(values[0].key, {
                "rect": rect,
                "item": values[0]
            });
            return;
        }

        var first = values[0];
        var last = values[values.length-1];

        var cutValue = (first.cumulative + last.cumulative + last.value) / 2;
        for (var cutIndex = 0; cutIndex < values.length-1; cutIndex++) {
            if (values[cutIndex].cumulative >= cutValue) break;
        }
        var cut = values[cutIndex];

        var factor = ((cut.cumulative - first.cumulative) 
                      / (last.cumulative + last.value - first.cumulative));
        if (horizontal) {
            var bottom = rect.top + factor * (rect.bottom-rect.top);
            subdivide(values.slice(0, cutIndex), result, !horizontal, {
                "left": rect.left,
                "right": rect.right,
                "top": rect.top,
                "bottom": bottom
            });
            subdivide(values.slice(cutIndex), result, !horizontal, {
                "left": rect.left,
                "right": rect.right,
                "top": bottom,
                "bottom": rect.bottom
            });
        } else {
            var right = rect.left + factor * (rect.right-rect.left);
            subdivide(values.slice(0, cutIndex), result, !horizontal, {
                "left": rect.left,
                "right": right,
                "top": rect.top,
                "bottom": rect.bottom
            });
            subdivide(values.slice(cutIndex), result, !horizontal, {
                "left": right,
                "right": rect.right,
                "top": rect.top,
                "bottom": rect.bottom
            });
        }
    };

    var prepare = function(values) {
        var sorted = values.keys().map(function(key) {
            return {
                "key": key,
                "value": values.get(key),
                "cumulative": null
            }
        }).sort(function(left, right) {
            return right.value - left.value;
        });
        
        var cumulative = 0;
        sorted.forEach(function(item) {
            item.cumulative = cumulative;
            cumulative += item.value;
        });
        return sorted;
    };

    var fitText = function(ctx, text, fontSize, rect, minHeight) {
        var width = rect.right-rect.left;
        var height = rect.bottom-rect.top;

        var metric = ctx.measureText(text);
        var scale = Math.min(0.8 * width / metric.width, 
                             0.75 * height / fontSize);

        if (scale * height < minHeight) return;

        ctx.save();
        ctx.translate(rect.left + width / 2, rect.top + height / 2);
        ctx.scale(scale, scale);
        ctx.fillText(text, 0, 0);
        ctx.restore();    
    };

    exports.KeyMap = new Class({
        Extends: CanvasView,
        Implements: Observable,

        initialize: function(container) {
            this.parent(container);

            this.set({
                "data": null
            });

            this.observe({
                "data": function(id, value, observer) {
                    if (observer) observer.unobserve();
                    if (!value) return null;
                    
                    return value.observe(function() {
                        this.update();
                    }, this);
                }
            }, this);
        },

        paint: function(ctx) {
            var values = new Container();
            
            var keys = new Container();
            (this.get("data") || new Container()).forEach(function(event, id) {
                event.forEach(function(value, key) {
                    if (key === "id") return;

                    var container = keys.get(key) || new Container();
                    keys.set(key, container);
                    container.set(value, container.get(value, 0) + 1);
                });
            });
            keys.forEach(function(container, key) {
                var max = 0;
                container.forEach(function(count) {
                    max = Math.max(max, count);
                });
                values.set(key, max);
            });

            var rects = new Container();
            subdivide(prepare(values), rects, false, {
                "left": 0,
                "right": this.width(),
                "top": 0,
                "bottom": this.height()
            });
            
            ctx.clearRect(0, 0, this.width(), this.height());
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "bold 14px sans-serif";

            rects.forEach(function(item, key) {
                var rect = item.rect;
                ctx.fillStyle = "black";
                ctx.fillRect(rect.left + 1,
                             rect.top + 1, 
                             rect.right-rect.left - 2, 
                             rect.bottom-rect.top - 2);

                var textRect = {
                    "left": rect.left,
                    "right": rect.right,
                    "top": rect.top,
                    "bottom": rect.top + Math.min(40, 
                                                  (rect.bottom-rect.top) / 3)
                };
                ctx.font = "italic 14px sans-serif";
                ctx.fillStyle = "white";
                fitText(ctx, key, 14, textRect, 0);

                keys.get(key).keys().forEach(function(value) {
                    var count = keys.get(key).pop(value);
                    keys.get(key).set(value + " (" + count + ")", 
                                      Math.pow(count, 0.75));
                });

                var sub = new Container();
                var subRects = subdivide(prepare(keys.get(key)), sub, true, {
                    "left": rect.left + 3,
                    "right": rect.right - 3,
                    "top": textRect.bottom,
                    "bottom": rect.bottom - 3
                });
                
                ctx.font = "14px sans-serif";
                sub.forEach(function(subItem, value) {
                    fitText(ctx, value, 14, subItem.rect, 0);
                });
            });
        }
    });
})(this);