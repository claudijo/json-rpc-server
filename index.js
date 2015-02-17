var ERRORS = {
  PARSE_ERROR: { code: -32700, message: 'Parse error' },
  INVALID_REQUEST: { code: -32600, message: 'Invalid Request' },
  METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
  INTERNAL_ERROR: { code: -32603, message: 'Internal error'}
};

var response = function(result, error, id) {
  return {
    jsonrpc: '2.0',
    result: result,
    error: error,
    id: id
  };
};

module.exports = function(channel) {
  var requestListeners = {};
  var messageQueue = [];

  var deferredSend = function(message, forceBatchResponse) {
    messageQueue.push(message);
    process.nextTick(function() {
      flushMessageQueue(forceBatchResponse);
    });
  };

  var flushMessageQueue = function(forceBatchResponse) {
    var data;
    var message;

    if (messageQueue.length === 0) {
      return;
    }

    if (!forceBatchResponse && messageQueue.length === 1) {
      data = messageQueue[0];
    } else {
      data = messageQueue;
    }

    message = JSON.stringify(data);
    messageQueue = [];

    channel.send.call(channel, message);
  };

  var handleRequest = function(request, forceBatchResponse) {
    var replyCallback;

    if (typeof request.method !== 'string') {
      deferredSend(response(undefined, ERRORS.INVALID_REQUEST, null), forceBatchResponse);
      return;
    }

    if (!requestListeners[request.method]) {
      deferredSend(response(undefined, ERRORS.METHOD_NOT_FOUND, request.id), forceBatchResponse);
      return;
    }

    if (typeof request.id === 'string' || typeof request.id === 'number') {
      replyCallback = function(err, result) {
        if (!err) {
          err = undefined;
        }
        deferredSend(response(result, err, request.id));
      };
    }

    requestListeners[request.method].forEach(function(listener) {
      try {
        listener.call(null, request.params, replyCallback);
      } catch (err) {
        if (replyCallback) {
          deferredSend(response(undefined, ERRORS.INTERNAL_ERROR, request.id), forceBatchResponse);
        }
      }
    });
  };

  channel.on('message', function(message) {
    try {
      var data = JSON.parse(message);
    } catch(err) {
      deferredSend(response(undefined, ERRORS.PARSE_ERROR, null));
      return;
    }

    if (Array.isArray(data) && data.length > 0) {
      data.forEach(function(request) {
        handleRequest(request, true);
      });

      return;
    }

    handleRequest(data);
  });

  return function(method, listener) {
    if (!requestListeners[method]) {
      requestListeners[method] = [];
    }

    requestListeners[method].push(listener);
  };
};