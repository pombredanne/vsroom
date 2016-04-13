(function(exports) {
    "use strict";

    var ListInfo = new Class({
        Extends: PointerInfo,

        initialize: function(id, description) {
            this.id = id;
            this.description = description;
        },

        select: function(data) {
            var selected = new Container();

            var item = data.get(this.id);
            if (item) {
                selected.set(this.id, item);
            }
            return selected;
        },

        createFilter: function() {
            var _id = this.id;

            return function(id, _) {
                return id === _id;
            };
        },

        formatTip: function() {
            return this.description;
        }
    });

    var delegate = {
        // Generate a fresh element representing a row
        build: function() {
            var element = new Element("div", {
                "class": "list-item",
                "styles": {
                    "position": "absolute",
                    "left": 0,
                    "width": 0,
                    "top": 0
                }
            });
            element._item = null;
            return element;
        },

        // Fill a generated element with row data
        decorate: function(element, item) {
            if (item && element._item === item) {
                return;
            }
            element._item = item;

            var eventText = $tr("ui.eventSingular", "event");
            var descriptionKey = $tr("events.description", "description");

            var text = item && item.value(descriptionKey);

            if (!item) {
                text = "<" + eventText + ">";
            } else if (text === null) {
                var array = [];
                item.forEach(function(value, key) {
                    array.push(key + "=" + value);
                });
                text = array.join(", ");
            }

            element.set("text", text || " ");
        }
    };

    exports.ListView = new Class({
        Extends: View,
        Implements: [Observable, PointerView],

        initialize: function(container) {
            this.parent(container);

            this.view = new Element("div", {
                "class": "list",
                "styles": {
                    "position": "relative",
                    "width": "100%",
                    "height": "100%",
                    "overflow": "hidden"
                }
            });
            this.scroll = new Element("div", {
                "styles": {
                    "overflow": "auto",
                    "position": "relative",
                    "width": "100%",
                    "height": "100%",
                    "margin": 0,
                    "padding": 0,
                    "border-style": "none"
                }
            });
            this.area = new Element("div", {
                "styles": {
                    "position": "absolute",
                    "top": 0,
                    "left": 0,
                    "right": 0,
                    "height": 0,
                    "overflow": "hidden"
                }
            });
            this.content = new Element("div", {
                "styles": {
                    "position": "absolute",
                    "left": 0,
                    "top": 0,
                    "width": 0,
                    "height": 0,
                    "margin": 0,
                    "padding": 0,
                    "border": "none",
                    "overflow": "visible"
                }
            });
            this.scroll.grab(this.area);
            this.view.grab(this.content);
            this.view.grab(this.scroll);
            this.container.grab(this.view);
            this.delegate = delegate;

            this.tree = new AVLTree(function(left, right) {
                return (left.id < right.id) ? -1 : (left.id > right.id) ? 1 : 0;
            }, {
                map: function(item) {
                    return 1;
                },
                combine: function(left, right) {
                    return left + right;
                }
            });

            this.itemSize = null;
            this.elementCache = [];
            this.ids = new Container();

            this.set({
                data: null,
                selected: null
            });

            this.observe({
                data: function(key, value, observer) {
                    if (observer) observer.unobserve();

                    return value && value.observe(function(id, event, node) {
                        if (node) {
                            this.tree.remove(node);
                        }

                        this.update();

                        return event && this.tree.insert({
                            "id": id,
                            "event": event
                        });
                    }, this)
                },

                selected: function(key, value, observer) {
                    if (observer) observer.unobserve();

                    return value && value.observe(function(id, present) {
                        var element = this.ids.get(id);
                        if (!element) return;

                        if (present) {
                            element.addClass("selected");
                        } else {
                            element.removeClass("selected");
                        }
                    }, this);
                }
            }, this);

            var current = null;
            this.listenPointerEvents(this.area, {
                point: function(event) {
                    this.scroll.style.visibility = "hidden";
                    try {
                        var element = document.elementFromPoint(event.clientX, event.clientY);
                    } finally {
                        this.scroll.style.visibility = "";
                    }

                    while (element && element.parentNode !== this.content) {
                        element = element.parentNode;
                    }
                    if (!element) {
                        element = null;
                    }

                    if (current === element) {
                        return PointerInfo.IGNORED;
                    }

                    if (current && current !== element) {
                        current.removeClass("highlighted");
                    }

                    if (!element) {
                        current = null;
                        return PointerInfo.EMPTY;
                    }

                    if (element !== current) {
                        element.addClass("highlighted");
                        current = element;
                    }
                    return new ListInfo(element._id, element.get("text"));
                },

                leave: function() {
                    if (current) {
                        current.removeClass("highlighted");
                    }
                    current = null;
                }
            }, this);

            this.scroll.addEventListener("scroll", function() {
                this.updateImmediately();
            }.bind(this), false);
        },

        destroy: function() {
            this.scroll.destroy();
            this.content.destroy();
            this.parent();
        },

        relayout: function() {
            this.parent();
            this.itemSize = null;
            this._resizeItems();
        },

        _count: function() {
            // Get the current item count.

            var root = this.tree.root;
            return root ? root.combined : 0;
        },

        _getItemSize: function() {
            if (this.itemSize === null) {
                var element = this.delegate.build();
                this.delegate.decorate(element, null);
                this.content.grab(element);

                element.style.width = "0px";
                var outer = element.getSize();

                element.style.border = "none";
                element.style.padding = "0px";
                element.style.margin = "0px";
                var inner = element.getSize();

                this.itemSize = {
                    "innerHeight": Math.max(inner.y, 1),
                    "outerHeight": Math.max(outer.y, 1),
                    "xPadding": outer.x - inner.x
                };
                element.destroy();
            }
            return this.itemSize;
        },

        _resizeItem: function(element) {
            // Note 2010-10-30: Setting row element heights and widths
            // explicitly seems to speed up general page drawing and
            // layout (e.g. when modifying the row text), at least on some
            // WebKit based engines (Safari, Chrome, MobileSafari).

            var itemSize = this._getItemSize();
            var style = element.style;
            style.height = itemSize.innerHeight + "px";
            style.width = (this.scroll.clientWidth - itemSize.xPadding) + "px";
        },

        _resizeItems: function() {
            this.elementCache.forEach(function(element) {
                this._resizeItem(element);
            }, this);

            this.ids.forEach(function(element) {
                this._resizeItem(element);
            }, this);
        },

        _freeItem: function(element) {
            element.removeClass("highlighted");
            element.removeClass("selected");
            this.elementCache.push(element);
        },

        _find: function(root, index) {
            if (!root) {
                return null;
            }

            var left = root.left ? root.left.combined : 0;
            if (index === left) {
                return root;
            }

            if (left > index) {
                return this._find(root.left, index);
            }

            return this._find(root.right, index-1-left);
        },

        _iterate: function(from, count, func, ctx) {
            var iterRight = function(node, index, func, ctx) {
                if (!node || count <= index) return index;

                func.call(ctx, node.value, index);
                index = iterSubtree(node.right, index+1, func, ctx);

                while (node.parent && node === node.parent.right) {
                    node = node.parent;
                }
                return iterRight(node.parent, index, func, ctx);
            };

            var iterSubtree = function(node, index, func, ctx) {
                if (!node || count <= index) return index;

                index = iterSubtree(node.left, index, func, ctx);
                func.call(ctx, node.value, index);
                return iterSubtree(node.right, index+1, func, ctx)
            };

            iterRight(from, 0, func, ctx);
        },

        doUpdate: function() {
            var count = this._count();
            var itemSize = this._getItemSize();
            this.area.style.height = (itemSize.outerHeight * count) + "px";

            var y = this.scroll.scrollTop;
            var height = this.scroll.clientHeight;
            var start = Math.floor(y / itemSize.outerHeight);
            var end = Math.ceil((y + height) / itemSize.outerHeight);
            this.content.style.top = (-y) + "px";

            var contentWidth = this.content.clientWidth;
            if (this.content.clientWidth !== this.scroll.clientWidth) {
                this.content.style.width = this.scroll.clientWidth + "px";
                this._resizeItems();
            }

            var selected = this.get("selected") || new Container();
            var ids = new Container();
            var node = this._find(this.tree.root, start);
            this._iterate(node, end-start, function(item, index) {
                var id = item.id;
                var element = this.ids.pop(id);

                if (!element) {
                    element = this.elementCache.pop();
                    if (!element) {
                        element = this.delegate.build();
                        this._resizeItem(element);
                        this.content.grab(element);
                    } else {
                        element.style.visibility = "";
                    }
                }

                element._id = id;
                element.style.top = ((start + index) * itemSize.outerHeight) + "px";
                this.delegate.decorate(element, item.event);

                if (selected.get(id)) {
                    element.addClass("selected");
                }

                ids.set(id, element);
            }, this);

            this.ids.forEach(function(element) {
                element.style.visibility = "hidden";
                this._freeItem(element);
            }, this);

            this.ids = ids;
        }
    });
})(this);
