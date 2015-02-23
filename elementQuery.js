(function (win, doc) {
    var obj = {},
        hasOwnProp = obj.hasOwnProperty,
        each = function (objects, callback, ctx) {
            var i, isArr;
            if (callback) {
                if (hasOwnProp.apply(objects, ['length'])) isArr = 1;
                if (isArr) {
                    for (i = 0; i < objects.length; i++) {
                        callback.apply(ctx, [objects[i], i, objects]);
                    }
                }
                if (!isArr) {
                    for (i in objects) {
                        callback.apply(ctx, [objects[i], i, objects]);
                    }
                }
            }
            return ctx;
        },
        replaceRegExp = function (target, string_to_replace, replacement) {
            var regex = new RegExp(string_to_replace);
            return target.replace(regex, replacement);
        },
        defaultCSS = {
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            position: 'absolute',
            overflow: 'scroll',
            'z-index': -1,
            visibility: 'hidden'
        },
        css = function (el, css) {
            var n;
            for (n in css) {
                el.style[n] = css[n];
            }
        },
        makeContainer = function (styles) {
            var n, div = doc.createElement('div');
            css(div, styles);
            return div;
        },
        deepInternalCss = {
            position: 'absolute',
            left: 0,
            top: 0
        },
        makeDefaults = function (el) {
            var i, n, elPosition, internal, overflower,
                resizeSensorContainer = makeContainer(defaultCSS);
            resizeSensorContainer.classList.add('resize-sensor');
            internalExpander = makeContainer(defaultCSS);
            internalExpanderChild = makeContainer(deepInternalCss);
            internalExpander.appendChild(internalExpanderChild);
            internalShrinker = makeContainer(defaultCSS);
            internalShrinkerChild = makeContainer(deepInternalCss);
            css(internalShrinkerChild, {
                height: '200%',
                width: '200%'
            });
            internalShrinker.appendChild(internalShrinkerChild);
            internalExpander.classList.add('resize-sensor-expander');
            internalShrinker.classList.add('resize-sensor-shrinker');
            resizeSensorContainer.appendChild(internalExpander);
            resizeSensorContainer.appendChild(internalShrinker);
            el.appendChild(resizeSensorContainer);
            elPosition = el.style.position;
            if (!elPosition || elPosition === 'static') {
                el.style.position = 'relative';
            }
            return {
                el: el,
                sensor: resizeSensorContainer,
                shrinker: internalShrinker,
                shrinkerChild: internalShrinkerChild,
                expander: internalExpander,
                expanderChild: internalExpanderChild,
                watchers: {}
            };
        },
        baseAttrs = {
            height: {
                fn: function (el, dims) {
                    return dims.height;
                }
            },
            width: {
                fn: function (el, dims) {
                    return dims.width;
                }
            }
        },
        unitProcessors = {
            px: function (val) {
                return val;
            }
        },
        objParseDims = function (str, hasThis) {
            var numBool = str.split(hasThis).length - 1;
            return (!!numBool);
        },
        objParseMeasurement = function (str) {
            var nuStr = str.match(/\-.*\~|\~\=/)[0];
            return nuStr.slice(1, nuStr.length - 1);
        },
        objParseValues = function (str) {
            var nuStr = str.match(/\=(\"|\')(.*)\"|\'/);
            return nuStr[2];
        },
        units = function (str) {
            var i, ch, unit = [],
                // todo change this to reflect valid unit lists
                unitList = ['px', 'em', 'ex', 'in', 'cm', '%', 'vh', 'vw', 'pc', 'pt', 'mm'];
            str = str.trim();
            for (i = str.length - 1; i >= 0; i--) {
                unit.unshift(str[i]);
                unitStr = unit.join('');
                if (unitList.indexOf(unitStr) >= 0) {
                    if (unitStr === 'em') {
                        if (str[i - 1] === 'r') return 'rem';
                    }
                    return unitStr;
                }
            }
            return false;
        },
        baseRegExp = /,?([^,\s]*)\[[\s\t]*(min|max)-({{{}}})[\s\t]*[~$\^]?=[\s\t]*"([^"]*)"[\s\t]*]([^\n\s\{]*)/,
        attrRegExp = /\[[\s\t]*(min|max)-({{{}}})[\s\t]*[~$\^]?=[\s\t]*"([^"]*)"[\s\t]*]/;
    unitProcessors[''] = unitProcessors.px;

    function Sensor(el) {
        var n, sensor = this,
            defaults = makeDefaults(el);
        for (n in defaults) {
            sensor[n] = defaults[n];
        }
        sensor.lastHeight = el.offsetHeight;
        sensor.lastWidth = el.offsetWidth;
        sensor.attachScrollHandler();
        return sensor;
    }
    Sensor.prototype = {
        attachScrollHandler: function () {
            var sensor = this,
                el = sensor.sensor;
            el.children[0].addEventListener('scroll', function (e) {
                var el = this;
                e.preventDefault();
                e.stopImmediatePropagation();
                if (el.offsetHeight > sensor.lastHeight || el.offsetWidth > sensor.lastWidth) {
                    sensor.update();
                    sensor.resetScroller();
                }
            }, true);
            el.children[1].addEventListener('scroll', function (e) {
                var el = this;
                e.preventDefault();
                e.stopImmediatePropagation();
                if (el.offsetHeight < sensor.lastHeight || el.offsetWidth < sensor.lastWidth) {
                    sensor.update();
                    sensor.resetScroller();
                }
            }, true);
        },
        update: function () {
            var i, n, m, o, v, args, unit, units, query, attrKey, values, valuesLen, currentValue, baseAttr, doer, convertedValue, sensor = this,
                el = sensor.el,
                watchers = sensor.watchers,
                activeAttrs = {};
            sensor.dimensions = sensor.el.getBoundingClientRect();
            for (n in watchers) {
                baseAttr = baseAttrs[n];
                activeAttrs['min-' + n] = [];
                activeAttrs['max-' + n] = [];
                if (baseAttr) {
                    queries = watchers[n];
                    doer = baseAttr.fn;
                    if (doer && typeof doer === 'function') {
                        currentValue = doer.apply(sensor, [el, sensor.dimensions]);
                        for (v in queries) {
                            query = queries[v];
                            val = parseFloat(v);
                            args = [currentValue, doer, el, sensor.dimensions];
                            for (o in query) {
                                units = query[o];
                                attrKey = o + '-' + n;
                                for (i = 0; i < units.length; i++) {
                                    unit = units[i];
                                    // val, proc, sensor, el, dims
                                    convertedValue = unitProcessors[unit].apply(sensor, args);
                                    if (val < convertedValue) {
                                        if (o === 'min') activeAttrs[attrKey].push(val + unit);
                                    }
                                    if (val > convertedValue) {
                                        if (o === 'max') activeAttrs[attrKey].push(val + unit);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            for (n in activeAttrs) {
                values = activeAttrs[n];
                valuesLen = values.length;
                if (valuesLen) el.setAttribute(n, activeAttrs[n].join(' '));
                if (!valuesLen) el.removeAttribute(n);
            }
        },
        resetScroller: function () {
            var sensor = this,
                sensorEl = sensor.sensor,
                expander = sensorEl.children[0],
                expanderChild = expander.children[0],
                shrinker = sensorEl.children[1];
            expanderChild.style.width = expander.offsetWidth + 10 + 'px';
            expanderChild.style.height = expander.offsetHeight + 10 + 'px';
            expander.scrollLeft = expander.scrollWidth;
            expander.scrollTop = expander.scrollHeight;
            shrinker.scrollLeft = shrinker.scrollWidth;
            shrinker.scrollTop = shrinker.scrollHeight;
            sensor.lastWidth = sensorEl.offsetWidth;
            sensor.lastHeight = sensorEl.offsetHeight;
        },
        hasWatcher: function (obj) {
            var n, m, v, sensor = this,
                watchers = sensor.watchers;
            if (typeof obj === 'object') {
                if (!Array.isArray(obj)) {
                    for (n in obj) {
                        watchers = watchers[n];
                        if (watchers) {
                            for (m in obj[n]) {
                                watchers = watchers[m];
                                if (watchers) {
                                    for (v in obj[n][m]) {
                                        if (watchers[v]) return 1;
                                    }
                                }
                            }
                        }
                    }
                    return 0;
                }
            }
        },
        parseObject: function (str) {
            var measurement, value, valueMesurement, unit, sensor = this,
                original = {};
            measurement = original[objParseMeasurement(str)] = {};
            // array for units
            value = objParseValues(str);
            unit = units(value);
            if (!unit) unit = '';
            valueMesurement = measurement[value] = {};
            if (objParseDims(str, 'min-')) minMax = 'min';
            if (objParseDims(str, 'max-')) minMax = 'max';
            valueMesurement[minMax] = unit;
            return original;
        },
        extendWatcher: function (obj) {
            var n, m, v, unit, sensor = this,
                watchers = sensor.watchers;
            for (n in obj) {
                if (!watchers[n]) watchers[n] = {};
                watchers = watchers[n];
                for (m in obj[n]) {
                    if (!watchers[m]) watchers[m] = {};
                    watchers = watchers[m];
                    for (v in obj[n][m]) {
                        if (!watchers[v]) watchers[v] = [];
                        watchers = watchers[v];
                        unit = obj[n][m][v];
                        if (watchers.indexOf(obj[n][m][v]) === -1) {
                            watchers.push(unit);
                        }
                    }
                }
            }
        },
        add: function (matcher) {
            var i, obj, sensor = this;
            obj = sensor.parseObject(matcher);
            if (!sensor.hasWatcher(obj)) {
                sensor.extendWatcher(obj);
            }
            return sensor;
        }
    };

    function ElementQuery(sheets) {
        var elQuery = this;
        elQuery.reinit(sheets);
        return elQuery;
    }
    ElementQuery.prototype = {
        prefixes: ['min', 'max'],
        regex: function (attr, regex) {
            var elQ = this,
                baseRegStr = regex.toString(),
                converted = replaceRegExp(baseRegStr.slice(1, baseRegStr.length - 1), '{{{}}}', attr);
            return new RegExp(converted, 'mgi');
        },
        reinit: function (sheets) {
            var elQuery = this;
            if (sheets) {
                elQuery.styles = sheets;
                elQuery.updateQueries();
                elQuery.update();
            }
            return elQuery;
        },
        updateQueries: function () {
            var elQuery = this;
            each(baseAttrs, function (obj, name) {
                obj.regex = elQuery.regex(name, baseRegExp);
            });
        },
        // parse the css
        update: function () {
            var i, elQuery = this;
            if (elQuery.styles) {
                each(elQuery.styles, function (sheet, index, sheets) {
                    each(sheet.rules, function (rule, index, rules) {
                        elQuery.addRule(rule.selectorText);
                    });
                });
            }
        },
        addRule: function (selector) {
            var elQuery = this;
            each(baseAttrs, function (computer, name) {
                var matchingElements = selector.match(computer.regex);
                if (matchingElements) {
                    each(matchingElements, function (match, i) {
                        var currentSelector = selector.split(match)[0] + match.replace(),
                            targetedMeasurement = [],
                            currentMatches = [];
                        each(baseAttrs, function (obj, name) {
                            var i, attrMatcher = elQuery.regex(name, attrRegExp),
                                maxedOut = currentSelector.match(attrMatcher),
                                targeted = match.match(attrMatcher);
                            if (maxedOut) {
                                for (i = 0; i < maxedOut.length; i++) {
                                    currentMatches.push(maxedOut[i]);
                                    currentSelector = currentSelector.split(maxedOut[i]).join('');
                                }
                            }
                            if (targeted) {
                                for (i = 0; i < targeted.length; i++) {
                                    targetedMeasurement.push(targeted[i]);
                                }
                            }
                        });
                        els = document.querySelectorAll(currentSelector);
                        each(els, function (el) {
                            each(targetedMeasurement, function (target) {
                                elQuery.attach(el, target);
                            });
                        });
                    });
                }
            });
        },
        // watch these els
        attach: function (el, matchers) {
            var els, watchers, dataCache, elIndex, elQ = this,
                stringVersion = el.toString();
            if (!elQ.watchers) elQ.watchers = {};
            watchers = elQ.watchers;
            if (!watchers[stringVersion]) watchers[stringVersion] = {};
            dataCache = watchers[stringVersion];
            if (!dataCache.els) dataCache.els = [];
            if (!dataCache.sensors) dataCache.sensors = [];
            els = dataCache.els;
            elIndex = els.indexOf(el);
            if (elIndex === -1) {
                elIndex = els.length;
                els.push(el);
            }
            if (!dataCache.sensors[elIndex]) {
                dataCache.sensors[elIndex] = new Sensor(el);
            }
            sensor = dataCache.sensors[elIndex];
            sensor.add(matchers);
            sensor.resetScroller();
            return elQ;
        },
        applySensorValues: function () {
            var n, m, dataCaches, dataCache, elQ = this,
                watchers = elQ.watchers;
            for (n in watchers) {
                dataCaches = watchers[n].sensors;
                for (i = 0; i < dataCaches.length; i++) {
                    dataCache = dataCaches[i];
                    dataCache.update();
                }
            }
        },
        unitProcessor: function (unit, fn) {
            var elQuery = this;
            unitProcessors[unit] = fn;
            return elQuery;
        },
        addProcessor: function (name, fn) {
            var elQuery = this;
            baseAttrs[name] = {
                fn: fn,
                regex: elQuery.regex(name, baseRegExp)
            };
            return elQuery;
        }
    };
    win.addEventListener('load', function (e) {
        elementQuery.reinit(doc.styleSheets);
        elementQuery.applySensorValues();
    }, true);
    win.ElementQuery = ElementQuery;
    win.elementQuery = new win.ElementQuery();
}(window, document));
elementQuery.unitProcessor('%', function (val, proc, el, dims) {
    var parent = el.parentNode,
        parentDims = parent.getBoundingClientRect(),
        parentVal = proc.apply(this, [parent, parentDims]);
    return (val / parentVal);
});
elementQuery.unitProcessor('em', function (val, proc, el, dims) {
    return val / parseFloat(el.style.fontSize);
});
elementQuery.addProcessor('area', function (el, dims) {
    return dims.height * dims.width;
});
elementQuery.addProcessor('diagonal', function (el, dims) {
    var height = dims.height,
        width = dims.width;
    return Math.pow((height * height * width * width), 0.5);
});
elementQuery.addProcessor('aspect', function (el, dims) {
    return dims.width / dims.height;
});
elementQuery.addProcessor('perimeter', function (el, dims) {
    var height = dims.height,
        width = dims.width;
    return ((height * 2) + (width * 2));
});