(function(exports) {
    // FilteredHistory

    var FilteredHistory = exports.FilteredHistory = function(history, filter) {
        this.history_ = history;
        this.filter_ = filter || null;
        this.listener_ = history.listen({
            added: this.added_,
            removed: this.removed_,
            spanChanged: this.spanChanged_
        }, this)
    };

    FilteredHistory.prototype = new EventSource();

    FilteredHistory.prototype.added_ = function(item) {
        var filter = this.filter_;
        if (!filter || filter(item.event)) {
            this.trigger("added", item);
        }        
    };

    FilteredHistory.prototype.removed_ = function(item) {
        var filter = this.filter_;
        if (!filter || filter(item.event)) {        
            this.trigger("removed", item);
        }        
    };

    FilteredHistory.prototype.spanChanged_ = function(span) {
        this.trigger("spanChanged", span);
    };       

    FilteredHistory.prototype.view = function(view) {
        return new HistoryView(this, view);
    };

    FilteredHistory.prototype.span = function() {
        return this.history_.span();
    };

    FilteredHistory.prototype.setFilter = function(filter) {
        var old = this.filter_;
        if (old === filter) return;

        this.filter_ = filter;

        this.history_.diff(-Infinity, -Infinity, null, -Infinity, Infinity, function(item) {
            var oldHit = !old || old(item.event);
            var newHit = !filter || filter(item.event);

            if (oldHit && !newHit) {
                this.trigger("removed", item);
            } else if (!oldHit && newHit) {
                this.trigger("added", item);                
            }            
        }, this);
    };

    FilteredHistory.prototype.diff = function(start1, end1, func1, start2, end2, func2, ctx) {
        var filter = this.filter_;
        this.history_.diff(start1, end1, function(item) {
            if (!filter || filter(item.event)) {
                func1.call(ctx, item);
            }
        }, start2, end2, function(item) {
            if (!filter || filter(item.event)) {
                func2.call(ctx, item);
            }            
        }, ctx);
    };

    FilteredHistory.prototype.destroy = function() {
        this.listener_.unlisten();
        this.history_ = null;
        this.filter_ = null;        
    };

    // Filtering UI

    var parse = function(filter) {
        if (filter === null) return null;

        filter = ("" + filter).trim();
        if (filter) {
            var parsed = EXPR.parse(filter);
            if (parsed && !parsed.tail) {
                return parsed.match;
            }
        }
        return null;        
    };

    var validate = function(value) {
        var value = (value || "").trim();
        if (!value) return true;

        var parsed = EXPR.parse(value);
        return parsed && !parsed.tail;
    };

    var filterField = function(filter) {
        return new InputField(filter, "filter", {
            "class": "filter",
            "placeholder": "<"+$tr("ui.settings.noFilter", "No filter")+">",
            "validate": validate
        });
    };

    var FilterView = exports.FilterView = new Class({
        Implements: Observable,
        
        initialize: function(container) {
            this.set({
                filter: null,
                filterFunc: null
            });

            container = document.id(container);
            container.grab(filterField(this).build().element);

            this.observer_ = this.observe({
                filter: function(_, filter, previous) {
                    if (filter !== previous) {
                        this.set("filterFunc", parse(filter));
                    }
                    return filter;
                }
            }, this);
        },

        relayout: function() {
        },

        destroy: function() {
            this.observer_.unobserve();
        },
        
        dumpState: function() {
            return this.get("filter");
        },
        
        loadState: function(filter) {
            this.set("filter", filter);
        }
    });
    
    var ViewFilterWrapper = exports.ViewFilterWrapper = new Class({
        Implements: Observable,
        
        initialize: function(view) {
            this.set({
                focus: null,
                freeze: null,
                selected: null,
                history: null,
                filter: null
            });

            this.view_ = view;
            this.filtered_ = null;

            this.bindings_ = [
                this.bind("focus", view, "focus"),
                this.bind("freeze", view, "freeze"),                
                this.bind("selected", view, "selected")
            ];

            this.observer_ = this.observe({
                filter: function(_, filter, previous) {
                    if (filter !== previous && this.filtered_) {
                        this.filtered_.setFilter(parse(filter));
                    }
                    return filter;
                },

                history: function(_, history) {
                    if (this.filtered_) {
                        this.filtered_.destroy();
                        this.filtered_ = null
                    }

                    if (history) {
                        var filter = parse(this.get("filter"));
                        this.filtered_ = new FilteredHistory(history, filter);
                    }

                    this.view_.set("history", this.filtered_);
                }
            }, this);
        },

        relayout: function() {
            this.view_.relayout();
        },

        destroy: function() {
            this.bindings_.forEach(function(binding) {
                binding.unbind();
            });
            this.observer_.unobserve();
            this.view_.destroy();
        },
        
        dumpState: function() {
            var state = this.view_.dumpState ? this.view_.dumpState() : {};
            state = new Container(state);
            state.set("filter", this.get("filter"));
            return state.valueOf();
        },
        
        loadState: function(state) {
            state = new Container(state);
            this.set("filter", state.pop("filter"));
            if (this.view_.loadState) {
                this.view_.loadState(state.valueOf());
            }
        },
        
        settingsView: function() {
            var fields = [];
            if (this.view_.settingsView) {
                fields.push(this.view_.settingsView());
            }
            fields.push(new FieldSet([
                filterField(this)
            ], {
                "class": "filter",
                "legend": $tr("ui.settings.filter", "filter")
            }));
            
            return new FieldSet(fields);
        }
    });
})(this);