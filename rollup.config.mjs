export default [
  {
    input: 'src/superwstest.mjs',
    external: [/^node:/, 'supertest', 'ws'],
    output: {
      file: 'build/superwstest.js',
      format: 'cjs',
      name: 'superwstest',
      exports: 'default',
    },
  },
];
