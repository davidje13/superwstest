export default [
  {
    input: 'src/superwstest.mjs',
    external: [/^node:/, 'supertest', 'ws'],
    output: { file: 'build/superwstest.mjs', format: 'es' },
  },
  {
    input: 'src/superwstest.cjs',
    external: [/^node:/, 'supertest', 'ws'],
    output: {
      file: 'build/superwstest.cjs',
      format: 'cjs',
      name: 'superwstest',
      exports: 'default',
    },
  },
];
