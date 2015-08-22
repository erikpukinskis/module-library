var library = require("../library")(require)

module.exports = library.export(
  "nrtv-module-with-commonjs-requirement",
  ["example"],
  function(example) {
    return true
  }
)