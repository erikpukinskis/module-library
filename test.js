var test = require("nrtv-test")
var Library = require("./library").Library


// test.only("collectives can be reset by the user")

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
  "dependencies of dependencies get reset too",

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

  }
)


