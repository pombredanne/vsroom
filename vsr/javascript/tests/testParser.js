var match = (function() {
    var assert = require("assert");
    var repr = JSON.stringify;

    var EXPR = require("../common/Parser.js").EXPR;
    var AHEvent = require("../common/AHEvent.js").AHEvent;

    var match = function(expr, event) {
        var parsed = EXPR.parse(expr);
        assert.ok(parsed.match, repr(expr) + " not parsed at all");
        assert.ok(!parsed.tail, repr(expr) + " not parsed completely");
        
        return parsed.match(new AHEvent(event));
    };
    
    return {
        ok: function(expr, event) {
            assert.ok(match(expr, event), 
                      repr(expr) + " should match " + repr(event));
        },
        
        not: function(expr, event) {
            assert.ok(!match(expr, event), 
                      repr(expr) + " should not match " + repr(event));
        }
    }
})();

var testRelations = {
    testEquality: function() {
        match.ok("a = 1", { a: 1 });
        match.ok("a == 1", { a: 1 });
    },
    
    testUnequality: function() {
        match.ok("a != 1", { a: 2 });
        match.ok("a != 1", { a: [1, 2] });
        match.not("a != 1", { a: 1 });
    }
};

var testBooleans = {
    testNo: function() {
        match.ok("no a = 1", { a: 2 });
        match.not("no a = 1", { a: [1, 2] });
    },
    
    testAnd: function() {
        match.ok("a = 1 and a = 2", { a: [1, 2] });
        match.not("a = 1 and a = 2", { a: 1 });
    },
    
    testOr: function() {
        match.ok("a = 1 or a = 2", { a: 1 });
        match.ok("a = 1 or a = 2", { a: 2 });
        match.not("a = 1 or a = 2", { a: 3 });
    }
};

var testString = {
    testQuotedSpaces: function() {
        match.ok('a = "quoted value"', { a: "quoted value" });
    },
    
    testQuotedEscaping: function() {
        match.ok('a = "\\\""', { a: "\"" });
        match.ok('a = "\\xe4"', { a: "\xe4" });
    }
};

var testFree = {
    testString: function() {
        match.ok("test", { a: "a test value" });
        match.ok("test", { "a test key": 1 });
        match.ok("test", { a: "case insensitive TeST" });
        match.ok("test", { a: "atestvalue" });
        
        match.not("test", { a: 1 });        
    },

    testRegExp: function() {
        match.ok("/test/", { a: "a test value" });
        match.not("/^test/", { a: "a test value" });
    }
};