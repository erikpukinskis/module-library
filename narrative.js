///////////////////////////////////////
// BOILERPLATE
var requirejs = require("requirejs")

function runTheTest(setup, description, test, chai) {
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

  if (setup) { setup(runAndDone) }
  else { runAndDone() }
}

function test(setup, description, runTest) {

  requirejs(
    ["chai"],
    runTheTest.bind(null, setup, description, runTest)
  )
}
//                   END OF BOILERPLATE
///////////////////////////////////////









/////////////////////////////////////
// Library

// Calls modules and orchestrates dependencies between them

function Library() {
  this.singletons = new Library.SingletonStore()
}









/////////////////////////////////////
test(
  addDefiningModules,
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
function addDefiningModules(done) {

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

  Library.SingletonStore = SingletonStore


  Library.prototype.define =
    function(name, func) {
      this.singletons.modules[name] = func
    }


  Library.prototype.using =
    function(dependencies, func) {
      var singletons = []

      for(var i=0; i<dependencies.length; i++) {

        var singleton = this.singletons.get(dependencies[i])

        singletons.push(singleton)
      }

      func.apply(null, singletons)
    }

  done()
}









/////////////////////////////////////
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




// test(
//   "collect"
