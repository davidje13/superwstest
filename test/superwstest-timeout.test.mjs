import makeEchoServer from './helpers/echoserver.mjs';
import withServer from './helpers/withServer.mjs';
import withScopedRequest from './helpers/withScopedRequest.mjs';

const REQUEST = withScopedRequest({ checkDanglingConnections: true });

describe('superwstest-timeout', { parallel: true }, () => {
  const SERVER = withServer(makeEchoServer);

  it('produces errors if a timeout occurs while reading', async ({
    [REQUEST]: request,
    [SERVER]: server,
  }) => {
    await expect(
      () => request(server).ws('/path/ws').expectText('hello').expectText('nope', { timeout: 100 }),
      throws('Expected message "nope", but got Error: Timeout after 100ms'),
    );
  });

  it('uses top-level timeout if no timeout is given', async ({
    [REQUEST]: request,
    [SERVER]: server,
  }) => {
    await expect(
      () =>
        request(server, { defaultExpectOptions: { timeout: 50 } })
          .ws('/path/ws')
          .expectText('hello')
          .expectText('nope'),
      throws('Expected message "nope", but got Error: Timeout after 50ms'),
    );
  });

  it('overrides top-level timeout if explicit timeout is given', async ({
    [REQUEST]: request,
    [SERVER]: server,
  }) => {
    await expect(
      () =>
        request(server, { defaultExpectOptions: { timeout: 10000 } })
          .ws('/path/ws')
          .expectText('hello')
          .expectText('nope', { timeout: 50 }),
      throws('Expected message "nope", but got Error: Timeout after 50ms'),
    );
  });

  it('cancels timeout errors after a successful message', async ({
    [REQUEST]: request,
    [SERVER]: server,
  }) => {
    await request(server)
      .ws('/path/ws')
      .expectText('hello')
      .sendText('ping')
      .expectText('echo ping', { timeout: 50 })
      .wait(100)
      .close();
  });
});
