import request from 'superwstest';

// this file just checks types; the code is not executed

request('hello')
  .ws('foo')
  .send('hi')
  .exec((ws) => ws.ping('blah'))
  .close();

request.closeAll();

const scopedRequest = request.scoped();

scopedRequest('hello')
  .ws('foo')
  .send('hi')
  .exec((ws) => ws.ping('blah'))
  .close();

scopedRequest.closeAll();

// @ts-expect-error
request(1);

// @ts-expect-error
scopedRequest(1);

// @ts-expect-error
request('hello').ws(1);

// @ts-expect-error
scopedRequest('hello').ws(1);
