# SuperWSTest

Extends [supertest](https://github.com/visionmedia/supertest) with
WebSocket capabilities. This is intended for testing servers which
support both HTTP and WebSocket requests.

## Install dependency

```bash
npm install --save-dev git+https://github.com/davidje13/superwstest.git#semver:^1.0.7
```

## Usage

### Example server implementation

```javascript
import http from 'http';
import WebSocket from 'ws';

const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    ws.send(`echo ${message}`);
  });

  ws.send('hello');
});

export default server;
```

### Tests for example server

```javascript
import request from 'superwstest';
import server from './myServer';

describe('MyThing', () => {
  beforeEach((done) => {
    server.listen(0, done);
  });

  afterEach((done) => {
    server.close(done);
  });

  it('communicates via websockets', async () => {
    await request(server)
      .ws('/path/ws')
      .expectText('hello')
      .sendText('foo')
      .expectText('echo foo')
      .sendText('abc')
      .expectText('echo abc')
      .close()
      .expectClosed();
  });
});
```

Since this builds on supertest, all the HTTP checks are also available.

As long as you add `server.close` in an `afterEach`, all connections
will be closed automatically, so you do not need to close connections
in every test.

## Methods

The main entrypoint is `request(myServer).ws(path)`. This returns a
`Promise` (eventually returning the `WebSocket`) with additional
methods attached:

- `expectText`: waits for the next message to arrive then checks that
  it matches the given text or function.
- `expectJson`: waits for the next message to arrive, deserialises it
  using `JSON.parse`, then checks that it matches the given data or
  function.
- `wait`: adds a delay of a number of milliseconds using `setTimeout`.
- `exec`: invokes the given function. If the function returns a
  promise, waits for the promise to resolve.
  *node: this differs from the `then` because you can continue to chain
  web socket actions and expectations*
- `sendText`: sends the given text.
- `sendJson`: sends the given JSON as text using `JSON.stringify`.
- `send`: sends a raw message (accepts any types accepted by
  `WebSocket.send`).
- `close`: closes the socket.
- `expectClosed`: waits for the socket to be closed.
- `expectConnectionError`: expect the initial connection handshake to
  fail. Optionally checks for a specific HTTP status code.
  *note: if you use this, it must be the only invocation in the chain*

You can also pass options to `request`:

- `request(myServer, { shutdownDelay: 500 }).ws(path)`: wait up to
  the given number of milliseconds for connections to close by
  themselves before forcing a shutdown when `close` is called on the
  server. By default this is 0 (i.e. all connections are closed
  immediately).
