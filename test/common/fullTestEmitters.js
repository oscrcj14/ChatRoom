(function () {
    "use strict";

    var IMPORT_PREFIX = "../" + require("../config").IMPORT_PREFIX;

    var constants = require(IMPORT_PREFIX + "common/constants"),
        q = require("q");

    var FullTestEmitters = function (helper) {
        this._helper = helper;
        this._state = helper.state;
    };

    var createEmitPromise = function (client, event, data) {
        var deferred = q.defer();
        client.emit(event, data, function (serverData) {
            deferred.resolve(serverData);
        });
        return deferred.promise;
    };

    FullTestEmitters.prototype.emitLogonFromClient = function (client, userId) {
        return createEmitPromise(client, constants.serverApis.logon, { userId: userId });
    };
    
    FullTestEmitters.prototype.emitCreateSessionFromClient = function (client, sessionId) {
        return createEmitPromise(client, constants.serverApis.createSession, { sessionId: sessionId });
    };
    
    FullTestEmitters.prototype.emitJoinSessionFromClient = function (client, sessionId) {
        return createEmitPromise(client, constants.serverApis.joinSession, { sessionId: sessionId });
    };

    FullTestEmitters.prototype.emitAddMessageFromClient = function (client, message) {
        return createEmitPromise(client, constants.serverApis.addMessage, { newMessage: message });
    };

    module.exports = FullTestEmitters;
})();
