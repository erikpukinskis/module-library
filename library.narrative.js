///////////////////////////////////////
// BOILERPLATE
var chai = require("chai")

function test(setup, description, test) {
  var expect = chai.expect

  if (!test) {
    test = description
    description = setup
    setup = undefined
  }

  var timer = setTimeout(
    function() {
      throw new Error("Got stuck in test \""+description+"\":\n"+runTest+"\n... or or setup:\n"+setup)
    },
    1000
  )

  function done() {
    clearTimeout(timer)
    console.log("  ✓ ", description)
  }

  var runTest = test.bind(null, chai.expect)

  var runAndDone = runTest.bind(null, done)

  if (setup) {
    setup(runAndDone)
  } else {
    runAndDone()
  }
}

//                   END OF BOILERPLATE
///////////////////////////////////////









/////////////////////////////////////
// Library

// Calls modules and orchestrates dependencies between them

function Library() {
  if (!Library.SingletonStore.prototype.describe) {
    throw new Error("The singleton store below needs a describe(name, func) method:\n"+Library.SingletonStore)
  } else if (!Library.SingletonStore.prototype.get) {
    throw new Error("The singleton store below needs a get(name) method:\n"+Library.SingletonStore)
  }
  this.singletons = new Library.SingletonStore()
}









/////////////////////////////////////
test(
  LibrariesDefineModules,
  "Define a module and then use it",

  function(expect, done) {
    var library = new Library()

    library.define("foo", 
      function() { return "bar" }
    )

    library.using(["foo"], expectBar)

    function expectBar(foo) {
      expect(foo).to.equal("bar")
      done()
    }
  }
)




/////////////////////////////////////
function LibrariesDefineModules(done) {

  function SingletonStore() {
    this.modules = {}
    this.singletons = {}
  }

  SingletonStore.prototype.get =
    function(name) {
      var singleton = this.singletons[name]

      if (typeof singleton == "undefined") {
        singleton = this.modules[name]()
        this.singletons[name] = singleton
      }

      return singleton
    }

  SingletonStore.prototype.describe =
    function(name, func) {
      if (!func.call) {
        throw new Error("Can't define "+name+" as "+JSON.stringify(func)+" cuz it's not a function")
      }
      this.modules[name] = func
    }

  Library.SingletonStore = SingletonStore

  Library.prototype.define =
    function(name, two, three) {
      if (three) {
        var func = three
        var dependencies = two
      } else {
        var func = two
        var dependencies = []
      }

      var generator = this.using.bind(this, dependencies, func)

      this.singletons.describe(name, generator)
    }


  Library.prototype.using =
    function(dependencies, func) {
      var using = {dependencies: dependencies}

      if (this.beforeUsing) {
        this.beforeUsing(using)
        dependencies = using.dependencies
        var singletonFrame = using.singletons
      } else {
        singletonFrame = this.singletons
      }

      var singletons = []

      for(var i=0; i<dependencies.length; i++) {

        var dependency = dependencies[i]

        if (typeof dependency == "undefined") {
          throw new Error("Dependency #"+i+" of "+JSON.stringify(dependencies)+" passed to library.using is undefined")
        } else if (dependency.call) {
          var singleton = dependency()
        } else {
          var singleton = singletonFrame.get(dependency)
        }

        singletons.push(singleton)
      }

      return func.apply(null, singletons)
    }

  done()
}





///////////////////////////////////////
test(
  "Don't run the generator every time",

  function(expect, done) {
    var library = new Library()
    var count = 0

    library.define("foo", 
      function() { return count++ }
    )

    library.using(["foo"], 
      function() {}
    )

    library.using(["foo"],
      function() {}
    )

    expect(count).to.equal(1)
    done()
  }
)





///////////////////////////////////////
test(
  "Definitions can have dependencies",

  function(expect, done) {
    var library = new Library()
    var count = 0

    library.define("turtle", 
      function() {
        return "in the sun"
      }
    )

    library.define(
      "rider",
      ["turtle"],
      function(turtle) {
        return "rider rides " + turtle
      }
    )

    library.using(["rider"], 
      function(rider) {
        expect(rider).to.equal("rider rides in the sun")
        done()
      }
    )
  }
)




/////////////////////////////////////
test(
  "Dependencies can be functions",

  function(expect, done) {
    var library = new Library()

    library.using(
      [function() { 
        return "the Tappet Brothers!"
      }],
      function(clickAndClack) {
        expect(clickAndClack).to.equal("the Tappet Brothers!")
        done()
      }
    )

  }
)



///////////////////////////////////////
test(
  ModulesHaveCollectives,
  "modules have collective objects",
  function(expect, done) {
    var library = new Library()

    library.define(
      "fish",
      [
        library.collective({
          flights: []
        })
      ],
      function(collective) {
        expect(collective.flights).to.be.empty
        done()
      }
    )

    library.using(
      ["fish"],
      function(fish) {}
    )

  }
)

function ModulesHaveCollectives(done) {
  var clone = require("clone")
  var SingletonFrame = require("nrtv-singleton-frame")

  Library.prototype.collective =
    function(object) {
      return function() {
        return clone(object)
      }
    }

  Library.SingletonStore = SingletonFrame

  done()
}






///////////////////////////////////////
test(
  LibraryResetsSingletons,
  "collectives can be reset by the user",

  function(expect, done) {
    var library = new Library()

    library.define(
      "bird",
      [library.collective({nests: [], orig: true})],
      function(collective) {
        function Bird(nest) {
          collective.nests.push(nest)
        }
        Bird.getNests = function() {
          return collective.nests
        }
        return Bird
      }
    )

    library.using(
      ["bird"],
      function(Bird) {
        var beltedKingfisher =
          new Bird("burrow")
      }
    )

    var halfDone = false
    library.using(
      ["bird"],
      function(Bird) {
        var burrowingOwl =
          new Bird("occupied burrow")

        var burrows = Bird.getNests()
        expect(burrows).to.have.members(["burrow", "occupied burrow"])
        if (halfDone) { done() }
        halfDone = true
      }
    )

    library.using(
      [library.reset("bird")],
      function(Bird) {

        var hummingbird =
          new Bird("supported cupped")
        var swift =
          new Bird("adherent")

        var cuppedNests = Bird.getNests()
        expect(cuppedNests).to.have.members(["supported cupped", "adherent"])
        if (halfDone) { done() }
        halfDone = true
      }
    )
  }
)


function LibraryResetsSingletons(done) {
  require("array.prototype.find")
  var ramda = require("ramda")
  var find = ramda.find
  var contains = ramda.contains

  Library.prototype.reset =
    function(name) {
      return {reset: name}
    }

  // Before we start using, we search the dependency tree for each dependency to see if any of *them* need to be reset. And then keep repeating that when we find a new thing to reset until we're done.

  Library.prototype.beforeUsing =
    function(using) {
      var resets = []

      for(var i=0; i<using.dependencies.length; i++) {

        var dependency = using.dependencies[i]

        var name = dependency.reset

        if (name) {
          resets.push(name)
          using.dependencies[i] = name
        }
      }

      var didResetOne = resets.length > 0
      var anotherToReset = alsoNeedsResetting.bind(null, resets)

      while (didResetOne) {
        didResetOne = find(anotherToReset)(using.dependencies)
      }
      
      using.singletons = this.singletons.reset(resets)
    }

  function alsoNeedsResetting(resets, dependency) {

    var alreadyReset = contains(dependency)(resets)

    if (!alreadyReset && dependsOn(dependency, resets)) {
      resets.push(dependency)
      return true
    }
  }


  done()
}



