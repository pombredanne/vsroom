var assert = require("assert");
var AHEvent = require("../common/AHEvent.js").AHEvent;

var sameValues = function(left, right) {
    left.forEach(function(value) {
        var index = right.indexOf(value);
        if (index < 0) return false;
        
        right.splice(index, 1);
    });
    return right.length === 0;
};

var testValues = {
    testBasic: function() {
        var attrs = {
            "a": ["a1"],
            "b": ["b1", "b2"]        
        };
        
        var event = new AHEvent(attrs);
        assert.ok(sameValues(event.values("a"), attrs.a));
        assert.ok(sameValues(event.values("b"), attrs.b));
        assert.ok(sameValues(event.values("c"), []));
    },

    testMap: function() {
        var event = new AHEvent({
            "non-numeric": ["a", "b"],
            "numeric": ["1", "2"],
            "mixed": ["a", "1", "b", "2"]
        });
        assert.ok(sameValues(event.values("not-existing", Number), []));
        assert.ok(sameValues(event.values("non-numeric", Number), []));
        assert.ok(sameValues(event.values("numeric", Number), [1, 2]));
        assert.ok(sameValues(event.values("mixed", Number), [1, 2]));
    },

    testFilter: function() {
        var filter = {
            filter: function(value) {
                return value !== "test";
            }
        }
        
        var event = new AHEvent({
            "not-filtered": ["a", "b"],
            "filtered": ["test"],
            "mixed": ["a", "test", "b"]
        });
        assert.ok(sameValues(event.values("not-existing", filter), []));
        assert.ok(sameValues(event.values("filtered", filter), []));
        assert.ok(sameValues(event.values("not-filtered", filter), ["a", "b"]));
        assert.ok(sameValues(event.values("mixed", filter), ["a", "b"]));
    }
};

var testValue = function() {
    var event = new AHEvent({
        "non-numeric": ["a"],
        "numeric": ["1"],
        "mixed": ["a", "1", "b"]
    });
    assert.ok(event.value("non-numeric") === "a");
    assert.ok(event.value("non-numeric", null, Number) === null);
    assert.ok(event.value("numeric", null, Number) === 1);
    assert.ok(event.value("mixed", null, Number) === 1);
};

var testConstructor = {
    testCopy: function() {
        var event = new AHEvent({
            "a": "a1"
        });
        var copy = new AHEvent(event);
        
        assert.ok(event.value("a") === copy.value("a"));
        assert.ok(event.value("b") === copy.value("b"));
    },

    testFromArray: function() {
        var event = new AHEvent(["a", "a1", "b", "b1", "b", "b2"]);
        
        assert.deepEqual(event.values("a").sort(), ["a1"]);
        assert.deepEqual(event.values("b").sort(), ["b1", "b2"]);
        assert.deepEqual(event.values("c").sort(), []);
    }
};

var testIsValid = function() {
    var event = new AHEvent();
    assert.ok(!event.isValid());

    var event = new AHEvent({ "id": "value" });
    assert.ok(!event.isValid());

    var event = new AHEvent({ "not-id": "value" });
    assert.ok(event.isValid());

    var event = new AHEvent({ "id": "value", "not-id": "value" });
    assert.ok(event.isValid());
};