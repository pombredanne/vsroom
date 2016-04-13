(function(exports) {
    var copyArray = function(array) {
        return Array.prototype.slice.call(array, 0, array.length);
    };
    
    var escapeRegExp = function(string) {
        var escaped = "";
        var padding = "0000";
        
        for (var i = 0, len = string.length; i < len; i++) {
            var code = string.charCodeAt(i).toString(16);
            escaped += "\\u" + padding.slice(0, 4-code.length) + code;
        }

        return escaped;
    };
    
    var Parser = exports.Parser = function(obj) {
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                this[key] = obj[key];
            }
        }
    };
    
    Parser.prototype = {
        map: function(match) {
            return match;
        },
        
        match: function(string) {
            return {
                "match": null,
                "tail": string
            }
        },
        
        parse: function(string) {
            var result = this.match(string);
            if (!result) return null;
            
            return {
                "match": this.map(result.match),
                "tail": result.tail
            };
        },
        
        transform: function(func, context) {
            var _this = this;
            
            return new Parser({
                match: function(string) {
                    var result = _this.parse(string);
                    if (!result) return null;
                    
                    return {
                        "match": func.call(context, result.match),
                        "tail": result.tail
                    };
                }
            });
        },
        
        pick: function() {
            var args = copyArray(arguments);
            
            return this.transform(function(match) {
                if (args.length === 0) return null;
                if (args.length === 1) return match[args[0]];
                
                var results = [];
                for (var i = 0, len = args.length; i < len; i++) {
                    results.push(match[args[i]]);
                }
                return results;
            });
        }
    };

    var word = exports.word = function(exp, ignoreCase) {
        if (typeof(exp) === "string") {
            exp = new RegExp("^" + escapeRegExp(exp), ignoreCase ? "i" : "");
        } else {
            ignoreCase = exp.ignoreCase;
            exp = new RegExp("^(?:" + exp.source + ")", ignoreCase ? "i" : "");
        }
        
        return new Parser({
            match: function(string) {
                var match = string.match(exp);
                if (!match) return null;
                
                return {
                    "match": match,
                    "tail": string.slice(match[0].length, string.length)
                };
            }
        });
    };
    
    var sequence = exports.sequence = function() {
        var args = copyArray(arguments);
        
        return new Parser({
            match: function(string) {
                var results = [];
                for (var i = 0, len = args.length; i < len; i++) {
                    var result = args[i].parse(string);
                    if (!result) return null;
                    
                    results.push(result.match);
                    string = result.tail;
                }
                
                return {
                    "match": results,
                    "tail": string
                };
            }
        });
    };
    
    var union = exports.union = function() {
        var args = copyArray(arguments);
        
        return new Parser({
            match: function(string) {
                for (var i = 0, len = args.length; i < len; i++) {
                    var result = args[i].parse(string);
                    if (result !== null) return result;
                }
                return null;
            }
        });
    };
    
    var maybe = exports.maybe = function(exp) {
        var epsilon = new Parser();
        return union(exp, epsilon);
    };
    
    var proxy = exports.proxy = function(parser) {
        return new Parser({
            parser: parser || new Parser(),
            
            set: function(parser) {
                this.parser = parser;
            },
            
            match: function(string) {
                return this.parser.parse(string);
            }
        });
    };

    var delimited = exports.quoted = function(delimiter, escapeChar) {
        var d = escapeRegExp(delimiter);
        var e = escapeRegExp(arguments.length >= 2 ? escapeChar : "\\");
        var exp = d + "((?:" + e + ".|[^" + e + d + "])*)" + d;
        return word(new RegExp(exp)).pick(1);
    };

    var W = word(/\s+/);
    var MW = maybe(W);

    var STRING = (function() {
        var parseJSON = JSON.parse;
        var quoted = delimited("\"").transform(function(string) {
            return parseJSON('"' + string + '"');
        });
        var unquoted = word(/[^\/\"\(\)\!\=\s]+/i).pick(0);
        return union(quoted, unquoted);
    })();
    
    var REGEXP = delimited("\/").transform(function(match) {
        return new RegExp(match);
    });

    var EQUALITY_OP = word(/==|=|!=/).pick(0);
    var EQUALITY = (sequence(STRING, MW, EQUALITY_OP, MW, union(STRING, REGEXP))
                    .pick(0, 2, 4));
    var FREE = union(STRING, REGEXP);
    
    var EXPR = exports.EXPR = proxy();
    
    var PARENS = sequence(word("("), EXPR, word(")")).pick(1);

    var ATOM = proxy();
    var NO = sequence(word(/no/i),
                      union(sequence(MW, PARENS),
                            sequence(W, ATOM)).pick(1)).pick(1);
    ATOM.set(union(NO, PARENS, EQUALITY, FREE));

    var LEFT = union(sequence(PARENS, MW), sequence(ATOM, W)).pick(0);
    var RIGHT = union(sequence(MW, PARENS), sequence(W, EXPR)).pick(1);
    var AND = sequence(LEFT, word(/and/i), RIGHT).pick(0, 2);
    var OR = sequence(LEFT, word(/or/i), RIGHT).pick(0, 2);
    
    EXPR.set(sequence(MW, union(AND, OR, NO, PARENS, ATOM), MW).pick(1));
    
    AND.map = function(match) {
        return function(item) {
            return match[0](item) && match[1](item);
        };
    };
    
    OR.map = function(match) {
        return function(item) {
            return match[0](item) || match[1](item);
        };
    };
    
    NO.map = function(match) {
        return function(item) {
            return !match(item);
        };
    };
    
    EQUALITY.map = function(match) {
        var key = match[0];
        var target = match[1] !== "!=";
        var value = match[2];
        if (typeof(value) === "string") {
            value = new RegExp("^" + escapeRegExp(value) + "$");
        }

        return function(event) {
            var values = event.values(key);
            for (var i = 0, len = values.length; i < len; i++) {
                if (value.test(values[i]) == target) return true;
            }
            return false;
        };
    };

    FREE.map = function(match) {
        if (typeof(match) === "string") {
            match = new RegExp(escapeRegExp(match), "i");
        }        

        return function(event) {
            var result = false;
            event.forEach(function(value, key) {
                result = result || match.test(key) || match.test(value);
            });
            return result;
        };
    };
})(this);