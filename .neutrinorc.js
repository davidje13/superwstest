const airbnbBase = require('@neutrinojs/airbnb-base');
const library = require('@neutrinojs/library');
const jest = require('@neutrinojs/jest');

module.exports = {
  options: {
    root: __dirname,
    tests: 'src',
  },
  use: [
    airbnbBase({
      eslint: {
        rules: {
          'arrow-parens': ['error', 'always'],
          'operator-linebreak': ['error', 'after'],
          'jest/expect-expect': ['off'],
        },
      },
    }),
    library({
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
    }),
    // https://github.com/webpack/webpack/issues/3929#issuecomment-432194802
    (neutrino) => neutrino.config.output.libraryExport('default'),
    jest(),
  ],
};
