import makeErrorServer from './test-helpers/errorserver';
import makeSubprotocolServer from './test-helpers/subprotocolserver';
import request from './superwstest';

describe('superwstest-http-errors', () => {
  const server = makeErrorServer();

  beforeEach((done) => {
    server.listen(0, 'localhost', done);
  });

  afterEach((done) => {
    server.close(done);
  });

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
    let capturedError = null;

    try {
      await request(server)
        .ws('/anything')
        .expectConnectionError(405);
    } catch (e) {
      capturedError = e;
    }

    expect(capturedError).not.toEqual(null);
    expect(capturedError.message)
      .toEqual('Expected connection failure with message "Unexpected server response: 405", got "Unexpected server response: 404"');
  });
});

describe('superwstest-protocol-errors', () => {
  const server = makeSubprotocolServer();

  beforeEach((done) => {
    server.listen(0, 'localhost', done);
  });

  afterEach((done) => {
    server.close(done);
  });

  it('checks the error message on connection failure', async () => {
    await request(server)
      .ws('/anything', 'unknown_subprotocol')
      .expectConnectionError('Server sent an invalid subprotocol');
  });

  it('produces errors if the expected error message does not match', async () => {
    let capturedError = null;

    try {
      await request(server)
        .ws('/anything', 'unknown_subprotocol')
        .expectConnectionError('unknown error message');
    } catch (e) {
      capturedError = e;
    }

    expect(capturedError).not.toEqual(null);
    expect(capturedError.message)
      .toEqual('Expected connection failure with message "unknown error message", got "Server sent an invalid subprotocol"');
  });
});
