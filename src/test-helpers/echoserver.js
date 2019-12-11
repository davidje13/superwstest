import http from 'http';
import WebSocket from 'ws';

export default () => {
  const server = http.createServer();
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    ws.on('message', (message) => {
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
