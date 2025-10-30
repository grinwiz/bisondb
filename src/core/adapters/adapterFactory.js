const { FileStorageAdapter } = require('./node/FileStorageAdapter.js');
const { IndexedDBAdapter } = require('./browser/IndexedDBAdapter.js');

function createAdapter({ env = 'auto' } = {}) {
  if (env === 'node') return new FileStorageAdapter();
  if (env === 'browser') return new IndexedDBAdapter();

  if (typeof process !== 'undefined' && process.versions?.node) {
    return new FileStorageAdapter();
  }

  if (typeof window !== 'undefined' && 'indexedDB' in window) {
    return new IndexedDBAdapter();
  }

  throw new Error('BisonDB: Unsupported runtime');
}

module.exports = { createAdapter };