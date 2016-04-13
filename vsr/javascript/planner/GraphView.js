(function(exports) {
    var max = Math.max;
    var min = Math.min;
    var abs = Math.abs;
    var random = Math.random;
    var sqrt = Math.sqrt;

    var GraphView = exports.GraphView = new Class({
        Extends: CanvasView,
        Implements: Observable,
        
        DEFAULT_UPDATE_DELAY: 10,
        MIN_MOVEMENT: 0.02,
        SMOOTHING_FACTOR: 0.99,

        // Constants for the graph layout, bigger EDGE_FACTOR value means
        // that edge "springs" affect the outcome more. REPULSION_DISTANCE
        // is the min distance where the effect of the repulsion force
        // stops.
        EDGE_FACTOR: 0.8,
        REPULSION_DISTANCE: 200.0,

        initialize: function(container) {
            this.parent(container);

            this.nodes = new Container();
            this.edges = new Container();
            this.transform = { x: 0.0, y: 0.0, scale: 1.0 };

            this.mousePos = null;

            this.canvas.addEvents({
                "mouseleave": function(event) {
                    this.mousePos = null;
                    this.set("highlighted", null);
                    this.update();
                }.bind(this),

                "click": function(event) {
                    var highlighted = this.get("highlighted");
                    var selected = this.get("selected");
                    
                    if (highlighted !== selected) {
                        this.set("selected", highlighted);
                    }
                    this.update();
                }.bind(this),
                
                "mousemove": function(event) {
                    this.mousePos = this.eventOffset(event.event);
                    this.update(25);
                }.bind(this)
            });

            this.set({
                "highlighted": null,
                "selected": null
            });
        },

        addNode: function(id) {
            if (!this.nodes.contains(id)) {
                this.nodes.set(id, { 
                    id: id, 

                    x: 100 * random() - 50, 
                    y: 100 * random() - 50, 

                    translation: { x: 0.0, y: 0.0, count: 0 },

                    height: null,
                    width: null
                });
                this.update();
            }
            return this.nodes.get(id);
        },

        discardNode: function(id) {
            return this.nodes.pop(id);
        },

        _edgeId: function(left, right) {
            left = left.replace(/>/g, ">>");
            right = right.replace(/>/g, ">>");
            return left + " > " + right;
        },

        addEdge: function(left, right) {
            var id = this._edgeId(left, right);

            if (!this.edges.contains(id)) {
                this.edges.set(id, { id: id, left: left, right: right });
                this.update();
            }

            return this.edges.get(id);
        },

        discardEdge: function(left, right) {
            return this.edges.pop(this._edgeId(left, right));
        },

        calc: function() {
            this.cleanup();

            var values = this.nodes.values();
            var valueCount = values.length;
            
            var edgeFactor = this.EDGE_FACTOR;
            var repulsionDistance = this.REPULSION_DISTANCE;

            this.edges.forEach(function(edge) {
                var left = this.nodes.get(edge.left);
                var right = this.nodes.get(edge.right);

                left.translation.x += edgeFactor * (right.x-left.x);
                left.translation.y += edgeFactor * (right.y-left.y);
                left.translation.count += edgeFactor;

                right.translation.x += edgeFactor * (left.x-right.x);
                right.translation.y += edgeFactor * (left.y-right.y);
                right.translation.count += edgeFactor;
            }, this);
            
            for (var i = 0; i < valueCount; i++) {
                var left = values[i];
                
                for (var j = i+1; j < valueCount; j++) {
                    var right = values[j];

                    var dx = right.x - left.x;
                    var dy = right.y - left.y;
                    var length = sqrt(dx * dx + dy * dy);
                    if (length > repulsionDistance) continue;

                    var amount = ((length - repulsionDistance) / 2.0) / length;

                    left.translation.x += dx * amount;
                    left.translation.y += dy * amount;
                    right.translation.x -= dx * amount;
                    right.translation.y -= dy * amount;
                    left.translation.count += 1.0;
                    right.translation.count += 1.0;
                }
            }

            var maxMovement = 0;
            var smoothing = this.SMOOTHING_FACTOR;
            this.nodes.forEach(function(left) {
                var translation = left.translation;

                if (translation.count > 0) {
                    var dx = smoothing * translation.x / translation.count;
                    var dy = smoothing * translation.y / translation.count;
                    maxMovement = max(abs(dx), abs(dy), maxMovement);

                    left.x += dx;
                    left.y += dy;
                    
                    translation.count = 0;
                    translation.x = 0.0;
                    translation.y = 0.0;
                }
            });
            return maxMovement;
        },

        _updateNodes: function() {
            var padding = 6.0;
            var minSize = 13.0;
            var ctx = this.context;

            this.nodes.forEach(function(node) {
                if (node.width === null) {
                    node.width = ctx.measureText(node.id).width + padding;
                    if (node.width < minSize) node.width = minSize;
                }
                if (node.height === null) {
                    node.height = minSize;
                }
            });
        },

        _purgeEdges: function() {
            var nodes = this.nodes;
            var edges = this.edges;

            edges.forEach(function(edge, id) {
                if (!nodes.contains(edge.left) || !nodes.contains(edge.right)) {
                    edges.pop(id);
                }
            });
        },

        cleanup: function() {
            this._purgeEdges();
            this._updateNodes();
        },   

        _bounds: function() {
            var padding = 10.0;

            var selected = this.get("selected");
            if (selected !== null && this.nodes.contains(selected)) {
                var bounds = this._centeredBounds(selected);
            } else {
                var bounds = this._totalBounds();
            }

            return {
                left: bounds.left - padding,
                top: bounds.top - padding,
                right: bounds.right + padding,
                bottom: bounds.bottom + padding
            };
        },

        _totalBounds: function() {
            if (this.nodes.count() === 0) {
                return {
                    left: 0.0,
                    top: 0.0,
                    right: 0.0,
                    bottom: 0.0
                };
            }

            var left = Infinity;
            var top = Infinity;
            var right = -Infinity;
            var bottom = -Infinity;

            this.nodes.forEach(function(node) {
                var width = (node.width || 0.0) / 2.0;
                var height = (node.height || 0.0) / 2.0;

                left = min(node.x - width, left);
                right = max(node.x + width, right);
                top = min(node.y - height, top);
                bottom = max(node.y + height, bottom);
            });

            return {
                left: left,
                top: top,
                right: right,
                bottom: bottom
            };
        },

        _centeredBounds: function(id) {
            var center = this.nodes.get(id);

            var left = center.x;
            var top = center.y;
            var right = center.x;
            var bottom = center.y;

            var edges = new Container();
            edges.set(id, null);
            this.edges.forEach(function(edge) {
                if (edge.left !== id && edge.right !== id) return;

                edges.set(edge.right, null);
                edges.set(edge.left, null);
            });

            edges.forEach(function(_, nodeId) {
                var node = this.nodes.get(nodeId);
                var width = (node.width || 0.0) / 2.0;
                var height = (node.height || 0.0) / 2.0;

                left = min(node.x - width, left);
                right = max(node.x + width, right);
                top = min(node.y - height, top);
                bottom = max(node.y + height, bottom);
            }, this);

            return {
                left: left,
                top: top,
                right: right,
                bottom: bottom
            };
        },

        _scale: function(bounds) {
            var left = bounds.left - 20.0;
            var top = bounds.top - 20.0;
            var right = bounds.right + 20.0;
            var bottom = bounds.bottom + 20.0;

            var width = this.width();
            var height = this.height();

            var scaleX = min(width / (right - left), 2.0);
            var scaleY = min(height / (bottom - top), 2.0);
            return min(scaleX, scaleY);
        },

        _track: function(xOffset, yOffset, scale) {
            if (!this.mousePos) return;

            var x = (this.mousePos.x - xOffset) / scale;
            var y = (this.mousePos.y - yOffset) / scale;

            function hit(node) {
                var nodeX = node.x;
                var nodeY = node.y;
                var width = node.width / 2;
                var height = node.height / 2;

                return (nodeX - width < x
                        && x < nodeX + width
                        && nodeY - height < y 
                        && y < nodeY + height);
            }

            var highlighted = null;
            this.nodes.forEach(function(node) {
                if (!hit(node)) return;
                highlighted = node.id || null;
            });

            if (highlighted !== this.get("highlighted")) {
                this.set("highlighted", highlighted);
            }
        },

        paint: function(ctx) {
            var maxMovement = this.calc();

            var width = this.width();
            var height = this.height();
            ctx.clearRect(0, 0, width, height);

            var highlighted = this.get("highlighted");
            var selected = this.get("selected");

            var bounds = this._bounds();
            var scale = this._scale(bounds);
            var centerX = (bounds.left + bounds.right) / 2.0;
            var centerY = (bounds.top + bounds.bottom) / 2.0;

            var factor = 0.2;
            var oldFactor = 1-factor;
            centerX = factor * centerX + oldFactor * this.transform.x;
            centerY = factor * centerY + oldFactor * this.transform.y;
            scale = factor * scale + oldFactor * this.transform.scale;

            maxMovement = max(maxMovement,
                              abs(centerX - this.transform.x),
                              abs(centerY - this.transform.y),
                              sqrt(abs(1.0 - scale / this.transform.scale)));
            
            this.transform.x = centerX;
            this.transform.y = centerY;
            this.transform.scale = scale

            var offsetX = width / 2.0 - scale * centerX;
            var offsetY = height / 2.0 - scale * centerY;
            this._track(offsetX, offsetY, scale);

            ctx.save();
            ctx.translate(offsetX, offsetY);
            ctx.scale(scale, scale);

            ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
            this.edges.forEach(function(edge) {
                var left = this.nodes.get(edge.left);
                var right = this.nodes.get(edge.right);

                if (selected === null) {
                    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
                } else if (left.id === selected || right.id === selected) {
                    ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
                } else {
                    ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
                }
                ctx.lineWidth = 1.0 / scale;

                ctx.beginPath();
                ctx.moveTo(left.x, left.y);
                ctx.lineTo(right.x, right.y);
                ctx.stroke();
                ctx.closePath();
            }, this);

            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = "10px helvetica";

            this.nodes.forEach(function(node) {
                var x = node.x;
                var y = node.y;
                var size = node.width;

                if (highlighted === node.id) {
                    ctx.strokeStyle = "rgba(200, 0, 0, 0.8)";
                    ctx.lineWidth = 2.0 / scale;
                } else if (selected === node.id) {
                    ctx.strokeStyle = "rgba(50, 0, 0, 0.8)";
                    ctx.lineWidth = 1.0 / scale;
                } else {
                    ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
                    ctx.lineWidth = 1.0;
                }

                if (selected !== node.id) {
                    ctx.fillStyle = "rgba(230, 230, 230, 0.9)";
                } else {
                    ctx.fillStyle = "rgba(230, 180, 180, 0.9)";
                }
                ctx.fillRect(x-size/2, y-node.height/2, size, node.height);
                ctx.strokeRect(x-size/2, y-node.height/2, size, node.height);

                ctx.fillStyle = "black";
                ctx.fillText(node.id, x, y);
            }, this);

            ctx.restore();
            
            if (maxMovement >= this.MIN_MOVEMENT) {
                this.update();
            }
        }
    });
})(this);