var test = require("nrtv-test")
var Library = require("./node-library").Library


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
  "getting individual singletons",
  function(expect, done) {
    var library = new Library()

    library.define("fred",
      function() {
        return "red"
      }
    )

    expect(library.get("fred")).to.equal("red")

    // And again to test cached path:

    expect(library.get("fred")).to.equal("red")

    done()
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

function libraryWithQuail() {
  var library = new Library()

  library._possibleMoods = ["sated", "jumpy", "quiet", "raucus", "weary", "enthusiastic"]

  library.define(
    "quail",
    [library.collective({})],
    function(collective) {

      if (!collective.mood) {
        collective.mood = library._possibleMoods.pop()
      }

      function Quail() {
        this.mood = collective.mood
      }

      return Quail
    }
  )

  return library
}



test(
  "stuff that uses the module you are resetting gets reset too",

  function(expect, done) {

    var library = libraryWithQuail()

    library.define(
      "forest",
      ["quail"],
      function(Quail) {
        function Forest() {
          this.mood = new Quail().mood
        }

        return Forest
      }
    )

    library.using(
      ["quail", "forest"],
      function(Quail, Forest) {

        // These should all start off with the same mood, coming off the birds' collective mood:

        var bird = new Quail()
        expect(bird.mood).to.equal("enthusiastic")
        var forest = new Forest()
        expect(forest.mood).to.equal("enthusiastic")
      }
    )

    library.using(
      [
        library.reset("quail"),
        "forest"
      ],
      function(Quail, Forest) {

        expect(new Quail().mood).to.equal("weary")

        // Without resets, forest would still be working off that original mood, but since we reset Bird, and Forest depends on Bird, we are expecting forest to pick up on the reset:

        var forest = new Forest()

        expect(forest.mood).to.equal("weary")

        done()
      }
    )

  library.dump()
  }
)



test(
  "reset ancestors singletons but not their collectives",

  function(expect, done) {

    var library = libraryWithQuail()

    library.define(
      "moody-forest",
      [library.collective({}), "quail"],
      function(collective, Quail) {

        // The moody forests have a collective tree mood of their own. And we want to make sure that even if we reset a dependency (Bird) we don't reset the forest mood unless we explicitly ask for that.

        if (!collective.treeMood) {
          collective.treeMood = library._possibleMoods.pop()
        }

        function MoodyForest() {
          new Quail()
          this.treeMood = collective.treeMood
        }

        return MoodyForest
      }
    )

    library.using(
      ["moody-forest"],
      function(MoodyForest) {
        var forest = new MoodyForest()

        // We took enthusiastic for the birds, so now the trees should get weary:

        expect(forest.treeMood).to.equal("weary")
      }
    )

    library.using(
      [
        library.reset("quail"),
        "moody-forest"
      ],
      function(Quail, MoodyForest) {
        var forest = new MoodyForest()

        // Forests should be the same, because their collective mood shouldn't have been reset, even though the bird collective was:

        expect(forest.treeMood).to.equal("weary")

        expect(new Quail().mood).to.equal("raucus")

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
  "dependencies of dependencies get reset too, if they depend on the resets",

  function(expect, done) {

    var library = new Library()


    library.define("a", function() { return true })

    library.define("b", ["c"], function() { return true })

    library.define("c", ["a"],
      function() {
        var count = 0

        function increment() {
          return ++count
        }

        return increment
      }
    )

    // We need to use these so the singletons get cached otherwise we won't bother resetting them:

    library.using(
      ["a", "b", "c"],
      function(a, b, c) {
        expect(c()).to.equal(1)
      }
    )

    library.using(
      ["a", "c"],
      function(a, c) {
        expect(c()).to.equal(2)
      }
    )

    library.using(
      [
        library.reset("a"),
        "c"
      ],
      function(a, c) {
        expect(c()).to.equal(1)
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

    var library = require("./node-library")(alternateRequire)

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
    var one = require("./node-library")(function() {})
    var two =  require("./node-library")(function() {})

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
    var one = require("./node-library")(myRequire)
    var two = require("./node-library")(myRequire)

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



test(
  "Add static collective methods to a constructor",

  function(expect, done) {

    var library = new Library()

    library.define(
      "coffee",
      [library.collective({})],
      function(collective) {

        function Coffee() {
          this.sips = []
        }

        Coffee.prototype.sip =
          function() {
            this.sips++
            return this.sips
          }

        library.collectivize(
          Coffee,
          collective,
          function() {
            return new Coffee()
          },
          ["sip"]
        )

        return Coffee
      }
    )

    library.using(["coffee"],
      function(coffee) {
        coffee.sip()
      }
    )

    library.using(["coffee"],
      function(coffee) {
        var sips = coffee.sip()
        expect(sips).to.equal(2)
        done()
      }
    )

  }
)
