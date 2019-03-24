module.exports = {
  options: {
    root: __dirname,
    tests: 'src',
  },
  use: [
    ['@neutrinojs/airbnb-base', {
      eslint: {
        rules: {
          'arrow-parens': ['error', 'always'],
          'operator-linebreak': ['error', 'after'],
        },
      },
    }],
    ['@neutrinojs/library', {
      name: 'superwstest',
      target: 'node',
      babel: {
        presets: [
          ['@babel/preset-env', {
            useBuiltIns: false,
            targets: {
              node: '10.15',
            },
          }],
        ],
      },
    }],
    '@neutrinojs/jest'
  ]
};
