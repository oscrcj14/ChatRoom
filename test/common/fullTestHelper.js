(function () {
    "use strict";

    var IMPORT_PREFIX = "../" + require("../config").IMPORT_PREFIX;

    var assert = require("assert"),
        config = require(IMPORT_PREFIX + "config"),
        constants = require(IMPORT_PREFIX + "common/constants"),
        io = require("socket.io-client"),
        log = require(IMPORT_PREFIX + "common/log"),
        q = require("q"),
        serverGenerator = require(IMPORT_PREFIX + "server");

    var FullTestHelper = function () {
        this.state = {};
        this.resetState();
    };

    FullTestHelper.prototype.resetState = function () {
        this.state.sessionName = "MyConversation";
        this.state.userId1 = "Curtis";
        this.state.userId2 = "Fred";
        this.state.userId3 = "Sally";
        this.state.serverUrl = config.getSetting("fullTestEndpoint1");
        this.state.serverUrl2 = config.getSetting("fullTestEndpoint2");
        this.state.options = {
            transports: ["websocket"],
            "force new connection": true,
            path: "/" + config.API_VERSION + "/socket.io/socket.io.js"
        };
        this.state.numClients = 3;
        this.state.waitTimeMS = 5000;
        this.state.briefWaitTimeMS = 200;
        this.state.testListener = null;
        this.state.clients = null;
        this.state.server = null;
        this.state.server2 = null;
    };

    FullTestHelper.prototype.validateId = function (id) {
        // Ensure the id is a string and in the correct form
        assert.notEqual(id, null);
        assert.strictEqual(typeof id, "string");
        assert.notEqual(id, "");
    };

    // Some test steps cannot use the socketCallbackHandler because they are waiting for things to NOT happen.
    // They can use this brief delay with setTimeout instead.
    FullTestHelper.prototype.briefDelay = function () {
        return q.delay(this.state.briefWaitTimeMS);
    };

    FullTestHelper.prototype.isApproximatelyCurrent = function (time) {
        var date = new Date();
        var curTime = date.getTime();
        return time > (curTime - this.state.waitTimeMS) && time < (curTime + this.state.waitTimeMS);
    };

    FullTestHelper.prototype.socketCallbackHandler = function (pendingTestCallbacks, emitFunctionToExecute) {
        var self = this;
        var stackTrace;
        var message = "Hit timeout of " + self.state.waitTimeMS + " while waiting for socket callbacks to fire. %%c%% of %%p%% have fired";
        try {
            throw new Error(message);
        } catch (e) {
            stackTrace = e.stack;
        }

        var defered = q.defer();

        var startTime = new Date().getTime();
        var callbacksReceived = 0;

        var timerId = setTimeout(function () {
            self._resetCallbacks();
            var error = Error(message.replace("%%c%%", callbacksReceived).replace("%%p%%", pendingTestCallbacks.length));
            error.stack = stackTrace.replace("%%c%%", callbacksReceived).replace("%%p%%", pendingTestCallbacks.length);
            defered.reject(error);
        }, self.state.waitTimeMS);

        var testCallbackHandler = function () {
            callbacksReceived++;

            if (callbacksReceived === pendingTestCallbacks.length) {
                var curTime = new Date().getTime();
                var duration = curTime - startTime;
                log.info("All socket [" + pendingTestCallbacks.length + "] callbacks received in " + duration);
                clearTimeout(timerId);
                self._resetCallbacks();
                defered.resolve();
            }
        };

        for (var i = 0; i < pendingTestCallbacks.length; i++) {
            pendingTestCallbacks[i].push(testCallbackHandler);
        }

        var promises = [
            defered.promise
        ];

        if (emitFunctionToExecute)
            promises.push(emitFunctionToExecute());

        return q.all(promises);
    };

    FullTestHelper.prototype._updateTestListener = function(listener, event, callData) {
        listener.calls[event].push(callData);

        var eventCallbacks = listener.callbacks[event];
        for (var i = 0; i < eventCallbacks.length; i++) {
            eventCallbacks[i](callData);
        }
    };

    FullTestHelper.prototype._resetEventArrays = function(testObject) {
        testObject.connected = [];
        testObject.newMessagesReceived = [];
    };

    FullTestHelper.prototype._resetCallbacks = function() {
        for (var i = 0; i < this.state.testListener.length; i++) {
            this._resetEventArrays(this.state.testListener[i].callbacks);
        }
    };

    FullTestHelper.prototype.resetTestListener = function() {
        this.state.testListener = [];

        for (var i = 0; i < this.state.numClients; i++) {
            this.state.testListener[i] = { calls: {}, callbacks: {} };
            this._resetEventArrays(this.state.testListener[i].calls);
        }

        this._resetCallbacks();
    };

    FullTestHelper.prototype.initializeServer = function () {
        var self = this;
        self.state.server = serverGenerator.create();
        self.state.server.on("unhandledError", function () { assert.ok(false, "Unhandled error"); });
        return self.state.server.start();
    };

    FullTestHelper.prototype.initializeSecondServer = function () {
        process.env.PORT = constants.additionalTestPort;
        this.state.server2 = serverGenerator.create();
        this.state.server2.on("unhandledError", function () { assert.ok(false, "Unhandled error"); });
        return this.state.server2.start()
            .then(function () {
                delete process.env.PORT;
            });
    };

    FullTestHelper.prototype.stopServer = function () {
        return this.state.server.stop();
    };

    FullTestHelper.prototype.stopSecondServer = function () {
        return this.state.server2.stop();
    };

    FullTestHelper.prototype.disconnect = function() {
        for (var i = 0; i < this.state.clients.length; i++) {
            this.state.clients[i].disconnect();
        }
    };

    var _generateUserConnectMethod = function (index) {
        var self = this;

        return function () {
            // Listeners
            self.state.clients[index].on(constants.clientApis.connected, function (data) {
                self._updateTestListener(self.state.testListener[index], constants.clientApis.connected, data);
            });

            self.state.clients[index].on(constants.clientApis.newMessagesReceived, function (data) {
                self._updateTestListener(self.state.testListener[index], constants.clientApis.newMessagesReceived, data);
            });
        };
    };

    FullTestHelper.prototype.setupClients = function (hasMultipleServers) {
        this.state.clients = [];

        // Create socket instances
        for (var i = 0; i < this.state.numClients - 1; i++) {
            this.state.clients.push(io.connect(this.state.serverUrl, this.state.options));
            this.state.clients[i].once("connect", _generateUserConnectMethod.call(this, i));
        }

        this.state.clients.push(io.connect(hasMultipleServers ? this.state.serverUrl2 : this.state.serverUrl, this.state.options));
        this.state.clients[this.state.numClients - 1].once("connect", _generateUserConnectMethod.call(this, this.state.numClients - 1));
    };

    module.exports = FullTestHelper;
})();
