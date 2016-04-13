var EventSource = (function() {
    "use strict";

    var has = Object.prototype.hasOwnProperty;

    var trigger = function(head, args) {
        while (head) {
            var func = head.func_;

            if (func) func.apply(head.ctx_, args);

            head = head.next_;
        }
    };

    var Listener = function() {
    };

    Listener.prototype = {
        next_: null,
        prev_: null,
        func_: null,
        ctx_: null,

        unlisten: function() {
            if (!this.func_) return;

            this.func_ = null;
            this.ctx_ = null;

            var prev = this.prev_;
            var next = this.next_;

            if (prev) {
                prev.next_ = next;
                this.prev_ = null;
            }

            if (next) {
                next.prev_ = prev;

                // Leave this.next_ untouched so it can still be
                // followed in case e.g. unlisten() is called inside
                // func_.
            }
        }
    };

    var ListenerGroup = function(listeners) {
        this.listeners_ = listeners;
    };

    ListenerGroup.prototype = {
        unlisten: function() {
            var listeners = this.listeners_;
            if (!listeners) return;

            this.listeners_ = null;

            while (listeners.length) {
                var listener = listeners.pop();
                listener.unlisten();
            }
        }
    };

    var listen = function(types, type, func, ctx) {
        var newHead = new Listener();

        var oldHead = has.call(types, type) ? types[type] : new Listener();
        oldHead.func_ = func;
        oldHead.ctx_ = ctx;
        oldHead.prev_ = newHead;

        newHead.next_ = oldHead;
        types[type] = newHead;

        return oldHead;        
    };

    var EventSource = function() {
    };

    EventSource.prototype = {
        eventSourceListeners_: null,

        trigger: function(type) {
            var types = this.eventSourceListeners_;
            if (!types) return;

            var all = types["all"];
            if (all
                && (all = all.next_)
                && (type !== "all")
                && has.call(types, "all")) {

                trigger(all, arguments);
            }

            var head = types[type];
            if (head
                && (head = head.next_)
                && has.call(types, type)) {

                var length = arguments.length;
                var args = new Array(length-1);

                for (var i = 1; i < length; i++) {
                    args[i-1] = arguments[i];
                }

                trigger(head, args);
            }
        },

        listen: function(type, func, ctx) {
            var types = this.eventSourceListeners_;
            if (!types) this.eventSourceListeners_ = types = {};

            if (typeof type === "string") {
                return listen(types, type, func, ctx);
            }

            var listeners = [];
            for (var key in type) {
                if (has.call(type, key)) {
                    listeners.push(listen(types, key, type[key], func));
                }
            }
            return new ListenerGroup(listeners);
        }
    };

    return EventSource;
})();