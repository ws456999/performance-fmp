const baseConfig = require('./webpack.base');
const merge = require('webpack-merge');

const config = merge(baseConfig, {
  mode: 'production',
});

module.exports = config;

