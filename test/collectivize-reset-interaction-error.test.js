var runTest = require("run-test")(require)

runTest(
  "library.using() throws an error if you try to reset a dependency of a module with a collectivized singleton",
  ["../node-library"],
  function(expect, done, libraryFactory) {

    var library = new libraryFactory.Library()

    library.define(
      "nrtv-browser-bridge",
      [library.collective({})],
      function(collective) {
        function BrowserBridge() {
          this.id = Math.random().toString(36).split(".")[1]
        }

        BrowserBridge.prototype.getId =
          function() {
            return this.id
          }

        library.collectivize(
          BrowserBridge,
          collective,
          ["getId"]
        )

        return BrowserBridge
      }
    )


    library.define(
      "nrtv-socket-server",
      [library.collective({}), "nrtv-browser-bridge"],
      function(collective, bridge) {

        function SocketServer() {
        }

        SocketServer.prototype.bridgeId =
          function() {
            return bridge.getId()
          }

        SocketServer.prototype.adoptConnections =
          function(handler) {
          }


        library.collectivize(
          SocketServer,
          collective,
          ["adoptConnections", "bridgeId"]
        )

        return SocketServer
      }  
    )


    library.define(
      "nrtv-single-use-socket",

      ["nrtv-socket-server", "nrtv-browser-bridge"],
      function(socketServer, bridge) {

        function SingleUseSocket(onReady) {
        }

        SingleUseSocket.getReady =
          function() {
            socketServer.adoptConnections(function() {})      
          }

        SingleUseSocket.prototype.bridgeId =
          function() {
            return bridge.getId()
          }
          
        return SingleUseSocket
      }
    )



    function inappropriateUse() {
      library.using(
        ["nrtv-single-use-socket"],
        function(SingleUseSocket) {

          SingleUseSocket.getReady()

          library.using(["nrtv-single-use-socket", library.reset("nrtv-browser-bridge"), "nrtv-socket-server"])
        }
      )
    }

    expect(inappropriateUse).to.throw(Error, /has a collectivized singleton/)

    done()
  }
)