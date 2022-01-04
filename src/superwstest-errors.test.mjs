import makeErrorServer from './test-helpers/errorserver.mjs';
import makeSubprotocolServer from './test-helpers/subprotocolserver.mjs';
import runServer from './test-helpers/runServer.mjs';
import baseRequest from './superwstest.mjs';

describe('superwstest-http-errors', () => {
  const server = makeErrorServer();
  const request = baseRequest.scoped();
  beforeEach(runServer(server));

  it('catches connection failures', async () => {
    await request(server)
      .ws('/anything')
      .expectConnectionError();
  });

  it('checks the status code on connection failure', async () => {
    await request(server)
      .ws('/anything')
      .expectConnectionError(404);
  });

  it('produces errors if the expected status code does not match', async () => {
    await expect(
      () => request(server)
        .ws('/anything')
        .expectConnectionError(405),
      throws('Expected connection failure with message "Unexpected server response: 405", got "Unexpected server response: 404"'),
    );
  });
});

describe('superwstest-protocol-errors', () => {
  const server = makeSubprotocolServer();
  const request = baseRequest.scoped();
  beforeEach(runServer(server));

  it('checks the error message on connection failure', async () => {
    await request(server)
      .ws('/anything', 'unknown_subprotocol')
      .expectConnectionError('Server sent an invalid subprotocol');
  });

  it('produces errors if the expected error message does not match', async () => {
    await expect(
      () => request(server)
        .ws('/anything', 'unknown_subprotocol')
        .expectConnectionError('unknown error message'),
      throws('Expected connection failure with message "unknown error message", got "Server sent an invalid subprotocol"'),
    );
  });
});
