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
                watchers: {},
                formerVals: {},
                currentValidQueries: {},
                annexes: []
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
        units = function (str, unitList) {
            var i, ch, unitStr, unit = [];
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
            window.console.log(sensor);
            resizeHandler = function () {
                win.requestAnimationFrame(resizeHandler);
            }.bind(sensor);
            win.requestAnimationFrame(resizeHandler);
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
        attachResizeHandlers(sensor);
        return sensor;
    }
    Sensor.prototype = {
        updateUI: function (type) {
            var n, currentAttrVals, sensor = this,
                values = sensor.currentValidQueries[type],
                el = sensor.el;
            for (n in values) {
                attrName = n + '-' + type;
                currentAttrVals = values[n];
                if (currentAttrVals) {
                    valuesLen = currentAttrVals.length;
                    if (valuesLen) el.setAttribute(attrName, currentAttrVals.join(' '));
                    if (!valuesLen) el.removeAttribute(attrName);
                }
            }
        },
        update: function () {
            var n, name, base, formerVal, newVal, updatedAtts, sensor = this,
                watchers = sensor.watchers,
                formerVals = sensor.formerVals,
                el = sensor.el,
                elementStyles = win.getComputedStyle(el),
                dimensions = el.getBoundingClientRect(),
                elHeight = parseFloat(dimensions.height),
                elWidth = parseFloat(dimensions.width),
                baseArgs = [el, elWidth, elHeight, elementStyles, dimensions],
                updateThese = [];
            sensor.latestStyles = elementStyles;
            sensor.latestClientRect = dimensions;
            sensor.latestHeight = elHeight;
            sensor.latestWidth = elWidth;
            for (n in watchers) {
                base = baseAttrs[n];
                formerVal = formerVals[n];
                newVal = base.fn.apply(sensor, baseArgs);
                if (newVal !== formerVal) {
                    formerVals[n] = newVal;
                    updateThese.push(n);
                    sensor.currentValidQueries[n] = sensor.calculateValues(n, newVal);
                }
            }
            for (n = 0; n < updateThese.length; n++) {
                sensor.updateUI(updateThese[n]);
                updatedAtts = 1;
            }
            if (updatedAtts) {
                sensor.runAnnexes();
            }
        },
        calculateValues: function (type, currentValue) {
            var i, n, m, o, v, unitArgs, unit, units, query, attrKey, values, valuesLen, baseAttr, doer, convertedValue, queries, activeAttrs, sensor = this,
                el = sensor.el,
                watchers = sensor.watchers,
                elementStyles = sensor.latestStyles,
                dimensions = sensor.latestClientRect,
                elHeight = sensor.latestHeight,
                elWidth = sensor.latestWidth;
            baseAttr = baseAttrs[type];
            if (baseAttr.fn) {
                queries = watchers[type];
                doer = baseAttr.fn;
                // if (doer && typeof doer === 'function') {
                activeAttrs = {
                    min: [],
                    max: []
                };
                // currentValue = doer.apply(sensor, valueArgs);
                unitArgs = [currentValue, doer, el, elWidth, elHeight, elementStyles, dimensions];
                for (v in queries) {
                    query = queries[v];
                    val = parseFloat(v);
                    for (o in query) {
                        units = query[o];
                        for (i = 0; i < units.length; i++) {
                            unit = units[i];
                            // val, proc, sensor, el, dims
                            convertedValue = unitProcessors[unit].apply(sensor, unitArgs);
                            if (val < convertedValue) {
                                if (o === 'min') activeAttrs[o].push(val + unit);
                            }
                            if (val > convertedValue) {
                                if (o === 'max') activeAttrs[o].push(val + unit);
                            }
                        }
                    }
                }
                return activeAttrs;
                // }
            }
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
            var n, minMax, value,
                valueMesurement, unit, unitList = [],
                sensor = this,
                original = {},
                objectParsed = objParseMeasurement(str),
                measurement = original[objectParsed] = {};
            // array for units
            value = objParseValues(str);
            for (n in unitProcessors) {
                unitList.push(n);
            }
            unit = units(value, unitList);
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
                if (!sensor.formerVals[n]) sensor.formerVals[n] = NaN;
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
            sensor.extendWatcher(obj);
            return sensor;
        },
        annex: function (callback) {
            this.annexes.push(callback);
            return this;
        },
        runAnnexes: function () {
            var i, sensor = this;
            for (i = 0; i < sensor.annexes.length; i++) {
                sensor.annexes[i].apply(sensor);
            }
            return sensor;
        }
    };

    function ElementQuery(sheets) {
        var elQuery = this;
        this.reinit(sheets);
        return elQuery;
    }
    ElementQuery.prototype = {
        reinit: function (sheets) {
            var elQuery = this;
            each(baseAttrs, function (obj, name) {
                obj.regex = regexMaker(name, baseRegExp);
            });
            if (sheets) elQuery.styles = sheets;
            elQuery.update();
            return elQuery;
        },
        // parse the css
        update: function () {
            var i, elQuery = this;
            if (elQuery.styles) {
                each(baseAttrs, function (computer, name) {
                    elQuery.scanSelectors(computer.regex, function (match, selector) {
                        elQuery.addRule(match, selector);
                    });
                });
            }
            return elQuery;
        },
        scanSelectors: function (regex, callback) {
            var selector, matchingStrings, allRules, elQuery = this;
            each(elQuery.styles, function (sheet, index, sheets) {
                if (typeof sheet === 'object') {
                    allRules = sheet.rules || sheet.cssRules;
                    each(allRules, function (rule, index, allRules) {
                        selector = rule.selectorText;
                        if (selector) {
                            matchingStrings = selector.match(regex);
                            if (matchingStrings) {
                                each(matchingStrings, function (match) {
                                    callback.apply(elQuery, [match, selector, rule]);
                                });
                            }
                        }
                    });
                }
            });
        },
        addRule: function (match, selector) {
            var i, maxedOut, targeted, attrMatcher, currentMatches, targetedMeasurement, currentSelector, matchingStrings, elQuery = this;
            // revisit this function later
            currentSelector = selector.split(match)[0] + match.replace();
            targetedMeasurement = [];
            currentMatches = [];
            each(baseAttrs, function (obj, name) {
                attrMatcher = regexMaker(name, attrRegExp);
                maxedOut = currentSelector.match(attrMatcher);
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
            els = doc.querySelectorAll(currentSelector);
            each(els, function (el) {
                each(targetedMeasurement, function (target) {
                    if (el instanceof HTMLElement) {
                        elQuery.attach(el, target);
                    }
                });
            });
            return elQuery;
        },
        // watch these els
        attach: function (el, matchers) {
            var elQ = this;
            sensor = elQ.getSensor(el);
            sensor.add(matchers);
            // sensor.resetDimensions();
            return elQ;
        },
        getSensor: function (el) {
            var els, watchers, dataCache, idx, sensors, elQ = this,
                stringVersion = el.toString();
            if (!elQ.watchers) elQ.watchers = {};
            watchers = elQ.watchers;
            if (!watchers[stringVersion]) watchers[stringVersion] = {};
            dataCache = watchers[stringVersion];
            if (!dataCache.els) dataCache.els = [];
            if (!dataCache.sensors) dataCache.sensors = [];
            els = dataCache.els;
            sensors = dataCache.sensors;
            idx = els.indexOf(el);
            if (idx === -1) {
                idx = els.length;
                els.push(el);
            }
            if (!sensors[idx]) sensors[idx] = new Sensor(el);
            return sensors[idx];
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
        },
        physicalDistance: function (divisor) {
            return function (val) {
                return ((val / win.devicePixelRatio) / divisor);
            };
        }
    };
    win.onload = function () {
        elementQuery.reinit();
        elementQuery.applySensorValues();
    };
    win.ElementQuery = ElementQuery;
    win.elementQuery = new win.ElementQuery();
    elementQuery.unitProcessor('%', function (val, proc, el) {
        var parent = el.parentNode,
            pDims = parent.getBoundingClientRect(),
            pStyles = parent.getComputedStyle(),
            pHeight = parseFloat(parentStyles.height),
            pWidth = parseFloat(parentStyles.width),
            pVal = proc.apply(this, [parent, pWidth, pHeight, pDims, pStyles]);
        return (val / parentVal);
    });
    elementQuery.unitProcessor('em', function (val, proc, el, width, height, computedStyle, dimensions) {
        return (val / parseFloat(computedStyle.fontSize));
    });
    elementQuery.unitProcessor('rem', (function (win, doc) {
        var baseFont = parseFloat(win.getComputedStyle(doc.documentElement).fontSize);
        return function (val) {
            return (val / baseFont);
        };
    }(window, document)));
    elementQuery.unitProcessor('in', elementQuery.physicalDistance(96));
    elementQuery.unitProcessor('cm', elementQuery.physicalDistance(37.79527559055118));
    elementQuery.unitProcessor('mm', elementQuery.physicalDistance(3.779527559055118));
    elementQuery.unitProcessor('pc', elementQuery.physicalDistance(16));
    elementQuery.unitProcessor('pt', elementQuery.physicalDistance(1.333333333333333));
    elementQuery.unitProcessor('vw', function (val) {
        var width = window.innerWidth;
        return (val / (width / 100));
    });
    elementQuery.unitProcessor('vh', function (val) {
        var height = window.innerHeight;
        return (val / (height / 100));
    });
    elementQuery.unitProcessor('vmax', function (val) {
        var max = Math.max(window.innerHeight, window.innerWidth);
        return (val / (max / 100));
    });
    elementQuery.unitProcessor('vmin', function (val) {
        var min = Math.min(window.innerHeight, window.innerWidth);
        return (val / (min / 100));
    });
    elementQuery.addProcessor('area', function (el, width, height, computedStyle, dimensions) {
        return height * width;
    });
    elementQuery.addProcessor('diagonal', function (el, width, height, computedStyle, dimensions) {
        return Math.pow(((height * height) + (width * width)), 0.5);
    });
    elementQuery.addProcessor('aspect', function (el, width, height, computedStyle, dimensions) {
        return width / height;
    });
    elementQuery.addProcessor('perimeter', function (el, width, height, computedStyle, dimensions) {
        return ((height * 2) + (width * 2));
    });
    win.elementQuery.reinit(doc.styleSheets);
}(window, document));