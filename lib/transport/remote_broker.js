'use strict';

var Stompit = require('stompit');
var Promise = require('promise');

function RemoteBroker(uniqueId){
    this.uniqueId = uniqueId;
    this.channel = {};
}


RemoteBroker.prototype.connect = function (hostname, port) {
    var remoteBroker = this;
    return new Promise(function (fulfill, reject) {
        var connectionManager = new Stompit.ConnectFailover([{
            host: hostname,
            port: port
        }]);
        connectionManager.on('error', function (error) {
            var connectArgs = error.connectArgs;
            var address = connectArgs.host + ':' + connectArgs.port;
            reject(new Error('Could not connect to ' + address + ': ' + error.message));
        });
        connectionManager.on('connecting', function (connector) {
            console.log('Connecting to ' + connector.serverProperties.remoteAddress.transportPath);
        });

        var channelPool = Stompit.ChannelPool(connectionManager);

        channelPool.channel(function (error, channel) {
            if (error) {
                reject(new Error("Connect error" + error.message));
            } else {
                remoteBroker.channel = channel;
                fulfill(remoteBroker)
            }
        })
    });
};

RemoteBroker.prototype.subscribe = function (processingRules) {
    var remoteBroker = this;
    var requestQueue = '/queue/' + this.uniqueId + '.req';

    return new Promise(function (fulfill, reject) {
        remoteBroker.channel.subscribe({
            'destination': requestQueue,
            'ack': 'client-individual',
            'activemq.prefetchSize': 1
        }, function (error, message) {
            if (error) {
                reject(new Error("Subscribe error: " + error.message));
                return;
            }

            message.readString('utf-8', function (error, body) {
                if (error) {
                    reject(new Error('Read message error ' + error.message));
                    return;
                }
                var requestData = JSON.parse(body);
                var request = {
                    originalMessage: message,
                    id: requestData.id,
                    method: requestData.method,
                    params: requestData.params
                };

                var response = processingRules.getResponseFor(request);
                console.log("Response: ", require("util").inspect(response));

                var clientAction = response.clientAction;

                clientAction.afterResponse(remoteBroker, request, response)
                    .then(function (remoteBroker) {
                        clientAction.prepareForNextRequest(remoteBroker)
                    });
            });
        });

        setTimeout(function () {
            fulfill(remoteBroker)
        }, 3000);
    })
};

RemoteBroker.prototype.respondTo = function (request, response) {
    var remoteBroker = this;
    var responseQueue = '/queue/' + this.uniqueId + '.resp';
    var sendHeaders = {
        'destination': responseQueue,
        'content-type': 'text/json'
    };
    var serializedResponse = JSON.stringify(response.asHash());

    return new Promise(function (fulfill, reject) {
        remoteBroker.channel.send(sendHeaders, serializedResponse,
            function (error) {
                if (error) {
                    reject(new Error('Send error ' + error.message));
                    return;
                }

                remoteBroker.channel.ack(request.originalMessage);

                fulfill(remoteBroker);
            });
    });
};

RemoteBroker.prototype.close = function () {
    var remoteBroker = this;
    return new Promise(function (fulfill) {
        console.log("Stopping");
        remoteBroker.channel.close();
        fulfill(remoteBroker)
    });
};

module.exports = RemoteBroker;