import baseRequest from '../../src/superwstest.mjs';

export default function withScopedRequest({ checkDanglingConnections = false } = {}) {
  return beforeEach(async ({ setParameter }) => {
    const request = baseRequest.scoped();
    setParameter(request);
    return () => {
      const danglingConnections = request.closeAll();
      if (checkDanglingConnections && danglingConnections > 0) {
        throw new Error(`Found ${danglingConnections} dangling connection(s) after test`);
      }
    };
  });
}
