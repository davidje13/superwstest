import http from 'http';
import WebSocket from 'ws';

const SUPPORTED_SUBPROTOCOL = 'supported_subprotocol';

export default () => {
  const server = http.createServer();
  // eslint-disable-next-line no-new
  new WebSocket.Server({
    server,
    handleProtocols: () => SUPPORTED_SUBPROTOCOL,
  });

  return server;
};
