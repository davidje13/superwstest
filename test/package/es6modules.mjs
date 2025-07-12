import { createServer } from 'node:http';
import defaultImport from 'superwstest';

if (typeof defaultImport !== 'function') {
  throw new Error("import 'superwstest' did not return superwstest function");
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
  await defaultImport(server).get('/path').expect(200);
  server.close();
});
