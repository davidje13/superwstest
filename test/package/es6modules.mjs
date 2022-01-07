import defaultImport from 'superwstest';

if (typeof defaultImport !== 'function') {
  throw new Error("import 'superwstest' did not return superwstest function");
}

if (typeof defaultImport('http://localhost').get !== 'function') {
  throw new Error('supertest proxy not connected');
}
