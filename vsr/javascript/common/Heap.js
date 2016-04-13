(function(exports) {
    var up = function(array, cmp, index) {
        var item = array[index];
        
        while (index > 0) {
            var parent = (index - 1) >> 1;
            if (cmp(array[parent], item) <= 0) break;
            
            array[index] = array[parent];
            index = parent;
        }
        
        array[index] = item;
    };

    var down = function(array, cmp, index) {
        var length = array.length;

        while (true) {
            var left = (index << 1) + 1;
            var right = left + 1;
            var min = index;

            if ((left < length) && (cmp(array[left], array[min]) < 0)) {
                min = left;
            }
            if ((right < length) && (cmp(array[right], array[min]) < 0)) {
                min = right;
            }

            if (index === min) break;

            var item = array[min];
            array[min] = array[index];
            array[index] = item;
            index = min;
        }
    };

    var Heap = exports.Heap = function(cmp) {
        this.cmp = cmp;
        this.array = [];
    };

    Heap.prototype = {
        push: function(item) {
            var array = this.array;
            var length = array.push(item);
            up(array, this.cmp, length-1);
        },
        
        pop: function() {
            var array = this.array;       
            if (array.length === 0) return null;
            
            var replacement = array.pop();
            if (array.length === 0) return replacement;
            
            var item = array[0];
            array[0] = replacement;
            down(array, this.cmp, 0);
            return item;
        },
        
        peek: function() {
            var array = this.array;
            if (array.length === 0) return null;
            return array[0];
        }
    };
})(this);