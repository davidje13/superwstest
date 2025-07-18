import makeErrorServer from './helpers/errorserver.mjs';
import makeSubprotocolServer from './helpers/subprotocolserver.mjs';
import withServer from './helpers/withServer.mjs';
import withScopedRequest from './helpers/withScopedRequest.mjs';

const REQUEST = withScopedRequest();

describe('superwstest-http-errors', () => {
  const SERVER = withServer(makeErrorServer);

  it('catches connection failures', async ({ [REQUEST]: request, [SERVER]: server }) => {
    await request(server).ws('/anything').expectConnectionError();
  });

  it('checks the status code on connection failure', async ({
    [REQUEST]: request,
    [SERVER]: server,
  }) => {
    await request(server).ws('/anything').expectConnectionError(404);
  });

  it('produces errors if the expected status code does not match', async ({
    [REQUEST]: request,
    [SERVER]: server,
  }) => {
    await expect(
      () => request(server).ws('/anything').expectConnectionError(405),
      throws(
        'Expected connection failure with message "Unexpected server response: 405", but got "Unexpected server response: 404"',
      ),
    );
  });
});

describe('superwstest-protocol-errors', () => {
  const SERVER = withServer(makeSubprotocolServer);

  it('checks the error message on connection failure', async ({
    [REQUEST]: request,
    [SERVER]: server,
  }) => {
    await request(server)
      .ws('/anything', 'unknown_subprotocol')
      .expectConnectionError('Server sent an invalid subprotocol');
  });

  it('produces errors if the expected error message does not match', async ({
    [REQUEST]: request,
    [SERVER]: server,
  }) => {
    await expect(
      () =>
        request(server)
          .ws('/anything', 'unknown_subprotocol')
          .expectConnectionError('unknown error message'),
      throws(
        'Expected connection failure with message "unknown error message", but got "Server sent an invalid subprotocol"',
      ),
    );
  });
});
