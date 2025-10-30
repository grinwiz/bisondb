const { BisonDB } = require('./src/core/BisonDB.js');

module.exports = { BisonDB };

if (typeof window !== 'undefined') {
  window.BisonDB = BisonDB;
}