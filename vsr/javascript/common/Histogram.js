(function(exports) {
    var max = Math.max;
    var min = Math.min;

    var cmp = function(left, right) {
        var delta = left.start - right.start;
        return delta === 0 ? left.end - right.end : delta;
    };

    var floor_ = Math.floor;
    var floor = function(value, granularity) {
        return floor_(value / granularity) * granularity;
    };

    var ceil_ = Math.ceil;
    var ceil = function(value, granularity) {
        return ceil_(value / granularity) * granularity;
    };

    var find = function(array, time, lo, hi) {
        if (lo === hi) {
            return lo;
        }

        var mid = lo + ((hi-lo) >> 1);
        if (array[mid].time < time) {
            return find(array, time, mid+1, hi);
        }
        return find(array, time, lo, mid);
    };

    var merge = function(combiner, left, right) {
        if (!left) return right;
        if (!right) return left;

        var head = null;
        var tail = null;

        while (left && right) {
            var newTail = null;

            if (left.time < right.time) {
                newTail = left;
                left = left.next;
            } else if (right.time < left.time) {
                newTail = right;
                right = right.next;
            } else {
                left.combined = combiner.combine(left.combined, right.combined);
                newTail = left;
                left = left.next;
                right = right.next;
            }

            if (tail) {
                tail.next = newTail;
            } else {
                head = newTail;
            }
            tail = newTail;
        }

        tail.next = left || right;
        return head;
    };

    var range = function(start, end, step, value) {
        if (start >= end) return null;
        var head = {
            time: start,
            combined: value,
            next: null 
        };
        var tail = head;

        start += step;
        while (start < end) {
            var newTail = {
                time: start,
                combined: value,
                next: null
            };
            tail.next = newTail;
            tail = newTail;
            start += step;
        }
        return head;
    };

    var traverse = function(root, start, end, step, combiner) {
        if (!root || start >= end) return null;

        var combined = root.combined;
        var maxStart = floor(combined.max.start, step);        
        var maxEnd = ceil(combined.max.end, step);
        if (start >= maxEnd || maxStart >= end) return null;

        var value = root.value;
        var valueStart = max(floor(value.max.start, step), start);
        var valueEnd = min(ceil(value.max.end, step), end);

        var minStart = max(floor(combined.min.start, step), start);
        var minEnd = min(ceil(combined.min.end, step), end);
        if (minStart >= minEnd) {
            var all = traverse(root.left, start, end, step, combiner);
            all = merge(combiner, all, range(valueStart, valueEnd, step, value));
            all = merge(combiner, all, traverse(root.right, start, end, step, combiner));
            return all;
        }

        var common = range(minStart, minEnd, step, combined);

        var left = traverse(root.left, start, minStart, step, combiner);
        left = merge(combiner, left, range(valueStart, minStart, step, value));
        left = merge(combiner, left, traverse(root.right, start, minStart, step, combiner));

        var right = traverse(root.left, minEnd, end, step, combiner);
        right = merge(combiner, right, range(minEnd, valueEnd, step, value));
        right = merge(combiner, right, traverse(root.right, minEnd, end, step, combiner));

        return merge(combiner, left, merge(combiner, common, right));
    };

    exports.Histogram = new Class({
        initialize: function(history) {
            this.full_ = history;
            this.history_ = null;
            this.listener_ = null;

            this.view_ = {
                start: -Infinity,
                end: -Infinity  
            };

            this.granularity_ = Infinity;
            this.combiner_ = new Combiner();
            this.initTree_();
        },

        initTree_: function() {
            if (this.history_) this.history_.destroy();
            if (this.listener_) this.listener_.unlisten();

            var step = this.granularity_;
            var view = this.view_;
            this.history_ = this.full_.view({
                start: floor(view.start, step),
                end: ceil(view.end, step)                
            });
            this.listener_ = this.history_.listen({
                added: this.added_,
                removed: this.removed_ 
            }, this);

            this.nodes_ = {};
            this.data_ = null;

            var combiner = this.combiner_;
            this.items_ = new AVLTree(cmp, function(left, right) {
                var combined = combiner.combine(left, right);
                combined.max = {
                    start: min(left.max.start, right.max.start),
                    end: max(left.max.end, right.max.end)
                };
                combined.min = {
                    start: max(left.min.start, right.min.start),
                    end: min(left.min.end, right.min.end)
                };
                return combined;
            });

            this.history_.forEach(function(item) {
                this.added_(item);
            }, this);
        },
        
        added_: function(item) {
            var granularity = this.granularity_;

            var combined = this.combiner_.map(item.event);
            var span = {
                start: item.start,
                end: item.end                
            };
            combined.max = span;
            combined.min = span;
            this.nodes_[item.id] = this.items_.insert(combined);

            this.data_ = null;
        },

        removed_: function(item) {
            var node = this.nodes_[item.id];
            this.items_.remove(node);
            delete this.nodes_[item.id];

            this.data_ = null;            
        },

        destroy: function() {
            this.listener_.unlisten();
            this.history_.destroy();
        },

        setCombiner: function(combiner) {
            this.combiner_ = new Combiner(combiner);
            this.initTree_();
        },

        setView: function(start, end, granularity) {
            var start = floor(start, granularity);
            var end = ceil(end, granularity);

            if (this.granularity_ === granularity &&
                this.view_.start === start &&
                this.view_.end === end) return;

            this.granularity_ = granularity;
            this.view_.start = start;
            this.view_.end = end;
            this.data_ = null;
            this.history_.setView(this.view_.start, this.view_.end);
        },

        recalc_: function() {
            if (this.data_) return this.data_;

            var step = this.granularity_;
            var start = floor(this.view_.start, step);
            var end = ceil(this.view_.end, step);

            var combiner = this.combiner_;
            var node = traverse(this.items_.root, start, end, step, combiner);

            var data = [];
            while (node) {
                data.push({
                    time: node.time,
                    combined: node.combined 
                });
                node = node.next;
            }
            this.data_ = data;

            return data;
        },

        find: function(time) {
            var data = this.recalc_();
            if (data.length === 0) {
                return null;
            }

            var step = this.granularity_;
            var index = find(data, time, 0, data.length);

            var item = data[index];
            if (index === data.length || data[index].time > time) {
                index -= 1;
            } else {
                return data[index].combined;
            }

            if (index >= 0 && time < data[index].time + step) {
                return data[index].combined;
            }

            return null;
        },
        
        forEach: function(start, end, func, context) {
            var combiner = this.combiner_;
            this.recalc_().forEach(function(item) {
                func.call(context, item.time, combiner.unmap(item.combined));
            });
        }
    });
})(this);