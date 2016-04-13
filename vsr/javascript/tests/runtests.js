var isTest = function(name) {
    return (/^test/i).test(name);
};

var repeatString = function(string, times) {
    var result = "";
    for (var i = 0; i < times; i++) {
        result += string;
    }
    return result;
};

var run = function(from, depth) {
    for (var key in from) {
        if (!from.hasOwnProperty(key)) continue;
        if (!isTest(key)) continue;
        
        var test = from[key];
        var padding = repeatString(" ", depth * 2);
        if (typeof test === "function") {
            console.log(padding + "-", key);
            test.call(from);
        } else {
            console.log(padding + "*", key);
            run(test, depth + 1);
        }
    }
};

process.argv.slice(2).forEach(function(arg) {
    var fs = require("fs");
    var Script = process.binding("evals").Script;

    var sandbox = {
        "console": console,
        "require": require
    };
    var code = fs.readFileSync(arg);
    Script.runInNewContext(code, sandbox, arg);

    console.log(arg);
    run(sandbox, 1);
});