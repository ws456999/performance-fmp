const path = require('path');
const pkg = require('../package.json');
const packageVersion = pkg.version;

const isDEV = process.env.NODE_ENV !== 'production';
const resolve = (...args) => path.join(__dirname, '../', ...args);


module.exports = {
  isDEV,
  resolve,
}
