const path = require('path');
const { appendDoc, appendMany } = require('../bson/bsonStreamWriter');
const { readAll } = require('../bson/bsonStreamReader');
const { updateOne, updateMany } = require('../bson/bsonStreamUpdater');
const { deleteOne, deleteMany } = require('../bson/bsonStreamDeleter');
const { compact } = require('../bson/bsonStreamCompact');

class Collection {
  constructor(name, folderPath) {
    this.name = name;
    this.filePath = path.join(folderPath, `${name}.bson`);
  }

  async insertOne(doc, options = {}) {
    const newDoc = await appendDoc(this.filePath, doc);
    if (options.returnDocument === 'after') return newDoc;
    return { acknowledged: true, insertedId: newDoc._id };
  }

  async insertMany(docs, options = {}) {
    const newDocs = await appendMany(this.filePath, docs);
    if (options.returnDocument === 'after') return newDocs;
    return { acknowledged: true, insertedIds: newDocs.map(d => d._id) };
  }

  async find(filter = {}, projection = null) {
    return readAll(this.filePath, filter, projection);
  }

  async findOne(filter = {}, projection = null) {
    const docs = await this.find(filter, projection);
    return docs.length > 0 ? docs[0] : null;
  }

  async findById(id, projection = null) {
    return this.findOne({ _id: id }, projection);
  }

  async count(filter = {}) {
    const docs = await this.find(filter);
    return docs.length;
  }

  async distinct(field, filter = {}) {
    const docs = await this.find(filter);
    const values = new Set();
    for (const doc of docs) if (field in doc) values.add(doc[field]);
    return Array.from(values);
  }

  async updateOne(filter, update, options = {}) {
    return updateOne(this.filePath, filter, update, options);
  }

  async updateMany(filter, update, options = {}) {
    return updateMany(this.filePath, filter, update, options);
  }

  async deleteOne(filter, options = {}) {
    return deleteOne(this.filePath, filter, options);
  }

  async deleteMany(filter, options = {}) {
    return deleteMany(this.filePath, filter, options);
  }

  async compact() {
    return compact(this.filePath);
  }
}

module.exports = { Collection };