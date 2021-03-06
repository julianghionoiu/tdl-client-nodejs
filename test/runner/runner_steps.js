"use strict";

var assert = require('chai').assert;
var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');

var TDL = require('../..');
var WiremockProcess = require('./wiremock_process');
var TestActionProvider = require('./test_action_provider');
var TestAuditStream = require('./test_audit_stream');
var NoisyImplementationRunner = require('../queue/runners/noisy_implementation_runner');
var QuietImplementationRunner = require('../queue/runners/quiet_implementation_runner');

var workingDirectory = './';

module.exports = function () {

    this.Given(/^There is a challenge server running on "(.*)" port (.*)$/, function (hostname, port, callback) {
        var world = this;

        world.challengeHostname = hostname;
        world.challengePort = port;

        world.challengeServerStub = new WiremockProcess(hostname, port);
        world.challengeServerStub
            .reset()
            .then(callback);
    });

    this.Given(/^There is a recording server running on "(.*)" port (.*)$/, function (hostname, port, callback) {
        var world = this;

        world.recordingServerStub = new WiremockProcess(hostname, port);
        world.recordingServerStub
            .reset()
            .then(callback);
    });

    this.Given(/^the challenge server exposes the following endpoints$/, function (table, callback) {
        var world = this;

        table.hashes()
            .reduce(function (prev, serverConfig) {
                return prev.then(function () {
                    return world.challengeServerStub.createNewMapping(serverConfig);
                });
            }, Promise.resolve())
            .then(callback);
    });

    this.Given(/^the recording server exposes the following endpoints$/, function (table, callback) {
        var world = this;

        table.hashes()
            .reduce(function (prev, serverConfig) {
                return prev.then(function () {
                    return world.recordingServerStub.createNewMapping(serverConfig);
                });
            }, Promise.resolve())
            .then(callback);
    });

    this.Given(/^journeyId is "(.*)"$/, function (journeyId, callback) {
        var world = this;

        world.journeyId = journeyId;

        callback();
    });

    this.Given(/^the action input comes from a provider returning "(.*)"$/, function (s, callback) {
        TestActionProvider.set(s);
        callback();
    });

    this.Given(/^the challenges folder is empty$/, function (callback) {
        var challengesPath = path.join(workingDirectory, 'challenges');
        rimraf(challengesPath, callback);
    });

    this.Given(/^there is an implementation runner that prints "(.*)"$/, function (s, callback) {
        var world = this;

        world.implementationRunnerMessage = s;
        world.implementationRunner = new NoisyImplementationRunner(s);

        callback();
    });

    this.Given(/^recording server is returning error$/, function (callback) {
        var world = this;

        world.recordingServerStub
            .reset()
            .then(callback);
    });

    this.Given(/^the challenge server returns (\d+), response body "(.*)" for all requests$/, function (returnCode, body, callback) {
        var world = this;

        world.challengeServerStub
            .createNewMapping({
                endpointMatches: '^(.*)',
                status: returnCode,
                verb: 'ANY',
                responseBody: body
            })
            .then(callback);
    });

    this.Given(/^the challenge server returns (\d+) for all requests$/, function (returnCode, callback) {
        var world = this;

        world.challengeServerStub
            .createNewMapping({
                endpointMatches: '^(.*)',
                status: returnCode,
                verb: 'ANY'
            })
            .then(callback);
    });

    this.When(/^user starts client$/, function (callback) {
        var world = this;

        world.auditStream = new TestAuditStream();

        var config = TDL.ChallengeSessionConfig
            .forJourneyId(world.journeyId)
            .withServerHostname(world.challengeHostname)
            .withPort(world.challengePort)
            .withColours(true)
            .withAuditStream(world.auditStream)
            .withRecordingSystemShouldBeOn(true)
            .withWorkingDirectory(workingDirectory);

        var runner = world.implementationRunner || new QuietImplementationRunner();
        runner.setAuditStream(world.auditStream);

        TDL.ChallengeSession
            .forRunner(runner)
            .withConfig(config)
            .withActionProvider(TestActionProvider)
            .start()
            .then(callback);
    });

    this.Then(/^the server interaction should look like:$/, function (expectedOutput, callback) {
        var world = this;

        var total = world.auditStream.getLog();
        assert.isTrue(total.indexOf(expectedOutput) !== -1, 'Expected string is not contained in output');
        callback();
    });

    this.Then(/^the file "(.*)" should contain$/, function (file, text, callback) {
        var fileFullPath = path.join(workingDirectory, file);

        var fileContent = fs.readFileSync(fileFullPath, 'utf8');
        text = text.replace(/\n$/, '');

        assert.equal(fileContent, text, 'Contents of the file is not what is expected');

        callback();
    });

    this.Then(/^the recording system should be notified with "(.*)"$/, function (expectedOutput, callback) {
        var world = this;

        world.recordingServerStub.verifyEndpointWasHit('/notify', 'POST', expectedOutput).then(function (wasHit) {
            assert.isTrue(wasHit);
            callback();
        });
    });

    this.Then(/^the recording system should have received a stop signal$/, function (callback) {
        var world = this;

        world.recordingServerStub.verifyEndpointWasHit('/stop', 'POST', "").then(function (wasHit) {
            assert.isTrue(wasHit);
            callback();
        });
    });

    this.Then(/^the implementation runner should be run with the provided implementations$/, function (callback) {
        var world = this;

        var total = world.auditStream.getLog();
        assert.isTrue(total.indexOf(world.implementationRunnerMessage) !== -1);
        callback();
    });

    this.Then(/^the server interaction should contain the following lines:$/, function (expectedOutput, callback) {
        var world = this;

        var total = world.auditStream.getLog();
        var lines = expectedOutput.split('\n');
        lines.forEach(function (line) {
            assert.isTrue(total.indexOf(line) !== -1, 'Expected string is not contained in output');
        });
        callback();
    });

    this.Then(/^the client should not ask the user for input$/, function (callback) {
        var world = this;

        var total = world.auditStream.getLog();
        assert.isTrue(total.indexOf('Selected action is:') === -1);
        callback();
    });
};
