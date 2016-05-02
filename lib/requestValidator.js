(function () {
    "use strict";

    var contracts = require("./common/contracts"),
        log = require("./common/log");

    var AUTHORIZATION_TYPE =
    {
        none: "none",
        userId: "userId"
    };

    var SYSTEM_PARAMS = ["userId"];

    var _params = {
        joinSession: {
            required: ["sessionId"],
            clientCallbackRequired: true,
            authorization: AUTHORIZATION_TYPE.userId
        },
        createSession: {
            required: ["sessionId"],
            clientCallbackRequired: true,
            authorization: AUTHORIZATION_TYPE.userId
        },
        addMessage: {
            required: ["newMessage"],
            clientCallbackRequired: true,
            authorization: AUTHORIZATION_TYPE.userId
        },
        logon: {
            required: ["userId"],
            optional: ["deviceId"],
            clientCallbackRequired: true,
            authorization: AUTHORIZATION_TYPE.none
        },
        disconnect: {
            required: [],
            clientCallbackRequired: false,
            authorization: AUTHORIZATION_TYPE.none
        },
    };

    var validate = function (socketInfo, apiName, callingParams, respond) {
        contracts.assertValue(socketInfo);
        contracts.assertNonEmpty(apiName);
        contracts.assertValue(callingParams);

        contracts.assertValue(_params[apiName]);
        var expectedParamList = _params[apiName].required;
        contracts.assertValue(expectedParamList);

        var optionalParamList = _params[apiName].optional || [];

        var missingParams = expectedParamList.slice(0);
        var unexpectedParams = [];

        var validation = { valid: true };
        var errors = [];

        // Determine if the request is authorized
        switch (_params[apiName].authorization) {
            case AUTHORIZATION_TYPE.none:
                break;

            case AUTHORIZATION_TYPE.userId:
                if (!socketInfo.userId) {
                    errors.push("The user is not logged in");
                }
                break;

            default:
                errors.push("Unknown authorization type: " + _params[apiName].authorization);
                break;
        }

        // Determine the list of unexpected parameters
        Object.keys(callingParams).forEach( function (callingParam) {
            var isOptional = optionalParamList.indexOf(callingParam) !== -1;
            var isRequired = expectedParamList.indexOf(callingParam) !== -1;
            contracts.assert(!(isOptional && isRequired),
                callingParam + " for " + apiName + " cannot be both required and optional");

            if (isRequired) {
                missingParams.splice(missingParams.indexOf(callingParam), 1);
            } else if (!isOptional && SYSTEM_PARAMS.indexOf(callingParam) === -1) {
                unexpectedParams.push(callingParam);
                delete callingParams[callingParam];
            }
        });

        if (missingParams.length !== 0) {
            errors.push("The following parameters are missing: " + missingParams.join().replace(",", ", ") + ".");
        }

        if (_params[apiName].clientCallbackRequired && !respond) {
            log.error("requestValidatorError", { info: "No respond callback", apiName: apiName, callingParms: JSON.stringify(callingParams) });
            errors.push("No respond callback for " + apiName);
        }

        if (errors.length > 0) {
            validation.error = errors.join("; ");
            validation.valid = false;
        }

        if (unexpectedParams.length > 0) {
            validation.warning = "The following unexpected parameters were present: " + unexpectedParams.join().replace(",", ", ") + ".";
        }

        return validation;
    };

    module.exports = {
        validate: validate
    };
})();