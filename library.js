// Library

// Calls modules and orchestrates dependencies between them


module.exports = function(Tree) {

  function Library() {
    this.id = "library@f"+randomId()
    this.root = this
    this.children = []
    this.resets = []
    this.modules = {}
    this.singletonCache = {}
    this.aliases = {}
    this._id = randomId()
    this.require = Library.require
  }

  Library.loaders = []
  Library.useLoader = function(loader) {
    Library.loaders.push(loader)
  }

  function randomId() {
    return Math.random().toString(36).split(".")[1].substr(0,4)  
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

      if (!name || typeof name != "string") {
        throw new Error("library.define or export or whatever you did expects a name as the first argument, but you passed "+name)
      }

      if (typeof func != "function") {
        throw new Error("library.define/export/etc needs some kind of function but you gave it "+func)
      }

      if (!Array.isArray(dependencies)) {
        throw new Error("You passed "+dependencies+" to library.define/export/whatever in between the name and the function, but that's not an array of dependencies. We were expecting an array of dependencies there.")
      }

      var module = {
        __isNrtvLibraryModule: true,
        name: name,
        dependencies: dependencies,
        func: func
      }

      this.addModule(module)

      return module
    }

  Library.prototype.addModule =
    function(module) {
      this.modules[module.name] = module
    }

  Library.prototype.ref = function() {
    return {__dependencyType: "self reference"}
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

  function clone(object) {
    var fresh = {}
    for(var key in object) {
      var value = object[key]
      if (Array.isArray(value)) {
        fresh[key] = [].concat(value)
      } else if (typeof value == "object") {
        fresh[key] = clone(value)
      } else {
        fresh[key] = value
      }
    }
    return fresh
  }

  Library.prototype.reset =
    function(name) {
      return {
        __dependencyType: "reset",
        name: name
      }
    }

  // Rename to library.use? #todo

  Library.prototype.using =
    function(dependencies, func) {

      // First we're going to check which of the dependencies need to have their collectives reset:

      var resets = []

      if (!Array.isArray(dependencies)) {
        throw new Error("You did library.using("+JSON.stringify(dependencies)+", ...) but we were expecting an array of dependencies there.")
      }
      for(var i=0; i<dependencies.length; i++) {

        if (dependencies[i].__dependencyType == "reset") {

          var name = dependencies[i].name

          // If we do need to reset something, we note it and then change the dependency back to a regular name so that when we pass the dependencies to the new (reset) library it doesn't try to reset it again.

          var alias = this.aliases[name]
          resets.push(alias || name)

          dependencies[i] = name

        }
      }

      var tree = this._buildDependencyTree()

      resets = [].concat.apply(resets, resets.map(
        function(name) {
          return tree.ancestors(name)
        }
      ))

      resets = intersect(
        resets,
        Object.keys(this.singletonCache)
      )

      // If anything needs to be reset, we make a new library with the resets and call using on that.

      var library = this.cloneAndReset(resets)

      // At this point we have a properly reset library, and the dependencies should just be module names and collective IDs, so we just iterate through the dependencies and build the singletons.

      return func.apply(null, library._getArguments(dependencies, func))
    }

  function intersect(a, b) {
    var t

    if (b.length > a.length) {
      t = b
      b = a
      a = t
    }

    return a.filter(function (e) {
      if (b.indexOf(e) !== -1) {
        return true
      }
    })
  }

  Library.prototype._buildDependencyTree =
    function() {
      var tree = new Tree()

      for(name in this.modules) {
        tree.add(
          name,
          this._dealiasedDependencies(
            this.modules[name].dependencies
          )
        )
      }

      return tree
    }

  Library.prototype._dealiasedDependencies =
    function(possiblyAliased) {
      var dependencies = []
      var aliases = this.aliases

      possiblyAliased.map(
        function(dependency) {

          if (typeof(dependency) != "string") { return }

          var alias = aliases[dependency]

          dependencies.push(alias || dependency)
        }
      )

      return dependencies
    }



  // Arguments

  // When we call a module generator or use a function, we need arguments to pass to them. For now, these are either collectives, singletons generated by those generators, or commonjs modules.

  Library.prototype._getArguments =
    function(dependencies, func) {
      var args = []

      for(var i=0; i<dependencies.length; i++) {

        var singleton = this._getSingleton(dependencies[i])

        var isObject = typeof singleton == "object"

        var keyCount = isObject && Object.keys(singleton).length

        if (isObject && keyCount < 1) {
          throw new Error("The singleton for "+dependencies[i]+" is just an empty object. Did you maybe forget to do module.exports = ?")
        }

        args.push(singleton)
      }

      return args
    }

  Library.prototype._getSingleton =
    function (identifier, alternateRequire) {
      if (identifier.__dependencyType == "self reference") {

        return this

      } if (identifier.__dependencyType == "collective") {

        return this._getCollective(identifier)

      } else if (identifier in this.singletonCache) {

        return this.singletonCache[identifier]

      } else if (typeof identifier != "string") {

        throw new Error("You asked for a module by the name of "+identifier+" but, uh... that's not really a name.")

      } else if (module = this.modules[identifier]) {
        return this._generateSingleton(module)
      } else if (alias = this.aliases[identifier]) {
        return this._getSingleton(alias)
      }

      for(var i=0; i<Library.loaders.length; i++) {
        var singleton = Library.loaders[i](
          alternateRequire || this.require,
          identifier,
          this
        )

        if (singleton) {
          return singleton
        }
      }

      throw new Error("You don't seem to have ever mentioned a "+identifier+" module to "+this._id)

    }

  Library.prototype._generateSingleton =
    function(module) {
      var deps = []

      for(var i=0; i<module.dependencies.length; i++) {

        deps.push(
          this._getSingleton(
            module.dependencies[i],
            module.require
          )
        )
      }

      var singleton = module.func.apply(null, deps)

      if (typeof singleton == "undefined") {
        throw new Error("The generator for "+module.name+" didn't return anything.")
      }

      singleton.__nrtvId = randomId()

      this.singletonCache[module.name] = singleton

      return singleton
    }


  // Resetting

  // When we have figured out what all modules need to be reset, we build a new library with the cache cleared for those.

  Library.prototype.clone =
    function() {
      var newLibrary = new Library()
      newLibrary.parent = this
      this.children.push(newLibrary)
      newLibrary.root = this.root
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
      newLibrary.resets = resets
      newLibrary.singletonCache = clone(this.singletonCache)

      var aliases = this.aliases

      resets.forEach(function(name) {

        delete newLibrary.singletonCache[name]

        var alias = aliases[name]

        if (alias) {
          delete newLibrary.singletonCache[alias]
        }

      })

      return newLibrary
    }

  // library.makeConstructorActLikeAColectiveInstance

  Library.prototype.collectivize =
    function(constructor, collective, makeCollective, methods) {

      var getCollective = function() {
        var key = "__Collective"+constructor.name
        if (!collective[key]) {
          collective[key] = makeCollective()
        }
        return collective[key]
      }

      for(var i=0; i<methods.length; i++) {
        var method = methods[i]

        constructor[method] = applyIt.bind(null, method, getCollective)
      }
    }

  function applyIt(method, getCollective) {
    var instance = getCollective()
    return instance[method].apply(instance, arguments)
  }


  return Library
}
