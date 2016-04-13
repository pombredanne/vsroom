(function(exports) {
    var hasOwnProperty = Object.prototype.hasOwnProperty;

    var createLevel = function() {
        return {
            "subLevels": {},
            "values": {}
        };
    };

    var createLang = function() {
        var root = createLevel();
        
        var lang = function(path, _default) {
            if (typeof(path) === "string") path = path.split(".");
            
            var result = _default == null ? null : _default;
            var level = root;
            var last = path.pop();
            var index = 0;
            var length = path.length;
            
            do {
                var values = level.values;
                if (hasOwnProperty.call(values, last)) result = values[last];
                if (index >= length) break;
                
                var subLevels = level.subLevels;
                var key = path[index];
                index += 1;
                
                if (!hasOwnProperty.call(subLevels, key)) break;
                level = subLevels[key];
            } while (true);
            
            return result;
        };
        
        lang.define = function(paths) {
            for (var path in paths) {
                if (!hasOwnProperty.call(paths, path)) continue;
                
                var level = root;
                path.split(".").forEach(function(key) {
                    if (!hasOwnProperty.call(level.subLevels, key)) {
                        level.subLevels[key] = createLevel();
                    }
                    level = level.subLevels[key];
                });
                
                var values = paths[path];
                for (var key in values) {
                    if (!hasOwnProperty.call(values, key)) continue;
                    level.values[key] = values[key];
                }
            }

            return this;
        };

        lang.flatten = function(path) {
            if (typeof(path) === "string") path = path.split(".");

            var result = {};
            var level = root;

            path.forEach(function(part) {
                if (level) {
                    var sub = level.subLevels;
                    level = hasOwnProperty.call(sub, part) ? sub[part] : null;
                }
                if (!level) {
                    return;
                }

                var values = level.values;
                for (var key in values) {
                    if (!hasOwnProperty.call(values, key)) continue;
                    result[key] = values[key];
                }
            });

            return result;
        };

        return lang;
    };

    var namedLangs = {};
    
    var get = function(lang) {
        if (lang == null) {
            return createLang();
        }
        
        if (typeof(lang) === "string") {
            if (!hasOwnProperty.call(namedLangs, lang)) {
                namedLangs[lang] = createLang();
            }
            return namedLangs[lang];
        }
        
        return lang;
    };

    var current = createLang();

    var $tr = exports.$tr = function(path, _default) {
        return current(path, _default);
    };
    
    $tr.use = function(lang) {
        lang = get(lang);
        current = lang;
        return lang;
    };
    
    $tr.get = function(lang) {
        return get(lang);
    };
    
    $tr.define = function(lang, paths) {
        lang = get(lang);
        lang.define(paths);
        return lang;
    };

    $tr.flatten = function(path) {
        return current.flatten(path);
    };
})(this);