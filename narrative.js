require("requirejs")(
  ["chai"],
  function(chai) {
    var expect = chai.expect
///////////////////////////////////////

function Library() {
  this.modules = {}
}

var library = new Library()

Library.prototype.define =
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

Library.prototype.using =
  function(dependencies, func) {

    var singletons = []

    for(var i=0; i<dependencies.length; i++) {

      var singleton = getSingleton.bind(this, dependencies[i])()

      singletons.push(singleton)
    }

    func.apply(null, singletons)
  }

library.define("foo", function() {
  return "bar"
})

library.using(["foo"], function(foo) {
  expect(foo).to.equal("bar")
  console.log("woop")
})





///////////////////////////////////////
  }
)