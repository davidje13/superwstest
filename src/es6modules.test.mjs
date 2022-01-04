import defaultImport from '../build/index.js';

describe('es6 module syntax', () => {
  it('exports the request method as the default export', async () => {
    expect(typeof defaultImport, equals('function'));
  });
});
