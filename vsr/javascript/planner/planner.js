var PlannerContainer = function() {};
PlannerContainer.prototype = new Container();
PlannerContainer.prototype.add = function(item) {
    do {
        var id = "id-" + Math.random();
    } while (this.contains(id));

    this.set(id, item);
    return id;
};

var Item = function() {
    this.set("keys", new PlannerContainer());
};
Item.prototype = new Observable();

var ItemKey = function(name) {
    this.set({
        "name": name != null ? name : null,
        "values": new PlannerContainer()
    });
};
ItemKey.prototype = new Observable();

var ItemValue = function(value) {
    this.set("value", value != null ? value : null);
};
ItemValue.prototype = new Observable();

var CSVConverter = new Class({
    initialize: function(container, items) {
        this.container = document.id(container);
        this.items = items;

        this.editor = this.container.getElement("#csv-editor");
        this.editor.value = "";

        this.importButton = this.container.getElement("#csv-import-button");
        this.importButton.addEvent("click", function() {
            this.parse(this.editor.value || "");
            this.hide();
        }.bind(this));

        this.cancelButton = this.container.getElement("#csv-cancel-button");
        this.cancelButton.addEvent("click", function() {
            this.hide();
        }.bind(this));
    },

    format: function() {
        var rows = new Array();
        this.items.forEach(function(item, id) {
            var keys = item.get("keys");
            if (keys.count() === 0) {
                rows.push(id);
                return;
            }

            keys.forEach(function(keyItem) {
                var key = keyItem.get("name") || "";
                var values = keyItem.get("values");

                if (values.count() === 0) {
                    rows.push(id + "," + key);
                    return;
                }
                
                values.forEach(function(valueItem) {
                    var value = valueItem.get("value") || "";
                    rows.push(id + "," + key + "," + value);
                });
            });
        });
        return rows.join("\n");
    },

    parse: function(value) {
        this.items.clear();

        var items = new Container();
        value.split("\n").forEach(function(line) {
            var bites = line.split(",");
            if (bites.length <= 0 || !bites[0]) return;

            if (!items.contains(bites[0])) {
                items.set(bites[0], new Container());
            } 
            var keys = items.get(bites[0]);

            if (!this.items.contains(bites[0])) {
                this.items.set(bites[0], new Item());
            }
            var item = this.items.get(bites[0]);
            if (bites.length === 1) return;

            var keyItem = keys.get(bites[1]);
            if (!keyItem) {
                keyItem = new ItemKey(bites[1]);
                item.get("keys").add(keyItem);
                keys.set(bites[1], keyItem);
            }
            if (bites.length === 2) return;

            keyItem.get("values").add(new ItemValue(bites[2]));
        }, this);
    },

    show: function() {
        this.editor.value = this.format();

        this.container.setStyle("display", "");
        this.editor.select();
        this.editor.focus();
    },

    hide: function() {
        this.container.setStyle("display", "none");
        this.editor.value = "";
    }
});

window.addEvent("domready", function() {
    document.id(window).addEvent("selectstart", function(event) { 
        event.preventDefault();
        return false; 
    });
});

window.addEvent("domready", function() {
    var items = new Container();

    var csvConverter = new CSVConverter("csv-overlay", items);
    var graphView = new GraphView("graph");
    var itemContainerView = new ItemContainerView("item-container");
    itemContainerView.set("items", items);

    document.id("csv-button").addEvent("click", function() {
        csvConverter.show();
    });
    csvConverter.hide();

    var incNode = function(id) {
        var node = graphView.addNode(id);
        node.count = node.count || 0;
        node.count += 1;
        return node;
    }
    var decNode = function(id) {
        var node = graphView.addNode(id);
        if (node.count) node.count -= 1;
        if (!node.count) graphView.discardNode(id);
        return node;
    }
    var incEdge = function(left, right) {
        var edge = graphView.addEdge(left, right);
        edge.count = edge.count || 0;
        edge.count += 1;        
    }
    var decEdge = function(left, right) {
        var edge = graphView.addEdge(left, right);
        if (edge.count) edge.count -= 1;
        if (!edge.count) graphView.discardEdge(left, right);
    }

    items.observe(function(id, item, observer) {
        if (observer) observer.unobserve();

        if (!item) {
            decNode(id);
            return;
        }
        incNode(id);

        return item.get("keys").observe(function(keyId, keyItem, observer) {
            if (observer) observer.unobserve();
            if (!keyItem) return;

            return keyItem.get("values").observe(function(valueId, valueItem, obj) {
                if (obj) {
                    obj.observer.unobserve();
                    decEdge(id, obj.value);
                    decNode(obj.value);
                }
                if (!valueItem) return null;

                obj = { value: valueItem.get("value") || "" };
                obj.observer = valueItem.observe("value", function(key, value) {
                    value = value || "";
                    
                    incEdge(id, value);
                    decEdge(id, obj.value);
                    
                    var node1 = incNode(value);
                    var node2 = decNode(obj.value);

                    if (node1.count === 1 && node2.count === 0) {
                        node1.x = node2.x;
                        node1.y = node2.y;
                    }
                    
                    obj.value = value;
                });

                incNode(obj.value);
                incEdge(id, obj.value);
                return obj;
            });
        });
    });

    graphView.bind("selected", itemContainerView, "selected");
    itemContainerView.focus();
});
