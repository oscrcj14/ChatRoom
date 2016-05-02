(function () {
    "use strict";

    var contracts = require("./contracts"),
        log = require("./log"),
        q = require("q");

    function _handleError(apiName, respondCallback, error) {
        contracts.assertNonEmpty(apiName);
        contracts.assertFunction(respondCallback);

        log.error("processRequestError", { error: error, apiName: apiName });

        var errorMessage;
        if (error && error.message) {
            errorMessage = error.message;
        } else {
            errorMessage = "Unknown server error in " + apiName;
        }

        respondCallback({
            error: errorMessage
        });
    }

    // Do shared error/response logic for all apis
    // params:
    //  apiName - name of the api used for reporting errors
    //  res - response object
    //  promiseFunc - function that returns a promise call for which errors will be handled,
    //      or it is successful and produces the response which this method will send back.
    function processRequest(apiName, res, promiseFunc) {
        contracts.assertNonEmpty(apiName);
        contracts.assert(typeof res === "function" || typeof res.json === "function");
        contracts.assertFunction(promiseFunc);

        // Res could be an express respond object or a socket io respond object.
        // Pull out the appropriate method to use for responding either way.
        var isSocket = typeof res.json !== "function";
        var respondMethod = isSocket ? res : res.json.bind(res);

        q().then(promiseFunc)
            .then(function (response) {
                contracts.assertValue(response);
                contracts.assert(typeof response === "object" && !Array.isArray(response), "Response must be a pure object in order to append success information onto it.");

                if (response.error) {
                    log.error("processRequestError", { error: response.error, apiName: apiName });
                }
                respondMethod(response);
            }, function (err) {
                if (!isSocket) { res.status(500); }
                // handle all uncaught errors
                _handleError(apiName, respondMethod, err);
            })
            .done();
    }

    module.exports = {
        processRequest: processRequest,
    };
})();