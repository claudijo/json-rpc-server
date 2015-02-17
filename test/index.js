var assert = require('assert');
var server = require('..');

describe('json rpc server', function() {
  var listen;
  var channel;

  beforeEach(function() {
    channel = {
      _listeners: {},

      send: function(json) {
        throw new Error('Method "send" not implemented');
      },

      on: function(event, listener) {
        this._listeners[event] = listener;
      },

      _receive: function(event, data) {
        this._listeners[event] && this._listeners[event].call(null, data);
      }
    };

    listen = server(channel);
  });

  it('should send response with json rpc version', function(done) {
    listen('subtract', function(params, reply) {
      reply(null, params[0] - params[1]);
    });

    channel._receive('message', '{"jsonrpc": "2.0", "method": "subtract", "params": [42, 23], "id": 1}');

    channel.send = function(json) {
      var data = JSON.parse(json);
      assert(data.jsonrpc === '2.0');
      done();
    }
  });

  it('should send response with result to request with positional parameters', function(done) {
    listen('subtract', function(params, reply) {
      reply(null, params[0] - params[1]);
    });

    channel._receive('message', '{"jsonrpc": "2.0", "method": "subtract", "params": [42, 23], "id": 1}');

    channel.send = function(json) {
      var data = JSON.parse(json);
      assert(data.result === 19);
      done();
    }
  });

  it('should send response with result to request with named parameters', function(done) {
    listen('subtract', function(params, reply) {
      reply(null, params.minuend - params.subtrahend);
    });

    channel._receive('message', '{"jsonrpc": "2.0", "method": "subtract", "params": {"subtrahend": 23, "minuend": 42}, "id": 3}');

    channel.send = function(json) {
      var data = JSON.parse(json);
      assert(data.result === 19);
      done();
    }
  });

  it('should send response with id', function(done) {
    listen('subtract', function(params, reply) {
      reply(null, params[0] - params[1]);
    });

    channel._receive('message', '{"jsonrpc": "2.0", "method": "subtract", "params": [42, 23], "id": 1}');

    channel.send = function(json) {
      var data = JSON.parse(json);
      assert(data.id === 1);
      done();
    }
  });

  it('should not be possible to reply to a notification', function(done) {
    listen('notify_sum', function(params, reply) {
      assert(typeof reply === 'undefined');
      done();
    });

    channel._receive('message', '{"jsonrpc": "2.0", "method": "notify_sum", "params": [1,2,4]}');
  });

  it('should send response without error', function(done) {
    listen('subtract', function(params, reply) {
      reply(null, params[0] - params[1]);
    });

    channel._receive('message', '{"jsonrpc": "2.0", "method": "subtract", "params": [42, 23], "id": 1}');

    channel.send = function(json) {
      var data = JSON.parse(json);

      assert(typeof data.error === 'undefined');
      done();
    }
  });

  it('should send parse error if request is invalid json', function(done) {
    listen('subtract', function(params, reply) {
      reply(null, params[0] - params[1]);
    });

    channel._receive('message', '{"jsonrpc": "2.0", "method": "foobar, "params": "bar", "baz]');

    channel.send = function(json) {
      var data = JSON.parse(json);

      assert(data.error.code === -32700);
      assert(data.error.message === 'Parse error');
      done();
    }
  });

  it('should send parse error if batch request is invalid json', function(done) {
    listen('subtract', function(params, reply) {
      reply(null, params[0] - params[1]);
    });

    channel._receive('message', '[' +
    '{"jsonrpc": "2.0", "method": "sum", "params": [1,2,4], "id": "1"},' +
    '{"jsonrpc": "2.0", "method"' +
    ']');

    channel.send = function(json) {
      var data = JSON.parse(json);

      assert(data.error.code === -32700);
      assert(data.error.message === 'Parse error');
      done();
    }
  });

  it('should send invalid request error if method is not a string', function(done) {
    listen('subtract', function(params, reply) {
      reply(null, params[0] - params[1]);
    });

    channel._receive('message', '{"jsonrpc": "2.0", "method": 1, "params": "bar"}');

    channel.send = function(json) {
      var data = JSON.parse(json);

      assert(data.error.code === -32600);
      assert(data.error.message === 'Invalid Request');
      done();
    }
  });

  it('should send invalid request error if request is empty array', function(done) {
    listen('subtract', function(params, reply) {
      reply(null, params[0] - params[1]);
    });

    channel._receive('message', '[]');

    channel.send = function(json) {
      var data = JSON.parse(json);

      assert(data.error.code === -32600);
      assert(data.error.message === 'Invalid Request');
      done();
    }
  });

  it('should send invalid request error if request is invalid batch (but not empty)', function(done) {
    listen('subtract', function(params, reply) {
      reply(null, params[0] - params[1]);
    });

    channel._receive('message', '[1]');

    channel.send = function(json) {
      var data = JSON.parse(json);

      assert(data[0].error.code === -32600);
      assert(data[0].error.message === 'Invalid Request');
      done();
    }
  });

  it('should send invalid request error if request is invalid batch', function(done) {
    listen('subtract', function(params, reply) {
      reply(null, params[0] - params[1]);
    });

    channel._receive('message', '[1, 2, 3]');

    channel.send = function(json) {
      var data = JSON.parse(json);

      assert(data[0].error.code === -32600);
      assert(data[0].error.message === 'Invalid Request');

      assert(data[1].error.code === -32600);
      assert(data[1].error.message === 'Invalid Request');

      assert(data[2].error.code === -32600);
      assert(data[2].error.message === 'Invalid Request');

      done();
    }
  });

  it('should send method not found error if method is not handled by server', function(done) {
    channel._receive('message', '{"jsonrpc": "2.0", "method": "foobar", "id": "1"}');

    channel.send = function(json) {
      var data = JSON.parse(json);
      assert(data.error.code === -32601);
      assert(data.error.message === 'Method not found');
      assert(data.id === '1');
      done();
    }
  });

  it('should send both errors and responses if batch contains both valid and invalid requests', function(done) {
    listen('subtract', function(params, reply) {
      reply(null, params[0] - params[1]);
    });

    listen('sum', function(params, reply) {
      var sum = 0;
      params.forEach(function(param) {
        sum += param;
      });
      reply(null, sum);
    });

    listen('get_data', function(params, reply) {
      reply(null, ['hello', 5]);
    });

    listen('notify_hello', function(params) {});

    channel._receive('message', '[' +
    '{"jsonrpc": "2.0", "method": "sum", "params": [1,2,4], "id": "1"},' +
    '{"jsonrpc": "2.0", "method": "notify_hello", "params": [7]},' +
    '{"jsonrpc": "2.0", "method": "subtract", "params": [42,23], "id": "2"},' +
    '{"foo": "boo"},' +
    '{"jsonrpc": "2.0", "method": "foo.get", "params": {"name": "myself"}, "id": "5"},' +
    '{"jsonrpc": "2.0", "method": "get_data", "id": "9"}' +
    ']');

    channel.send = function(json) {
      var data = JSON.parse(json);

      assert(data[0].result === 7);
      assert(data[0].id === '1');

      assert(data[1].result === 19);
      assert(data[1].id === '2');

      assert(data[2].error.code === -32600);
      assert(data[2].error.message === 'Invalid Request');
      assert(data[2].id === null);

      assert(data[3].error.code === -32601);
      assert(data[3].error.message === 'Method not found');
      assert(data[3].id === '5');

      assert(data[4].result[0] === 'hello');
      assert(data[4].result[1] === 5);
      assert(data[4].id === '9');

      done();
    }
  });

  it('should not send any response if batch contains all notifications', function(done) {
    var callCount = 0;

    listen('notify_sum', function(params, reply) {});
    listen('notify_hello', function(params, reply) {});

    channel._receive('message', '[' +
    '{"jsonrpc": "2.0", "method": "notify_sum", "params": [1,2,4]},' +
    '{"jsonrpc": "2.0", "method": "notify_hello", "params": [7]}' +
    ']');

    channel.send = function(json) {
      callCount += 1;
    };

    setTimeout(function() {
      assert(callCount === 0);
      done();
    }, 0);
  });

  it('should respond with internal errors for requests if handler throws', function(done) {
    listen('subtract', function(params, reply) {
      throw new Error('Boom');
    });

    channel._receive('message', '{"jsonrpc": "2.0", "method": "subtract", "params": [42, 23], "id": 1}');

    channel.send = function(json) {
      var data = JSON.parse(json);
      assert(data.error.code === -32603);
      assert(data.error.message === 'Internal error');
      assert(data.id === 1);
      done();
    };
  });

  it('should not respond with internal errors for notification if handler throws', function(done) {
    var callCount = 0;

    listen('subtract', function(params) {
      throw new Error('Boom');
    });

    channel._receive('message', '{"jsonrpc": "2.0", "method": "subtract", "params": [42, 23]}');

    channel.send = function(json) {
      console.log('GOT', json);
      callCount += 1;
    };

    setTimeout(function() {
      assert(callCount === 0);
      done();
    });
  });

});