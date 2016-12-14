var library = require("./node-library")(require)

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