[![Node Version](http://img.shields.io/badge/Node-5.6.0-green.svg)](https://nodejs.org/dist/latest-v5.x/)
[![npm](http://img.shields.io/npm/v/tdl-client.svg?maxAge=2592000)](https://www.npmjs.com/package/tdl-client)
[![Codeship Status for julianghionoiu/tdl-client-nodejs](https://img.shields.io/codeship/f6d0ec40-2c31-0134-f32a-2a45120acafc.svg)](https://codeship.com/projects/163364)
[![Coverage Status](https://coveralls.io/repos/github/julianghionoiu/tdl-client-nodejs/badge.svg?branch=master)](https://coveralls.io/github/julianghionoiu/tdl-client-nodejs?branch=master)

# tdl-client-nodejs

`npm install`

To run the acceptance tests, start the WireMock servers:
```
python wiremock/wiremock-wrapper.py start 41375
python wiremock/wiremock-wrapper.py start 8222
```

And the broker, with:
```
python broker/activemq-wrapper.py start
```

Run tests
```
npm test
```

`npm run example`

If you want to run the Spec file in your IDE you need to pass `-r ./test` to cucumber-js


## To release

`npm login`

`npm config ls`

`npm version [patch|major|minor]`

`npm publish`

Then go to https://www.npmjs.com/~

Other notes:
- the major version needs to be changed in package.json
- the deployment has not been configured to run on the CI server