import { isDeepStrictEqual } from 'node:util';
import { Server as HTTPSServer } from 'node:https';
import { Server, Socket } from 'node:net';
import WebSocket from 'ws';
import { BlockingQueue } from './BlockingQueue.mjs';

// supertest is an optional dependency
const stRequest = (() => {
  try {
    const m = require('supertest');
    return m.default || m;
  } catch (e) {
    return fallbackSTRequest;
  }
})();
// es6 with top-level await:
//const stRequest = await import('supertest').then((m) => m.default, () => fallbackSTRequest);

// fallback to an error when supertest methods are used
function fallbackSTRequest() {
  return new Proxy(
    {},
    {
      get(o, prop) {
        if (Object.prototype.hasOwnProperty.call(o, prop)) {
          return o[prop];
        }
        throw new Error(
          `request().${prop} is unavailable (supertest dependency not found).\n` +
            'Run `npm install --save-dev supertest` to access these methods from superwstest',
        );
      },
    },
  );
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
    throw new Error('Expected text message, but got binary');
  }
  return String(data);
}

function msgJson(msg) {
  return JSON.parse(msgText(msg));
}

function msgBinary({ data, isBinary }) {
  if (!isBinary) {
    throw new Error('Expected binary message, but got text');
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

function makeTextCheck(expected) {
  if (expected instanceof RegExp) {
    const check = (value) => expected.test(value);
    check.expectedMessage = `matching ${expected}`;
    return check;
  } else {
    return expected;
  }
}

function makeBinaryCheck(expected) {
  if (typeof expected === 'function') {
    return expected;
  } else if (expected) {
    const norm = normaliseBinary(expected);
    const check = (value) => compareBinary(value, norm);
    check.expectedMessage = stringify(norm);
    return check;
  }
}

function checkMessage(check, received) {
  if (typeof check === 'function') {
    return check(received) !== false;
  } else {
    return isDeepStrictEqual(received, check);
  }
}

function getNextMessage(ws, timeout) {
  return Promise.race([
    ws.messages.pop(timeout),
    ws.closed.then(({ code, data }) => {
      throw new Error(`connection closed: ${code} "${data}"`);
    }),
  ]);
}

const wsMethods = {
  send: (ws, msg, options) => sendWithError(ws, msg, options),
  sendText: (ws, msg) => sendWithError(ws, String(msg)),
  sendJson: (ws, msg) => sendWithError(ws, JSON.stringify(msg)),
  sendBinary: (ws, msg) =>
    sendWithError(ws, normaliseBinary(msg), {
      binary: true,
    }),

  exec: async (ws, fn) => fn(ws),

  expectMessage: async (ws, conversion, check = undefined, options = undefined) => {
    const opts = { ...ws.defaultExpectOptions, ...options };
    const received = await getNextMessage(ws, opts.timeout).then(conversion, (err) => {
      throw new Error(`Expected message ${stringify(check)}, but got ${err}`);
    });
    if (check !== undefined && !checkMessage(check, received)) {
      throw new Error(`Expected message ${stringify(check)}, but got ${stringify(received)}`);
    }
  },
  expectText: (ws, expected, options) =>
    wsMethods.expectMessage(ws, msgText, makeTextCheck(expected), options),
  expectJson: (ws, check, options) => wsMethods.expectMessage(ws, msgJson, check, options),
  expectBinary: (ws, expected, options) =>
    wsMethods.expectMessage(ws, msgBinary, makeBinaryCheck(expected), options),

  wait: (ws, ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  waitForMessage: async (ws, conversion, check = undefined, options = undefined) => {
    const opts = { ...ws.defaultWaitForOptions, ...options };
    const hasTimeout = opts.timeout !== undefined;
    const deadline = Date.now() + opts.timeout;
    const failures = [];
    while (true) {
      const timeout = hasTimeout ? deadline - Date.now() : undefined;
      const message = await getNextMessage(ws, timeout).catch((err) => {
        if (failures.length === 0) {
          return err;
        }
        throw new Error(
          `Received ${failures.length} message${failures.length === 1 ? '' : 's'} while waiting for ${stringify(check)}, but none matched:\n${failures.join('\n')}\n${err}`,
        );
      });
      try {
        const received = await conversion(message);
        if (check === undefined || checkMessage(check, received)) {
          return;
        }
        failures.push(stringify(received));
      } catch {
        if (message.isBinary) {
          failures.push(stringify(new Uint8Array(message.data)));
        } else {
          failures.push(stringify(String(message.data)));
        }
      }
    }
  },
  waitForText: (ws, expected, options) =>
    wsMethods.waitForMessage(ws, msgText, makeTextCheck(expected), options),
  waitForJson: (ws, check, options) => wsMethods.waitForMessage(ws, msgJson, check, options),
  waitForBinary: (ws, expected, options) =>
    wsMethods.waitForMessage(ws, msgBinary, makeBinaryCheck(expected), options),

  close: (ws, code, message) => ws.close(code, message),
  expectClosed: async (ws, expectedCode = null, expectedMessage = null) => {
    const { code, data } = await ws.closed;
    if (expectedCode !== null && code !== expectedCode) {
      throw new Error(`Expected close code ${expectedCode}, but got ${code} "${data}"`);
    }
    if (expectedMessage !== null && String(data) !== expectedMessage) {
      throw new Error(`Expected close message "${expectedMessage}", but got ${code} "${data}"`);
    }
  },

  expectUpgrade: async (ws, check) => {
    const request = await ws.upgrade;
    const result = check(request);
    if (result === false) {
      throw new Error(
        `Expected Upgrade matching assertion, but got: status ${
          request.statusCode
        } headers ${JSON.stringify(request.headers)}`,
      );
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
    throw new Error(`Expected connection failure with message "${expected}", but got "${actual}"`);
  }
}

function isOpen(ws) {
  return ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN;
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
  return Object.keys(headers).find((h) => h.toLowerCase() === lc) || lc;
}

const PRECONNECT_FN_ERROR = () => {
  throw new Error('WebSocket has already been established; cannot change configuration');
};

function wsRequest(config, url, protocols, options) {
  if (typeof protocols === 'object' && protocols !== null && !Array.isArray(protocols)) {
    /* eslint-disable no-param-reassign */ // function overload
    options = protocols;
    protocols = [];
    /* eslint-enable no-param-reassign */
  }
  const opts = { ...options, headers: { ...(options || {}).headers } };
  const messageFilters = [];

  const initPromise = (resolve, reject) => {
    const ws = new WebSocket(url, protocols, opts);
    config.clientSockets.add(ws);
    const originalClose = ws.close.bind(ws);
    let requestedClose = false;
    ws.close = (...args) => {
      // we might get "WebSocket was closed before the connection was established", which can be ignored
      requestedClose = true;
      originalClose(...args);
      config.clientSockets.delete(ws);
    };

    Object.assign(ws, config);
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
      let message;
      if (isBinary !== undefined) {
        // ws 8.x
        message = { data, isBinary };
      } else if (typeof data === 'string') {
        // ws 7.x
        message = {
          data: Buffer.from(data, 'utf8'),
          isBinary: false,
        };
      } else {
        message = { data, isBinary: true };
      }
      if (messageFilters.every((fn) => fn(message))) {
        ws.messages.push(message);
      }
    });
    ws.on('error', (err) => {
      if (!requestedClose) {
        reject(err);
      }
    });
    ws.on('close', (code, data) => {
      config.clientSockets.delete(ws);
      closed.push({ code, data });
    });
    ws.on('open', () => {
      ws.removeListener('error', reject);
      ws.on('error', (err) => {
        if (!requestedClose) {
          errors.push(err);
        }
      });
      resolve(ws);
    });
    ws.on('upgrade', (request) => {
      upgrade.push(request);
    });
  };

  // Initial Promise.resolve() gives us a tick to populate connection info (i.e. set(...))
  let chain = Promise.resolve().then(() => new Promise(initPromise));

  const preconnectFns = {
    set(header, value) {
      if (typeof header === 'object') {
        Object.entries(header).forEach(([h, v]) => preconnectFns.set(h, v));
      } else {
        opts.headers[findExistingHeader(opts.headers, header)] = value;
      }
      return chain;
    },
    unset(header) {
      delete opts.headers[findExistingHeader(opts.headers, header)];
      return chain;
    },
    filterMessages(fn) {
      messageFilters.push(fn);
      return chain;
    },
    filterText(fn = () => true) {
      messageFilters.push((m) => (m.isBinary ? false : fn(msgText(m))));
      return chain;
    },
    filterJson(fn = () => true) {
      messageFilters.push((m) => {
        if (m.isBinary) {
          return false;
        }
        let json;
        try {
          json = msgJson(m);
        } catch {
          return false;
        }
        return fn(json);
      });
      return chain;
    },
    filterBinary(fn = () => true) {
      messageFilters.push((m) => (m.isBinary ? fn(msgBinary(m)) : false));
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

  const thenDo =
    (fn) =>
    (...args) => {
      chain = chain.then((ws) =>
        Promise.race([fn(ws, ...args), ws.firstError])
          .catch(closeAndRethrow(ws))
          .then(() => ws),
      );

      removePreConnectionFunctions(chain);
      return wrapPromise(chain);
    };

  Object.keys(wsMethods).forEach((method) => {
    methods[method] = thenDo(wsMethods[method]);
  });

  chain.expectConnectionError = (expectedCode = null) => {
    chain = chain.then(reportConnectionShouldFail, (error) =>
      checkConnectionError(error, expectedCode),
    );

    removePreConnectionFunctions(chain);
    return chain;
  };

  return wrapPromise(chain);
}

async function performShutdown(sockets, shutdownDelay) {
  const awaiting = [...sockets];

  if (shutdownDelay > 0 && awaiting.length > 0) {
    const expire = Date.now() + shutdownDelay;

    while (Date.now() < expire && awaiting.some((s) => sockets.has(s))) {
      /* eslint-disable-next-line no-await-in-loop */ // polling
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  [...sockets].forEach((s) => {
    if (s instanceof Socket) {
      s.end();
    } else if (s.close) {
      s.close(); // WebSocketServer
    }
  });
}

const serverTestConfigs = new WeakMap();

function registerShutdown(server, shutdownDelay) {
  let testConfig = serverTestConfigs.get(server);
  if (testConfig) {
    testConfig.shutdownDelay = Math.max(testConfig.shutdownDelay, shutdownDelay);
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

const REGEXP_HTTP = /^http/;

function getProtocol(server) {
  if (!(server instanceof Server)) {
    // could be WebSocketServer
    server = (server.options || {}).server || server;
  }
  return server instanceof HTTPSServer ? 'https' : 'http';
}

function getHostname(address) {
  if (typeof address === 'string') {
    return address;
  }
  if (address.family === 'IPv6') {
    return `[${address.address}]`;
  }
  return address.address;
}

function getHttpBase(server) {
  if (typeof server === 'string') {
    return server;
  }

  const address = server.address();
  if (!address) {
    // see https://github.com/visionmedia/supertest/issues/566
    throw new Error(
      'Server must be listening:\n' +
        "beforeEach((done) => server.listen(0, 'localhost', done));\n" +
        'afterEach((done) => server.close(done));\n' +
        '\n' +
        "supertest's request(app) syntax is not supported (find out more: https://github.com/davidje13/superwstest#why-isnt-requestapp-supported)",
    );
  }

  return `${getProtocol(server)}://${getHostname(address)}:${address.port}`;
}

function makeScopedRequest() {
  const clientSockets = new Set();

  const request = (
    server,
    { shutdownDelay = 0, defaultExpectOptions = {}, defaultWaitForOptions = {} } = {},
  ) => {
    const httpBase = getHttpBase(server);

    if (typeof server !== 'string') {
      registerShutdown(server, shutdownDelay);
    }

    const wsConfig = { defaultExpectOptions, defaultWaitForOptions, clientSockets };
    const obj = stRequest(httpBase);
    obj.ws = (path, ...args) =>
      wsRequest(wsConfig, httpBase.replace(REGEXP_HTTP, 'ws') + path, ...args);

    return obj;
  };

  request.closeAll = () => {
    const remaining = [...clientSockets].filter(isOpen);
    clientSockets.clear();
    remaining.forEach((ws) => ws.close());
    return remaining.length;
  };

  request.scoped = () => makeScopedRequest();

  return request;
}

const request = makeScopedRequest();

// temporary backwards-compatibility for CommonJS require('superwstest').default
request.default = request;
export default request;
