(function () {
    "use strict";

    var express = require("express"),
        constants = require("./common/constants"),
        log = require("./common/log"),
        socketsGenerator = require("./sockets"),
        q = require("q");
    
    log.enableConsoleLog();
    log.level = log.levels.info;

    var autoStart = function () {
        // catch uncaught errors
        process.on("uncaughtException", function (err) {
            console.error((new Date()).toUTCString() + " uncaughtException: ", err.message);
            console.error(err.stack);
            // try to log via log, though we are in an unknown state.
            log.error("uncaughtServerError", { error: err });
            // handling the exception is not a good idea. Node is in an unknown state..
        });
        
        return create().start();
    };

    var create = function (logOverride) {
        var _server, _sockets;
        var _logOverride = logOverride;
        var _started = false;
        var _unhandledError = null;

        var start = function () {
            if (_started) {
                var deferred = q.defer();
                deferred.resolve();
                return deferred.promise;
            }

            log.info("Server starting up", {});
            
            log.info("Server starting Express", {});
            
            var app = express();
            
            // Listen for requests
            var port = process.env.PORT || constants.devPort;
            log.info("Server listening on port", { port: port });
            _server = app.listen(port);
            
            // Initialize sockets.
            log.info("Server attaching socket handling", {});
            _sockets = socketsGenerator.create();
            _sockets.initialize(_server);
            
            log.info("Server started", {});
            _started = true;

            if (_logOverride) {
                log = _logOverride;
            }

            return q();
        };
        
        var stop = function () {
            log.info("Server Stopping", {});
            
            var stopPromise = q();
            
            if (_sockets) {
                _sockets.close();
            }
            
            // In some tests the express server is started but the sockets are never used, so the previous step won't close the server.
            if (_server && _server._handle) {
                _server.close();
            }
            
            stopPromise.then(function () {
                _started = false;
                log.info("Server stopped", {});
            });
            
            return stopPromise;
        };

        var on = function (eventName, handler) {
            if (eventName === "unhandledError") {
                _unhandledError = handler;
            }
        };

        return {
            stop: stop,
            start: start,
            on: on
        };
    };
    
    if (!module.parent) {
        // it is a run from command line, so auto-start
        autoStart();
    }

    // This is meant to be used only for tests.
    module.exports = {
        create: create
    };
})();
