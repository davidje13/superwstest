import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

const SUPPORTED_SUBPROTOCOL = 'supported_subprotocol';

export default () => {
  const server = createServer();
  // eslint-disable-next-line no-new
  new WebSocketServer({
    server,
    handleProtocols: () => SUPPORTED_SUBPROTOCOL,
  });

  return server;
};
