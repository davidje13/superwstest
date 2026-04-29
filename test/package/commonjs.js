const { createServer } = require('node:http');
const defaultRequire = require('superwstest');

if (typeof defaultRequire !== 'function') {
  throw new Error("require('superwstest') did not return superwstest function");
}

// test proxying to supertest
const server = createServer((req, res) => {
  res.writeHead(req.url === '/path' ? 200 : 404);
  res.end();
});

server.listen(0, '::1', async (err) => {
  if (err) {
    throw err;
  }
  await defaultRequire(server).get('/path').expect(200);
  await defaultRequire(server).ws('/foo').expectConnectionError(404);
  server.close();
});
