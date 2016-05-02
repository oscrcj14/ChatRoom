(function () {
    "use strict";

    var contracts = require("./common/contracts");

    // Development config values. Can also override these by setting node environment variables.
    var LOCAL_CONFIG = {
        redisUrl: null,
        redisKey: null,
        redisPort: 6379,
        socketPingInterval: "2000", // In milliseconds
        socketPingTimeout: "10000", // In milliseconds
        fullTestEndpoint1: "http://localhost:8898",
        fullTestEndpoint2: "http://localhost:8899",
        fullTestOperationTimeout: "10000",
    };

    var getSetting = function (key) {
        contracts.assertNonEmpty(key);

        if (typeof process.env[key] !== "undefined")
            return process.env[key];
        else if (typeof LOCAL_CONFIG[key] !== "undefined")
            return LOCAL_CONFIG[key];
        else
            contracts.assert(false, "Tried to get missing config setting: " + key);
    };

    var setSetting = function (key, value) {
        contracts.assertNonEmpty(key);

        LOCAL_CONFIG[key] = value;
    };

    module.exports = {
        getSetting: getSetting,
        // Used as the api version number
        API_VERSION: "v1",
        // Only intended for tests!
        setSettingFromTest: setSetting,
    };
})();
