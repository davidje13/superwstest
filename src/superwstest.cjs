import { makeScopedRequest } from './makeScopedRequest.mjs';

// supertest is an optional dependency
const stRequest = (() => {
  try {
    const m = require('supertest');
    return m.default || m;
  } catch (e) {
    return undefined;
  }
})();

const request = makeScopedRequest(stRequest);
export default request;
