# SuperWSTest

Provides a [supertest](https://github.com/visionmedia/supertest)-compatible API
for testing WebSockets.

If supertest is installed, this package also exposes supertest's API for
convenience when testing servers which provide both HTTP and WebSocket URLs.

## Install dependency

```bash
npm install --save-dev superwstest
```

You can also optionally install supertest for access to `.get`, `.post`, etc.:

```bash
npm install --save-dev superwstest supertest
```

## Usage

### Example server implementation

```javascript
import http from 'http';
import WebSocket from 'ws';

const server = http.createServer();
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  ws.on('message', (message) => { ws.send(`echo ${message}`); });
  ws.send('hello');
});

export default server;
```

### Tests for example server

```javascript
import request from 'superwstest';
import server from './myServer';

describe('My Server', () => {
  beforeEach((done) => {
    server.listen(0, 'localhost', done);
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

As long as you add `server.close` in an `afterEach`, all connections
will be closed automatically, so you do not need to close connections
in every test.

### Testing non-WebSocket endpoints

If you have installed supertest, all the HTTP checks are also available
by proxy:

```javascript
import request from 'superwstest';
import server from './myServer';

describe('My Server', () => {
  beforeEach((done) => server.listen(0, 'localhost', done));
  afterEach((done) => server.close(done));

  it('communicates via HTTP', async () => {
    await request(server)
      .get('/path')
      .expect(200);
  });
});
```

### Testing a remote webserver

You can also test against a remote webserver by specifying the URL
of the server:

```javascript
import request from 'superwstest';

describe('My Remote Server', () => {
  afterEach(() => {
    request.closeAll(); // recommended when using remote servers
  });

  it('communicates via websockets', async () => {
    await request('https://example.com')
      .ws('/path/ws')
      .expectText('hello')
      .close();
  });
});
```

The server URL given should be http(s) rather than ws(s); this will
provide compatibility with native supertest requests such as `post`,
`get`, etc. and will be converted automatically as needed.

Note that adding `request.closeAll()` to an `afterEach` will
ensure connections are closed in all situations (including test
timeouts, etc.). This is not needed when testing against a local
server because the server will close connections when closed.

If you need to scope the `request` instance (to avoid `closeAll`
interfering with other tests running in parallel in the same
process), you can use `.scoped()` (note that this is not
typically required when using Jest since parallel execution is
performed using separate processes):

```javascript
import baseRequest from 'superwstest';

describe('thing', () => {
  const request = baseRequest.scoped();
  afterEach(() => request.closeAll());
  /* ... */
});
```

## API

- [request(server[, options])](#requestserver-options)
- [request(...).ws(path[, protocols][, options])](#requestserverwspath-protocols-options)
  - [.set(header, value)](#setheader-value)
  - [.unset(header)](#unsetheader)
  - [.expectText([expected[, options]])](#expecttextexpected-options)
  - [.expectJson([expected[, options]])](#expectjsonexpected-options)
  - [.expectBinary([expected[, options]])](#expectbinaryexpected-options)
  - [.sendText(text)](#sendtexttext)
  - [.sendJson(json)](#sendjsonjson)
  - [.sendBinary(data)](#sendbinarydata)
  - [.send(data[, options])](#senddata-options)
  - [.close([code[, reason]]](#closecode-reason)
  - [.expectClosed([expectedCode[, expectedReason]])](#expectclosedexpectedcode-expectedreason)
  - [.expectConnectionError([expectedStatusCode])](#expectconnectionerrorexpectedstatuscode)
  - [.expectUpgrade(test)](#expectupgradetest)
  - [.wait(milliseconds)](#waitmilliseconds)
  - [.exec(fn)](#execfn)

### `request(server[, options])`

The beginning of a superwstest
(or [supertest](https://www.npmjs.com/package/supertest)) test chain.
Typically this is immediately followed by `.ws(...)` or `.get(...)` etc.

`options` can contain additional configuration:

- `shutdownDelay`: wait up to the given number of milliseconds for
  connections to close by themselves before forcing a shutdown when
  `close` is called on the server. By default this is 0 (i.e. all
  connections are closed immediately). Has no effect when testing
  remote servers.

  ```javascript
  request(server, { shutdownDelay: 500 }).ws(path)
  ```

- `defaultExpectOptions`: a set of options which are passed to all
  `expect*` calls in the current chain (e.g. allows setting a timeout
  for all expectations in the chain):

  ```javascript
  request(server, { defaultExpectOptions: { timeout: 5000 } })
    .ws(path)
    .expectText('hello') // implicit { timeout: 5000 }
    .expectText('hi', { timeout: 9000 }) // overrides default
  ```

### `request(server).ws(path[, protocols][, options])`

Returns a `Promise` (eventually returning the `WebSocket`) with
additional fluent API methods attached (described below).

Internally, this uses [ws](https://www.npmjs.com/package/ws), and the
protocols and options given are passed directly to the
[`WebSocket` constructor](https://github.com/websockets/ws/blob/HEAD/doc/ws.md#new-websocketaddress-protocols-options).
For example, one way to set a cookie:

```javascript
request(myServer)
  .ws('/path/ws', { headers: { cookie: 'foo=bar' } })
```

(you can also use `.set('Cookie', 'foo=bar')` to set cookies)

### `.set(header, value)`

Sets the header-value pair on the initial WebSocket connection. This can
also be called with an object to set multiple headers at once.

```javascript
request(server).ws('...')
  .set('Cookie', 'foo=bar')
  .set({ 'Authorization': 'bearer foo', 'X-Foo': 'bar' })
```

This function cannot be called after the connection has been established
(i.e. after calling `send` or `expect*`).

### `.unset(header)`

Removes the header from the initial WebSocket connection.

```javascript
request(server).ws('...')
  .unset('Cookie')
```

This function cannot be called after the connection has been established
(i.e. after calling `send` or `expect*`).

### `.expectText([expected[, options]])`

Waits for the next message to arrive then checks that it matches the given
text (exact match), regular expression, or function. If no parameter is
given, this only checks that the message is text (not binary).

```javascript
request(server).ws('...')
  .expectText('hello')   // exact text
  .expectText(/^hel*o$/) // RegExp matching
  .expectText((actual) => actual.includes('lo')) // function
  .expectText()          // just check message is text
```

When using a function, the check will be considered a failure if it
returns `false`. Any other value (including `undefined` and `null`)
is considered a pass. This means you can use (e.g.) Jest expectations
(returning no value):

```javascript
request(server).ws('...')
  .expectText((actual) => {
    expect(actual).toContain('foo');
  })
```

A second parameter can be given with additional options:

- `timeout`: wait up to the given number of milliseconds for a message
  to arrive before failing the test (defaults to infinity).

  ```javascript
  request(server).ws('...')
    .expectText('hello', { timeout: 1000 })
    .expectText(undefined, { timeout: 1000 })
  ```

  Note that for the most reliable tests, it is recommended to stick with
  the default (infinite) timeout. This option is provided as an escape
  hatch when writing long flow tests where the test timeout is
  unreasonably large for detecting an early failure.

These options can also be configured for the whole chain in the
[request call](#requestserver-options).

### `.expectJson([expected[, options]])`

Waits for the next message to arrive, deserialises it using `JSON.parse`,
then checks that it matches the given data
([deep equality](https://nodejs.org/api/util.html#utilisdeepstrictequalval1-val2))
or function.
If no parameter is given, this only checks that the message is valid JSON.

```javascript
request(server).ws('...')
  .expectJson({ foo: 'bar', zig: ['zag'] })       // exact match
  .expectJson((actual) => (actual.foo === 'bar')) // function
  .expectJson() // just check message is valid JSON
```

When using a function, the check will be considered a failure if it
returns `false`. Any other value (including `undefined` and `null`)
is considered a pass. This means you can use (e.g.) Jest expectations
(returning no value):

```javascript
request(server).ws('...')
  .expectJson((actual) => {
    expect(actual.bar).toBeGreaterThan(2);
  })
```

A second parameter can be given with additional options:

- `timeout`: wait up to the given number of milliseconds for a message
  to arrive before failing the test (defaults to infinity).

  ```javascript
  request(server).ws('...')
    .expectJson({ foo: 'bar' }, { timeout: 1000 })
    .expectJson(undefined, { timeout: 1000 })
  ```

  Note that for the most reliable tests, it is recommended to stick with
  the default (infinite) timeout. This option is provided as an escape
  hatch when writing long flow tests where the test timeout is
  unreasonably large for detecting an early failure.

These options can also be configured for the whole chain in the
[request call](#requestserver-options).

### `.expectBinary([expected[, options]])`

Waits for the next message to arrive then checks that it matches the given
array / buffer (exact match) or function. If no parameter is given,
this only checks that the message is binary (not text).

When providing a function, the data will always be a `Uint8Array`.

```javascript
request(server).ws('...')
  .expectBinary([10, 20, 30])
  .expectBinary(new Uint8Array([10, 20, 30]))
  .expectBinary((actual) => (actual[0] === 10)) // function
  .expectBinary() // just check message is binary
```

When using a function, the check will be considered a failure if it
returns `false`. Any other value (including `undefined` and `null`)
is considered a pass. This means you can use (e.g.) Jest expectations
(returning no value):

```javascript
request(server).ws('...')
  .expectBinary((actual) => {
    expect(actual[0]).toBeGreaterThan(2);
  })
```

A second parameter can be given with additional options:

- `timeout`: wait up to the given number of milliseconds for a message
  to arrive before failing the test (defaults to infinity).

  ```javascript
  request(server).ws('...')
    .expectBinary([10, 20, 30], { timeout: 1000 })
    .expectBinary(undefined, { timeout: 1000 })
  ```

  Note that for the most reliable tests, it is recommended to stick with
  the default (infinite) timeout. This option is provided as an escape
  hatch when writing long flow tests where the test timeout is
  unreasonably large for detecting an early failure.

These options can also be configured for the whole chain in the
[request call](#requestserver-options).

### `.sendText(text)`

Sends the given text. Non-strings are converted using `String` before
sending.

```javascript
request(server).ws('...')
  .sendText('yo')
```

### `.sendJson(json)`

Sends the given JSON as text using `JSON.stringify`.

```javascript
request(server).ws('...')
  .sendJson({ foo: 'bar' })
```

### `.sendBinary(data)`

Sends the given data as a binary message.

```javascript
request(server).ws('...')
  .sendBinary([10, 20, 30])
  .sendBinary(new Uint8Array([10, 20, 30]))
```

### `.send(data[, options])`

Sends a raw message (accepts any types accepted by
[`WebSocket.send`](https://github.com/websockets/ws/blob/HEAD/doc/ws.md#websocketsenddata-options-callback),
and `options` is passed through unchanged).

```javascript
request(server).ws('...')
  .send(new Uint8Array([5, 20, 100])) // binary message

  // multipart message
  .send('this is a fragm', { fin: false })
  .send('ented message', { fin: true })
```

### `.close([code[, reason]])`

Closes the socket. Arguments are passed directly to
[`WebSocket.close`](https://github.com/websockets/ws/blob/HEAD/doc/ws.md#websocketclosecode-reason).

```javascript
request(server).ws('...')
  .close() // close with default code and reason

request(server).ws('...')
  .close(1001) // custom code

request(server).ws('...')
  .close(1001, 'getting a cup of tea') // custom code and reason
```

### `.expectClosed([expectedCode[, expectedReason]])`

Waits for the socket to be closed. Optionally checks if it was closed
with the expected code and reason.

```javascript
request(server).ws('...')
  .expectClosed()

request(server).ws('...')
  .expectClosed(1001) // expected code

request(server).ws('...')
  .expectClosed(1001, 'bye') // expected code and reason
```

### `.expectConnectionError([expectedStatusCode])`

Expect the initial connection handshake to fail. Optionally checks for
a specific HTTP status code.

*note: if you use this, it must be the only invocation in the chain*

```javascript
request(server).ws('...')
  .expectConnectionError(); // any error

request(server).ws('...')
  .expectConnectionError(404); // specific error code

request(server).ws('...')
  .expectConnectionError('Server sent an invalid subprotocol'); // specific error message
```

### `.expectUpgrade(test)`

Run a check against the Upgrade response. Useful for making arbitrary
assertions about parts of the Upgrade response, such as headers.

The check will be considered a failure if it returns `false`. Any other
value (including `undefined` and `null`) is considered a pass.
This means you can use (e.g.) Jest expectations (returning no value).

The parameter will be a
[`http.IncomingMessage`](https://nodejs.org/api/http.html#http_class_http_incomingmessage).

```javascript
request(server).ws('...')
  .expectUpgrade((res) => (res.headers['set-cookie'] === 'foo=bar'));

request(server).ws('...')
  .expectUpgrade((res) => {
    expect(res.headers).toHaveProperty('set-cookie', 'foo=bar');
  })
```

### `.wait(milliseconds)`

Adds a delay of a number of milliseconds using `setTimeout`. This is
available as an escape hatch, but try to avoid using it, as it may
cause intermittent failures in tests due to timing variations.

```javascript
request(server).ws('...')
  .wait(500)
```

### `.exec(fn)`

Invokes the given function. If the function returns a promise, this
waits for the promise to resolve (but ignores the result). The function
will be given the WebSocket as a parameter. This is available as an
escape hatch if the standard functions do not meet your needs.

```javascript
request(server).ws('...')
  .exec((ws) => console.log('hello debugger!'))
```

*note: this differs from `Promise.then` because you can continue to
chain web socket actions and expectations.*

See [the FAQ](#how-can-i-perform-another-asynchronous-task-while-a-connection-is-open)
for examples of how `exec` can be used to perform side operations
during a connection.

## FAQ

### My server is closing the connection immediately with code 1002

Your server is probably trying to indicate that you need to specify a
particular sub-protocol when connecting:

```javascript
request(myServer)
  .ws('/path/ws', 'my-protocol-here')
```

You will need to check the documentation for the server library you are
using to find out which subprotocol is needed. If multiple sub-protocols
are needed, you can provide an array of strings.

### Why do I see "supertest dependency not found" errors?

Older versions of this library bundled supertest by default because they
used some functionality from it. The latest version does not require any
functionality from supertest but remains API-compatible with it, and for
this reason supertest has become optional and not included by default
(reducing dependencies when testing WebSocket-only servers).

To restore the ability to use `.get`, `.post`, etc. simply run:

```shell
npm install --save-dev supertest
```

The presence of this package will detected automatically and the supertest
API will be available via superwstest as before.

### Why isn't `request(app)` supported?

This project aims to be API-compatible with `supertest` wherever possible,
but does not support the ability to pass an `express` app directly into
`request()` (instead, the server must be started in advance and the server
object passed in). The recommended approach is:

```javascript
let server;

beforeEach((done) => {
  server = app.listen(0, 'localhost', done);
});

afterEach((done) => {
  server.close(done);
});
```

There are several reasons for not supporting this feature:

- `supertest`'s implementation
  [has a bug](https://github.com/visionmedia/supertest/issues/566) where it
  does not wait for the server to start before making requests. This can lead
  to flakey tests. For this reason it seems beneficial to discourage this
  approach in general (for both WebSocket and non-WebSocket tests).
- It is not possible for this library to reliably know when a test has ended,
  so it is not obvious when the auto-started server should be closed.
  `supertest`
  [never closes these auto-started servers](https://github.com/visionmedia/supertest/issues/437)
  (leading to
  [a large number of servers being spawned](https://github.com/visionmedia/supertest/issues/489)
  during a test run), but even this approach is not viable for WebSocket
  testing (typical web requests are short-lived, but websockets are long-lived
  and any dangling connections will prevent the test process from terminating).

### How can I perform another asynchronous task while a connection is open?

Often when testing websockets, you will want to perform another action and
check for a reaction on the websocket. This can be achieved using `exec`:

```javascript
await request(server).ws('here')
  .sendText('hello')
  .expectText('session open')
  .exec(async () => {
    await myOtherOperation();
  })
  .expectText('something happened')
  .close();
```

The recommended approach is to pull these out as helper functions, for example:

```javascript
const makeThing = (name) => () => request(server)
  .post('blah')
  .expect(200);

await request(server).ws('here')
  .sendText('hello')
  .expectText('session open')

  .exec(makeThing('my first thing'))
  .expectText('made "my first thing"')

  .exec(makeThing('my second thing'))
  .expectText('made "my second thing"')

  .close();
```

If you need 2 websocket connections to interact with each other, you can use
`Promise.all`:

```javascript
await Promise.all([
  request(server).ws('here')
    .expectText('Welcome to the chat room')
    .sendText('Hi all! I am foo')
    .expectText('Hi foo, I am bar')
    .close(),
  request(server).ws('here')
    .expectText('Welcome to the chat room')
    .expectText('Hi all! I am foo')
    .sendText('Hi foo, I am bar')
    .close(),
]);
```
