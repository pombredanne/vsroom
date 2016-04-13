(function(exports) {   
    var factor = function(node) {
        var left = node.left;
        var right = node.right;
        return (left ? left.height : 0) - (right ? right.height : 0);
    };

    var height = function(node) {
        var left = node.left ? node.left.height : 0;
        var right = node.right ? node.right.height : 0;
        return (left < right ? right : left) + 1;
    };

    var combined = function(node, combiner) {
        var map = combiner.map;
        var combine = combiner.combine;

        var left = node.left;
        var right = node.right;

        var value = map ? map(node.value) : node.value;
        if (left) value = combine(value, left.combined);
        if (right) value = combine(value, right.combined);
        return value;
    };

    var rotate = function(node, leftRotation, combiner) {
        var parent = node.parent;
        var pivot = leftRotation ? node.right : node.left;
        
        node.parent = pivot;
        if (leftRotation) {
            node.right = pivot.left;
            if (node.right) node.right.parent = node;
            pivot.left = node;
        } else {
            node.left = pivot.right;
            if (node.left) node.left.parent = node;
            pivot.right = node;
        }
        
        pivot.parent = parent;
        if (parent && node === parent.left) {
            parent.left = pivot;
        } else if (parent && node === parent.right) {
            parent.right = pivot;
        }
        
        if (combiner) {
            pivot.combined = node.combined;
            node.combined = combined(node, combiner);
        }

        node.height = height(node);
        pivot.height = height(pivot);
        return pivot;
    };
    
    var rebalance = function(node, combiner) {
        while (node) {
            node.height = height(node);
            if (combiner) node.combined = combined(node, combiner);

            var balance = factor(node);
            if (balance < -1) {
                if (factor(node.right) > 0) {
                    rotate(node.right, false, combiner);
                }
                node = rotate(node, true, combiner);
            } else if (balance > 1) {
                if (factor(node.left) < 0) {
                    rotate(node.left, true, combiner);
                }
                node = rotate(node, false, combiner);
            }
            
            if (!node.parent) break;
            node = node.parent;
        }
        return node;
    };

    var replace = function(node, other) {
        var parent = node.parent;
        if (parent && node === parent.left) parent.left = other;
        if (parent && node === parent.right) parent.right = other;
        if (other) other.parent = parent;
        return other || parent;
    };

    var find = function(node, compared, cmp) {
        if (!node) return null;
        if (cmp(node.value, compared) < 0) {
            return find(node.right, compared, cmp);
        }

        return find(node.left, compared, cmp) || node;
    };

    var AVLTree = exports.AVLTree = function(cmp, combiner) {
        if (typeof(combiner) === "function") {
            combiner = { "combine": combiner };
        }
        this.combiner = combiner;
        this.cmp = cmp;

        this.root = null;
    };
    
    AVLTree.prototype = {
        insert: function(value) {
            var node = {
                value: value,
                height: 1,
                parent: null,
                left: null,
                right: null,
                combined: null
            };

            var cmp = this.cmp;
            var parent = this.root;
            while (parent) {
                if (cmp(value, parent.value) < 0) {
                    if (parent.left) {
                        parent = parent.left;
                    } else {
                        parent.left = node;
                        node.parent = parent;
                        break;
                    }
                } else {
                    if (parent.right) {
                        parent = parent.right;
                    } else {
                        parent.right = node;
                        node.parent = parent;
                        break;
                    }
                }
            }

            this.root = rebalance(node, this.combiner);
            return node;
        },
        
        remove: function(node) {
            var left = node.left;
            var right = node.right;
            var root = null;

            if (!right) {
                root = replace(node, left);
            } else if (!right.left) {
                right.left = left;
                if (left) left.parent = right;
                root = replace(node, right);
            } else {
                var next = right.left;
                while (next.left) next = next.left;

                root = replace(next, next.right);
                replace(node, next);
                
                next.left = left;
                if (left) left.parent = next;
                next.right = right;
                if (right) right.parent = next;
            }

            this.root = rebalance(root, this.combiner);
        },
        
        update: function(node) {
            this.remove(node);
            return this.insert(node.value);
        },

        next: function(node) {
            if (node.right) {
                node = node.right;
                while (node.left) {
                    node = node.left;
                }
                return node;
            }
            
            while (node.parent && node !== node.parent.left) {
                node = node.parent;
            }
            return node.parent;
        },
        
        previous: function(node) {
            if (node.left) {
                node = node.left;
                while (node.right) {
                    node = node.right;
                }
                return node;
            }
            
            while (node.parent && node !== node.parent.right) {
                node = node.parent;
            }
            return node.parent;
        },
        
        find: function(compared) {
            return find(this.root, compared, this.cmp);
        }
    };
})(this);