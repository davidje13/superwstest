import request from 'superwstest';

// this file just checks types; the code is not executed

request('hello')
  .ws('foo')
  .send('hi')
  .exec((ws) => ws.ping('blah'))
  .close();

// @ts-expect-error
request('hello').get('/hi');
