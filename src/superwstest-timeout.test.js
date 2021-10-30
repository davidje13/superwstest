import makeEchoServer from './test-helpers/echoserver';
import request from './superwstest';

describe('superwstest-timeout', () => {
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

  it('produces errors if a timeout occurs while reading', async () => {
    await expect(
      () => request(server)
        .ws('/path/ws')
        .expectText('hello')
        .expectText('nope', { timeout: 100 }),
    ).rejects.toThrow('Expected message "nope", but got Error: Timeout after 100ms');
  });

  it('uses top-level timeout if no timeout is given', async () => {
    await expect(
      () => request(server, { defaultExpectOptions: { timeout: 50 } })
        .ws('/path/ws')
        .expectText('hello')
        .expectText('nope'),
    ).rejects.toThrow('Expected message "nope", but got Error: Timeout after 50ms');
  });

  it('overrides top-level timeout if explicit timeout is given', async () => {
    await expect(
      () => request(server, { defaultExpectOptions: { timeout: 10000 } })
        .ws('/path/ws')
        .expectText('hello')
        .expectText('nope', { timeout: 50 }),
    ).rejects.toThrow('Expected message "nope", but got Error: Timeout after 50ms');
  });

  it('cancels timeout errors after a successful message', async () => {
    await request(server)
      .ws('/path/ws')
      .expectText('hello')
      .sendText('ping')
      .expectText('echo ping', { timeout: 50 })
      .wait(100)
      .close();
  });
});
