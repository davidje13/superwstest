import makeEchoServer from './test-helpers/echoserver';
import request from './superwstest';

describe('superwstest-remote', () => {
  const server = makeEchoServer();

  beforeEach((done) => {
    server.listen(0, 'localhost', done);
  });

  afterEach((done) => {
    const danglingConnections = request.closeAll();
    server.close(done);
    if (danglingConnections > 0) {
      throw new Error(`Found ${danglingConnections} dangling connection(s) after test`);
    }
  });

  it('communicates via websockets to the remote server', async () => {
    const serverAddress = `ws://localhost:${server.address().port}`;
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
    const serverAddress = `http://localhost:${server.address().port}`;
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
