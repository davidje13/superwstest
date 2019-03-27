import WebSocket from 'ws';
import makeEchoServer from './test-helpers/echoserver';
import request from './superwstest';

describe('superwstest', () => {
  const server = makeEchoServer();

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

  it('closes connections automatically on server shutdown', async () => {
    const ws = await request(server)
      .ws('/path/ws')
      .expectText('hello');

    expect(ws.readyState).toEqual(WebSocket.OPEN);

    await new Promise(server.close);
    expect(ws.readyState).toBeGreaterThan(1); // CLOSING or CLOSED
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
      .toEqual('Expected message \'nope\', got \'hello\'');
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
      .toEqual('Expected message \'nope\', but connection closed');
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
      .toEqual('Expected close message \'Nope\', got \'Oops\'');
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
      .toEqual('Expected message \'nope\', but connection closed');
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
