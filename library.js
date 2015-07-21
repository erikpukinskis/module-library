
// Library

// Calls modules and orchestrates dependencies between them

var clone = require("clone")
var ramda = require("ramda")
var find = ramda.find
var contains = ramda.contains
var test = require("nrtv-test")


function Library() {
  this.modules = {}
  this.singletonCache = {}
  this.aliases = {}
  this._id = Math.random().toString(36).split(".")[1].substr(0,4)
  this.require = require  
}

Library.prototype.define =
  function(name, two, three) {
    if (three) {
      var func = three
      var dependencies = two
    } else {
      var func = two
      var dependencies = []
    }

    var module = {
      name: name,
      dependencies: dependencies,
      func: func
    }

    this.modules[name] = module

    return module
  }

Library.prototype.export =
  function(name) {

    var module = this.define.apply(this, arguments)

    var singleton = this._generateSingleton(module)

    singleton.__module = module

    return singleton
  }

Library.prototype.collective =
  function(object) {
    return {
      __dependencyType: "collective",
      object:object
    }
  }

Library.prototype._getCollective =
  function(identifier) {
    return clone(identifier.object)
  }

Library.prototype.reset =
  function(name) {
    return {
      __dependencyType: "reset",
      name: name
    }
  }

Library.prototype.using =
  function(dependencies, func) {

    // First we're going to check which of the dependencies need to have their collectives reset:

    var resets = []

    for(var i=0; i<dependencies.length; i++) {

      if (dependencies[i].__dependencyType == "reset") {

        var name = dependencies[i].name

        // If we do need to reset something, we note it and then change the dependency back to a regular name so that when we pass the dependencies to the new (reset) library it doesn't try to reset it again.

        resets.push(name)

        dependencies[i] = name

      }
    }

    this._addDependenciesToResets(resets, dependencies)


    // If anything needs to be reset, we make a new library with the resets and call using on that.

    if (resets.length) {
      var library = this.cloneAndReset(resets)
    } else {
      var library = this
    }

    // At this point we have a properly reset library, and the dependencies should just be module names and collective IDs, so we just iterate through the dependencies and build the singletons.

    return func.apply(null, library._getArguments(dependencies, func))
  }




// Resets

// There is some special work here when we want to reset a module's collective. We have to trace back through the dependency tree and find *every* module that depends on the things we're resetting.

Library.prototype._addDependenciesToResets =
  function(resets, dependencies) {

    var oneToReset = resets.length > 0

    var another = this._getAnotherToReset.bind(this, resets, dependencies)

    while (oneToReset) {
      oneToReset = find(another)(dependencies)

      if (oneToReset) {
        resets.push(oneToReset)
      }
    }
  }

Library.prototype._getAnotherToReset =
  function(resets, dependenciesToReset, dependency) {

  var alreadyReset = contains(dependency)(resets)

  if (alreadyReset) {
    return false
  } else {
    return this._dependsOn(dependency, resets)
  }
}

Library.prototype._dependsOn =
  function(target, possibleDeps) {

    if (alias = this.aliases[target]) {
      return this._dependsOn(alias, possibleDeps)
    }
    isDirectMatch = contains(target)(possibleDeps)

    if (isDirectMatch) {
      return true
    } else if (target.__dependencyType) {
      return false
    }

    var module = this.modules[target]

    if (!module) {
      throw new Error("Trying to figure out what "+target+" depends on, but that doesn't seem like a module name we know about.")
    }

    var dependencies = module.dependencies

    for(var i=0; i<dependencies.length; i++) {

      var foundDeep = this._dependsOn(dependencies[i], possibleDeps)

      if (foundDeep) { return true }
    }

    return false
  }



// Arguments

// When we call a module generator or use a function, we need arguments to pass to them. For now, these are either collectives, singletons generated by those generators, or commonjs modules.

Library.prototype._getArguments =
  function(dependencies, func) {
    var args = []

    for(var i=0; i<dependencies.length; i++) {

      args.push(this._getSingleton(dependencies[i]))
    }

    return args
  }

Library.prototype._getSingleton =
  function (identifier) {

    if (identifier.__dependencyType == "collective") {

      return this._getCollective(identifier)

    } else if (identifier in this.singletonCache) {

      return this.singletonCache[identifier]

    } else if (typeof identifier != "string") {

      throw new Error("You asked for a module by the name of "+identifier+" but, uh... that's not really a name.")

    } else if (module = this.modules[identifier]) {
      return this._generateSingleton(module)
    } else if (alias = this.aliases[identifier]) {
      return this._getSingleton(alias)
    } else if (singleton = this.require(identifier)) {

      return this._processCommonJsSingleton(identifier, singleton)
    }

    throw new Error("You don't seem to have ever mentioned a "+identifier+" module to "+this._id)

  }

Library.prototype._generateSingleton =
  function(module) {
    var deps = []

    for(var i=0; i<module.dependencies.length; i++) {

      deps.push(this._getSingleton(module.dependencies[i]))
    }

    var singleton = module.func.apply(null, deps)

    this.singletonCache[module.name] = singleton

    return singleton
  }

Library.prototype._processCommonJsSingleton =
  function(path, singleton) {

    if (module = singleton.__module) {

      if (!this.modules[module.name]) {
        this.modules[module.name] = module
      }

      if (module.name != path) {

        this.aliases[path] = module.name
      }

      return this._getSingleton(path)

    } else {
      this.singletonCache[path] = singleton

      return singleton
    }

  }


// Resetting

// When we have figured out what all modules need to be reset, we build a new library with the cache cleared for those.

Library.prototype.clone =
  function() {
    var newLibrary = new Library()

    newLibrary.modules = this.modules
    newLibrary.singletonCache = this.singletonCache
    newLibrary.aliases = this.aliases
    newLibrary.require = this.require

    return newLibrary
  }

Library.prototype.cloneAndReset =
  function(resets) {

    if (resets.length < 1) {
      return this
    }

    var newLibrary = this.clone()

    newLibrary.singletonCache = clone(this.singletonCache)

    resets.forEach(function(name) {
      delete newLibrary.singletonCache[name]
    })

    return newLibrary
  }


// Testing

Library.prototype.test =
  function(description, dependencies, runTest) {

    this.using(dependencies, function() {

      var deps = Array.prototype.slice.call(arguments)

      test(description, function(expect, done) {

        var args = [expect, done].concat(deps)

        runTest.apply(null, args)
      })
    })
  }

var library = new Library()

function libraryFactory(alternateRequire) {

  var newLibrary = library.clone()

  newLibrary.require = alternateRequire

  return newLibrary
}

libraryFactory.Library = Library

module.exports = libraryFactory
