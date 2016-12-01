Most build systems use config files to define dependencies separate from code.

Module-library allows you to define your dependencies in code:

```javascript
var library = require("module-library")(require)

library.define(
  "people",
  function() {
    return [{name: "erik", age: 35}, {name: "alex", age:39}, {name: "kate", age: 30}]
  }
)

library.define(
  "say-hello",
  ["people", "querystring"],
  function(people, querystring) {
    return function hi() {
      people.forEach(function(person) {
        console.log(querystring.stringify(person))
      })
    }
  }
)

library.using(
  ["say-hello"],
  function(hi) {
    hi()
  }
)
```

You can also export these modules so they are accessible via commonjs:

```javascript
var library = require("module-library")(require)

module.exports = library.export(
  "say-hello",
  ["people", "http"],
  function(people, http) {
    ...
  }
)
```

## Why

* We have an explicit reference, in software, of which dependencies are needed for a piece of code. This makes it easy to load that code in other places, like in the browser, without any kind of elaborate, declarative, filesystem-based, side-effect ridden build process. See [bridge-module](https://github.com/erikpukinskis/bridge-module)

* We can pause and debug any part of the module loading process in the same process as our app

* We will (later on) be able to hot reload modules without refreshing the whole tree
