import defaultImport from '../build/index';

const defaultRequire = require('../build/index');

describe('es6 module syntax', () => {
  it('exports the request method as the default export', async () => {
    expect(typeof defaultImport).toEqual('function');
  });
});

describe('cjs module syntax', () => {
  it('exports the request method as the default export', async () => {
    expect(typeof defaultRequire).toEqual('function');
  });

  it('is also available via .default', async () => {
    expect(typeof defaultRequire.default).toEqual('function');
  });
});
