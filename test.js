///////////////////////////////////////
// BOILERPLATE
var chai = require("chai")
var only //= "Don't run the generator every time"

function test(setup, description, test) {
  if (!test) {
    test = description
    description = setup
    setup = undefined
  }

  function done(extra) {
    clearTimeout(timer)
    console.log("  ✓ ", description, extra ? extra : "")
  }

  if (only && description != only) {
    setup && setup(function() {})
    return done(" [ SKIPPED ]")
  }

  var expect = chai.expect

  var timer = setTimeout(
    function() {
      var message = "Got stuck in test \""+description+"\":\n"+runTest
      if (setup) {
        message += "\n... or or setup:\n"+setup
      }
      throw new Error(message)
    },
    1000
  )

  var runTest = test.bind(null, chai.expect)

  var runAndDone = runTest.bind(null, done)

  try {
    if (setup) {
      setup(runAndDone)
    } else {
      runAndDone()
    }
  } catch (e) {
    console.log(" ⚡⚡⚡ "+description + " ⚡⚡⚡")
    throw(e)
  }
}

//                   END OF BOILERPLATE
///////////////////////////////////////






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
    console.log("defined name")

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
    console.log("defined parent")

    // library.using(
    //   ["name"],
    //   function(name) {
    //     name("fred")

    //     expect(name.names()).to.have.members(["fred"])
    //   }
    // )
    // console.log("added fred")

    // library.using(
    //   ["name"],
    //   function(name) {
    //     expect(name.names()).to.have.members(["fred"])
    //   }
    // )

    // library.using(
    //   ["parent"],
    //   function(parent) {
    //     parent("trish")
    //   }
    // )
    // console.log("added trish")

    // library.using(
    //   ["name"],
    //   function(name) {
    //     expect(name.names()).to.have.members(["fred", "trish"])
    //   }
    // )
    // console.log("checked two")

    // library.using(
    //   [library.reset("name")],
    //   function(name) {
    //     expect(name.names()).to.be.empty
    //   }
    // )
    // console.log("reset name")

    // library.using(
    //   ["name"],
    //   function(name) {
    //     expect(name.names()).to.have.members(["fred", "trish"])
    //   }
    // )
    // console.log("used name")

    library.using(
      [
        library.reset("name"),
        "parent"
      ],
      function(name, parent) {
        expect(name.collective()).to.equal(parent.collective())
      }
    )

    // why did feshniss get gerwil off bill when it should've gotten enseer off ted

    console.log("reset again")

    done()
  }
)
