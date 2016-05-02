(function () {
    "use strict";
    
    var constants = require("./constants"),
        contracts = require("./contracts"),
        log = require("./log"),
        q = require("q");
    
    // Socket Room Types
    // --------------------
    // Socket ID - Socket.io automatically puts all new sockets into a room of the socket id.
    // Session ID - When a socket joins a session it will be put into a room for that session, so as to receive any session-specific messages.
    
    var create = function () {
        var deleteUserSocket = function (socket) {
            contracts.assertValue(socket);
            
            // Socket.io will handle removing this socket from any rooms.

            socket.socketInfo = null;
        };
        
        var setUserSession = function (socket, sessionId) {
            contracts.assertValue(socket);
            contracts.assertNonEmpty(socket.socketInfo.userId);
            contracts.assertValue(sessionId);
            
            return q()
                .then(function () {
                    // Leave the current room, if any, before joining another.
                    return socket.socketInfo.sessionId ? unsetUserSession(socket, socket.socketInfo.sessionId) : q();
                })
                .then(function () {
                    var deferred = q.defer();
                    socket.socketInfo.sessionId = sessionId;
                
                    // Join new session room
                    socket.join(sessionId, function (error) {
                        if (error) {
                            deferred.reject(error);
                            log.error("joinNewSessionRoomError", { error: error, sessionId: sessionId });
                        } else {
                            deferred.resolve();
                        }
                    });

                    return deferred;
                })
                .then(function () {
                    log.info("joinedSession", { userId: socket.socketInfo.userId, sessionId: sessionId });
                });
            };
        
        var unsetUserSession = function (socket, sessionId) {
            contracts.assertValue(socket);
            contracts.assertValue(sessionId);
            contracts.assertArray(socket.rooms);
            contracts.assertValue(socket.socketInfo);
            contracts.assertNonEmpty(socket.socketInfo.userId);
            
            socket.socketInfo.sessionId = null;

            var deferred = q.defer();

            // Leave current session room, if exists
            socket.leave(sessionId, function (error) {
                if (error) {
                    log.error("unsetUserDeviceSessionError", error);
                } else {
                    log.info("leftRoom", {
                        roomId: sessionId,
                        userId: socket.socketInfo.userId
                    });
                }
                deferred.resolve();
            });

            return deferred.promise;
        };

        var notifyUsersOfNewMessages = function (sessionId, message, socket) {
            contracts.assertNonEmpty(sessionId);
            contracts.assertNonEmpty(message);
            contracts.assertValue(socket);

            socket.to(sessionId).emit(constants.clientApis.newMessagesReceived, { messages: [message] });
            log.info(constants.clientApis.newMessagesReceived, { userId: socket.socketInfo.userId, sessionId: sessionId });
        };

        return {
            setUserSession: setUserSession,
            notifyUsersOfNewMessages: notifyUsersOfNewMessages,
            deleteUserSocket: deleteUserSocket,
        };
    };

    module.exports = { create: create };
})();