var runTest = require("run-test")
var Library = require("../").Library


runTest(
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


runTest(
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


// The following two tests are based off this same base:

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


runTest(
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

    // Just want to make sure we don't break this code path:

    library.dump(function() {})
  }
)


runTest(
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


runTest(
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


runTest(
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
