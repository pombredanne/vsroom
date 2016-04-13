var assert = require("assert");
var $tr = require("../common/Translate.js").$tr;

var testDefault = function() {
    var lang = $tr.get();
    assert.ok(lang("test") === null);
    assert.ok(lang("test", "default") === "default");
};

var testFallback = function() {
    var lang = $tr.get().define({
        "root": {
            "a": 1
        }
    });
    assert.ok(lang("root.subPath.a") === 1);
};

var testMasking = function() {
    var lang = $tr.get().define({
        "root": {
            "a": 1
        },
        
        "root.subPath": {
            "a": 2,
            "b": 3
        }
    });
    
    assert.ok(lang("root.a") === 1);
    assert.ok(lang("root.subPath.a") === 2);
    
    assert.ok(lang("root.b") === null);
    assert.ok(lang("root.subPath.b") === 3);
};

var testGet = function() {
    var lang = $tr.get("getTest");
    lang.define({
        "root": {
            "a": 1
        }
    });

    assert.ok($tr.get("getTest")("root.a") === 1);
};

var testPath = function() {
    var lang = $tr.get().define({
        "root.subPath": {
            "a": 1
        }
    });
    
    assert.ok(lang("root.subPath.a") === 1);
    assert.ok(lang(["root", "subPath", "a"]) === 1);
};

var testFlatten = function() {
    var lang = $tr.get().define({
        "root": {
            "a": "X",
            "c": "Z"
        },

        "root.subPath": {
            "a": "Q",
            "b": "Q"
        }
    });

    assert.deepEqual(lang.flatten("root"), { "a": "X", "c": "Z" });
    assert.deepEqual(lang.flatten("root.subPath"), 
                     { "a": "Q", "b": "Q", "c": "Z" });
};