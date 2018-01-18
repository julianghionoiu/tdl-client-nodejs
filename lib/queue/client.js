'use strict';

var Promise = require('promise');

var RemoteBroker = require('./transport/remote_broker');
var AuditStream = require('../audit/audit_stream');

function Client(opts){
    this.hostname = opts.hostname;
    this.port = opts.port || 61613;
    this.uniqueId = opts.uniqueId;
    this.requestTimeoutMillis = opts.requestTimeoutMillis || 500;
}

Client.prototype.getRequestTimeoutMillis = function () {
    var client = this;
    return new Promise(function (fulfill) {
        fulfill(client.requestTimeoutMillis)
    });
};

Client.prototype.goLiveWith = function (processingRules) {
    var client = this;
    return new RemoteBroker(client.uniqueId).connect(client.hostname, client.port)
        .then(function (remoteBroker) {
            console.log("Starting client.");
            return remoteBroker.subscribeAndProcess(new ApplyProcessingRules(processingRules), client.requestTimeoutMillis);
        })
        .then(function (remoteBroker) {
            console.log("Stopping client.");
            return remoteBroker.close()
        }).catch(function (error) {
            console.error("There was a problem processing messages. " + error.message);
            console.error(error.stack)
        });
};

//~~~~ Queue handling policies

function ApplyProcessingRules(processingRules) {
    this.processingRules = processingRules;
    this.audit = new AuditStream();
}

ApplyProcessingRules.prototype.processNextRequestFrom = function (remoteBroker, request) {
    var audit = this.audit;
    audit.startLine();
    audit.log(request);

    // Obtain response from user
    var response = this.processingRules.getResponseFor(request);
    audit.log(response);

    // Obtain action
    var clientAction = response.clientAction;
    audit.log(clientAction);

    // Act
    return Promise.resolve(remoteBroker)
        .then(function (remoteBroker) {
            return clientAction.afterResponse(remoteBroker, request, response)
        })
        .then(function (remoteBroker) {
            audit.endLine();
            return clientAction.prepareForNextRequest(remoteBroker)
        });
};

// ~~~~ Utils

String.prototype.isEmpty = function() {
    return (this.length === 0 || !this.trim());
};

module.exports = Client;