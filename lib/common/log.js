(function () {
    "use strict";

    var _ = require("underscore");
    var contracts = require("./contracts");
    var winston = require("winston");
    require("winston-loggly");

    // Expose functionality from this module under logManager namespace.
    var logManager = exports;

    // We use the following log levels, which are the same as npm log-levels except we ignored
    // the silly one.
    Object.defineProperty(logManager, "levels", {
        get: function () {
            return {
                //silly: 0,
                debug: 1,
                verbose: 2,
                info: 3,
                warn: 4,
                error: 5
            };
        },
        enumerable: true,
        configurable: false
    });

    var Logger = function (filename) {
        this.logger = new winston.Logger();
        this.logger.add(winston.transports.File, {
            filename: filename,
            level: "info",
            maxsize: 10485760 /* 10 MB */,
            maxFiles: 1000 /* 10 GB */
        });

        this.isOn = true;
    };

    // Setting log "level" causes all log statements below that level to be ignored.
    Object.defineProperty(Logger.prototype, "level", {
        get: function () {
            return logManager.levels[this.logger.level];
        },
        set: function (val) {
            // Fetch the key as a string.
            var level = _.invert(logManager.levels)[val];

            var self = this;
            self.logger.level = level;
            Object.keys(self.logger.transports).forEach(function (key) {
                self.logger.transports[key].level = level;
            });
        },
        enumerable: true,
        configurable: true
    });

    Logger.prototype.debug = function () {
        return this.logger.debug.apply(this.logger, logManager._formatLog(arguments));
    };

    Logger.prototype.verbose = function () {
        return this.logger.verbose.apply(this.logger, logManager._formatLog(arguments));
    };

    Logger.prototype.info = function () {
        return this.logger.info.apply(this.logger, logManager._formatLog(arguments));
    };

    Logger.prototype.warn = function () {
        return this.logger.warn.apply(this.logger, logManager._formatLog(arguments));
    };

    Logger.prototype.error = function () {
        return this.logger.error.apply(this.logger, logManager._formatLog(arguments));
    };

    Logger.prototype.query = function (startTime, callback) {
        var options = {
            from: startTime,
            until: new Date().getTime(),
            limit: 10000,
            start: 0,
            order: "asc",
            fields: ["message", "timestamp"]
        };

        return this.logger.query.apply(this.logger, [options, callback]);
    };

    Logger.prototype.on = function () {
        if (this.isOn)
            return;

        var self = this;
        Object.keys(self.logger.transports).forEach(function (key) {
            self.logger.transports[key].silent = false;
        });

        this.isOn = true;
    };

    Logger.prototype.off = function () {
        if (!this.isOn)
            return;

        var self = this;
        Object.keys(self.logger.transports).forEach(function (key) {
            self.logger.transports[key].silent = true;
        });

        this.isOn = false;
    };

    Logger.prototype.enableConsoleLog = function () {
        this.logger.add(winston.transports.Console);
    };

    Logger.prototype.disableConsoleLog = function () {
        this.logger.remove(winston.transports.Console);
    };

    Logger.prototype.enableLoggly = function () {
        this.logger.add(winston.transports.Loggly, {
            inputToken: "18b43fbc-ae40-495d-952d-4a201fa3bd82",
            subdomain: "playground",
            json: true
        });
    };

    Logger.prototype.disableLoggly = function () {
        this.logger.remove(winston.transports.Loggly);
    };

    // Expose default logger, so apps can use logging without having to create an instance.
    var defaultLogger = new Logger("app.log");

    var methods = [
        "debug",
        "verbose",
        "info",
        "warn",
        "error",
        "on",
        "off",
        "enableConsoleLog",
        "disableConsoleLog",
        "enableLoggly",
        "disableLoggly",
        "query",
    ];

    methods.forEach(function (method) {
        logManager[method] = function () {
            return Logger.prototype[method].apply(defaultLogger, arguments);
        };
    });

    Object.defineProperty(logManager, "level", {
        get: function () {
            return defaultLogger.level;
        },
        set: function (val) {
            defaultLogger.level = val;
        },
        enumerable: true,
        configurable: false
    });

    // Support a global activity id (guid), similar to .net
    logManager.activityId = null;

    // Apps can create additional loggers..
    logManager.Logger = Logger;

    // The formatLog function is defined as:
    // _formatLog(
    //      eventName   /* string, required */
    //      meta        /* This can be anything, null, string, array, object. If it is an Error object, special processing is performed. */
    //      callback    /* function, optional. callback function used by winston */
    // )
    // This is an attempt to keep logging complex objects as simple as possible.
    // If meta is not an object, then it is logged as { meta: meta.toString() }. Null and undefined are ignored.
    // The meta object is a one level object with the exception of an error object.

    // Simple Example: meta = { test: "1 2 3" }
    // This will be logged as { test: "1 2 3" }

    // Two objects: meta = { test1: "123", test2: "456" }
    // This will be logged as { test1: "123", test2: "456" }

    // Error object: meta = new Error("Testing")
    // This will be logged as { error: error, errorMessage: "Testing", stack: "- execution stack -" }

    // Error object: meta = { error: new Error("Testing"), additional: "123", data: "456" }
    // This will be logged as { error: error, errorMessage: "Testing", stack: "- execution stack -", additional: "123", data: "456" }

    // Examples of invalid meta:
    // { err1: new Error(), err2: new Error() }         // Two error objects would cause conflicting key names
    // { first: { second: { third: "bad" } } }          // More then 1 level deep
    // { error: new Error(), stack: "my stack" }        // Conflicting key names

    logManager._formatLog = function (args) {
        contracts.assertValue(args);

        args = Array.prototype.slice.call(args);

        var eventName = args[0];
        contracts.assertString(eventName, "An event name must be supplied");

        if (typeof eventName !== "string")
            eventName = "Unknown error";

        var callback = typeof args[args.length - 1] === "function" ? args.pop() : null;

        contracts.assert(args.length <= 2, "Only two parameters plus function are allowed");
        var meta = args[1];

        var logObject = {};
        if (meta !== null && typeof meta !== "undefined") {
            if (meta instanceof Object && !(meta instanceof Array)) {
                logObject = parseMeta(meta);
            } else {
                logObject = { meta: meta.toString() };
            }
        }
        logObject.message = eventName;

        if (logManager.activityId !== null) {
            logObject.activityId = logManager.activityId;
        }

        var newArgs = [];
        newArgs.push(eventName);
        newArgs.push(logObject);

        if (callback)
            newArgs.push(callback);

        return newArgs;
    };

    function parseMeta(meta) {
        contracts.assertValue(meta);

        var logObject = {};
        if (isErrorObject(meta)) {
            logObject.error = meta;
            logObject.errorMessage = meta.message;
            logObject.stack = meta.stack;
        } else {
            for (var key in meta) {
                contracts.assert(!(key in logObject), "The key: " + key + " is already defined. It will be overwritten");

                if (isErrorObject(meta[key])) {
                    contracts.assert(!("errorMessage" in logObject), "The key: errorMessage is already defined. It will be overwritten");
                    contracts.assert(!("stack" in logObject), "The key: stack is already defined. It will be overwritten");
                    contracts.assert(!("error" in logObject), "The key: error is already defined. It will be overwritten");

                    logObject.error = meta[key];
                    logObject.errorMessage = meta[key].message;
                    logObject.stack = meta[key].stack;
                } else {
                    // We only support one level.
                    if (meta[key] instanceof Object || meta[key] instanceof Array)
                        logObject[key] = JSON.stringify(meta[key]);
                    else
                        logObject[key] = meta[key];
                }
            }
        }
        return logObject;
    }

    function isErrorObject(errObject) {
        // errObject can be anything including null or undefined.

        if (errObject === null || typeof errObject !== "object" || errObject.name !== "Error")
            return false;

        // Error objects are not discoverable. If we can't find properties then it's an Error object.
        for (var key in errObject) {
            // If this is an actual Error object, the name property won't be discoverable.
            if (key === "name")
                return false;
            return true;
        }

        return true;
    }

})();
