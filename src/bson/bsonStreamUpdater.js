// bsonStreamUpdater.js
// Async updater for collection .bson files
// Supports MongoDB-like update operators: $set, $inc, $unset, $push
// Supports returnDocument: 'after' | 'before'

const fs = require('fs').promises;
const { deserialize, serialize, ObjectId } = require('bson');
const { matchesFilter } = require('./bsonStreamReader');

/**
 * updateOne - updates the first matching document
 * @param {string} filePath
 * @param {object} filter
 * @param {object} update
 * @param {object} options { returnDocument: 'after' | 'before' }
 * @returns {Promise<object>} Mongo-like result
 */
async function updateOne(filePath, filter, update, options = {}) {
  const allDocs = await readAllDocs(filePath);
  let matchedCount = 0;
  let modifiedCount = 0;
  let resultDoc = null;

  for (let i = 0; i < allDocs.length; i++) {
    const doc = allDocs[i];
    if (doc._deleted) continue;
    if (matchesFilter(doc, filter)) {
      matchedCount++;
      const originalDoc = { ...doc };
      const updatedDoc = applyUpdateOperators(doc, update);
      if (JSON.stringify(updatedDoc) !== JSON.stringify(doc)) modifiedCount++;
      allDocs[i] = updatedDoc;
      resultDoc = options.returnDocument === 'after' ? updatedDoc : originalDoc;
      break; // only update first match
    }
  }

  await writeAllDocs(filePath, allDocs);

  if (!options.returnDocument) {
    return { acknowledged: true, matchedCount, modifiedCount };
  }

  return resultDoc;
}

/**
 * updateMany - updates all matching documents
 * @param {string} filePath
 * @param {object} filter
 * @param {object} update
 * @param {object} options { returnDocument: 'after' | 'before' }
 * @returns {Promise<object>} Mongo-like result
 */
async function updateMany(filePath, filter, update, options = {}) {
  const allDocs = await readAllDocs(filePath);
  let matchedCount = 0;
  let modifiedCount = 0;
  const resultDocs = [];

  for (let i = 0; i < allDocs.length; i++) {
    const doc = allDocs[i];
    if (doc._deleted) continue;
    if (matchesFilter(doc, filter)) {
      matchedCount++;
      const originalDoc = { ...doc };
      const updatedDoc = applyUpdateOperators(doc, update);
      if (JSON.stringify(updatedDoc) !== JSON.stringify(doc)) modifiedCount++;
      allDocs[i] = updatedDoc;
      resultDocs.push(options.returnDocument === 'after' ? updatedDoc : originalDoc);
    }
  }

  await writeAllDocs(filePath, allDocs);

  if (!options.returnDocument) {
    return { acknowledged: true, matchedCount, modifiedCount };
  }

  return resultDocs;
}

/**
 * Apply MongoDB-like update operators to a document
 * Supports $set, $inc, $unset, $push
 */
function applyUpdateOperators(doc, update) {
  const newDoc = { ...doc };
  for (const op of Object.keys(update)) {
    const changes = update[op];
    switch (op) {
      case '$set':
        Object.assign(newDoc, changes);
        break;
      case '$inc':
        for (const k of Object.keys(changes)) {
          if (typeof newDoc[k] === 'number') newDoc[k] += changes[k];
          else newDoc[k] = changes[k];
        }
        break;
      case '$unset':
        for (const k of Object.keys(changes)) {
          delete newDoc[k];
        }
        break;
      case '$push':
        for (const k of Object.keys(changes)) {
          if (!Array.isArray(newDoc[k])) newDoc[k] = [];
          newDoc[k].push(changes[k]);
        }
        break;
      default:
        throw new Error(`Unsupported update operator ${op}`);
    }
  }
  return newDoc;
}

/**
 * Read all documents from a file
 */
async function readAllDocs(filePath) {
  const docs = [];
  try {
    const buf = await fs.readFile(filePath).catch(err => {
      if (err.code === 'ENOENT') return Buffer.alloc(0);
      throw err;
    });
    let offset = 0;
    while (offset < buf.length) {
      const len = buf.readUInt32LE(offset);
      offset += 4;
      const docBuf = buf.slice(offset, offset + len);
      offset += len;
      docs.push(deserialize(docBuf));
    }
  } catch (err) {
    throw new Error(`Failed to read documents: ${err.message}`);
  }
  return docs;
}

/**
 * Write all documents back to file (overwrite)
 */
async function writeAllDocs(filePath, docs) {
  const parts = [];
  for (const doc of docs) {
    const b = serialize(doc);
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32LE(b.length, 0);
    parts.push(lenBuf, b);
  }
  const buf = Buffer.concat(parts);
  await fs.writeFile(filePath, buf);
}

module.exports = { updateOne, updateMany };
