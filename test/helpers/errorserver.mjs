import { createServer } from 'node:http';

export default () => {
  const server = createServer((req, res) => {
    res.writeHead(404);
    res.end();
  });
  return server;
};
