(function () {
    "use strict";

    function check(condition, param, message) {
        if (!condition) {
            throw new Error("Invalid argument " + param + ": " + (message || ""));
        }
    }

    function checkValue(obj, param, message) {
        check(typeof obj !== "undefined" && obj !== null, param, message);
    }

    function checkNonEmpty(str, param, message) {
        check(typeof str === "string" && str !== "", param, message);
    }

    function checkFunction(fn, param, message) {
        check(typeof fn === "function", param, message);
    }

    function checkNumber(obj, param, message) {
        check(typeof obj === "number", param, message || "Object was not a number.");
    }

    function assert(condition, message) {
        if (!condition) {
            _debugFail(message || "Assert failed.");
        }
    }

    function assertValue(obj, message) {
        if (obj === null || typeof obj === "undefined") {
            _debugFail(message || "Object did not have a value.");
        }
    }

    function assertNonEmptyOrNull(str, message) {
        if (str === null) {
            return;
        }
        assertNonEmpty(str, message);
    }

    function assertNonEmpty(str, message) {
        if (str === null || typeof str === "undefined" || str === "") {
            _debugFail(message || "String was empty.");
        }
    }

    function assertString(obj, message) {
        if (typeof obj !== "string" ) {
            _debugFail(message || "Object was not a string.");
        }
    }

    function assertBoolean(obj, message) {
        if (typeof obj !== "boolean") {
            _debugFail(message || "Object was not a boolean.");
        }
    }

    function assertArray(obj, message) {
        if (!(obj instanceof Array)) {
            _debugFail(message || "Object was not an Array.");
        }
    }

    function assertArrayOrNull(obj, message) {
        if (obj !== null && !(obj instanceof Array)) {
            _debugFail(message || "Object was not an Array or null.");
        }
    }

    function assertObject(value, message) {
        if (value === null || !(value instanceof Object) || value instanceof Array || typeof value === "function") {
            _debugFail(message || "Object was not an Object.");
        }
    }

    function assertObjectOrUndefined(value, message) {
        if (typeof value === "undefined")
            return;
        assertObject(value, message || "Object was not an Object or Undefined.");
    }

    function assertNumber(obj, message) {
        if (typeof obj !== "number") {
            _debugFail(message || "Object was not a number.");
        }
    }

    function assertFunction(obj, message) {
        if (typeof obj !== "function") {
            _debugFail(message || "Object was not a function.");
        }
    }

    function _debugFail (msg) {
        msg = msg || "Unknown error.";
        throw new Error(msg);
    }

    var contracts =  {
        check: check,
        checkValue: checkValue,
        checkNonEmpty: checkNonEmpty,
        checkFunction: checkFunction,
        checkNumber: checkNumber,
        assert: assert,
        assertValue: assertValue,
        assertNonEmpty: assertNonEmpty,
        assertNonEmptyOrNull: assertNonEmptyOrNull,
        assertString: assertString,
        assertBoolean: assertBoolean,
        assertArray: assertArray,
        assertArrayOrNull: assertArrayOrNull,
        assertNumber: assertNumber,
        assertFunction: assertFunction,
        assertObject: assertObject,
        assertObjectOrUndefined: assertObjectOrUndefined,
    };

    module.exports = contracts;
})();
