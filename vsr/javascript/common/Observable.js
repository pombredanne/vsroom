(function(exports) {
    var has = Object.prototype.hasOwnProperty;

    var forEachOwnProperty = function(obj, func, context, source) {
        for (var key in obj) {
            if (!has.call(obj, key)) return;
            func.call(context, obj[key], key, source);
        }
    };

    var observeKey = function(obj, key, func, ctx) {
        var state = func.call(ctx, key, obj.get(key), null, obj);

        var listener = obj.listen("change:" + key, function(value) {
            state = func.call(ctx, key, value, state, obj);
            if (state == null) state = null;
        });

        return {
            unobserve: function(teardown) {
                if (!listener) return;
                listener.unlisten();

                if (!listener) return;
                listener = null;

                if (teardown) func.call(ctx, key, null, state, obj);
                state = null;
            }
        };
    };

    var observeAny = function(obj, func, ctx) {
        var states = {};

        obj.forEachObservableKey(function(key) {
            var state = func.call(ctx, key, obj.get(key), null, obj);

            if (state != null) {
                states[key] = state;
            }
        });

        var listener = obj.listen("change", function(key, value) {
            var hasState = has.call(states, key);
            var state = func.call(ctx, key, value, hasState ? states[key] : null, obj);
            if (state != null) {
                states[key] = state;
            } else if (hasState) {
                delete states[key];
            }
        });

        return {
            unobserve: function(teardown) {
                if (!listener) return;
                listener.unlisten();

                if (!listener) return;
                listener = null;

                if (teardown || arguments.length === 0) obj.forEachObservableKey(function(key) {
                    var state = has.call(states, key) ? states[key] : null;
                    func.call(ctx, key, null, state, obj);
                });
                states = null;
            }
        };
    };

    var ObservableBase = exports.ObservableBase = function() {
    };

    ObservableBase.prototype = new EventSource();

    ObservableBase.prototype.observe = function(arg1, arg2, arg3) {
        if (typeof(arg1) === "string") {
            return observeKey(this, arg1, arg2, arg3);
        } else if (typeof(arg1) === "function") {
            return observeAny(this, arg1, arg2);
        }

        var observers = [];

        forEachOwnProperty(arg1, function(func, key) {
            observers.push(observeKey(this, key, func, arg2));
        }, this);

        return {
            unobserve: function() {
                while (observers.length) {
                    var observer = observers.pop();
                    observer.unobserve.apply(observer, arguments);
                }
            }
        };
    };

    ObservableBase.prototype.signalObservableKeyChange = function(key, item) {
        this.trigger("change", key, item);
        this.trigger("change:" + key, item);
    };

    ObservableBase.prototype.get = function(key, _default) {
        return (arguments.length < 2) ? null : _default;
    };

    ObservableBase.prototype.set = function(key, value) {
    };

    ObservableBase.prototype.forEachObservableKey = function(func, context) {
    };

    var Observable = exports.Observable = function(obj) {
        this._observableKeys = null;

        if (obj) {
            forEachOwnProperty(obj, function(value, key) {
                this.set(key, value);
            }, this);
        }
    };

    Observable.prototype = new ObservableBase();

    Observable.prototype._observableKeys = null;

    Observable.prototype.forEachObservableKey = function(func, context) {
        var keys = this._observableKeys;
        if (!keys) return;

        forEachOwnProperty(keys, function(_, key) {
            func.call(context, key, this);
        }, this);
    };

    Observable.prototype.set = function(arg1, arg2) {
        var keys = this._observableKeys;
        if (!keys) this._observableKeys = keys = {};

        if (typeof(arg1) === "string") {
            keys[arg1] = arg2;
            this.signalObservableKeyChange(arg1, arg2);
        } else {
            for (var key in arg1) {
                if (!has.call(arg1, key)) continue;

                var value = arg1[key];
                keys[key] = value;
                this.signalObservableKeyChange(key, value);
            }
        }

        return this;
    };

    Observable.prototype.get = function(key, _default) {
        var keys = this._observableKeys;
        if (keys && has.call(keys, key)) {
            return keys[key];
        }
        return (arguments.length < 2) ? null : _default;
    };

    Observable.prototype.bind = function(fromKey, to, toKey) {
        var from = this;

        var fromObserver = this.observe(fromKey, function(key, value) {
            if (to.get(toKey) !== value) to.set(toKey, value);
        });

        var toObserver = to.observe(toKey, function(key, value) {
            if (from.get(fromKey) !== value) from.set(fromKey, value);
        });

        return {
            unbind: function() {
                fromObserver.unobserve(false);
                toObserver.unobserve(false);
            }
        };
    };
})(this);