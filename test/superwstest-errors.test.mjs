import makeErrorServer from './helpers/errorserver.mjs';
import makeSubprotocolServer from './helpers/subprotocolserver.mjs';
import withServer from './helpers/withServer.mjs';
import withScopedRequest from './helpers/withScopedRequest.mjs';

const REQUEST = withScopedRequest();

describe('superwstest-connection-errors', () => {
  const UNAVAILABLE_SERVER = 'http://127.0.0.1:12345';

  it('fails if the connection fails', async ({ [REQUEST]: request }) => {
    await expect(
      () => request(UNAVAILABLE_SERVER).ws('/anything').expectText('response'),
      throws('connect ECONNREFUSED'),
    );
  });

  it('returns a connection error if the server is not available', async ({
    [REQUEST]: request,
  }) => {
    await request(UNAVAILABLE_SERVER).ws('/anything').expectConnectionError();
  });
});

describe('superwstest-http-errors', () => {
  const SERVER = withServer(makeErrorServer);

  it('fails if the server returns 404', async ({ [REQUEST]: request, [SERVER]: server }) => {
    await expect(
      () => request(server).ws('/anything').expectText('response'),
      throws('Unexpected server response: 404'),
    );
  });

  it('fails if the server does not upgrade', async ({ [REQUEST]: request, [SERVER]: server }) => {
    await expect(
      () => request(server).ws('/200').expectText('response'),
      throws('Unexpected server response: 200'),
    );
  });

  it('catches http failures', async ({ [REQUEST]: request, [SERVER]: server }) => {
    await request(server).ws('/anything').expectConnectionError();
  });

  it('checks the status code on http failure', async ({ [REQUEST]: request, [SERVER]: server }) => {
    await request(server).ws('/anything').expectConnectionError(404);
  });

  it('checks the status code on upgrade failure', async ({
    [REQUEST]: request,
    [SERVER]: server,
  }) => {
    await request(server).ws('/200').expectConnectionError(200);
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
