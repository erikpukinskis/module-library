var generateConstructor = require("./library")

var Tree = require("nrtv-tree")
var Library = generateConstructor(Tree)

var contains = require("ramda").contains
var filter = require("ramda").filter
var contains = require("ramda").contains


// Debugging

Library.prototype.dump = function(logger) {
  (logger || console.log)("library", JSON.stringify(this._dump(true), null, 2))

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

  var singletons = this.singletonCache

  var singletonLabels = names.map(
    function(name) {
      var label = name
      var id = singletons[name].__nrtvId

      if (id) {
        name += "@"+id
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

    return singleton
  }

Library.useLoader(
  function(require, identifier, library) {
    try {

      var singleton = require(identifier)

    } catch (e) {

      var notFound = e.code == "MODULE_NOT_FOUND" 

      if (notFound && identifier.match(/[A-Z]/)) {

        e.message += " (is '"+identifier+"' capitalized right? usually modules are lowercase.)"

      } else if (notFound && !e.message.match(/package\.json point/)) {

        e.message += " (Is it in your node_modules folder? Does the \"main\" attribute in the package.json point to the right file?)"
      }

      throw e
    }

    if (singleton) {
      return processCommonJsSingleton(identifier, singleton, library)
    }

  }
)

function processCommonJsSingleton(path, singleton, library) {

  if (singleton.__isNrtvLibraryModule == true) {
    throw new Error("Commonjs module "+path+" exported a nrtv module ("+singleton.name+"). Did you do module.exports = library.define instead of module.exports library.export?")
  }
  if (module = singleton.__nrtvModule) {

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
    var isObject = typeof singleton == "object"
    var isEmpty = isObject && Object.keys(singleton).length < 1

    if (isObject && isEmpty) {
      throw new Error("The "+path+" module just returned an empty object. Did you forget to do module.exports = library.export?")
    }

    library.singletonCache[path] = singleton

    return singleton
  }

}



Library.require = require
var library = new Library()
require.__nrtvLibrary = library

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

libraryFactory.generator = generateConstructor

module.exports = libraryFactory
