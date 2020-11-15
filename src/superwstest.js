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
  exec: async (ws, fn) => fn(ws),
  expectMessage: async (ws, conversion, check = undefined) => {
    const received = await Promise.race([
      ws.messages.pop(),
      ws.closed.then(() => {
        throw new Error(`Expected message ${JSON.stringify(check)}, but connection closed`);
      }),
    ]).then(conversion);
    if (check === undefined) {
      return;
    }
    if (typeof check === 'function') {
      const result = check(received);
      if (result === false) {
        throw new Error(`Message expectation failed for ${JSON.stringify(received)}`);
      }
    } else if (!equal(received, check)) {
      throw new Error(`Expected message ${JSON.stringify(check)}, got ${JSON.stringify(received)}`);
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
      throw new Error(`Expected close message "${expectedMessage}", got "${message}"`);
    }
  },
};

function reportConnectionShouldFail(ws) {
  ws.close();
  throw new Error('Expected connection failure, but succeeded');
}

function checkConnectionError(error, expectedCode) {
  if (!expectedCode) {
    return;
  }
  let expected = expectedCode;
  if (typeof expectedCode === 'number') {
    expected = `Unexpected server response: ${expectedCode}`;
  }
  const actual = error.message;
  if (actual !== expected) {
    throw new Error(`Expected connection failure with message "${expected}", got "${actual}"`);
  }
}

function closeAndRethrow(ws) {
  return (e) => {
    if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    throw e;
  };
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
    ]).catch(closeAndRethrow(ws)).then(() => ws));

    delete chain.expectConnectionError;
    return wrapPromise(chain);
  };

  Object.keys(wsMethods).forEach((method) => {
    methods[method] = thenDo(wsMethods[method]);
  });

  chain.expectConnectionError = (expectedCode = null) => {
    chain = chain.then(
      reportConnectionShouldFail,
      (error) => checkConnectionError(error, expectedCode),
    );

    delete chain.expectConnectionError;
    return chain;
  };

  return wrapPromise(chain);
}

function performShutdown(sockets, shutdownDelay) {
  if (shutdownDelay <= 0) {
    [...sockets].forEach((s) => s.end());
    return;
  }

  const expire = Date.now() + shutdownDelay;

  [...sockets].forEach(async (s) => {
    while (Date.now() < expire && sockets.has(s)) {
      /* eslint-disable-next-line no-await-in-loop */ // polling
      await new Promise((r) => setTimeout(r, 20));
    }
    if (sockets.has(s)) {
      s.end();
    }
  });
}

const serverTestConfigs = new WeakMap();

function registerShutdown(server, shutdownDelay) {
  let testConfig = serverTestConfigs.get(server);
  if (testConfig) {
    testConfig.shutdownDelay = Math.max(
      testConfig.shutdownDelay,
      shutdownDelay,
    );
    return;
  }
  testConfig = { shutdownDelay };
  serverTestConfigs.set(server, testConfig);

  const sockets = new Set();
  server.on('connection', (s) => {
    sockets.add(s);
    s.on('close', () => sockets.delete(s));
  });

  const originalClose = server.close.bind(server);

  /* eslint-disable-next-line no-param-reassign */ // ensure clean shutdown
  server.close = (callback) => {
    if (server.address()) {
      performShutdown(sockets, testConfig.shutdownDelay);
      testConfig.shutdownDelay = 0;
      originalClose(callback);
    } else if (callback) {
      callback();
    }
  };
}

export default (server, { shutdownDelay = 0 } = {}) => {
  if (!server.address()) {
    // see https://github.com/visionmedia/supertest/issues/566
    throw new Error(
      'Server must be listening: beforeEach((done) => server.listen(0, done));',
    );
  }

  registerShutdown(server, shutdownDelay);

  const obj = request(server);
  obj.ws = (path, ...args) => wsRequest(getServerWsPath(server, path), ...args);

  return obj;
};
