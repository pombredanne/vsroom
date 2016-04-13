var ObservableInput = new Class({
    Implements: Observable,

    CHECK_DELAY_MS: 50,

    initialize: function(element) {
        this.element = document.id(element);

        var checkId = null;
        var checkNow = function() {
            if (checkId !== null) {
                clearTimeout(checkId);
                checkId = null;
            }

            var value = element.value || null;
            if (element.type == "checkbox") value = element.checked;

            if (this.get("value") !== value) {
                this.set("value", value);
            }
        }.bind(this);
        var checkDelayed = function() {
            if (checkId === null) {
                checkId = setTimeout(checkNow, this.CHECK_DELAY_MS);
            }
        }.bind(this);

        this.observe({
            "value": function(key, value) {
                value = value || "";

                if (element.type == "checkbox" && element.checked != value){
                    element.set('checked', value);
                }else if (element.type != "checkbox" && value !== element.value) {
                    element.value = value;
                }
            }
        });

        var focusValue = null;
        element.addEvents({
            "focus": function() {
                focusValue = element.value;
                return true;
            },
            "blur": function() {
                focusValue = null;
                return true;
            },
            "keydown": function(event) {
                if (event.key === "enter") {
                    element.blur();
                } else if (event.key === "esc") {
                    if (focusValue !== null) element.value = focusValue;
                    element.blur();
                } else {
                    return true;
                }
                return false;
            }
        });

        element.addEventListener("input", checkDelayed, false);
        element.addEvents({ 
            "drop": checkDelayed,
            "focus": checkDelayed,
            "blur": checkDelayed,
            "change": checkDelayed,
            "keydown": checkDelayed,
            "keyup": checkDelayed,
            "mouseenter": checkDelayed
        });

        checkNow();
    },

    focus: function() {
        this.element.focus();
    }
});