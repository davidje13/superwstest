import http from 'http';
import WebSocket from 'ws';

export default () => {
  const server = http.createServer();
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    ws.on('message', (data, isBinary) => {
      if (isBinary || (isBinary === undefined && typeof data !== 'string')) {
        ws.send(Buffer.concat([
          new Uint8Array([111]),
          new Uint8Array(data),
        ]));
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

    if (ws.protocol === 'show-foo-header') {
      ws.send(`show-foo-header protocol: ${req.headers.foo}`);
    } else {
      ws.send('hello');
    }
  });

  return server;
};
