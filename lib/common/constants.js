(function () {
    "use strict";
    
    module.exports = {
        serverApis: {
            logon: "logon",
            createSession: "createSession",
            joinSession: "joinSession",
            addMessage: "addMessage",
        },

        clientApis: {
            connected: "connected",
            newMessagesReceived: "newMessagesReceived",
        },

        devPort: 8898,
        additionalTestPort: 8899,
    };
})();
