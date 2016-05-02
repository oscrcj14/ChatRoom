(function() {
    "use strict";

    var config = require("./config"),
        constants = require("./common/constants"),
        contracts = require("./common/contracts"),
        log = require("./common/log"),
        q = require("q"),
        redis = require("redis"),
        requestProcessing = require("./common/requestProcessing.js"),
        requestValidator = require("./requestValidator"),
        io = require("socket.io"),
        socketRedis = require("socket.io-redis"),
        socketManagerGenerator = require("./common/socketManager");

    var create = function () {
        // Set up private state
        var _pub, _sub, _socketListener, _socketManager;

        var registerEvent = function (socket, event, summaryFields, callback) {
            contracts.assertValue(socket);
            contracts.assertNonEmpty(event);
            contracts.assertArrayOrNull(summaryFields);
            contracts.assertFunction(callback);

            socket.on(event, function (data, respond) {
                // For some events there is no respond method.
                // These are non-client initiated events such as disconnect.
                var innerRespond = respond || function () {};
                var validation = {};
                
                // Standardize input data
                data = data || {};
                data = typeof data === "object" ? data : { data: data };

                requestProcessing.processRequest(event, innerRespond, function () {
                    validation = requestValidator.validate(socket.socketInfo, event, data, respond);
                    if (!validation.valid) {
                        return q({ error: validation.error });
                    }

                    // Place the userId onto the calling params if the user is logged on, so we don't have to pass the socket everywhere
                    data.userId = data.userId || socket.socketInfo.userId;

                    var currentSummaryFields = summaryFields || Object.keys(data);
                    var summaryObj = {};
                    for (var i = 0; i < currentSummaryFields.length; i++) {
                        var field = currentSummaryFields[i];
                        summaryObj[field] = data[field];
                    }

                    summaryObj.message = event;
                    data.message = event;
                    log.info(summaryObj.message, summaryObj);
                    log.verbose(data.message, data);

                    return q()
                        .then(function () {
                            return callback(data);
                        })
                        .then(function (response) {
                            contracts.assertValue(response);

                            if (typeof response === "object") {
                                response.warning = validation.warning;
                            }

                            return response;
                        });
                });
            });
        };

        var closeSockets = function () {
            _socketListener.close();

            if (_pub)
                _pub.end();

            if (_sub)
                _sub.end();
        };

        var initializeSockets = function(server) {
            contracts.assertValue(server);

            // If these values are not parsed to numbers, weird bugs occur in socket.io,
            // such as 'disconnect' messages not coming through for websockets.
            var socketPingInterval = parseInt(config.getSetting("socketPingInterval"), 10);
            var socketPingTimeout = parseInt(config.getSetting("socketPingTimeout"), 10);
            contracts.assertNumber(socketPingInterval);
            contracts.assertNumber(socketPingTimeout);
            var ioOptions = {
                // Frequency of ping heartbeat for each socket
                pingInterval: socketPingInterval,
                // Time with no client heartbeat before we assume 'disconnect'
                pingTimeout: socketPingTimeout,
                // Path to socket.io endpoint
                path: "/" + config.API_VERSION + "/socket.io"
            };

            _socketListener = io.listen(server, ioOptions);

            _socketManager = socketManagerGenerator.create();

            var redisUrl = config.getSetting("redisUrl");
            var redisPort = config.getSetting("redisPort");
            // For local dev environments we will not support scale
            if (redisUrl) {
                if (!_pub && !_sub) {
                    var options = { return_buffers: true };
                    var redisKey = config.getSetting("redisKey");
                    if (redisKey) {
                        options.auth_pass = redisKey;
                    }

                    _pub = redis.createClient(redisPort, redisUrl, options);
                    _sub = redis.createClient(redisPort, redisUrl, options);
                }
                _socketListener.adapter(socketRedis({ pubClient: _pub, subClient: _sub }));
            }

            _registerApis();
        };
        
        var _registerApis = function () {
            _socketListener.sockets.on("connection", function (socket) {
                contracts.assertValue(socket);

                socket.conn.on("close", function (reason, desc) {
                    log.info("socketClosed", { reason: reason, desc: desc });
                });

                socket.emit(constants.clientApis.connected, { success: true });
                var handshake = socket.handshake;
                log.verbose(constants.clientApis.connected, {
                    ip: handshake.address,
                    userAgent: handshake.headers["user-agent"]
                });

                socket.socketInfo = {};

                registerEvent(socket, "disconnect", ["userId"], function (data) {
                    contracts.assertValue(data);
                    
                    log.info("socketDisconnected", { userId: socket.socketInfo ? socket.socketInfo.userId : null, socketId: socket.id });

                    _socketManager.deleteUserSocket(socket);

                    return q({});
                });

                registerEvent(socket, constants.serverApis.logon, ["userId", "deviceId"], function (data) {
                    contracts.assertValue(data);

                    socket.socketInfo.userId = data.userId;

                    return q({});
                });

                registerEvent(socket, constants.serverApis.createSession, ["userId", "sessionId"], function (data) {
                    contracts.assertValue(data);
                    
                    // Eventually, would like to have this store to persistent state, too, to allow reloading a conversation later.
                    // At that time will need to validate that this name is not already taken.
                    return _socketManager.setUserSession(socket, data.sessionId)
                        .then(function () {
                            return {};
                        });
                });

                registerEvent(socket, constants.serverApis.joinSession, ["userId", "sessionId"], function (data) {
                    contracts.assertValue(data);

                    return _socketManager.setUserSession(socket, data.sessionId)
                        .then(function () {
                        return {};
                    });
                });

                registerEvent(socket, constants.serverApis.addMessage, ["newMessage"], function (data) {
                    contracts.assertValue(data);

                    if (!socket.socketInfo.sessionId) {
                        throw new Error("User must create or join a session before adding messages");
                    }

                    return q()
                        .then(function () {
                            var newMessage = { message: data.newMessage, time: new Date().getTime() };
                            _socketManager.notifyUsersOfNewMessages(socket.socketInfo.sessionId, newMessage, socket);
                            return newMessage;
                        });
                });
            });
        };

        return {
            close: closeSockets,
            initialize: initializeSockets,
        };
    };

    module.exports = { create: create };
})();