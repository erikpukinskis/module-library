// Library

// Calls modules and orchestrates dependencies between them


module.exports = function(StringTree) {

  function Library() {
    this.id = "library@f"+randomId()
    this.sandbox = {__moduleLibrary: this.id}
    this.root = this
    this.children = []
    this.modules = {}
    this.singletonCache = {}
    this.collectiveCache = {}
    this.aliases = {}
    this._id = randomId()
    this.require = Library.require
    this.__isNrtvLibrary = true
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

      var alreadyLoaded = this.modules[name]

      if (alreadyLoaded) {
        console.log("⚡⚡⚡ WARNING ⚡⚡⚡ "+name+" was loaded into the library twice. Seems odd?")
        return alreadyLoaded
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
    function(identifier, name) {
      var cached = this.collectiveCache[name]
      if (cached) { return cached }
      var fresh = deepClone(identifier.object)
      this.collectiveCache[name] = fresh
      return fresh
    }

  function deepClone(object) {
    var fresh = {}
    for(var key in object) {
      var value = object[key]
      if (Array.isArray(value)) {
        fresh[key] = [].concat(value)
      } else if (typeof value == "object") {
        fresh[key] = deepClone(value)
      } else {
        fresh[key] = value
      }
    }
    return fresh
  }

  function shallowClone(object) {
    var fresh = {}
    for(var key in object) {
      fresh[key] = object[key]
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

      var collectiveResets = []

      if (!Array.isArray(dependencies)) {
        throw new Error("You did library.using("+JSON.stringify(dependencies)+", ...) but we were expecting an array of dependencies there.")
      }
      for(var i=0; i<dependencies.length; i++) {

        if (dependencies[i].__dependencyType == "reset") {

          var name = dependencies[i].name

          // If we do need to reset something, we note it and then change the dependency back to a regular name so that when we pass the dependencies to the new (reset) library it doesn't try to reset it again.

          var alias = this.aliases[name]
          collectiveResets.push(alias || name)

          dependencies[i] = name

        }
      }

      var tree = this._buildDependencyTree()

      var _this = this

      singletonResets = concat(
        collectiveResets.map(
          function(name) {

            // This maybe only needs to be ancestors which are in the using args? And then update the error in assertNoCollective? #todo

            var ancestors = tree.ancestors(name)

            _this._assertNoCollectivizedAncestors(ancestors, name, collectiveResets)

            return ancestors
          }
        ).concat(collectiveResets)
      )

      singletonResets = intersection(
        singletonResets,
        Object.keys(this.singletonCache)
      )

      // If anything needs to be reset, we make a new library with the resets and call using on that.

      var library = this.cloneAndReset(collectiveResets, singletonResets)

      // At this point we have a properly reset library, and the dependencies should just be module names and collective IDs, so we just iterate through the dependencies and build the singletons.

      return func.apply(null, library._getArguments(dependencies, func))
    }

  Library.prototype._assertNoCollectivizedAncestors = function(ancestors, child, resets) {

    for(var i=0; i<ancestors.length; i++) {
      var ancestor = ancestors[i]

      if (ancestor in resets) { 
        continue
      }

      var singleton = this._getSingleton(ancestor)

      if (singleton.__wasNrtvLibraryCollectivized) {
        throw new Error("You asked us to reset "+child+", but "+ancestor+" depends on it and has a collectivized singleton. You may want to split "+ancestor+" into two parts, one which uses "+child+" and another which has the collective instance methods, each their own module.")
      }
    }
  }

  var concat = Function.prototype.apply.bind(Array.prototype.concat, [])

  function intersection(a, b) {
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
      var tree = new StringTree()

      for(var name in this.modules) {
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
    function(dependencies) {
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

  Library.prototype.getModule =
    function(name) {
      return this.modules[name]
    }

  Library.prototype.get = function(name) {
      if (!this.modules[name]) {
        throw new Error("Tried to get a library module called "+name+" but couldn't find any with that name")
      }

      return this.singletonCache[name] || this._generateSingleton(this.getModule(name))
    }

  Library.prototype.getSource = function(name) {
    return this.getModule(name).func.toString()
  }

  Library.prototype._getSingleton =
    function (identifier, alternateRequire, forName) {
      if (identifier.__dependencyType == "self reference") {

        return this

      } if (identifier.__dependencyType == "collective") {

        return this._getCollective(identifier, forName)

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
          this,
          forName
        )

        if (singleton) {
          return singleton
        }
      }

      throw new Error("You don't seem to have ever mentioned a "+identifier+" module to library "+this._id)

    }

  var generating = {}
  var generationStack = []

  Library.prototype._generateSingleton =
    function(module) {
      generationStack.push(module.name)

      if (generating[module.name]) {
        throw new Error("Tried to generate "+module.name+" while generating "+module.name+". Seems an infinite loop? Stack: "+generationStack.join(" → "))
      }

      generating[module.name] = true
      var deps = []

      for(var i=0; i<module.dependencies.length; i++) {

        deps.push(
          this._getSingleton(
            module.dependencies[i],
            module.require,
            module.name
          )
        )
      }

      var singleton = module.func.apply(this.sandbox, deps)

      var isUndefined = typeof singleton == "undefined"
      var isFunction = typeof singleton == "function"
      var isObject = typeof singleton == "object"
      var isString = typeof singleton == "string"

      if (isUndefined) {
        throw new Error("The generator for "+module.name+" didn't return anything.")
      } else if (!isFunction && !isObject && !isString) {
        throw new Error("Modules need to return either a function or an object, so that we can stick some bookkeeping attributes on it. Your module "+module.name+" returned an "+(typeof singleton)+": "+singleton)
      }

      singleton.__nrtvId = randomId()
      singleton.__nrtvModule = module

      this.singletonCache[module.name] = singleton

      generating[module.name] = false
      generationStack.pop()

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
      newLibrary.collectiveCache = this.collectiveCache
      newLibrary.aliases = this.aliases
      newLibrary.require = this.require

      return newLibrary
    }

  Library.prototype.cloneAndReset =
    function(collectiveResets, singletonResets) {

      if (collectiveResets.length < 1) {
        return this
      }

      var newLibrary = this.clone()

      newLibrary.singletonCache = shallowClone(this.singletonCache)

      newLibrary.collectiveCache = shallowClone(this.collectiveCache)

      // This aliases situation is getting out of hand. I don't think we even need to care about them here. Aliases should really just be confined to node-library. #todo

      var aliases = this.aliases

      collectiveResets.forEach(function(name) {

        delete newLibrary.collectiveCache[name]

        var alias = aliases[name]

        if (alias) {
          delete newLibrary.collectiveCache[alias]
        }

      })

      singletonResets.forEach(function(name) {

        delete newLibrary.singletonCache[name]

        var alias = aliases[name]

        if (alias) {
          delete newLibrary.singletonCache[alias]
        }

      })

      return newLibrary
    }

  Library.prototype.setPath = function(path, name) {
    this.aliases[path] = name
  }

  Library.prototype.collectivize =
    function(constructor, collective, makeCollective, methods) {

      if (!methods) {
        methods = makeCollective
        makeCollective = function() {
          return new constructor
        }
      }

      for(var i=0; i<methods.length; i++) {
        var method = methods[i]

        constructor[method] = callCollectiveMethod.bind(null, collective, makeCollective, method)
      }

      constructor.__wasNrtvLibraryCollectivized = true
    }

  function callCollectiveMethod(collective, makeCollective, method) {

    var remainingArgs = Array.prototype.slice.call(arguments, 3)

    if (!collective.__nrtvCollectiveInstance) {
      collective.__nrtvCollectiveInstance = makeCollective()
    }

    return collective.__nrtvCollectiveInstance[method].apply(collective.__nrtvCollectiveInstance, remainingArgs)
  }

  return Library
}
