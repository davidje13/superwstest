import stRequest, { Test } from 'supertest';
import BlockingQueue from 'blocking-queue';
import equal from 'fast-deep-equal';
import WebSocket from 'ws';

const REGEXP_HTTP = /^http/;

function getServerWsPath(server, path) {
  let httpPath;
  if (typeof server === 'string') {
    httpPath = server + path;
  } else {
    if (!server.address()) {
      throw new Error('Server was closed');
    }
    httpPath = Test.prototype.serverAddress(server, path);
  }
  return httpPath.replace(REGEXP_HTTP, 'ws');
}

function normaliseBinary(v) {
  return new Uint8Array(v);
}

function compareBinary(a, b) {
  return Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(b);
}

function stringifyBinary(v) {
  const hex = Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('hex');
  const spacedHex = hex.replace(/(..)(?!$)/g, '$1 ');
  return `[${spacedHex}]`;
}

function msgText({ data, isBinary }) {
  if (isBinary) {
    throw new Error('Expected text message, got binary');
  }
  return String(data);
}

function msgJson(msg) {
  return JSON.parse(msgText(msg));
}

function msgBinary({ data, isBinary }) {
  if (!isBinary) {
    throw new Error('Expected binary message, got text');
  }
  return normaliseBinary(data);
}

function sendWithError(ws, msg, options) {
  // https://github.com/websockets/ws/pull/1532
  return new Promise((resolve, reject) => {
    ws.send(msg, options, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  }).catch(async (err) => {
    if (err.message && err.message.includes('WebSocket is not open')) {
      const { code, data } = await ws.closed;
      throw new Error(`Cannot send message; connection closed with ${code} "${data}"`);
    }
  });
}

function stringify(v) {
  if (typeof v === 'function') {
    return v.expectedMessage || 'matching function';
  }
  if (v instanceof Uint8Array) {
    return stringifyBinary(v);
  }
  return JSON.stringify(v);
}

const wsMethods = {
  send: (ws, msg, options) => sendWithError(ws, msg, options),
  sendText: (ws, msg) => sendWithError(ws, String(msg)),
  sendJson: (ws, msg) => sendWithError(ws, JSON.stringify(msg)),
  sendBinary: (ws, msg) => sendWithError(ws, normaliseBinary(msg), {
    binary: true,
  }),
  wait: (ws, ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  exec: async (ws, fn) => fn(ws),
  expectMessage: async (ws, conversion, check = undefined) => {
    const received = await Promise.race([
      ws.messages.pop(),
      ws.closed.then(({ code, data }) => {
        throw new Error(`Expected message ${stringify(check)}, but connection closed: ${code} "${data}"`);
      }),
    ]).then(conversion);
    if (check === undefined) {
      return;
    }
    if (typeof check === 'function') {
      const result = check(received);
      if (result === false) {
        throw new Error(`Expected message ${stringify(check)}, got ${stringify(received)}`);
      }
    } else if (!equal(received, check)) {
      throw new Error(`Expected message ${stringify(check)}, got ${stringify(received)}`);
    }
  },
  expectText: (ws, expected) => {
    let check;
    if (expected instanceof RegExp) {
      check = (value) => expected.test(value);
      check.expectedMessage = `matching ${expected}`;
    } else {
      check = expected;
    }
    return wsMethods.expectMessage(ws, msgText, check);
  },
  expectJson: (ws, check) => wsMethods.expectMessage(ws, msgJson, check),
  expectBinary: (ws, expected) => {
    let check;
    if (typeof expected === 'function') {
      check = expected;
    } else if (expected) {
      const norm = normaliseBinary(expected);
      check = (value) => compareBinary(value, norm);
      check.expectedMessage = stringify(norm);
    }
    return wsMethods.expectMessage(ws, msgBinary, check);
  },
  close: (ws, code, message) => ws.close(code, message),
  expectClosed: async (ws, expectedCode = null, expectedMessage = null) => {
    const { code, data } = await ws.closed;
    if (expectedCode !== null && code !== expectedCode) {
      throw new Error(`Expected close code ${expectedCode}, got ${code} "${data}"`);
    }
    if (expectedMessage !== null && String(data) !== expectedMessage) {
      throw new Error(`Expected close message "${expectedMessage}", got ${code} "${data}"`);
    }
  },
  expectUpgrade: async (ws, check) => {
    const request = await ws.upgrade;
    const result = check(request);
    if (result === false) {
      throw new Error(`Expected Upgrade matching assertion, got: status ${request.statusCode} headers ${JSON.stringify(request.headers)}`);
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

function isOpen(ws) {
  return (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN);
}

function closeAndRethrow(ws) {
  return (e) => {
    if (isOpen(ws)) {
      ws.close();
    }
    throw e;
  };
}

function findExistingHeader(headers, header) {
  const lc = header.toLowerCase();
  return Object.keys(headers).find((h) => (h.toLowerCase() === lc)) || lc;
}

const clientSockets = new Set();

const PRECONNECT_FN_ERROR = () => {
  throw new Error('WebSocket has already been established; cannot change configuration');
};

function wsRequest(url, protocols, options) {
  const opts = { ...options, headers: { ...(options || {}).headers } };

  // Initial Promise.resolve() gives us a tick to populate connection info (i.e. set(...))
  let chain = Promise.resolve().then(() => new Promise((resolve, reject) => {
    const ws = new WebSocket(url, protocols, opts);
    clientSockets.add(ws);
    const originalClose = ws.close.bind(ws);
    ws.close = (...args) => {
      originalClose(...args);
      clientSockets.delete(ws);
    };

    // ws.on('open', () => console.log('OPEN'));
    // ws.on('error', (e) => console.log('ERROR', e));
    // ws.on('close', () => console.log('CLOSE'));
    // ws.on('message', (m) => console.log('MESSAGE', m));

    ws.messages = new BlockingQueue();
    const errors = new BlockingQueue();
    const closed = new BlockingQueue();
    const upgrade = new BlockingQueue();
    ws.closed = closed.pop();
    ws.firstError = errors.pop().then((e) => {
      throw e;
    });
    ws.upgrade = upgrade.pop();

    ws.on('message', (data, isBinary) => {
      if (isBinary !== undefined) { // ws 8.x
        ws.messages.push({ data, isBinary });
      } else if (typeof data === 'string') { // ws 7.x
        ws.messages.push({ data: Buffer.from(data, 'utf8'), isBinary: false });
      } else {
        ws.messages.push({ data, isBinary: true });
      }
    });
    ws.on('error', reject);
    ws.on('close', (code, data) => {
      clientSockets.delete(ws);
      closed.push({ code, data });
    });
    ws.on('open', () => {
      ws.removeListener('error', reject);
      ws.on('error', (err) => errors.push(err));
      resolve(ws);
    });
    ws.on('upgrade', (request) => {
      upgrade.push(request);
    });
  }));

  const preconnectFns = {
    set(header, value) {
      if (typeof header === 'object') {
        Object.entries(header).forEach(([h, v]) => preconnectFns.set(h, v));
        return chain;
      }
      opts.headers[findExistingHeader(opts.headers, header)] = value;
      return chain;
    },
    unset(header) {
      delete opts.headers[findExistingHeader(opts.headers, header)];
      return chain;
    },
  };
  Object.assign(chain, preconnectFns);

  /* eslint-disable no-param-reassign */ // purpose of function
  function removePreConnectionFunctions(promise) {
    delete promise.expectConnectionError;
    Object.keys(preconnectFns).forEach((k) => {
      promise[k] = PRECONNECT_FN_ERROR;
    });
  }
  /* eslint-enable no-param-reassign */

  const methods = {};
  function wrapPromise(promise) {
    return Object.assign(promise, methods);
  }

  const thenDo = (fn) => (...args) => {
    chain = chain.then((ws) => Promise.race([
      fn(ws, ...args),
      ws.firstError,
    ]).catch(closeAndRethrow(ws)).then(() => ws));

    removePreConnectionFunctions(chain);
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

    removePreConnectionFunctions(chain);
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

  const serverSockets = new Set();
  server.on('connection', (s) => {
    serverSockets.add(s);
    s.on('close', () => serverSockets.delete(s));
  });

  const originalClose = server.close.bind(server);

  /* eslint-disable-next-line no-param-reassign */ // ensure clean shutdown
  server.close = (callback) => {
    if (server.address()) {
      performShutdown(serverSockets, testConfig.shutdownDelay);
      testConfig.shutdownDelay = 0;
      originalClose(callback);
    } else if (callback) {
      callback();
    }
  };
}

const request = (server, { shutdownDelay = 0 } = {}) => {
  if (typeof server !== 'string') {
    if (!server.address()) {
      // see https://github.com/visionmedia/supertest/issues/566
      throw new Error(
        'Server must be listening: beforeEach((done) => server.listen(0, done));',
      );
    }

    registerShutdown(server, shutdownDelay);
  }

  const obj = stRequest(server);
  obj.ws = (path, ...args) => wsRequest(getServerWsPath(server, path), ...args);

  return obj;
};

request.closeAll = () => {
  const remaining = [...clientSockets].filter(isOpen);
  clientSockets.clear();
  remaining.forEach((ws) => ws.close());
  return remaining.length;
};

// temporary backwards-compatibility for CommonJS require('superwstest').default
request.default = request;
export default request;
