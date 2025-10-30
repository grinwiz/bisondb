const fs = require('fs');
const path = require('path');
const { IStorageAdapter } = require('../../interfaces/IStorageAdapter.js');
const { deserialize, serialize, ObjectId } = require('bson');
const { matchesFilter, applyProjection } = require('../../../utils/QueryMatcher.js');
const { streamUpdateOne, streamUpdateMany } = require('../../../utils/UpdateEngine.js');
const { streamDeleteOne, streamDeleteMany } = require('../../../utils/DeleteEngine.js');
const { streamCompact } = require('../../../utils/CompactEngine.js');

const DB_DIR = path.resolve(process.cwd(), '.bisondb');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

class FileStorageAdapter extends IStorageAdapter {
  #getPath(collection) {
    return path.join(DB_DIR, `${collection}.bson`);
  }

  async write(collection, doc) {
    const file = this.#getPath(collection);
    const id = doc._id ?? new ObjectId().toHexString();
    const payload = { ...doc, _id: id };

    const b = serialize(payload);
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32LE(b.length, 0);
    const buf = Buffer.concat([lenBuf, b]);

    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    await fs.promises.appendFile(file, buf);
    return id;
  }

  async find(collection, query = {}, projection = null) {
    const file = this.#getPath(collection);
    if (!fs.existsSync(file)) return [];

    const stream = fs.createReadStream(file);
    const results = [];
    let buffer = Buffer.alloc(0);
    let offset = 0;

    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= offset + 4) {
        const docLen = buffer.readUInt32LE(offset);
        offset += 4;
        if (buffer.length < offset + docLen) break;

        const docBuf = buffer.slice(offset, offset + docLen);
        const doc = deserialize(docBuf);
        offset += docLen;

        if (doc._deleted) continue;
        if (matchesFilter(doc, query)) {
          results.push(projection ? applyProjection(doc, projection) : doc);
        }
      }
      buffer = buffer.slice(offset);
      offset = 0;
    }
    return results;
  }

  async count(collection, query = {}) {
    const file = this.#getPath(collection);
    if (!fs.existsSync(file)) return 0;

    const stream = fs.createReadStream(file);
    let buffer = Buffer.alloc(0);
    let offset = 0;
    let count = 0;

    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);

      while (buffer.length >= offset + 4) {
        const docLen = buffer.readUInt32LE(offset);
        offset += 4;

        if (buffer.length < offset + docLen) break;

        const docBuf = buffer.slice(offset, offset + docLen);
        const doc = deserialize(docBuf);
        offset += docLen;

        if (doc._deleted) continue;
        if (matchesFilter(doc, query)) count++;
      }

      buffer = buffer.slice(offset);
      offset = 0;
    }

    return count;
  }

  async updateOne(collection, filter, update, options = {}) {
    const file = this.#getPath(collection);
    if (!fs.existsSync(file)) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };

    const tmp = `${file}.tmp`;
    const readStream = fs.createReadStream(file);
    const writeStream = fs.createWriteStream(tmp);
    const result = await streamUpdateOne(readStream, writeStream, filter, update, options.returnDocument);

    await new Promise((resolve, reject) => {
      writeStream.on('close', resolve);
      writeStream.on('error', reject);
      writeStream.end(); // Ensure end is called
    });
    fs.renameSync(tmp, file);

    if (options.returnDocument === 'after') {
      return result.document;
    }

    return {
      acknowledged: true,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      ...(options.returnDocument ? { document: result.document } : {})
    };
  }

  async updateMany(collection, filter, update, options = {}) {
    const file = this.#getPath(collection);
    if (!fs.existsSync(file)) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };

    const tmp = `${file}.tmp`;
    const readStream = fs.createReadStream(file);
    const writeStream = fs.createWriteStream(tmp);

    const result = await streamUpdateMany(readStream, writeStream, filter, update, options.returnDocument);

    await new Promise((resolve, reject) => {
      writeStream.on('close', resolve);
      writeStream.on('error', reject);
      writeStream.end();
    });

    fs.renameSync(tmp, file);

    return {
      acknowledged: true,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      ...(options.returnDocument ? { document: result.document } : {})
    };
  }

  async deleteOne(collection, filter, options = { autoCompact: true }) {
    const file = this.#getPath(collection);
    if (!fs.existsSync(file)) return { deletedCount: 0 };

    const tmp = `${file}.tmp`;
    const readStream = fs.createReadStream(file);
    const writeStream = fs.createWriteStream(tmp);

    const result = await streamDeleteOne(readStream, writeStream, filter);

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      readStream.on('end', () => writeStream.end()); // end only after read completes
    });


    fs.renameSync(tmp, file);

    if (options.autoCompact && result.deletedCount > 0) {
      await this.compact(collection);
    }

    return result;
  }

  async deleteMany(collection, filter, options = { autoCompact: true }) {
    const file = this.#getPath(collection);
    if (!fs.existsSync(file)) return { deletedCount: 0 };

    const tmp = `${file}.tmp`;
    const readStream = fs.createReadStream(file);
    const writeStream = fs.createWriteStream(tmp);

    const result = await streamDeleteMany(readStream, writeStream, filter);

    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      readStream.on('end', () => writeStream.end()); // end only after read completes
    });

    fs.renameSync(tmp, file);

    if (options.autoCompact && result.deletedCount > 0) {
      await this.compact(collection);
    }

    return result;
  }

  async compact(collection) {
    const file = this.#getPath(collection);
    if (!fs.existsSync(file)) return;

    const tmp = `${file}.tmp`;
    const readStream = fs.createReadStream(file);
    const writeStream = fs.createWriteStream(tmp);
    await streamCompact(readStream, writeStream);
    await new Promise(res => writeStream.once('finish', res));
    fs.renameSync(tmp, file);
  }

  async beginTransaction() { return null; }
  async commitTransaction() { }
  async rollbackTransaction() { }
}

module.exports = { FileStorageAdapter };