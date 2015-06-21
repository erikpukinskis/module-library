require("requirejs")(
  ["chai"],
  function(chai) {
    var expect = chai.expect

    function test(setup, description, runTest) {
      var timer = setTimeout(
        function() {
          throw new Error("Never came back from "+description+":\n"+func)
        },
        1000
      )

      setup()
      runTest(function() {
        clearTimeout(timer)
        console.log("  ✓ ", description)
      })
    }
///////////////////////////////////////






// Library

// Calls modules and orchestrates dependencies between them



function Library() {
  this.modules = {}
}



test(
  moduleUsing.bind(Library),
  "Define a module and then use it",
  function(done) {
    var library = new Library()

    library.define("foo", function() {
      return "bar"
    })

    library.using(["foo"], function(foo) {
      expect(foo).to.equal("bar")
      done()
    })
  }
)



function moduleUsing() {
  this.prototype.define =
    function(name, func) {
      var module = {
        name: name,
        func: func
      }
      this.modules[name] = module
    }

  function getSingleton(name) {
    var func = this.modules[name].func
    return func()
  }

  this.prototype.using =
    function(dependencies, func) {
      var singletons = []

      for(var i=0; i<dependencies.length; i++) {

        var singleton = getSingleton.bind(this, dependencies[i])()

        singletons.push(singleton)
      }

      func.apply(null, singletons)
    }
}








///////////////////////////////////////
  }
)