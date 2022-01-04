const defaultRequire = require('superwstest');

if (typeof defaultRequire !== 'function') {
  throw new Error("require('superwstest') did not return superwstest function");
}

if (typeof defaultRequire.default !== 'function') {
  throw new Error("require('superwstest').default did not return superwstest function");
}
