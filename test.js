var test = require("nrtv-test")
var Library = require("./library").Library

// test.only("resets work for modules exported through commonjs")

test(
  "define a module and then use it",

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




test(
  "don't run the generator every time",

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




test(
  "definitions can have dependencies",

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
        return true
      }
    )

    library.using(
      ["fish"],
      function(fish) {}
    )

  }
)


test(
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

    library.define(
      "noreset",
      [library.collective({})],
      function(collective) {
        function noreset(junk) {
          collective.junk = junk
        }
        noreset.collective = collective
        return noreset
      }
    )

    library.using(
      ["noreset"],
      function(noreset) {
        noreset("forest")
      }
    )

    library.using(
      ["bird"],
      function(Bird) {
        var beltedKingfisher =
          new Bird("burrow")
      }
    )

    library.using(
      ["bird"],
      makeAnotherBurrow
    )

    function makeAnotherBurrow(Bird) {

      var burrowingOwl =
        new Bird("occupied burrow")

      expect(Bird.getNests()).to.have.members(["burrow", "occupied burrow"])

      library.using(
        [
          library.reset("bird"),
          "noreset"
        ],
        makeCuppedNests
      )
    }

    function makeCuppedNests(Bird, noreset) {

      expect(noreset.collective.junk).to.equal("forest")

      var hummingbird =
        new Bird("supported cupped")
      var swift =
        new Bird("adherent")

      expect(Bird.getNests()).to.have.members(["supported cupped", "adherent"])

      done()
    }

  }
)


test(
  "stuff that uses the module you are resetting gets reset too",

  function(expect, done) {
    var library = new Library()

    library.define(
      "name",
      [library.collective(
        {names: []})
      ],
      function(collective) {
        function name(person) {
          collective.names.push(person)
        }
        name.collective = function() {
          return collective
        }
        return name
      }
    )

    library.define(
      "parent",
      ["name"],
      function(name) {
        function parent(person) {
          name(person)
        }
        parent.collective = function() {
          return name.collective()
        }

        return parent
      }
    )

    library.using(
      [
        library.reset("name"),
        "parent"
      ],
      function(name, parent) {
        expect(name.collective()).to.equal(parent.collective())
        done()
      }
    )

  library.dump()
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
  "dependencies of dependencies get reset too, if they depend on the resets",

  function(expect, done) {

    var library = new Library()


    library.define("a", function() { return true })

    library.define("b", ["c"], function() { return true })

    library.define("c", ["a"], function() { return true })

    // We need to use these so the singletons get cached otherwise we won't bother resetting them:

    library.using(
      ["a", "b", "c"],
      function() {}
    )

    library.using(
      [
        library.reset("a"),
        library.ref()
      ],
      function(a, library) {
        expect(library.resets).to.include.members(["c"])
      }
    )

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

    var library = require("./library")(alternateRequire)

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
    var one = require("./library")(function() {})
    var two =  require("./library")(function() {})

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
    var one = require("./library")(myRequire)
    var two = require("./library")(myRequire)

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
