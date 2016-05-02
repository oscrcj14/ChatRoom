"use strict";

module.exports = {
    reporter: function (responses) {

        responses.forEach(function (response) {
            var error = response.error;
            var errorMessage = response.file + "[" + error.line + "," + error.character + "]: error " + error.code + "-" + error.reason;
            console.log(errorMessage);
        });
        
        console.log("JSHint: " + responses.length + " errors" );
    }
};
