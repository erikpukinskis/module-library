var test = require("nrtv-test")
var Library = require("../node-library").Library

test(
  "dependencies can be commonjs modules",

  function(expect, done) {
    var library = new Library()

    library.define(
      "finder",
      ["ramda"],
      function(rambda) {
        return rambda.contains
      }
    )

    library.using(
      ["finder", "ramda"],
      function(finder, rambda) {
        expect(finder).to.be.a("function")
        expect(rambda.find).to.be.a("function")
        done()

      }
    )
  }
)


test(
  "can export singleton for commonjs",

  function(expect, done) {
    var library = new Library()

    var singleton = library.export(
      "foo",
      function() {
        return "bar"
      }
    )

    expect(singleton).to.equal("bar")

    done()
  }
)

test(
  "resets work for modules exported through commonjs",

  function(expect, done) {
    var library = new Library()

    library.using(
      ["./flower", "./seed"],
      function(Flower, seed) {
        new Flower("Danube")
        expect(seed.sprouts()).to.have.members(["Danube P. Sprout"])
      }
    )

    // we weren't resetting "seed" before when we try to reset "./seed". That suggests to me that now flower and seed have different seed singletons.

    library.using(
      [
        "./flower",
        library.reset("./seed")
      ],
      function(Flower, seed) {
        new Flower("Daryl")
        expect(seed.sprouts()).to
        .have.members([
          "Daryl P. Sprout"
        ])

        done()
      }
    )
  }
)



test(
  "you can reset a module before using its neighbors",

  function(expect, done) {
    var library = new Library()

    library.using(
      [
        "./flower",
        library.reset("./seed")
      ],
      function(Flower, seed) {
        done()
      }
    )
  }
)



test(
  "external require functions",

  function(expect, done) {
    function alternateRequire() {
      return "boo ba doo"
    }

    var library = require("../node-library")(alternateRequire)

    library.using(
      ["this could be anything"],
      function(boo) {
        expect(boo).to.equal("boo ba doo")
        done()
      }
    )
  }
)



test(
  "same library regardless of require",

  function(expect, done) {
    var one = require("../node-library")(function() {})
    var two =  require("../node-library")(function() {})

    one.define("foo", function() {
      return "yup"
    })

    two.using(["foo"], function(foo) {
      expect(foo).to.equal("yup")
      done()
    })
  }
)



test(
  "one library per require",

  function(expect, done) {
    function myRequire() {}
    var one = require("../node-library")(myRequire)
    var two = require("../node-library")(myRequire)

    expect(one).to.equal(two)
    done()
  }
)



test(
  "exported nrtv modules keep their require functions around for commonjs requires",

  function(expect, done) {
    var library = new Library()

    expect(function() {
      library.using(
        ["./nrtv_module_with_commonjs_requirement"],
        function(stuff) {
          done()
        }
      )
    }).to.not.throw()
  }
)
