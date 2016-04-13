(function(exports) {
    var _hasOwnProperty = Object.prototype.hasOwnProperty;
    
    var Container = exports.Container = function(obj) {
        this._containerItems = null;
        this._containerCount = 0;

        if (obj instanceof Container) {
            obj.forEach(function(value, key) {
                this.set(key, value);
            }, this);
        } else if (obj) {
            for (var key in obj) {
                if (!_hasOwnProperty.call(obj, key)) continue;
                this.set(key, obj[key]);
            }
        }
    };

    Container.prototype = new ObservableBase();
    
    Container.prototype._containerItems = null;
    Container.prototype._containerCount = 0;

    Container.prototype.set = function(key, item) {
        var items = this._containerItems;
        if (!items) this._containerItems = items = {};
        
        if (!_hasOwnProperty.call(items, key)) {
            this._containerCount += 1;
        }
        items[key] = item;
        this.signalObservableKeyChange(key, item);
        return this;
    };

    Container.prototype.get = function(key, _default) {
        var items = this._containerItems;
        if (items && _hasOwnProperty.call(items, key)) {
            return items[key];
        }
        return (arguments.length < 2) ? null : _default;
    };   
    
    Container.prototype.forEachObservableKey = function(func, context) {
        this.forEach(function(_, key) {
            func.call(context, key, this);
        });
    };
    
    Container.prototype.pop = function(key, _default) {
        var items = this._containerItems;
        if (items && _hasOwnProperty.call(items, key)) {
            var item = items[key];
            delete items[key];
            
            this._containerCount -= 1;
            this.signalObservableKeyChange(key, null);
            
            return item;
        }
        return (arguments.length < 2) ? null : _default;
    };
    
    Container.prototype.clear = function() {
        var items = this._containerItems;
        if (!items) return;
        
        delete this._containerItems;
        delete this._containerCount;
        
        for (var key in items) {
            if (!_hasOwnProperty.call(items, key)) continue;
            this.signalObservableKeyChange(key, null);
        }
    };
    
    Container.prototype.contains = function(key) {
        var items = this._containerItems;
        return items && _hasOwnProperty.call(items, key);
    };
    
    Container.prototype.count = function() {
        return this._containerCount;
    };

    Container.prototype.forEach = function(func, context) {
        var items = this._containerItems;
        if (!items) return;
        
        for (var key in items) {
            if (!_hasOwnProperty.call(items, key)) continue;
            func.call(context, items[key], key, this);
        }
    };
    
    Container.prototype.keys = function() {
        var keys = [];
        this.forEach(function(value, key) { keys.push(key); });
        return keys;
    };
    
    Container.prototype.values = function() {
        var values = [];
        this.forEach(function(value, key) { values.push(value); });
        return values;
    };
    
    Container.prototype.valueOf = function() {
        var result = {};
        this.forEach(function(value, key) {
            result[key] = value;
        });
        return result;
    };

    Container.prototype.equals = function(other, eqFunc) {
        if (!(other instanceof Container)) {
            return false;
        }
        
        if (other.count() !== this.count()) {
            return false;
        }
             
        var items = this._containerItems;
        if (!items) {
            return true;
        }
        
        for (var key in items) {
            if (!_hasOwnProperty.call(items, key)) continue;
            
            var value = items[key];
            var otherValue = other.get(key);
            
            if (eqFunc ? !eqFunc(value, otherValue) : (value !== otherValue)) {
                return false;
            }
        }
        return true;
    };
})(this);