import makeEchoServer from './test-helpers/echoserver.mjs';
import runServer from './test-helpers/runServer.mjs';
import noDangling from './test-helpers/noDangling.mjs';
import baseRequest from './superwstest.mjs';

describe('superwstest-remote', () => {
  const server = makeEchoServer();
  const request = baseRequest.scoped();
  beforeEach(runServer(server, '127.0.0.1'));
  afterEach(noDangling(request));

  it('communicates via websockets to the remote server', async () => {
    const serverAddress = `ws://127.0.0.1:${server.address().port}`;
    await request(serverAddress)
      .ws('/path/ws')
      .expectText('hello')
      .sendText('foo')
      .expectText('echo foo')
      .sendText('abc')
      .expectText('echo abc')
      .close(1001)
      .expectClosed(1001);
  });

  it('automatically converts protocol from http to ws', async () => {
    const serverAddress = `http://127.0.0.1:${server.address().port}`;
    await request(serverAddress)
      .ws('/path/ws')
      .expectText('hello')
      .sendText('foo')
      .expectText('echo foo')
      .sendText('abc')
      .expectText('echo abc')
      .close(1001)
      .expectClosed(1001);
  });
});

describe('superwstest-remote IPv6', () => {
  const server = makeEchoServer();
  const request = baseRequest.scoped();
  beforeEach(runServer(server, '::1'));
  afterEach(noDangling(request));

  it('automatically converts protocol from http to ws', async () => {
    const serverAddress = `http://[::1]:${server.address().port}`;
    await request(serverAddress)
      .ws('/path/ws')
      .expectText('hello')
      .close(1001)
      .expectClosed(1001);
  });
});
