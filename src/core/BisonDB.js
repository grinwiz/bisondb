const { Collection } = require('./Collection.js');
const { createAdapter } = require('./adapters/adapterFactory.js');
const { TransactionManager } = require('../transactions/TransactionManager.js');

class BisonDB {
  #adapter;
  #transactionManager;

  constructor(options = {}) {
    this.#adapter = createAdapter(options);
    this.#transactionManager = new TransactionManager(this.#adapter);
  }

  collection(name) {
    if (typeof name !== 'string' || name.trim() === '') {
      throw new Error('Collection name must be a non-empty string');
    }
    return new Collection(name, this.#adapter, this);
  }

  async transaction(collections, operations) {
    if (!Array.isArray(collections) || collections.length === 0) {
      throw new Error('Collections must be a non-empty array');
    }
    return this.#transactionManager.run(collections, operations);
  }
}

module.exports = { BisonDB };