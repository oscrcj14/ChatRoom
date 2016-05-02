"use strict";

var IMPORT_PREFIX = require("./config").IMPORT_PREFIX;

var assert = require("assert"),
    config = require(IMPORT_PREFIX + "config"),
    constants = require(IMPORT_PREFIX + "common/constants"),
    Emitters = require("./common/fullTestEmitters"),
    Helper = require("./common/fullTestHelper"),
    //q = require("q"),
    redis = require("redis");

var helper = new Helper();
var emitters = new Emitters(helper);
var state = helper.state;

describe("ChatRoom full tests", function () {
    afterEach(function () {
        helper.disconnect();
    });

    describe("with single server", function () {
        before(function (done) {
            helper.resetState();
            helper.initializeServer()
                .done(function () { done(); }, done);
        });

        after(function (done) {
            helper.stopServer()
                .done(done, done);
        });

        beforeEach(function (done) {
            helper.resetTestListener();
            helper.setupClients(false);

            var callbacks = [];
            for (var i = 0; i < state.testListener.length; i++) {
                callbacks.push(state.testListener[i].callbacks.connected);
            }

            // Ignore promise results upon success
            helper.socketCallbackHandler(callbacks)
                .done(function () { done(); }, done);
        });

        it("Connecting to server", function () {
            assert.strictEqual(JSON.stringify(state.testListener[0].calls.connected[0]), "{\"success\":true}");
            assert.strictEqual(JSON.stringify(state.testListener[1].calls.connected[0]), "{\"success\":true}");
            assert.strictEqual(JSON.stringify(state.testListener[1].calls.connected[0]), "{\"success\":true}");
        });
        
        it("Logon to server", function (done) {
            emitters.emitLogonFromClient(state.clients[0], state.userId1)
                .then(emitters.emitLogonFromClient.bind(emitters, state.clients[1], state.userId2))
                .then(emitters.emitLogonFromClient.bind(emitters, state.clients[2], state.userId3))
                .done(function() { done(); }, done);
        });

        it("Creating session", function (done) {
            emitters.emitLogonFromClient(state.clients[0], state.userId1)
                .then(emitters.emitCreateSessionFromClient.bind(emitters, state.clients[0], state.sessionName))
                .then(function (result) {
                    assert.strictEqual(typeof result.error, "undefined");
                })
                .done(done, done);
        });

        it("Joining session", function (done) {
            emitters.emitLogonFromClient(state.clients[0], state.userId1)
                .then(emitters.emitCreateSessionFromClient.bind(emitters, state.clients[0], state.sessionName))
                .then(emitters.emitLogonFromClient.bind(emitters, state.clients[1], state.userId2))
                .then(emitters.emitJoinSessionFromClient.bind(emitters, state.clients[1], state.sessionName))
                .then(function (result) {
                    assert.strictEqual(typeof result.error, "undefined");
                })
                .done(done, done);
        });

        it("Adding messages to session", function (done) {
            var message1 = "How are you, Sally?";
            var message2 = "I'm good, I just got back from Mexico!";

            emitters.emitLogonFromClient(state.clients[0], state.userId1)
                .then(emitters.emitCreateSessionFromClient.bind(emitters, state.clients[0], state.sessionName))
                .then(emitters.emitLogonFromClient.bind(emitters, state.clients[1], state.userId2))
                .then(emitters.emitJoinSessionFromClient.bind(emitters, state.clients[1], state.sessionName))
                .then(emitters.emitLogonFromClient.bind(emitters, state.clients[2], state.userId3))
                .then(emitters.emitJoinSessionFromClient.bind(emitters, state.clients[2], state.sessionName))
                .then(function() {
                    var pendingEvents = [state.testListener[1].callbacks.newMessagesReceived, state.testListener[2].callbacks.newMessagesReceived];

                    return helper.socketCallbackHandler(pendingEvents, emitters.emitAddMessageFromClient.bind(emitters, state.clients[0], message1));
                })
                .then(function (callbackResponse) {
                    var result = callbackResponse[1];
                    assert.strictEqual(typeof result.error, "undefined");
                    assert.strictEqual(result.message, message1);
                    helper.isApproximatelyCurrent(result.time);

                    assert.strictEqual(state.testListener[1].calls.newMessagesReceived.length, 1);
                    assert.deepEqual(state.testListener[1].calls.newMessagesReceived[0].messages, [result]);
                    assert.strictEqual(state.testListener[2].calls.newMessagesReceived.length, 1);
                    assert.deepEqual(state.testListener[2].calls.newMessagesReceived[0].messages, [result]);
                })
                .then(function () {
                    var pendingEvents = [state.testListener[0].callbacks.newMessagesReceived, state.testListener[2].callbacks.newMessagesReceived];
                
                    return helper.socketCallbackHandler(pendingEvents, emitters.emitAddMessageFromClient.bind(emitters, state.clients[1], message2));
                })
                .then(function (callbackResponse) {
                    var result = callbackResponse[1];
                    assert.strictEqual(typeof result.error, "undefined");
                    assert.strictEqual(result.message, message2);
                    helper.isApproximatelyCurrent(result.time);
                
                    assert.strictEqual(state.testListener[0].calls.newMessagesReceived.length, 1);
                    assert.deepEqual(state.testListener[0].calls.newMessagesReceived[0].messages, [result]);
                    assert.strictEqual(state.testListener[1].calls.newMessagesReceived.length, 1);
                    assert.strictEqual(state.testListener[2].calls.newMessagesReceived.length, 2);
                    assert.deepEqual(state.testListener[2].calls.newMessagesReceived[1].messages, [result]);
                })
                .done(done, done);
        });

        it("Adding message before joining a session fails", function (done) {
            emitters.emitLogonFromClient(state.clients[0], state.userId1)
                .then(emitters.emitAddMessageFromClient.bind(emitters, state.clients[0], "unauthorized message"))
                .then(function (result) {
                    assert.strictEqual(typeof result.error, "string");
                })
                .done(done, done);
        });

        it("Adding message before logging on fails", function (done) {
            emitters.emitAddMessageFromClient(state.clients[0], "unauthorized message")
                .then(function (result) {
                    assert.strictEqual(typeof result.error, "string");
                })
                .done(done, done);
        });
    });

    describe("with multiple servers", function () {
        before(function (done) {
            helper.resetState();
            var overrideRedisUrl = "localhost";
            config.setSettingFromTest("redisUrl", overrideRedisUrl);
            state.redisClient = redis.createClient(6379, overrideRedisUrl, {});

            helper.initializeServer()
                .then(helper.initializeSecondServer.bind(helper))
                // Give the redis client a moment to initialize
                .then(helper.briefDelay.bind(helper))
                .done(done, done);
        });

        after(function (done) {
            helper.stopServer()
                .then(helper.stopSecondServer.bind(helper))
                .then(function () {
                    config.setSettingFromTest("redisUrl", null);

                    process.env.PORT = constants.devPort;
                    state.redisClient.end();
                })
                .done(done, done);
        });

        beforeEach(function (done) {
            helper.resetTestListener();
            helper.setupClients(true);

            var callbacks = [];
            for (var i = 0; i < state.testListener.length; i++) {
                callbacks.push(state.testListener[i].callbacks.connected);
            }

            // Ignore promise results upon success
            helper.socketCallbackHandler(callbacks)
                .done(function () { done(); }, done);
        });

        it("Adding messages to session", function (done) {
            var message1 = "How are you, Sally?";
            var message2 = "I'm good, I just got back from Mexico!";
            
            emitters.emitLogonFromClient(state.clients[0], state.userId1)
                .then(emitters.emitCreateSessionFromClient.bind(emitters, state.clients[0], state.sessionName))
                .then(emitters.emitLogonFromClient.bind(emitters, state.clients[1], state.userId2))
                .then(emitters.emitJoinSessionFromClient.bind(emitters, state.clients[1], state.sessionName))
                .then(emitters.emitLogonFromClient.bind(emitters, state.clients[2], state.userId3))
                .then(emitters.emitJoinSessionFromClient.bind(emitters, state.clients[2], state.sessionName))
                .then(function () {
                    var pendingEvents = [state.testListener[1].callbacks.newMessagesReceived, state.testListener[2].callbacks.newMessagesReceived];
                
                    return helper.socketCallbackHandler(pendingEvents, emitters.emitAddMessageFromClient.bind(emitters, state.clients[0], message1));
                })
                .then(function (callbackResponse) {
                    var result = callbackResponse[1];
                    assert.strictEqual(typeof result.error, "undefined");
                    assert.strictEqual(result.message, message1);
                    helper.isApproximatelyCurrent(result.time);
                
                    assert.strictEqual(state.testListener[1].calls.newMessagesReceived.length, 1);
                    assert.deepEqual(state.testListener[1].calls.newMessagesReceived[0].messages, [result]);
                    assert.strictEqual(state.testListener[2].calls.newMessagesReceived.length, 1);
                    assert.deepEqual(state.testListener[2].calls.newMessagesReceived[0].messages, [result]);
                })
                .then(function () {
                    var pendingEvents = [state.testListener[0].callbacks.newMessagesReceived, state.testListener[2].callbacks.newMessagesReceived];
                
                    return helper.socketCallbackHandler(pendingEvents, emitters.emitAddMessageFromClient.bind(emitters, state.clients[1], message2));
                })
                .then(function (callbackResponse) {
                    var result = callbackResponse[1];
                    assert.strictEqual(typeof result.error, "undefined");
                    assert.strictEqual(result.message, message2);
                    helper.isApproximatelyCurrent(result.time);
                
                    assert.strictEqual(state.testListener[0].calls.newMessagesReceived.length, 1);
                    assert.deepEqual(state.testListener[0].calls.newMessagesReceived[0].messages, [result]);
                    assert.strictEqual(state.testListener[1].calls.newMessagesReceived.length, 1);
                    assert.strictEqual(state.testListener[2].calls.newMessagesReceived.length, 2);
                    assert.deepEqual(state.testListener[2].calls.newMessagesReceived[1].messages, [result]);
                })
                .done(done, done);
        });
    });
});