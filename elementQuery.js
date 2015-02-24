(function (win, doc) {
    var obj = {},
        hasOwnProp = obj.hasOwnProperty,
        each = function (objects, callback, ctx) {
            var i, isArr;
            if (callback) {
                if (objects) {
                    if (!ctx) ctx = win;
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
            return {
                el: el,
                watchers: {}
            };
        },
        baseAttrs = {
            height: {
                fn: function (el, dims, computedStyle) {
                    return parseFloat(computedStyle.height);
                }
            },
            width: {
                fn: function (el, dims, computedStyle) {
                    return parseFloat(computedStyle.width);
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
            var nuStr = str.match(/\=(\"|\')(.*)(\"|\')/);
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
        regexMaker = function (attr, regex) {
            var baseRegStr = regex.toString(),
                converted = replaceRegExp(baseRegStr.slice(1, baseRegStr.length - 1), '{{{}}}', attr);
            return new RegExp(converted, 'mgi');
        },
        attachResizeHandlers = function (sensor) {
            var resizeHandler;
            resizeHandler = function () {
                var sensor = this,
                    diffHeight = (sensor.el.offsetHeight !== sensor.lastHeight),
                    diffWidth = (sensor.el.offsetWidth !== sensor.lastWidth);
                if (diffHeight || diffWidth) {
                    sensor.update();
                    sensor.resetScroller(sensor);
                }
                window.requestAnimationFrame(resizeHandler);
            }.bind(sensor);
            window.requestAnimationFrame(resizeHandler);
        },
        baseRegExp = /,?([^,\n]*)\[[\s\t]*(min|max)-({{{}}})[\s\t]*[~$\^]?=[\s\t]*(["|'](.*)["|'])[\s\t]*]([^\n\s\{]*)/,
        attrRegExp = /\,?([[\s\t]*(min|max)-({{{}}})[\s\t]*[~$\^]?=[\s\t]*(["|'](.+?)["|'])[\s\t]*])/;
    unitProcessors[''] = unitProcessors.px;

    function Sensor(el) {
        var n, sensor = this,
            defaults = makeDefaults(el);
        for (n in defaults) {
            sensor[n] = defaults[n];
        }
        // sensor.lastHeight = el.offsetHeight;
        // sensor.lastWidth = el.offsetWidth;
        attachResizeHandlers(sensor);
        return sensor;
    }
    Sensor.prototype = {
        update: function () {
            var i, n, m, o, v, unitArgs, valueArgs, unit, units, query, attrKey, values, valuesLen, currentValue, baseAttr, doer, convertedValue, sensor = this,
                el = sensor.el,
                watchers = sensor.watchers,
                activeAttrs = {},
                elementStyles = win.getComputedStyle(el),
                dimensions = sensor.el.getBoundingClientRect(),
                elHeight = parseFloat(dimensions.height),
                elWidth = parseFloat(dimensions.width);
            sensor.dimensions = dimensions;
            for (n in watchers) {
                baseAttr = baseAttrs[n];
                activeAttrs['min-' + n] = [];
                activeAttrs['max-' + n] = [];
                if (baseAttr) {
                    queries = watchers[n];
                    doer = baseAttr.fn;
                    if (doer && typeof doer === 'function') {
                        valueArgs = [el, elWidth, elHeight, elementStyles, dimensions];
                        currentValue = doer.apply(sensor, valueArgs);
                        unitArgs = [currentValue, doer].concat(valueArgs);
                        for (v in queries) {
                            query = queries[v];
                            val = parseFloat(v);
                            for (o in query) {
                                units = query[o];
                                attrKey = o + '-' + n;
                                for (i = 0; i < units.length; i++) {
                                    unit = units[i];
                                    // val, proc, sensor, el, dims
                                    convertedValue = unitProcessors[unit].apply(sensor, unitArgs);
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
            var sensor = this;
            sensor.lastWidth = sensor.el.offsetWidth;
            sensor.lastHeight = sensor.el.offsetHeight;
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
            // if (!sensor.hasWatcher(obj)) {
            sensor.extendWatcher(obj);
            // }
            return sensor;
        }
    };

    function ElementQuery(sheets) {
        var elQuery = this;
        each(baseAttrs, function (obj, name) {
            obj.regex = regexMaker(name, baseRegExp);
        });
        elQuery.reinit(sheets);
        return elQuery;
    }
    ElementQuery.prototype = {
        reinit: function (sheets) {
            var elQuery = this;
            if (sheets) elQuery.styles = sheets;
            elQuery.update();
            return elQuery;
        },
        // parse the css
        update: function () {
            var i, elQuery = this;
            if (elQuery.styles) {
                each(elQuery.styles, function (sheet, index, sheets) {
                    if (typeof sheet === 'object') {
                        var rules = sheet.rules || sheet.cssRules;
                        each(rules, function (rule, index, rules) {
                            if (rule.selectorText) {
                                elQuery.addRule(rule.selectorText);
                            }
                        });
                    }
                });
            }
            return elQuery;
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
                            var i, attrMatcher = regexMaker(name, attrRegExp),
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
                                if (el instanceof HTMLElement) {
                                    elQuery.attach(el, target);
                                }
                            });
                        });
                    });
                }
            });
            return elQuery;
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
                // window.console.log(dataCache.sensors[elIndex]);
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
            return elQ;
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
                regex: regexMaker(name, baseRegExp)
            };
            return elQuery;
        }
    };
    win.ElementQuery = ElementQuery;
    win.elementQuery = new win.ElementQuery();
}(window, document));
elementQuery.unitProcessor('%', function (val, proc, el, width, height, computedStyle, dimensions) {
    var parent = el.parentNode,
        parentDims = parent.getBoundingClientRect(),
        parentStyles = parent.getComputedStyle(),
        parentHeight = parseFloat(parentStyles.height),
        parentWidth = parseFloat(parentStyles.width),
        parentVal = proc.apply(this, [parent, parentWidth, parentHeight, parentDims, parentStyles]);
    return (val / parentVal);
});
elementQuery.unitProcessor('em', function (val, proc, el, width, height, computedStyle, dimensions) {
    return (val / parseFloat(computedStyle.fontSize));
});
elementQuery.unitProcessor('rem', function (val, proc, el, width, height, computedStyle, dimensions) {
    return (val / parseFloat(document.documentElement.style.fontSize));
});
elementQuery.addProcessor('area', function (el, width, height, computedStyle, dimensions) {
    return height * width;
});
elementQuery.addProcessor('diagonal', function (el, width, height, computedStyle, dimensions) {
    return Math.pow((height * height * width * width), 0.5);
});
elementQuery.addProcessor('aspect', function (el, width, height, computedStyle, dimensions) {
    return width / height;
});
elementQuery.addProcessor('perimeter', function (el, width, height, computedStyle, dimensions) {
    return ((height * 2) + (width * 2));
});
elementQuery.reinit(document.styleSheets);
elementQuery.applySensorValues();