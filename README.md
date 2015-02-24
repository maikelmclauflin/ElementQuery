# ElementQuery
A small api for creating css element queries. When the media just isn't enough.

In the following example there are 4 main parts:
```css
[min-width~="40em"]
```

In order of computation, first there is a type, or query type which is usually interchangable for other numerical representitive variables such as width, aspect ratio, or area.

The second main part of this example is the actual value of the query. In this case, the value is 40.

Next is the unit, the whats of the value. In this case we have 40 whats? 40 ems. So we use our processor for ems to convert from pixels and we're good to go.

Finally we have the min or max values that are prepended to the query. These determine, just like media queries, if the attribute will be applied or ignored / removed.

This is the basic breakdown and functionality that this extension uses to compute and apply it's attributes.

## Processors

Processors should be called before the window onload method so that they can be used to parse the available stylesheets. This is so that they can do not have to scan the available stylesheets multiple times with the help of the reinit method.

### Unit Processor

Arguments for the unit handlers are denoted in the following list, and the context is the sensor instance object that is watching the element being resized.

1. val: the value calculated from the original query. This values is common for all units on that element for the same query.
2. proc: the query handler that calculated the value of val. Useful for creating % based queries, such as the one shown below.
3. el: the element that is being sensed by the sensor.
4. width: the element's cached width
4. height: the element's cached height
6. computedStyle: the cached styles of the element being resized by the sensor.
7. dimensions: the cached dimensions of the element being resized by the sensor.

The system currently supports the following unit handlers. If a handler is not found, or a bad unit is applied in css, then the system will fallback to using px values for the handler and final attribute.

###### units with basic processors

1. px
2. em
3. %
4. rem

###### units that still need processors

5. in
6. cm
7. ex
8. vh
9. vw
10. pc
11. pt
12. mm


Listed below are examples of how to support percentage and em units. These processors are commented out in the dev source code, but are there for your copying and pasting convenience.

##### %

the following is a good example of how to make complex computations for a unit like percentages. it is a good idea to pass all of the necessary arguments so the query handler can compute, no matter what type of function it is running.

```javascript
elementQuery.unitProcessor('%', function (val, proc, el) {
    var parent = el.parentNode,
        parentDims = parent.getBoundingClientRect(),
        parentStyles = parent.getComputedStyle(),
        parentHeight = parseFloat(parentStyles.height),
        parentWidth = parseFloat(parentStyles.width),
        parentVal = proc.apply(this, [parent, parentWidth, parentHeight, parentDims, parentStyles]);
    return (val / parentVal);
});
```

##### em

the following is an example of a computation of em units, where the font size of the element will determine the final value that was calculated by the query processor.

```javascript
elementQuery.unitProcessor('em', function (val, proc, el, width, height, computedStyle) {
    return (val / parseFloat(computedStyle.fontSize));
});
```

#### rem

the following is an example of the computation necessary to achieve rem units. In this case it was a good idea to cache the base font size, since it rarely if ever changes.

```javascript
elementQuery.unitProcessor('rem', (function () {
    var baseFont = window.getComputedStyle(document.documentElement).fontSize;
    return function (val) {
        return (val / baseFont);
    };
}()));
```

### Query Processor

Queries that are already included include height and width. All queries support min and max values. All query handlers must return a number and be constructed in the following way:

```javascript
elementQuery.addProcessor(name, handler);
```

While the context of the handlers when they are run is the sensor object that they are tied to, use of this object and the attached elements is not recommended. Most of the calculations that you will need to do use information from the dimensions of the element and the styles of that element. Both the getComputedStyle and getBoundingClientRect functions have been applied to the element being sensed, are cached for all of the queries that are to be run against it.

below are some examples of different queries that you can run on elements you are watching.

```javascript

elementQuery.addProcessor('area', function (el, width, height) {
    return height * width;
});

elementQuery.addProcessor('diagonal', function (el, width, height) {
    return Math.pow((height * height * width * width), 0.5);
});

elementQuery.addProcessor('aspect', function (el, width, height) {
    return width / height;
});

elementQuery.addProcessor('perimeter', function (el, width, height) {
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

#### Sensor.update();
method that initializes the recalculation of the resized div, as determined by scroll events hosted in the children of the targeted element. First the values are recalulated, then the correct attributes are added and removed to the targeted html elements.


## Future Releases
1. Ability to add custom units
2. Ability to get resize sensor by passing html element
3. Ability to add trailing functions that run after the element queries
4. Try watching elements using alternative sensory methods (object resize, iframe resize).