import WebSocket from 'ws';
import { promisify } from 'util';
import makeEchoServer from './test-helpers/echoserver';
import request from './superwstest';

function delay(millis) {
  return new Promise((r) => setTimeout(r, millis));
}

describe('superwstest', () => {
  const server = makeEchoServer();

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
      .close(1001)
      .expectClosed(1001);
  });

  it('closes connections automatically on server shutdown', async () => {
    const ws = await request(server)
      .ws('/path/ws')
      .expectText('hello');

    expect(ws.readyState).toEqual(WebSocket.OPEN);

    await new Promise(server.close);
    expect(ws.readyState).toBeGreaterThan(1); // CLOSING or CLOSED
  });

  it('waits for the given shutdownDelay before closing connections', async () => {
    const ws = await request(server, { shutdownDelay: 100 })
      .ws('/path/ws')
      .expectText('hello');

    expect(ws.readyState).toEqual(WebSocket.OPEN);

    server.close(); // no await

    await delay(50);
    expect(ws.readyState).toEqual(WebSocket.OPEN);

    await delay(100);
    expect(ws.readyState).toBeGreaterThan(1); // CLOSING or CLOSED
  });

  it('shuts down immediately if all connections close themselves', async () => {
    let closing;

    await request(server, { shutdownDelay: 6000 })
      .ws('/path/ws')
      .exec(async (ws) => {
        closing = new Promise(server.close);

        await delay(100);
        expect(ws.readyState).toEqual(WebSocket.OPEN); // not closed yet
      })
      .close() // close connection
      .expectClosed();

    await closing; // server closes when all connections are closed
  });

  it('propagates protocol and options', async () => {
    await request(server)
      .ws('/path/ws', ['show-foo-header'], { headers: { Foo: 'bar' } })
      .expectText('show-foo-header protocol: bar');
  });

  it('catches close events', async () => {
    await request(server)
      .ws('/path/ws')
      .sendText('trigger-server-close')
      .expectClosed();
  });

  it('checks close status codes', async () => {
    await request(server)
      .ws('/path/ws')
      .sendText('trigger-server-close')
      .expectClosed(4321, 'Oops');
  });

  it('produces errors if the connection unexpectedly succeeds', async () => {
    let capturedError = null;

    try {
      await request(server)
        .ws('/anything')
        .expectConnectionError();
    } catch (e) {
      capturedError = e;
    }

    expect(capturedError).not.toEqual(null);
    expect(capturedError.message)
      .toEqual('Expected connection failure, but succeeded');
  });

  it('closes if the connection unexpectedly succeeds', async () => {
    try {
      await request(server)
        .ws('/anything')
        .expectConnectionError();
    } catch (e) { /* expected */ }

    await delay(100); // wait for connection closure to reach server

    const connections = await promisify(server.getConnections).bind(server)();
    expect(connections).toEqual(0);
  });

  it('produces errors if an expectation is not met', async () => {
    let capturedError = null;

    try {
      await request(server)
        .ws('/path/ws')
        .expectText('nope');
    } catch (e) {
      capturedError = e;
    }

    expect(capturedError).not.toEqual(null);
    expect(capturedError.message)
      .toEqual('Expected message "nope", got "hello"');
  });

  it('stops execution of the chain if an expectation is not met', async () => {
    let runs = 0;
    try {
      await request(server)
        .ws('/path/ws')
        .exec(() => { runs += 1; })
        .expectText('nope')
        .exec(() => { runs += 1; });
    } catch (e) { /* expected */ }

    expect(runs).toEqual(1);
  });

  it('closes if an expectation is not met', async () => {
    let ws;
    try {
      await request(server)
        .ws('/path/ws')
        .exec((w) => { ws = w; })
        .expectText('nope');
    } catch (e) { /* expected */ }

    expect(ws.readyState).toBeGreaterThan(1); // CLOSING or CLOSED
  });

  it('tests JSON data', async () => {
    await request(server)
      .ws('/path/ws')
      .expectText()
      .sendText('{"foo":"bar"}')
      .expectJson({ foo: 'bar' })
      .sendText('{ "foo" : "bar" }')
      .expectJson({ foo: 'bar' })
      .sendText('{ "foo": "bar", "zig": "zag" }')
      .expectJson({ foo: 'bar', zig: 'zag' });
  });

  it('fails if JSON data does not match', async () => {
    let capturedError = null;

    try {
      await request(server)
        .ws('/path/ws')
        .expectText()
        .sendText('{"foo":"bar"}')
        .expectJson({ foo: 'nope' });
    } catch (e) {
      capturedError = e;
    }

    expect(capturedError).not.toEqual(null);
    expect(capturedError.message).toContain('Expected message {"foo":"nope"}');
    expect(capturedError.message).toContain('got {"foo":"bar"}');
  });

  it('closes if JSON data does not match', async () => {
    let ws;
    try {
      await request(server)
        .ws('/path/ws')
        .exec((w) => { ws = w; })
        .sendText('{"foo":"bar"}')
        .expectJson({ foo: 'nope' });
    } catch (e) { /* expected */ }

    expect(ws.readyState).toBeGreaterThan(1); // CLOSING or CLOSED
  });

  it('fails if data is not parsable as JSON', async () => {
    let capturedError = null;

    try {
      await request(server)
        .ws('/path/ws')
        .expectText()
        .sendText('nope')
        .expectJson({ foo: 'bar' });
    } catch (e) {
      capturedError = e;
    }

    expect(capturedError).not.toEqual(null);
    expect(capturedError.message).toContain('Unexpected token e');
  });

  it('closes if data is not parsable as JSON', async () => {
    let ws;
    try {
      await request(server)
        .ws('/path/ws')
        .exec((w) => { ws = w; })
        .sendText('nope')
        .expectJson({ foo: 'bar' });
    } catch (e) { /* expected */ }

    expect(ws.readyState).toBeGreaterThan(1); // CLOSING or CLOSED
  });

  it('produces errors if the connection closes while reading', async () => {
    let capturedError = null;

    try {
      await request(server)
        .ws('/path/ws')
        .expectText('hello')
        .sendText('trigger-server-close')
        .expectText('nope');
    } catch (e) {
      capturedError = e;
    }

    expect(capturedError).not.toEqual(null);
    expect(capturedError.message)
      .toEqual('Expected message "nope", but connection closed');
  });

  it('produces errors if the connection closes with an unexpected code', async () => {
    let capturedError = null;

    try {
      await request(server)
        .ws('/path/ws')
        .expectText('hello')
        .sendText('trigger-server-close')
        .expectClosed(4444);
    } catch (e) {
      capturedError = e;
    }

    expect(capturedError).not.toEqual(null);
    expect(capturedError.message)
      .toEqual('Expected close code 4444, got 4321');
  });

  it('produces errors if the connection closes with an unexpected message', async () => {
    let capturedError = null;

    try {
      await request(server)
        .ws('/path/ws')
        .expectText('hello')
        .sendText('trigger-server-close')
        .expectClosed(4321, 'Nope');
    } catch (e) {
      capturedError = e;
    }

    expect(capturedError).not.toEqual(null);
    expect(capturedError.message)
      .toEqual('Expected close message "Nope", got "Oops"');
  });

  it('produces errors if the connection closes while sending', async () => {
    let capturedError = null;

    try {
      await request(server)
        .ws('/path/ws')
        .expectText('hello')
        .sendText('trigger-server-close')
        .wait(100)
        .sendText('nope');
    } catch (e) {
      capturedError = e;
    }

    expect(capturedError).not.toEqual(null);
    expect(capturedError.message).toContain('WebSocket is not open');
  });

  it('executes arbitrary code via exec', async () => {
    await request(server)
      .ws('/path/ws')
      .expectText('hello')
      .exec((ws) => ws.send('foo'))
      .expectText('echo foo');
  });

  it('waits for promises returned by exec', async () => {
    let delayComplete = false;
    await request(server)
      .ws('/path/ws')
      .exec(async () => {
        await delay(50);
        delayComplete = true;
      });

    expect(delayComplete).toEqual(true);
  });

  it('closes if exec throws', async () => {
    let ws;
    try {
      await request(server)
        .ws('/path/ws')
        .exec((w) => { ws = w; })
        .exec(() => { throw new Error(); });
    } catch (e) { /* expected */ }

    expect(ws.readyState).toBeGreaterThan(1); // CLOSING or CLOSED
  });

  it('produces errors if reading after the connection has closed', async () => {
    let capturedError = null;

    try {
      await request(server)
        .ws('/path/ws')
        .expectText('hello')
        .close()
        .expectText('nope');
    } catch (e) {
      capturedError = e;
    }

    expect(capturedError).not.toEqual(null);
    expect(capturedError.message)
      .toEqual('Expected message "nope", but connection closed');
  });

  it('produces errors if sending after the connection has closed', async () => {
    let capturedError = null;

    try {
      await request(server)
        .ws('/path/ws')
        .expectText('hello')
        .close()
        .sendText('nope');
    } catch (e) {
      capturedError = e;
    }

    expect(capturedError).not.toEqual(null);
    expect(capturedError.message).toContain('WebSocket is not open');
  });
});
