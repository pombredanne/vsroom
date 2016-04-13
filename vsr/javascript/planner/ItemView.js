var AbstractItemView = new Class({
    Implements: Observable,

    subItemContainer: "items",

    createSubView: function() {
        return null;
    },

    hookSubView: function(obj, item) {
        obj.view.set("item", item);
    },

    focusSubView: function(obj) {
        obj.view.focus();
    },

    placeSubView: function(obj) {
    },

    destroySubView: function(obj) {
        obj.view.set("item", null);
        obj.element.destroy();
    },

    initialize: function(container) {
        this.container = document.id(container);
        this.children = new Container();

        setTimeout(function() {
            this.observe("item", function(key, item, observer) {
                if (observer) observer.unobserve();
                this.children.forEach(this.destroySubView.bind(this));
                
                if (!item) return null;
                
                var container = item.get(this.subItemContainer);
                return container.observe(function(id, item) {
                    if (item) {
                        if (!this.children.contains(id)) {
                            var obj = this.createSubView(id);
                            this.placeSubView(obj);
                            this.children.set(id, obj);
                        }
                        
                        var obj = this.children.get(id);
                        this.hookSubView(obj, item);
                    } else {
                        if (this.children.contains(id)) {
                            var obj = this.children.get(id);
                            this.children.pop(id);
                            this.destroySubView(obj);
                        }
                    } 
                }.bind(this));
            }.bind(this));
        }.bind(this));
    },

    focusTo: function(id) {
        var obj = this.children.get(id);
        if (obj) this.focusSubView(obj);
    }
});

var ItemView = new Class({
    Extends: AbstractItemView,

    subItemContainer: "keys",

    createSubView: function(id) {
        var element = this.template.clone();
        var view = new ItemKeyView(element, this.valueTemplate);
        
        element.getElement(".button-discard").addEvent("click", function() {
            var item = this.get("item");
            var subItem = view.get("item");
            if (!item || !subItem) return;
            
            item.get(this.subItemContainer).pop(id);
        }.bind(this));

        return { view: view, element: element };
    },

    placeSubView: function(obj) {
        this.keyContainer.grab(obj.element);
    },

    initialize: function(container) {
        this.parent(container);
        this.keyContainer = this.container.getElement("#item");

        this.newButton = this.container.getElement("#new-key-button");
        this.newButton.addEvent("click", function() {
            var item = this.get("item");
            if (!item) return;

            this.focusTo(item.get("keys").add(new ItemKey()));
        }.bind(this));

        this.template = this.container.getElement(".item-key");
        this.template.dispose();        

        this.valueTemplate = this.template.getElement(".item-key-value");
        this.valueTemplate.dispose();

        this.template.getElements(".item-key-value").destroy();
        this.container.getElements(".item-key").destroy();
    },
    
    focus: function() {
        this.newButton.focus();
    }
});

var ItemKeyView = new Class({
    Extends: AbstractItemView,

    subItemContainer: "values",

    createSubView: function(id) {
        var element = this.template.clone();
        var view = new ItemValueView(element);

        element.getElement(".button-discard").addEvent("click", function() {
            var item = this.get("item");
            var subItem = view.get("item");
            if (!item || !subItem) return;

            item.get(this.subItemContainer).pop(id);
        }.bind(this));

        return { view: view, element: element };
    },

    placeSubView: function(obj) {
        this.valueContainer.grab(obj.element);
    },

    initialize: function(container, template) {
        this.parent(container);
        this.template = template;
        this.valueContainer = this.container.getElement(".item-key-values");

        this.container.getElement(".new-value-button").addEvent("click", function() {
            var item = this.get("item");
            if (!item) return;

            this.focusTo(item.get("values").add(new ItemValue()));
        }.bind(this));

        this.input = new ObservableInput(this.container.getElement("input"));

        this.observe("item", function(key, item, binding) {
            if (binding) binding.unbind();
            if (!item) return null;

            return item.bind("name", this.input, "value");
        }.bind(this));
    },

    focus: function() {
        this.input.focus();
    }
});

var ItemValueView = new Class({
    Implements: Observable,

    initialize: function(container) {
        container = document.id(container);
        this.input = new ObservableInput(container.getElement("input"));

        this.observe("item", function(key, item, binding) {
            if (binding) binding.unbind();
            if (!item) return;

            return item.bind("value", this.input, "value");
        }.bind(this));
    },

    focus: function() {
        this.input.focus();
    }
});

var ItemContainerView = new Class({
    Implements: Observable,

    initialize: function(container) {
        this.container = document.id(container);

        this.itemName = new ObservableInput(this.container.getElement("#item-name"));
        this.itemDiscard = this.container.getElement("#item-delete");

        this.editContainer = this.container.getElement("#edit");
        this.createContainer = this.container.getElement("#create");
        this.chooseContainer = this.container.getElement("#choose");

        this.editView = new ItemView(this.editContainer);

        this.itemDiscard.addEvent("click", function() {
            var items = this.get("items");
            if (!items) return;

            var value = this.itemName.get("value");
            items.pop(value);
            this.set("selected", null);
            this._refresh();
            this.itemName.focus();
        }.bind(this));

        this.createContainer.getElement("#new-item-button").addEvent("click", function() {
            var items = this.get("items");
            if (!items) return;

            var name = this.itemName.get("value");
            if (!name) return;

            if (!items.contains(name)) items.set(name, new Item());
            this.set("selected", name);
            this._refresh();
            this.editView.focus();
        }.bind(this));

        this.bind("selected", this.itemName, "value");

        this.observe({
            "selected": function(key, value, old) {
                if (value !== old) this._refresh();

                return value;
            }.bind(this),

            "items": function(key, items, observer) {
                if (observer) observer.unobserve();               
                if (!items) return null;

                return items.observe(function(id, item) {
                    var selected = this.get("selected")
                    if (!selected) return;

                    if (item && selected === id) {
                        this.editView.set("item", item);
                    } else if (!item && selected === id) {
                        this.editView.set("item", null);
                        this.set("selected", null);
                    }
                }.bind(this));
            }.bind(this)
        });

        this._refresh();
    },

    focus: function() {
        this.itemName.focus();
    },

    _refresh: function() {
        var selected = this.get("selected");
        var items = this.get("items");
        
        if (!items || !selected) {
            this.chooseContainer.setStyle("display", "");
            this.createContainer.setStyle("display", "none");
            this.editContainer.setStyle("display", "none");
        } else if (!items.contains(selected)) {
            this.chooseContainer.setStyle("display", "none");
            this.createContainer.setStyle("display", "");
            this.editContainer.setStyle("display", "none");
        } else {
            this.createContainer.setStyle("display", "none");
            this.chooseContainer.setStyle("display", "none");
            this.editContainer.setStyle("display", "");                 
            this.editView.set("item", items.get(selected));
        }
    }
});