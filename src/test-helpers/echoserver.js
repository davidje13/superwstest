import http from 'http';
import WebSocket from 'ws';

export default () => {
  const server = http.createServer();
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    ws.on('message', (message) => {
      if (message === 'trigger-server-close') {
        ws.close(4321, 'Oops');
        return;
      }
      ws.send(`echo ${message}`);
    });

    ws.send('hello');
  });

  return server;
};
