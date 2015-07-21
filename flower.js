var library = require("../library")(require)
var log = require("treelog")

module.exports = library.export(
  "flower",
  ["./seed"],
  function(seed) {
    function Flower(name) {
      seed.sprout(name)
    }
    return Flower
  }
)