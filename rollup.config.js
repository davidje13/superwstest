export default [
  {
    input: 'src/superwstest.mjs',
    external: ['util', 'supertest', 'ws', 'https', 'net'],
    output: {
      file: 'build/superwstest.js',
      format: 'cjs',
      name: 'superwstest',
      exports: 'default',
    },
  },
];
