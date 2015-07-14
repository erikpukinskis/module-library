var test = require("nrtv-test")
var Library = require("./library").Library


test(
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

      var burrows = Bird.getNests()
      expect(burrows).to.have.members(["burrow", "occupied burrow"])
      library.using(
        [library.reset("bird")],
        makeCuppedNests
      )
    }

    function makeCuppedNests(Bird) {
      var hummingbird =
        new Bird("supported cupped")
      var swift =
        new Bird("adherent")

      var cuppedNests = Bird.getNests()
      expect(cuppedNests).to.have.members(["supported cupped", "adherent"])

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
