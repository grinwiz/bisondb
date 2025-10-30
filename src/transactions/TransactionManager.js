class TransactionManager {
  #adapter;

  constructor(adapter) {
    this.#adapter = adapter;
  }

  async run(collections, operations) {
    // In-memory transaction for Node (no real rollback in IndexedDB)
    const snapshots = {};
    for (const coll of collections) {
      snapshots[coll] = await this.#adapter.find(coll, {});
    }

    try {
      const context = { db: { collection: (name) => this.#createTxCollection(name, snapshots) } };
      await operations(context);
      return { acknowledged: true };
    } catch (err) {
      // Rollback in-memory
      for (const [coll, docs] of Object.entries(snapshots)) {
        await this.#adapter.delete(coll, {});
        for (const doc of docs) await this.#adapter.write(coll, doc);
      }
      throw err;
    }
  }

  #createTxCollection(name, snapshots) {
    return {
      insert: async (doc) => this.#adapter.write(name, doc),
      updateOne: async (f, u) => this.#adapter.updateOne(name, f, u),
      deleteOne: async (f) => this.#adapter.deleteOne(name, f)
    };
  }
}

module.exports = { TransactionManager };