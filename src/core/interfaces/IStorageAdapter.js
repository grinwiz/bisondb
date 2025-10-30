class IStorageAdapter {
  async write(collection, doc) { throw new Error('Not implemented'); }
  async find(collection, query = {}, projection = null) { throw new Error('Not implemented'); }
  async count(collection, query = {}, projection = null) { throw new Error('Not implemented'); }
  async updateOne(collection, filter, update, options = {}) { throw new Error('Not implemented'); }
  async updateMany(collection, filter, update, options = {}) { throw new Error('Not implemented'); }
  async deleteOne(collection, filter, options = {}) { throw new Error('Not implemented'); }
  async deleteMany(collection, filter, options = {}) { throw new Error('Not implemented'); }
  async compact(collection) { throw new Error('Not implemented'); }
  async listCollections() { return []; }
  async beginTransaction() { return null; }
  async commitTransaction(tx) { }
  async rollbackTransaction(tx) { }
}

module.exports = { IStorageAdapter };