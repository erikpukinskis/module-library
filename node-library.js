var generateConstructor = require("./library")

var Library = generateConstructor(
  require("nrtv-tree")
)

var contains = require("ramda").contains
var filter = require("ramda").filter
var contains = require("ramda").contains

// Debugging

Library.prototype.dump = function() {
  console.log("library", JSON.stringify(this._dump(true), null, 2))

  if (this != this.root) {
    this.root._dump(true)
  }
}

Library.prototype._dump = function(isRoot) {

  var names = Object.keys(this.singletonCache)

  if (this.parent) {
    names = filter(differentThanParent.bind(null, this, this.parent))(names)
  }

  function differentThanParent(child, parent, name) {
    if (!parent) { return true }
    return child.singletonCache[name] != parent.singletonCache[name]
  }

  var resets = this.resets
  var singletons = this.singletonCache

  var singletonLabels = names.map(
    function(name) {
      var label = name
      var id = singletons[name].__nrtvId
      var wasReset = contains(name)(resets)

      if (id) {
        name += "@"+id
      }

      if (wasReset) {
        name += " [reset]"
      }

      return name
    }
  )

  var kids = this.children.map(function(child) { return child._dump(false) })

  var dump = {
    id: this.id
  }

  if (isRoot) {
    dump.root = true
    dump.modules = Object.keys(this.modules)
  }

  dump.singletons = singletonLabels

  if (kids.length > 0) {
    dump.children = kids
  }

  return dump
}


// Exports

Library.prototype.export =
  function(name) {

    var module = this.define.apply(this, arguments)

    module.require = this.require

    var singleton = this._generateSingleton(module)

    singleton.__module = module

    return singleton
  }

Library.useLoader(
  function(require, identifier, library) {
    try {

      var singleton = require(identifier)

    } catch (e) {

      if (e.code == "MODULE_NOT_FOUND" && identifier.match(/[A-Z]/)) {
        e.message = e.message+" (is '"+identifier+"' capitalized right? usually modules are lowercase.)"
      }

      throw e
    }

    if (singleton) {
      return processCommonJsSingleton(identifier, singleton, library)
    }

  }
)

function processCommonJsSingleton(path, singleton, library) {

  if (module = singleton.__module) {

    if (!library.modules[module.name]) {
      library.addModule(module)
    }

    if (module.name != path) {

      var pathIsAName = !path.match(/\//)

      if (pathIsAName) {
        console.log(" ⚡ WARNING ⚡ The commonjs module", path, "returned a nrtv-library module called", module.name)
      }

      library.aliases[path] = module.name
    }

    return library._getSingleton(path)

  } else {
    library.singletonCache[path] = singleton

    return singleton
  }

}



var library = new Library()

function libraryFactory(alternateRequire) {

  var newLibrary = alternateRequire.__nrtvLibrary

  if (!newLibrary) {
    newLibrary = alternateRequire.__nrtvLibrary = library.clone()
    newLibrary.require = alternateRequire
  }

  return newLibrary
}

libraryFactory.Library = Library

libraryFactory.define = libraryFactory.using = function() {
  throw new Error("You tried to use the library factory as a library. Did you remember to do require(\"nrtv-library\')(require)?")
}

libraryFactory.generateConstructor = generateConstructor

module.exports = libraryFactory
