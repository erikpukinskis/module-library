var library = require("./node-library")(require)

module.exports = library.export(
  "seed",
  [library.collective({titles: []})],
  function(collective) {
    var seed = {
      sprout: function(name) {
        collective.titles.push(name+" P. Sprout")
      },
      sprouts: function() {
        return collective.titles
      }
    }
    return seed
  }
)
