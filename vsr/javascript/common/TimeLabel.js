var TimeLabel = new Class({
    Implements: [Options, Observable, Updater],

    DEFAULT_UPDATE_DELAY: 65,

    options: {
        format: "%Y-%m-%d %H:%M:%S %z %Z",
        now: Date.now
    },
    
    initialize: function(container, options) {
        this.setOptions(options);
        this.container = document.id(container);

        this.showingCurrentTime = true;

        this.set("value", null);
        this.observe("value", function(key, value, old) {
            if (value !== old) this.update();
            return value;
        }, this);

        this.update();
    },
    
    doUpdate: function() {
        var value = this.get("value");
        if (value === null) {
            if (!this.showingCurrentTime) {
                this.container.removeClass("frozen");
            }
            this.showingCurrentTime = true;

            value = this.options.now();
            this.update(1000.0);
        } else {
            if (this.showingCurrentTime) {
                this.container.addClass("frozen");
            }
            this.showingCurrentTime = false;
        }

        var date = new Date(value);
        this.container.set("text", date.format(this.options.format));
    }
});