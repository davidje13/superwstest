import makeEchoServer from './helpers/echoserver.mjs';
import runServer from './helpers/runServer.mjs';
import noDangling from './helpers/noDangling.mjs';
import baseRequest from '../src/superwstest.mjs';

describe('superwstest-timeout', () => {
  const server = makeEchoServer();
  const request = baseRequest.scoped();
  beforeEach(runServer(server));
  afterEach(noDangling(request));

  it('produces errors if a timeout occurs while reading', async () => {
    await expect(
      () => request(server).ws('/path/ws').expectText('hello').expectText('nope', { timeout: 100 }),
      throws('Expected message "nope", but got Error: Timeout after 100ms'),
    );
  });

  it('uses top-level timeout if no timeout is given', async () => {
    await expect(
      () =>
        request(server, { defaultExpectOptions: { timeout: 50 } })
          .ws('/path/ws')
          .expectText('hello')
          .expectText('nope'),
      throws('Expected message "nope", but got Error: Timeout after 50ms'),
    );
  });

  it('overrides top-level timeout if explicit timeout is given', async () => {
    await expect(
      () =>
        request(server, { defaultExpectOptions: { timeout: 10000 } })
          .ws('/path/ws')
          .expectText('hello')
          .expectText('nope', { timeout: 50 }),
      throws('Expected message "nope", but got Error: Timeout after 50ms'),
    );
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
