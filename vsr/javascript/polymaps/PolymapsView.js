(function(exports) {
    "use strict";

    var AreaLayer = new Class({
        Implements: Updater,

        AREA_COMBINER: {
            "map": function(event) {
                return event.value("population", null, Number);
            },
            "combine": Math.max
        },

        initialize: function(view, map, path, codes) {
            this.view = view;
            this.map = map;
            this.layers = new Container();
            this.population = new Container();
            this.max = null;

            codes.forEach(function(code) {
                var layer = org.polymaps.geoJson()
                    .visible(false)
                    .url(path.replace("%s", code))
                    .on("load", this._load.bind(this))
                    .on("load", this._style(code))
                    .on("show", this._style(code));
                this.layers.set(code, layer);
                this.map.add(layer);
            }.bind(this));

            this.view.observe({
                "areas": function(key, toggle) {
                    this.layers.forEach(function(layer, code) {
                        if (toggle) layer.visible(true);
                        if (!toggle) layer.visible(false);
                    }.bind(this));
                },

                "data": function(key, value, observer) {
                    if (observer) observer.unobserve();
                    return value && value.observe(this._updateId, this);
                }
            }, this);
        },

        _load: function(e) {
            (e.features || []).forEach(function(feature) {
                var el = document.id(feature.element);
                this.view.listenPointerEvents(el, {
                    "enter": function() {
                        var pointer = new PointerInfo();
                        var name = feature.data.properties.NIMI;
                        if (!name) name = feature.data.properties.VNIMI;
                        var code = feature.data.properties.KOOD;
                        if (!code) code = feature.data.properties.VKOOD;
                        code = String.from(code.toInt());

                        var content = [code + ": " + name];

                        var combiner = this.population.get(code);
                        if (combiner) {
                            var snap = combiner.combined();
                            if (snap.count > 0) {
                                content.push("population: " + snap.value);
                            }
                        }

                        pointer.formatTip = function() {
                            return content.join("\n")
                        };
                        return pointer;
                    }
                }, this);
            }.bind(this));
        },

        _updateId: function(id, event, previous) {
            if (previous) {
                previous.combiner.remove(previous.event);

                var snap = previous.combiner.combined();
                if (snap.totalCount === 0) {
                    this.population.pop(previous.code);
                }

                this.update();
            }
            if (!event) return null;

            var code = event.value("lau_code", null, Number);
            if (code === null) return null;

            var combiner = this.population.get(code);
            if (!combiner) {
                combiner = new CombinedAVLTree(function(left, right) {
                    return left - right;
                }, new Combiner(this.AREA_COMBINER));
                this.population.set(code, combiner);
            }
            combiner.insert(event);

            this.update();

            return {
                "code": code,
                "combiner": combiner,
                "event": event
            };
        },

        doUpdate: function() {
            this.max = null;
            this.layers.forEach(function(layer, code) {
                layer.reshow();
            });
        },

        _maxPopulation: function() {
            if (this.max === null) {
                this.population.forEach(function(combiner) {
                    var snap = combiner.combined();
                    if (snap.count > 0 && snap.value > this.max) {
                        this.max = snap.value;
                    }
                }, this);
            }
            return this.max;
        },

        _style: function(code) {
            return org.polymaps.stylist()
                .attr("stroke", function(d) {
                    return "orangered";
                })
                .attr("stroke-width", function(d) {
                return this.map.zoom() / 10;
            }.bind(this))
                .attr("fill", function(d) {
                    return "rgb(255,165,0)";
                })
                .attr("fill-opacity", function(d) {
                var combiner = this.population.get(code);
                if (!combiner) return 0;

                var snap = combiner.combined();
                if (snap.count <= 0) return 0;

                var maxPopulation = this._maxPopulation();
                return 0.1 + 0.4 * snap.value / Math.max(maxPopulation, 1);
            }.bind(this));
        }
    });

    var LonLat = function(lon, lat) {
        this.lon = lon;
        this.lat = lat;
    };

    LonLat.prototype = {
        equals: function(other) {
            return this.lon === other.lon && this.lat === other.lat;
        }
    };

    var hsvToRgb = function(h, s, v) {
        h = (h * 6) % 6;

        var max = v;
        var min = v * (1 - s);
        var mid = min + (max - min) * (1 - Math.abs(1 - h % 2));
        var maxMidMin = [max, mid, min, min, mid, max];

        return {
            "r": (255 * maxMidMin[((h + 0) % 6) | 0]) | 0,
            "g": (255 * maxMidMin[((h + 4) % 6) | 0]) | 0,
            "b": (255 * maxMidMin[((h + 2) % 6) | 0]) | 0
        };
    };

    var PolyPointerInfo = new Class({
        Extends: PointerInfo,

        initialize: function(bounds, groupBy, group, combiner) {
            this.bounds = bounds;
            this.groupBy = groupBy;
            this.group = group;
            this.combiner = combiner;
        },

        createFilter: function() {
            var latKey = $tr("events.latitude", "latitude");
            var lonKey = $tr("events.longitude", "longitude");
            var groupBy = this.groupBy;
            var group = this.group;

            var left = this.bounds.left;
            var right = this.bounds.right;
            var top = this.bounds.top;
            var bottom = this.bounds.bottom;

            return function(id, event) {
                var values = event.values(groupBy);
                if (group === null && values.length > 0) {
                    return false;
                }
                if (group !== null && values.indexOf(group) < 0) {
                    return false;
                }

                var lon = event.value(lonKey, null, Number);
                var lat = event.value(latKey, null, Number);
                if (lon === null || lat === null) {
                    return false;
                }
                return left <= lon && lon < right && top <= lat && lat < bottom;
            };
        },

        formatTip: function(data) {
            var selected = this.select(data);
            var count = selected.count();
            if (count === 0) {
                return null;
            }

            var content = [];
            if (this.groupBy && this.group !== null) {
                content.push(this.groupBy + ": " + this.group);
            }
            if (this.combiner) {
                var combined = Combiner.combineEach(this.combiner, selected);
                if (combined.count > 0) {
                    content.push(this.combiner.title + ": " + combined.value);
                } else {
                    content.push(this.combiner.title + ": -");
                }
            }
            content.push(count + " " + (count === 1 ?
                $tr("ui.eventSingular", "event") :
                $tr("ui.eventPlural", "events")));
            return content.join("\n");
        }
    });

    var PolyMarkerLayer = new Class({
        Implements: Updater,

        initialize: function(view, map) {
            this.view = view;
            this.map = map;

            this.clearArea = this._getArea();

            this.layer = (org.polymaps.geoJson()
                .features([])
                .on("load", this._load.bind(this))
                .on("move", this._move.bind(this))
                .scale("fixed"));
            map.add(this.layer);

            this.colors = new Container();
            this.markers = new Container();
            this.combiner = null;

            this.view.observe({
                "valueKey": function() {
                    this.update();
                },
                "valueCombiner": function(key, item) {
                    this.combiner = EVENT_COMBINERS.create(item);
                    this.update();
                },
                "groupBy": function() {
                    this.colors = new Container();
                    this.update();
                }
            }, this);
        },

        _groupColor: function(group, saturation, value) {
            var key = saturation + " " + value + " " + group;
            if (this.colors.contains(key)) {
                return this.colors.get(key);
            }

            var md5 = group.toMD5();
            var hue = parseInt(md5.substring(0, 3), 16) / 0xfff;
            var rgb = hsvToRgb(hue, saturation, value);

            var result = "rgb(" + rgb.r + "," + rgb.g + "," + rgb.b + ")";
            this.colors.set(key, result);
            return result;
        },

        _load: function(e) {
            var groupBy = this.view.get("groupBy");
            if (!this._oldSelections) this._oldSelections = [];


            var zoom = this.map.zoom();
            var factor = 2 / Math.pow(2, zoom - Math.round(zoom)) * Math.log(zoom) / Math.LN2;

            (e.features || []).forEach(function(feature) {
                var el = document.id(feature.element);

                var transform = el.getAttribute('transform');

                var container = org.polymaps.svg('g');
                container.setAttribute('transform', transform);
                container.setAttribute("class", "mapMarkerContainer");

                container.replaces(el);

                var bounds = feature.data.bounds;

                var total_angle = 0;

                var groups = Object.values(feature.data.groups);
                groups.sort(function(a, b) {
                    return a.name > b.name;
                });

                groups.forEach(function(group) {
                    var value = group.value;

                    group.r = 10;
                    if (value && (value.count > 0)) {
                        group.r += Math.round(Math.log(Math.max(1, value.value)));
                    }

                    group.angle = 5 + group.r * 2;
                    group.r *= factor;
                    total_angle += group.angle;
                });

                var scale_factor = Math.min(160 / total_angle, 1);

                total_angle = 0;

                groups.forEach(function(group) {
                    var selected = group.selected;

                    var el = org.polymaps.svg('path');
                    el.setAttribute("class", "mapMarker");

                    if (selected) {
                        el.setAttribute("class", "mapMarker selected");
                    }

                    var rotate = 'rotate(' + total_angle + ' 0 0)';

                    var a = Math.round(group.angle * scale_factor);
                    total_angle += a;
                    var r = group.r / Math.sqrt(scale_factor);

                    el.setAttribute("transform", rotate);
                    el.inject(container);
                    var y = r * Math.sin(a / 180 * Math.PI);
                    var x = r * Math.cos(a / 180 * Math.PI);
                    el.setAttribute('d', 'M-1,0 L-' + r + ',0 A' + r + ',' + r + ' 0 0,1 -' + x + ',-' + y + ' Z');

                    if (group.name !== null) {
                        el.setStyle("fill", this._groupColor(group.name, 0.95, 0.95));
                        el.setStyle("stroke", this._groupColor(group.name, 0.5, 0.25));
                    }

                    this.view.listenPointerEvents(el, {
                        "enter": function() {
                            el.setAttribute("transform", rotate + ' scale(1.1,1.1)');
                            container.setAttribute("transform", transform + ' scale(1.5,1.5)');
                            container.inject(container.getParent(), 'bottom');
                            return new PolyPointerInfo(bounds, groupBy, group.name,
                                this.combiner);
                        },
                        "leave": function() {
                            el.setAttribute("transform", rotate);
                            container.setAttribute("transform", transform);
                        }
                    }, this);
                }, this);
                transform += ' rotate(' + (Math.round(total_angle / -2) + 90) + ' 0 0)';
                container.setAttribute('transform', transform);

            }.bind(this));
        },

        _move: function() {
            var ext = this.map.extent();
            var clear = this.clearArea;
            if (!this.isInside(ext[0], clear) || !this.isInside(ext[1], clear) ||
                this.map.zoom() != clear[2]) {
                this.update();
            }
        },

        isInside: function(point, rect) {
            return (rect[0].lon <= point.lon && rect[0].lat <= point.lat
                && rect[1].lon >= point.lon && rect[1].lat >= point.lat)
        },

        set: function(id, event, lonLat, selected) {
            var marker = this.markers.get(id);
            if (marker && lonLat &&
                marker.lonLat.equals(lonLat) &&
                marker.selected === selected &&
                marker.event === event) {
                return;
            }

            this.markers.pop(id);
            if (event && lonLat) {
                marker = {
                    "id": id,
                    "event": event,
                    "lonLat": lonLat,
                    "selected": selected
                };
                this.markers.set(id, marker);

                if (this.isInside(lonLat, this.clearArea)) {
                    this.update();
                }
            } else if (marker) {
                this.update();
            }
        },

        _getArea: function() {
            var area = this.map.extent();
            return [new LonLat(2 * area[0].lon - area[1].lon,
                2 * area[0].lat - area[1].lat),
                new LonLat(2 * area[1].lon - area[0].lon,
                    2 * area[1].lat - area[0].lat),
                this.map.zoom()];
        },

        doUpdate: function() {
            this.clearArea = this._getArea();

            var markers = this.markers.values().filter(function(marker) {
                return this.isInside(marker.lonLat, this.clearArea)
            }.bind(this));

            this.layer.features(this._cluster(markers));
        },

        _cluster: function(markers) {
            var clusters = new Container();
            var map = this.map;
            var gridWidth = 35;
            var groupBy = this.view.get("groupBy");

            var leftTop = map.locationPoint({ "lon": -180, "lat": 45 });
            var rightBottom = map.locationPoint({ "lon": 180, "lat": -45 });
            var width = rightBottom.x - leftTop.x;
            var height = rightBottom.y - leftTop.y;

            var factor = Math.round(Math.log(width / gridWidth) / Math.LN2);
            var divisor = 360 / Math.pow(2, factor);

            markers.forEach(function(marker) {
                var lon = divisor * Math.floor(marker.lonLat.lon / divisor);
                var lat = divisor * Math.floor(marker.lonLat.lat / divisor);

                var grid = lon + " " + lat;
                var group = groupBy === null ? null : marker.event.value(groupBy);

                var cluster = clusters.get(grid);
                if (!cluster) {
                    cluster = {
                        "id": marker.id,
                        "geometry": {
                            "type": "Point",
                            "coordinates": [0, 0]
                        },
                        "bounds": {
                            "left": lon,
                            "right": lon + divisor,
                            "top": lat,
                            "bottom": lat + divisor
                        },
                        "groups": {},
                        "selected": false,
                        "markers": []
                    };
                    clusters.set(grid, cluster);
                }

                if (!cluster.groups[group])
                    cluster.groups[group] = {markers: [], events: [], selected: false, name: group};

                cluster.geometry.coordinates[0] += marker.lonLat.lon;
                cluster.geometry.coordinates[1] += marker.lonLat.lat;
                cluster.selected = cluster.groups[group].selected = cluster.groups[group].selected || marker.selected;
                cluster.groups[group].markers.push(marker);
                cluster.markers.push(marker);
                cluster.groups[group].events.push(marker.event);
            });

            var combiner = this.combiner;
            clusters.forEach(function(cluster, key) {
                cluster.geometry.coordinates[0] /= cluster.markers.length;
                cluster.geometry.coordinates[1] /= cluster.markers.length;

                cluster.geometry.coordinates[0] += cluster.bounds.left + divisor / 2;
                cluster.geometry.coordinates[1] += cluster.bounds.top + divisor / 2;
                cluster.geometry.coordinates[0] /= 2;
                cluster.geometry.coordinates[1] /= 2;

                Object.each(cluster.groups, function(group, key) {
                    group.value = Combiner.combineEach(combiner, group.events);
                });
            });
            return clusters.values();
        }
    });

    var PolymapsView = exports.PolymapsView = new Class({
        Extends: View,
        Implements: [Observable, PointerView],

        initialize: function(container) {
            this.parent(container);

            var po = this.po = org.polymaps;

            this.container.grab(new Element("span", {
                "class": "copy",
                "html": "Data CC-By-SA by <a href=\"http://www.openstreetmap.org/\">OpenStreetMap</a>"
            }));

            var controls = this.controls = {
                drag: po.drag(),
                wheel: po.wheel(),
                touch: po.touch(),
                dblclick: po.dblclick(),
                compass: po.compass().pan("none")
            };

            var map = this.map = po.map()
                .container(this.container.appendChild(po.svg("svg")))
                .add(controls.drag)
                .add(controls.wheel)
                .add(controls.dblclick)
                .add(controls.touch)
                .zoomRange([2, 18]);

            map.add(po.image()
                .url(po.url("http://{S}tile.cloudmade.com"
                + "/64659a541b60453882db1e488f2e239a"
                + "/998/256/{Z}/{X}/{Y}.png")
                .hosts(["a.", "b.", "c.", ""])));

            this._resize();

            this.extent = this.map.extent();
            this._move = function() {
                this.extent = this.map.extent();
            }.bind(this);
            map.on("move", this._move);

            this.set({
                data: null,
                selected: null,
                valueKey: null,
                valueCombiner: null,
                groupBy: null,
                lock: null,
                areas: null
            });

            var path = "../common/counties/%s.json";
            var counties = [37, 39, 44, 49, 51, 57, 59, 65, 67, 70, 74, 78, 82, 84, 86, 784, 795, 835];
            this.areaLayer = new AreaLayer(this, map, path, counties);

            this.markerLayer = new PolyMarkerLayer(this, map);

            map.add(controls.compass);
            this._mapLock();

            this.observe({
                data: this._observer,
                selected: this._observer
            }, this);
        },

        _mapLock: function() {
            var controls = this.controls;
            var lock = this.po.svg('svg');
            lock.setAttribute('class', 'lock');
            var bottom = this.po.svg('rect');
            bottom.setAttribute('x', '10');
            bottom.setAttribute('y', '20');
            bottom.setAttribute('width', '15');
            bottom.setAttribute('height', '12');
            var top = this.po.svg('path');
            top.setAttribute('d', 'M11,20 l0,-4 c0,-10 13,-10 13,0 l0,4');
            top.setAttribute('fill', 'none');
            lock.appendChild(bottom);
            lock.appendChild(top);
            this.container.appendChild(lock);
            lock.addEventListener('click', function() {
                this.set('lock', this.get('lock') == "on" ? "off" : "on");
            }.bind(this), true);

            this.observe('lock', function(key, value) {
                if (value == "on") {
                    top.setAttribute('transform', '');
                    Object.each(this.controls, this.map.remove);
                } else {
                    top.setAttribute('transform', 'rotate(-45 10 20)');
                    Object.each(this.controls, this.map.add);
                }
            }.bind(this))
        },

        _resize: function() {
            // Polymaps 2.3.0 throws "TypeError: Result of expression
            // 'tile.element.parentNode' [null] is not an object" on
            // Safari when width or height is 0.
            this.map.size({
                "x": Math.max(this.width(), 1),
                "y": Math.max(this.height(), 1)
            });
        },

        _observer: function(key, value, old) {
            if (old && old.value === value) return old;
            if (old && old.observer) old.observer.unobserve();
            if (!value) return null;

            return {
                observer: value.observe(this._updateId, this),
                value: value
            };
        },

        _updateId: function(id) {
            var data = this.get("data");
            var event = data && data.get(id);

            if (event) {
                var latKey = $tr("events.latitude", "latitude");
                var lonKey = $tr("events.longitude", "longitude");

                var lon = event.value(lonKey, null, Number);
                var lat = event.value(latKey, null, Number);

                if ((lon !== null) && (lat !== null)) {
                    var selected = this.get("selected");
                    selected = selected && selected.get(id);

                    var lonLat = new LonLat(lon, lat);
                    this.markerLayer.set(id, event, lonLat, selected);
                    return;
                }
            }

            this.markerLayer.set(id, null, null, false);
        },

        relayout: function() {
            this.parent();

            this.map.off("move", this._move);
            this._resize();
            this.map.extent(this.extent);
            this.map.on("move", this._move);
        },

        dumpState: function() {
            return {
                "groupBy": this.get("groupBy"),
                "valueKey": this.get("valueKey"),
                "valueCombiner": this.get("valueCombiner"),
                "areas": this.get("areas"),
                "lock": this.get("lock"),
                "bounds": {
                    "left": this.extent[0].lon,
                    "right": this.extent[1].lon,
                    "top": this.extent[1].lat,
                    "bottom": this.extent[0].lat
                }
            };
        },

        loadState: function(state) {
            state = new Container(state);
            this.set({
                "groupBy": state.get("groupBy"),
                "valueKey": state.get("valueKey"),
                "areas": state.get("areas"),
                "lock": state.get("lock"),
                "valueCombiner": state.get("valueCombiner")
            });

            if (state.contains("bounds")) {
                var bounds = state.get("bounds");
                this.extent = [new LonLat(bounds.left, bounds.bottom),
                    new LonLat(bounds.right, bounds.top)];
                this.relayout();
            }
        },

        settingsView: function() {
            return new FieldSet([
                new InputField(this, "groupBy", {
                    "label": $tr("ui.settings.groupBy", "group by")
                }),

                new CheckboxField(this, "areas", {
                    "type": "checkbox",
                    "label": $tr("ui.settings.areas", "toggle areas")
                }),

                new EVENT_COMBINERS.Input(this, "valueCombiner", {
                    "class": "combiner",
                    "legend": $tr("ui.settings.valueFunction", "value function")
                })
            ]);
        }
    });
})(this);
