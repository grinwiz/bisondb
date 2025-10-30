const { Validator } = require('../utils/Validator.js');
const { AggregationPipeline } = require('../aggregation/AggregationPipeline.js');

class Collection {
  #adapter;
  #name;
  #db;

  constructor(name, adapter, db) {
    this.#name = name;
    this.#adapter = adapter;
    this.#db = db;
  }

  async insertOne(doc, options = {}) {
    Validator.object(doc, 'Document must be an object');
    const id = await this.#adapter.write(this.#name, doc);

    if (options.returnDocument === 'after') {
      return this.findOne({ _id: id });
    }

    return { _id: id };
  }

  async insertMany(docs, options = {}) {
    Validator.array(docs, 'Documents must be a non-empty array');
    const ids = [];
    for (const doc of docs) {
      const id = await this.#adapter.write(this.#name, doc);
      ids.push(id);
    }
    return ids;
  }

  async findOne(query = {}, options = {}) {
    Validator.object(query, 'Query must be an object');
    const results = await this.#adapter.find(this.#name, query, options.projection);
    return results[0] || null;
  }

  async find(query = {}, options = {}) {
    Validator.object(query, 'Query must be an object');
    if (options.projection) Validator.object(options.projection, 'Projection must be an object');
    return this.#adapter.find(this.#name, query, options.projection);
  }

  async count(query = {}, options = {}) {
    Validator.object(query, 'Query must be an object');
    if (options.projection) Validator.object(options.projection, 'Projection must be an object');
    return this.#adapter.count(this.#name, query, options.projection);
  }

  async updateOne(filter, update, options = {}) {
    Validator.object(filter, 'Filter must be an object');
    Validator.object(update, 'Update must be an object');
    return this.#adapter.updateOne(this.#name, filter, update, options);
  }

  async update(filter, update, options = {}) {
    Validator.object(filter, 'Filter must be an object');
    Validator.object(update, 'Update must be an object');
    return this.#adapter.updateMany(this.#name, filter, update, options);
  }

  async deleteOne(filter, options = { autoCompact: true }) {
    Validator.object(filter, 'Filter must be an object');
    return this.#adapter.deleteOne(this.#name, filter, options);
  }

  async delete(filter, options = { autoCompact: true }) {
    Validator.object(filter, 'Filter must be an object');
    return this.#adapter.deleteMany(this.#name, filter, options);
  }

  async compact() {
    return this.#adapter.compact(this.#name);
  }

  async aggregate(pipeline) {
    Validator.array(pipeline, 'Aggregation pipeline must be a non-empty array');
    const docs = await this.find({});
    return AggregationPipeline.run(docs, pipeline);
  }

  async transaction(operations) {
    return this.#db.transaction([this.#name], operations);
  }
}

module.exports = { Collection };