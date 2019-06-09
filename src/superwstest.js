import request, { Test } from 'supertest';
import BlockingQueue from 'blocking-queue';
import equal from 'fast-deep-equal';
import WebSocket from 'ws';

const REGEXP_HTTP = /^http/;

function getServerWsPath(server, path) {
  if (!server.address()) {
    throw new Error('Server was closed');
  }
  return Test.prototype.serverAddress(server, path).replace(REGEXP_HTTP, 'ws');
}

function msgText(data) {
  if (typeof data !== 'string') {
    throw new Error(`Expected text message, got ${typeof data}`);
  }
  return data;
}

function msgJson(data) {
  return JSON.parse(msgText(data));
}

function sendWithError(ws, message) {
  // https://github.com/websockets/ws/pull/1532
  ws.send(message, (err) => {
    if (err) {
      throw err;
    }
  });
}

const wsMethods = {
  send: (ws, msg) => sendWithError(ws, msg),
  sendText: (ws, msg) => sendWithError(ws, String(msg)),
  sendJson: (ws, msg) => sendWithError(ws, JSON.stringify(msg)),
  wait: (ws, ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  expectMessage: async (ws, conversion, check = null) => {
    const received = await Promise.race([
      ws.messages.pop(),
      ws.closed.then(() => {
        throw new Error(`Expected message '${check}', but connection closed`);
      }),
    ]).then(conversion);
    if (check === null) {
      return;
    }
    if (typeof check === 'function') {
      const result = check(received);
      if (result === false) {
        throw new Error(`Message expectation failed for ${received}`);
      }
    } else if (!equal(received, check)) {
      throw new Error(`Expected message '${check}', got '${received}'`);
    }
  },
  expectText: (ws, check) => wsMethods.expectMessage(ws, msgText, check),
  expectJson: (ws, check) => wsMethods.expectMessage(ws, msgJson, check),
  close: (ws, code, message) => ws.close(code, message),
  expectClosed: async (ws, expectedCode = null, expectedMessage = null) => {
    const { code, message } = await ws.closed;
    if (expectedCode !== null && code !== expectedCode) {
      throw new Error(`Expected close code ${expectedCode}, got ${code}`);
    }
    if (expectedMessage !== null && message !== expectedMessage) {
      throw new Error(`Expected close message '${expectedMessage}', got '${message}'`);
    }
  },
};

function checkConnectionError(o, expectedCode) {
  if (!o || !o.error) {
    throw new Error('Expected connection failure, but succeeded');
  }
  if (!expectedCode) {
    return;
  }
  let expected = expectedCode;
  if (typeof expectedCode === 'number') {
    expected = `Unexpected server response: ${expectedCode}`;
  }
  const actual = o.error.message;
  if (actual !== expected) {
    throw new Error(`Expected connection failure with message '${expected}', got '${actual}'`);
  }
}

function wsRequest(url, protocols, options) {
  let chain = new Promise((resolve, reject) => {
    const ws = new WebSocket(url, protocols, options);

    // ws.on('open', () => console.log('OPEN'));
    // ws.on('error', (e) => console.log('ERROR', e));
    // ws.on('close', () => console.log('CLOSE'));
    // ws.on('message', (m) => console.log('MESSAGE', m));

    ws.messages = new BlockingQueue();
    const errors = new BlockingQueue();
    const closed = new BlockingQueue();
    ws.closed = closed.pop();
    ws.firstError = errors.pop().then((e) => {
      throw e;
    });

    ws.on('message', (msg) => ws.messages.push(msg));
    ws.on('error', reject);
    ws.on('close', (code, message) => closed.push({ code, message }));
    ws.on('open', () => {
      ws.removeListener('error', reject);
      ws.on('error', (err) => errors.push(err));
      resolve(ws);
    });
  });

  const methods = {};
  function wrapPromise(promise) {
    return Object.assign(promise, methods);
  }

  const thenDo = (fn) => (...args) => {
    chain = chain.then((ws) => Promise.race([
      fn(ws, ...args),
      ws.firstError,
    ]).then(() => ws));

    delete chain.expectConnectionError;
    return wrapPromise(chain);
  };

  Object.keys(wsMethods).forEach((method) => {
    methods[method] = thenDo(wsMethods[method]);
  });

  chain.expectConnectionError = (expectedCode = null) => {
    chain = chain
      .catch((error) => ({ error }))
      .then((o) => checkConnectionError(o, expectedCode));

    delete chain.expectConnectionError;
    return chain;
  };

  return wrapPromise(chain);
}

const adaptedServers = new WeakSet();

function registerShutdown(server) {
  if (adaptedServers.has(server)) {
    return;
  }
  adaptedServers.add(server);

  const sockets = new Set();
  server.on('connection', (s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });

  const originalClose = server.close.bind(server);

  /* eslint-disable-next-line no-param-reassign */ // ensure clean shutdown
  server.close = (callback) => {
    if (server.address()) {
      [...sockets].forEach((s) => s.end());
      originalClose(callback);
    } else if (callback) {
      callback();
    }
  };
}

export default (server) => {
  if (!server.address()) {
    // see https://github.com/visionmedia/supertest/issues/566
    throw new Error(
      'Server must be listening: beforeEach((done) => server.listen(0, done));',
    );
  }

  registerShutdown(server);

  const obj = request(server);
  obj.ws = (path, ...args) => wsRequest(getServerWsPath(server, path), ...args);

  return obj;
};
