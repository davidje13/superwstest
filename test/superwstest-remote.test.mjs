import makeEchoServer from './helpers/echoserver.mjs';
import withServer from './helpers/withServer.mjs';
import withScopedRequest from './helpers/withScopedRequest.mjs';

const REQUEST = withScopedRequest({ checkDanglingConnections: true });

describe('superwstest-remote', () => {
  const SERVER = withServer(makeEchoServer, '127.0.0.1');

  it('communicates via websockets to the remote server', async ({
    [REQUEST]: request,
    [SERVER]: server,
  }) => {
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

  it('automatically converts protocol from http to ws', async ({
    [REQUEST]: request,
    [SERVER]: server,
  }) => {
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
  const SERVER = withServer(makeEchoServer, '::1');

  it('automatically converts protocol from http to ws', async ({
    [REQUEST]: request,
    [SERVER]: server,
  }) => {
    const serverAddress = `http://[::1]:${server.address().port}`;
    await request(serverAddress).ws('/path/ws').expectText('hello').close(1001).expectClosed(1001);
  });
});
