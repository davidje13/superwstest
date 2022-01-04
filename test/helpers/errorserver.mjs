import http from 'http';

export default () => {
  const server = http.createServer((req, res) => {
    res.writeHead(404);
    res.end();
  });
  return server;
};
