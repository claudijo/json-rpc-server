# json rpc server

A [JSON-RPC 2.0](http://www.jsonrpc.org/specification) server implementation, which can be used with an arbitrary transport. For corresponding client implementation, see [json-rpc-client](https://github.com/claudijo/json-rpc-client).

> The Server is defined as the origin of Response objects and the handler of Request objects.

## Usage

Create listen function with an arbitrary transport. The listener function will be passed the parameters and a reply function (if the rpc call was a request). The reply function MUST be called with an error as first argument (if errors exist) and the result as second argument (if no errors exist).

The transport object MUST have a `send` method for sending string messages and it MUST have an `on` method for adding `message` event listeners.

### Example

```js
// Channel "interface"
var channel = {
  // Sends the specified string over the wire.
  send: function(json) {
    // ...
  },

  // This method will be called with the string `message` as event and a
  // callback that expects the incoming message payload as a string.
  on: function(event, listener) {
    // ...
  },
};

var listen = require('json-rpc-server')(channel);

// rpc call with positional parameters
// <-- {"jsonrpc": "2.0", "method": "subtract", "params": [42, 23], "id": "generated-uuid"}
listen('subtract', function(params, reply) {
  reply(null, params[0] - params[1]);
});

// rpc call with named parameters which yields an error reply
// <-- {"jsonrpc": "2.0", "method": "divide", "params": {"numerator": 23, "denominator": 0}, "id": "generated-uuid"}
listen('subtract', function(params, reply) {
  if (params.denominator === 0) return reply(new Error('Division by zero'));

  reply(null, params.numerator / params.denominator);
});

// a notification
// <-- {"jsonrpc": "2.0", "method": "log", "params": {"message": "Warming up"}}
listen('log', function(params) {
  console.log(params.message);
});
```

## Test

Run unit tests:

`$ npm test`

Create test coverage report:

`$ npm run-script test-cov`

## License

[MIT](LICENSE)