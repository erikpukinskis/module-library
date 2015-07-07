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
  } else { runAndDone() }
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
      var singletons = []
      for(var i=0; i<dependencies.length; i++) {

        var dependency = dependencies[i]

        if (dependency.call) {
          var singleton = dependency()
        } else {
          var singleton = this.singletons.get(dependency)
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




///////////////////////////////////////
test(
  "collectives can be reset by the user",

  function(expect, done) {
    console.log("noooooooooo")
    var library = new Library()

    library.define(
      "bird",
      [library.collective({nests: []})],
      function(collective) {
        function Bird(nest) {
          collective.nests.push(nest)
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

    console.log("not half done even")
    var halfDone = false
    library.using(
      ["bird"],
      function(Bird) {
        console.log("birding!")
        var burrowingOwl =
          new Bird("occupied burrow")

        var burrows = Bird.getNests()
        expect(burrows).to.have.members(["burrow", "occupied burrow"])
        if (halfDone) { done() }
        halfDone = true
      }
    )

    library.using(
      [collective.reset("bird")],
      function(Bird) {
        console.log("birdering!")
        var hummingbird =
          new Bird("supported cupped")
        var swift =
          new Bird("adherent")

        var cuppedNests = Bird.getNests()
        expect().to.have.members(["supported cupped", "adherent"])
        if (halfDone) { done() }
        halfDone = true
      }
    )

    done()
  }
)

function ModulesHaveCollectives(done) {
  var SingletonFrame = require("nrtv-singleton-frame")

  Library.prototype.collective =
    function(object) {
      return function() {
        var clone = {}
        for (var key in object) {
          clone[key] = object[key]
        }
        return clone
      }
    }

  Library.SingletonStore = SingletonFrame

  done()
}
