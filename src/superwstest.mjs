import { makeScopedRequest } from './makeScopedRequest.mjs';

// supertest is an optional dependency
const stRequest = await import('supertest').then(
  (m) => m.default,
  () => undefined,
);

const request = makeScopedRequest(stRequest);
export default request;
