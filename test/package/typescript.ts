import request from 'superwstest';
import { createServer as httpCreateServer } from 'http';
import { createServer as httpsCreateServer } from 'https';
import { WebSocketServer } from 'ws';

// this file just checks types; the code is not executed

request('hello')
  .ws('foo')
  .send('hi')
  .exec((ws) => ws.ping('blah'))
  .close();

request(httpCreateServer()).ws('foo');
request(httpsCreateServer()).ws('foo');
request(new WebSocketServer({ port: 0 })).ws('foo');

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
request(new WebSocket('x'));

// @ts-expect-error
scopedRequest(1);

// @ts-expect-error
request('hello').ws(1);

// @ts-expect-error
scopedRequest('hello').ws(1);
