import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

export const echo = (ws, req) => {
  ws.on('message', (data, isBinary) => {
    if (isBinary || (isBinary === undefined && typeof data !== 'string')) {
      ws.send(Buffer.concat([new Uint8Array([111]), new Uint8Array(data)]));
      return;
    }
    const message = String(data);
    if (message === 'trigger-server-close') {
      ws.close(4321, 'Oops');
      return;
    }
    if (message.startsWith('{')) {
      ws.send(message);
    } else {
      ws.send(`echo ${message}`);
    }
  });

  if (ws.protocol === 'show-test-headers') {
    ws.send(
      `show-test-headers protocol: ${req.headers.foo}, ${req.headers.bar}, ${req.headers.baz}`,
    );
  } else if (req.headers['x-special-header']) {
    ws.send('special!');
  } else {
    ws.send('hello');
  }
};

export default () => {
  const server = createServer();
  new WebSocketServer({ server }).on('connection', echo);
  return server;
};
