const defaultRequire = require('../build/index.js');

describe('cjs module syntax', () => {
  it('exports the request method as the default export', async () => {
    expect(typeof defaultRequire, equals('function'));
  });

  it('is also available via .default', async () => {
    expect(typeof defaultRequire.default, equals('function'));
  });
});
