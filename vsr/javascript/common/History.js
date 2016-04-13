(function(exports) {
    var cmp = function(left, right) {
        var delta = left.start - right.start;
        return delta === 0 ? left.end - right.end : delta;
    };    

    var find = function(node, start, end, func, ctx) {
        if (!node || node.combined <= start) return;

        find(node.left, start, end, func, ctx);

        var value = node.value;
        if (value.start < end) {
            if (value.end > start) {
                func.call(ctx, value);
            }
            find(node.right, start, end, func, ctx);
        }
    };

    var diff = function(node, start1, end1, func1, start2, end2, func2, ctx) {
        if (!node) return;
        if (node.combined <= start1) return find(node, start2, end2, func2, ctx);
        if (node.combined <= start2) return find(node, start1, end1, func1, ctx);

        diff(node.left, start1, end1, func1, start2, end2, func2, ctx);

        var value = node.value;

        var rightHit1 = value.start < end1;
        var rightHit2 = value.start < end2;
        var currentHit1 = rightHit1 && value.end > start1;
        var currentHit2 = rightHit2 && value.end > start2;

        if (currentHit1 && !currentHit2) {
            func1.call(ctx, value);
        } else if (!currentHit1 && currentHit2) {
            func2.call(ctx, value);
        }

        if (rightHit1 && !rightHit2) {
            find(node.right, start1, end1, func1, ctx);
        } else if (!rightHit1 && rightHit2) {
            find(node.right, start2, end2, func2, ctx);
        } else if (rightHit1 && rightHit2) {
            diff(node.right, start1, end1, func1, start2, end2, func2, ctx);
        }
    };

    var overlap = function(left, right) {
        return left.start < right.end && right.start < left.end;
    };

    // HistoryView

    var HistoryView = exports.HistoryView = function(history, view) {
        this.history_ = history;

        this.view_ = view || {
            start: -Infinity,
            end: -Infinity
        };

        this.listeners_ = [
            history.listen("added", this.added_, this),
            history.listen("removed", this.removed_, this)
        ];
    };

    HistoryView.prototype = new EventSource();

    HistoryView.prototype.added_ = function(item) {
        if (overlap(item, this.view_)) {
            this.trigger("added", item);
        }
    };

    HistoryView.prototype.removed_ = function(item) {
        if (overlap(item, this.view_)) {
            this.trigger("removed", item);
        }
    };

    HistoryView.prototype.destroy = function() {
        this.listeners_.forEach(function(listener) {
            listener.unlisten(); 
        });
        this.history_ = null;
    };

    HistoryView.prototype.setView = function(start, end) {
        var old = this.view_;
        this.view_ = {
            start: start,
            end: end            
        };

        var history = this.history_;
        if (!history) return;

        history.diff(old.start, old.end, function(item) {
            this.trigger("removed", item);
        }, start, end, function(item) {
            this.trigger("added", item);
        }, this);
    };

    HistoryView.prototype.forEach = function(func, ctx) {
        var history = this.history_;
        if (!history) return null;

        var view = this.view_;
        var start = view.start;
        var end = view.end;
        return history.diff(Infinity, Infinity, null, start, end, func, ctx);
    };

    // HistoryItem

    var nextId = 0;

    var HistoryItem = function(start, end, event) {
        this.start = start;
        this.end = end;
        this.event = event;
        this.id = (nextId++).toString(36);
    };

    HistoryItem.prototype.node_ = null;    

    // History

    var History = exports.History = function() {
        this.tree_ = new AVLTree(cmp, {
            map: function(item) {
                return item.end;
            },
            combine: Math.max
        });

        this.ids_ = new Container();
        this.span_ = null;
    };

    History.prototype = new EventSource();

    History.prototype.view = function(view) {
        return new HistoryView(this, view);
    };

    History.prototype.span = function() {
        return this.span_;  
    };

    History.prototype.diff = function(start1, end1, func1, start2, end2, func2, ctx) {
        return diff(this.tree_.root, start1, end1, func1, start2, end2, func2, ctx);
    };

    History.prototype.setSpan = function(start, end) {
        this.span_ = {
            start: start,
            end: end  
        };
        this.trigger("spanChanged", this.span_);
    };

    History.prototype.add = function(start, end, event) {
        var id = event.value("id");

        if (id === null) {
            var span = this.span_;
            if (this.span_ === null) {
                this.setSpan(start, start);
            } else {
                this.setSpan(Math.min(start, span.start), Math.max(span.end, start));
            }

            var item = new HistoryItem(start, end === null ? start + 1 : end, event);
            this.tree_.insert(item);
            this.trigger("added", item);

            return;
        }

        var item = new HistoryItem(start, end === null ? Infinity : end, event);
        event.values("id").forEach(function(id) {
            var ordered = this.ids_.get(id);
            if (!ordered) {
                ordered = new AVLTree(cmp);
                this.ids_.set(id, ordered);
            }
            
            var node = ordered.insert(item);

            var prevNode = ordered.previous(node);
            var prevItem = prevNode && prevNode.value;
            if (prevItem && item.start < prevItem.end) {
                if (prevItem.node_) {
                    this.trigger("removed", prevItem);
                }

                prevItem.end = item.start;
                ordered.update(prevNode);
                
                if (prevItem.node_) {
                    prevItem.node_ = this.tree_.update(prevItem.node_);
                    this.trigger("added", prevItem);
                }
            }

            var nextNode = ordered.next(node);
            if (nextNode === null || prevNode === null) {
                var span = this.span_;
                if (this.span_ === null) {
                    this.setSpan(start, start);
                } else {
                    this.setSpan(Math.min(start, span.start), Math.max(span.end, start));
                }
            }
                
            if (event.isValid()) {
                var nextItem = nextNode && nextNode.value;
                if (nextItem && nextItem.start < item.end) {
                    item.end = nextItem.start;
                    ordered.update(node);
                }

                item.node_ = this.tree_.insert(item);
                this.trigger("added", item);
            }
        }, this);
    };
})(this);