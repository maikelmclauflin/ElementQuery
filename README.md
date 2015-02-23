# ElementQuery
A small api for creating css element queries. For when the media just isn't enough.

## Processors

Processors should be called before the window onload method so that they can be used to parse the available stylesheets. This is so that they can do not have to scan the available stylesheets multiple times with the help of the reinit method.

## Units

Arguments for the unit handlers are denoted in the following list.

0. context: the sensor instance object that is watching the element being resized.
1. val: the value calculated from the original query. This values is common for all units on that element for the same query.
2. proc: the query handler that calculated the value of val. Useful for creating % based queries, such as the one shown below.
3. el: the element that is being sensed by the sensor.
4. dims: the cached dimensions of the element being resized by the sensor.
5. computedStyle: the cached styles of the element being resized by the sensor.

The system currently supports the following units:

1. 'px'
2. 'em'
3. 'ex'
4. 'in'
5. 'cm'
6. '%'
7. 'vh'
8. 'vw'
9. 'pc'
10. 'pt'
11. 'mm'

Listed below are examples of how to support percentage and em units. These processors are commented out in the dev source code, but are there for your copying and pasting convenience.

#### %
```javascript
elementQuery.unitProcessor('%', function (val, proc, el, dims, computedStyle) {
    var parent = el.parentNode,
        parentDims = parent.getBoundingClientRect(),
        parentStyles = parent.getComputedStyle(),
        parentVal = proc.apply(this, [parent, parentDims, parentStyles]);
    return (val / parentVal);
});
```

#### em
```javascript
elementQuery.unitProcessor('em', function (val, proc, el, dimensions, computedStyle) {
    return (val / parseFloat(computedStyle.fontSize));
});
```

## Queries

Queries that are already included include height and width. All queries support min and max values. All query handlers must return a number and be constructed in the following way:

```javascript
elementQuery.addProcessor(name, handler);
```

While the context of the handlers when they are run is the sensor object that they are tied to, use of this object and the attached elements is not recommended. Most of the calculations that you will need to do use information from the dimensions of the element and the styles of that element. Both the getComputedStyle and getBoundingClientRect functions have been applied to the element being sensed, are cached for all of the queries that are to be run against it.

below are some examples of different queries that you can run on elements you are watching.

```javascript
elementQuery.addProcessor('area', function (el, dimensions, computedStyle) {
    return dims.height * dims.width;
});

elementQuery.addProcessor('diagonal', function (el, dimensions, computedStyle) {
    var height = dims.height,
        width = dims.width;
    return Math.pow((height * height * width * width), 0.5);
});

elementQuery.addProcessor('aspect', function (el, dimensions, computedStyle) {
    return dims.width / dims.height;
});

elementQuery.addProcessor('perimeter', function (el, dimensions, computedStyle) {
    var height = dims.height,
        width = dims.width;
    return ((height * 2) + (width * 2));
});
```

## API Endpoints -- ElementQuery

#### ElementQuery.addProcessor(name, processor);
method to add different query types to the base object. When using this method, both the name (type: string) and proc (type: function) must be passed into the function. The processor's context will be the sensor that it is being called from, and the arguments that will be passed back will be the target element, then it's dimensions, then it's cached computed style. The processor must then return a numerical value that can be compared with the queries that are collected from the css.

#### ElementQuery.addRule(selectorText);
method to scan and find matching queries from strings. Used most frequently as the object is initalizing and scanning css selectors for query attributes.

#### ElementQuery.applySensorValues();
method to calculate and force update all tracked element queries

#### ElementQuery.attach(element, matchingAttributes);
method generally called when scanning stylesheets. The first argument is the dom element that is being watched, and the second is an array of attribute strings that need to be watched. Units can be passed in, but if there are no processors to watch for them, they will be ignored until the ElementQuery instance is reinitialized Each attribute string generally follows this pattern:
```css
[min-diagonal~="300"]
```

#### ElementQuery.reinit(stylesheets);
method that updates the element query with new stylesheets. The argument is required, and the nearest stylesheet objects can be found at document.styleSheets, though other documents could also have their sheets scanned and elements tracked as well.

#### ElementQuery.unitProcessor(unitString, processor);
method for adding different unit processors to the calculation chain. This is one of the last steps of the calulation before the value is decidedly put utilized or ignored by the current state of the element. That being said, it is recommended that the function used to process the current value to convert it to a new one be fast, since these functions are run once per css query, on every resize. The arguments that are applied to the processor function include: the current numerical value in the pipeline, the function that got the current value, the element being resized, and its cached computed style

#### ElementQuery.update();
method that iterates over the available styles and scans each selector for valid queries. If the method finds a valid query that is not being watched, either by editing the stylesheets or adding a new stylesheet to the document or simply on initial load, the method will collect the necessary information from the selector, find the element that is being targeted, and set up a sensor if it has not already done so.

## API Endpoints -- Sensor

The Sensor factory makes objects that directly construct the resize watchers and monitor the elements themselves.

#### Sensor.add(attributeString);
method that is passed an attribute string to determine extend the sensor's watch functions. From this string a simple object is created and is then extended into the sensor using the extendWatcher method.

#### Sensor.attachScrollHandler();
attaches scroll handlers to the shink and expand watch divs

#### Sensor.extendWatcher(extendObject);
extends the watch parameters and breakpoints of the sensor. Takes one argument in the following format:
```javascript
{
    attribute: {
        numberLimit: {
            min: [units],
            max: ['', '%', 'em']
        }
    }
}
```
#### Sensor.hasWatcher(watcher);
checks to see if the current sensor object is watching for changes down to the same breakpoint. data can either be passed in as an attribute string, or as an extend object.

#### Sensor.parseObject(attributeString);
method that converts attribute strings into extend objects.

#### Sensor.resetScroller();
resets the scroll positions on the shrink and expand divs so that they can sense another resize.

#### Sensor.update();
method that initializes the recalculation of the resized div, as determined by scroll events hosted in the children of the targeted element. First the values are recalulated, then the correct attributes are added and removed to the targeted html elements.


## Future Releases
1. Ability to add custom units
2. Ability to get resize sensor by passing html element
3. Ability to add trailing functions that run after the element queries