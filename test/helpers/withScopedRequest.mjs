import baseRequest from '../../src/superwstest.mjs';

export default function withScopedRequest({ checkDanglingConnections = false } = {}) {
  beforeEach(async ({ addTestParameter }) => {
    const request = baseRequest.scoped();
    addTestParameter(request);
    return () => {
      const danglingConnections = request.closeAll();
      if (checkDanglingConnections && danglingConnections > 0) {
        throw new Error(`Found ${danglingConnections} dangling connection(s) after test`);
      }
    };
  });
}
