import makeErrorServer from './helpers/errorserver.mjs';
import makeSubprotocolServer from './helpers/subprotocolserver.mjs';
import withServer from './helpers/withServer.mjs';
import withScopedRequest from './helpers/withScopedRequest.mjs';

describe('superwstest-http-errors', () => {
  withServer(makeErrorServer);
  withScopedRequest();

  it('catches connection failures', async (server, request) => {
    await request(server).ws('/anything').expectConnectionError();
  });

  it('checks the status code on connection failure', async (server, request) => {
    await request(server).ws('/anything').expectConnectionError(404);
  });

  it('produces errors if the expected status code does not match', async (server, request) => {
    await expect(
      () => request(server).ws('/anything').expectConnectionError(405),
      throws(
        'Expected connection failure with message "Unexpected server response: 405", got "Unexpected server response: 404"',
      ),
    );
  });
});

describe('superwstest-protocol-errors', () => {
  withServer(makeSubprotocolServer);
  withScopedRequest();

  it('checks the error message on connection failure', async (server, request) => {
    await request(server)
      .ws('/anything', 'unknown_subprotocol')
      .expectConnectionError('Server sent an invalid subprotocol');
  });

  it('produces errors if the expected error message does not match', async (server, request) => {
    await expect(
      () =>
        request(server)
          .ws('/anything', 'unknown_subprotocol')
          .expectConnectionError('unknown error message'),
      throws(
        'Expected connection failure with message "unknown error message", got "Server sent an invalid subprotocol"',
      ),
    );
  });
});
