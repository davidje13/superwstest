import makeErrorServer from './test-helpers/errorserver';
import request from './superwstest';

describe('superwstest-errors', () => {
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
