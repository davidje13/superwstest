import http from 'http';
import https from 'https';
import { WebSocket, WebSocketServer } from 'ws';
import { echo } from './helpers/echoserver.mjs';
import withScopedRequest from './helpers/withScopedRequest.mjs';
import withServer from './helpers/withServer.mjs';
import { TEST_HTTPS_CONFIG } from './test-tls.mjs';

const REQUEST = withScopedRequest({ checkDanglingConnections: true });

describe('node http server', () => {
  const SERVER = withServer(() => {
    const server = http.createServer();
    new WebSocketServer({ server }).on('connection', echo);
    return server;
  });

  it('connects', async ({ [REQUEST]: request, [SERVER]: server }) => {
    await request(server)
      .ws('/path/ws', [], { rejectUnauthorized: false })
      .expectText('hello')
      .close(1001)
      .expectClosed(1001);
  });
});

describe('node https server', () => {
  const SERVER = withServer(() => {
    const server = https.createServer(TEST_HTTPS_CONFIG);
    new WebSocketServer({ server }).on('connection', echo);
    return server;
  });

  it('connects', async ({ [REQUEST]: request, [SERVER]: server }) => {
    await request(server)
      .ws('/path/ws', [], { rejectUnauthorized: false })
      .expectText('hello')
      .close(1001)
      .expectClosed(1001);
  });
});

describe('WebSocketServer with internal server', () => {
  const SERVER = beforeEach(async ({ setParameter }) => {
    let wss;
    await new Promise((resolve) => {
      wss = new WebSocketServer({ port: 0 }, resolve);
      wss.on('connection', echo);
      setParameter(wss);
    });
    return () => new Promise((resolve) => wss.close(resolve));
  });

  it('connects', async ({ [REQUEST]: request, [SERVER]: server }) => {
    await request(server).ws('/path/ws').expectText('hello').close(1001).expectClosed(1001);
  });

  it('closes connections automatically on server shutdown', async ({
    [REQUEST]: request,
    [SERVER]: server,
  }) => {
    const ws = await request(server).ws('/path/ws').expectText('hello');

    expect(ws.readyState).toEqual(WebSocket.OPEN);

    await new Promise((resolve) => server.close(resolve));
    expect(ws.readyState).toBeGreaterThan(1); // CLOSING or CLOSED
  });
});

describe('WebSocketServer with https server', () => {
  const SERVER = beforeEach(async ({ setParameter }) => {
    const server = https.createServer(TEST_HTTPS_CONFIG);
    const wss = new WebSocketServer({ server });
    wss.on('connection', echo);
    setParameter(wss);
    await new Promise((resolve, reject) => {
      server.listen(0, 'localhost', (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    return () => new Promise((resolve) => wss.close(resolve));
  });

  it('connects', async ({ [REQUEST]: request, [SERVER]: server }) => {
    await request(server)
      .ws('/path/ws', [], { rejectUnauthorized: false })
      .expectText('hello')
      .close(1001)
      .expectClosed(1001);
  });
});
