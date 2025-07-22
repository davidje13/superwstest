import { createServer } from 'node:http';

export default () => {
  const server = createServer((req, res) => {
    if (req.url === '/200') {
      res.writeHead(200);
    } else {
      res.writeHead(404);
    }
    res.end();
  });
  return server;
};
