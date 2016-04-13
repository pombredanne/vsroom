(function(exports) {
    var DEFAULT_MAP = function(value) {
        return value;
    };
    
    var DEFAULT_FILTER = function(value) {
        return (value != null) && !isNaN(value);
    };
    
    var DEFAULT_COMBINE = function(left, right) {
        return null;
    };

    var DEFAULT_COMBINER = {
        map: function(value) {
            return 1;
        },
        
        filter: function(value) {
            return true;
        },
        
        combine: function(left, right) {
            return left + right;
        },

        unmap: DEFAULT_MAP
    };
    
    var fullCombiner = function(combiner) {
        if (!combiner) return DEFAULT_COMBINER;
        
        return {
            map: combiner.map || DEFAULT_MAP,
            filter: combiner.filter || DEFAULT_FILTER,
            combine: combiner.combine || DEFAULT_COMBINER,
            unmap: combiner.unmap || DEFAULT_MAP
        };
    };

    var Combiner = exports.Combiner = function(combiner) {
        combiner = fullCombiner(combiner);

        this.map_ = combiner.map;
        this.filter_ = combiner.filter;
        this.combine_ = combiner.combine;
        this.unmap_ = combiner.unmap;
    };

    Combiner.prototype.nil = function() {
        return {
            totalCount: 0,
            count: 0,
            value: null
        };
    };

    Combiner.prototype.map = function(item) {  
        var mapped = this.map_(item);
        var filtered = this.filter_(mapped);
        return {
            totalCount: 1,
            count: filtered ? 1 : 0,
            value: filtered ? mapped : null
        };        
    };

    Combiner.prototype.combine = function(left, right) {
        var value = null;
        if (left.count === 0) {
            value = right.value;
        } else if (right.count === 0) {
            value = left.value;
        } else {
            value = this.combine_(left.value, right.value);
        }

        return {
            totalCount: left.totalCount + right.totalCount,
            count: left.count + right.count,
            value: value
        };
    };

    Combiner.prototype.unmap = function(combined) {
        var count = combined.count;
        return {
            totalCount: combined.totalCount,
            count: count,
            value: count === 0 ? null : this.unmap_(combined.value)  
        };
    };

    Combiner.prototype.combineEach = function(items, unmap) {
        var combined = this.nil();

        items.forEach(function(item) {
            combined = this.combine(this.map(item), combined);
        }, this);

        if (unmap || arguments.length === 0) {
            combined = this.unmap(combined);
        }
        return combined;
    };

    Combiner.combineEach = function(combiner, items, unmap) {
        unmap = unmap || arguments.length < 3;
        return (new Combiner(combiner)).combineEach(items, unmap);
    };

    var CombinedAVLTree = exports.CombinedAVLTree = function(cmp, combiner) {
        this.combiner_ = combiner;
        this.cmp_ = this.cmpFunc_(cmp);

        this.tree_ = new AVLTree(this.cmp_, {
            combine: function(left, right) {
                return combiner.combine(left, right);
            }
        });
    };

    CombinedAVLTree.prototype.cmpFunc_ = function(cmp) {
        return function(left, right) {
            var leftCount = left.count;
            var rightCount = right.count;

            if (leftCount === 0 && rightCount === 0) return 0;
            if (leftCount === 0) return -1;
            if (rightCount === 0) return 1;

            return cmp(left.value, right.value);
        };     
    };

    CombinedAVLTree.prototype.insert = function(item) {
        this.tree_.insert(this.combiner_.map(item));
    };

    CombinedAVLTree.prototype.remove = function(item) {
        var mapped = this.combiner_.map(item);
        var node = this.tree_.find(mapped);
        if (node && this.cmp_(node.value, mapped) === 0) {
            this.tree_.remove(node);
        }
    };

    CombinedAVLTree.prototype.combined = function(unmap) {
        var root = this.tree_.root;
        if (!root) return this.combiner_.nil();

        var combined = root.combined;
        if (unmap || arguments.length === 0) {
            combined = this.combiner_.unmap(combined);
        }
        return combined;
    };
})(this);