// bsonStreamDeleter.js
// Async deleter for collection .bson files
// Implements deleteOne and deleteMany by marking documents as _deleted
// Supports optional autoCompact

const fs = require('fs').promises;
const { deserialize, serialize } = require('bson');
const { matchesFilter } = require('./bsonStreamReader');
const { compact } = require('./bsonStreamCompact');

/**
 * deleteOne - marks the first matching document as deleted
 * @param {string} filePath
 * @param {object} filter
 * @param {object} options { autoCompact: boolean }
 * @returns {Promise<object>} { deletedCount }
 */
async function deleteOne(filePath, filter, options = { autoCompact: true }) {
  const allDocs = await readAllDocs(filePath);
  let deletedCount = 0;

  for (let i = 0; i < allDocs.length; i++) {
    const doc = allDocs[i];
    if (doc._deleted) continue;
    if (matchesFilter(doc, filter)) {
      doc._deleted = true;
      allDocs[i] = doc;
      deletedCount = 1;
      break;
    }
  }

  await writeAllDocs(filePath, allDocs);

  if (options.autoCompact && deletedCount > 0) {
    await compact(filePath);
  }

  return { deletedCount };
}

/**
 * deleteMany - marks all matching documents as deleted
 * @param {string} filePath
 * @param {object} filter
 * @param {object} options { autoCompact: boolean }
 * @returns {Promise<object>} { deletedCount }
 */
async function deleteMany(filePath, filter, options = { autoCompact: true }) {
  const allDocs = await readAllDocs(filePath);
  let deletedCount = 0;

  for (let i = 0; i < allDocs.length; i++) {
    const doc = allDocs[i];
    if (doc._deleted) continue;
    if (matchesFilter(doc, filter)) {
      doc._deleted = true;
      allDocs[i] = doc;
      deletedCount++;
    }
  }

  await writeAllDocs(filePath, allDocs);

  if (options.autoCompact && deletedCount > 0) {
    await compact(filePath);
  }

  return { deletedCount };
}

/**
 * Read all docs from file
 */
async function readAllDocs(filePath) {
  const docs = [];
  try {
    const buf = await fs.readFile(filePath);
    let offset = 0;
    while (offset < buf.length) {
      const len = buf.readUInt32LE(offset);
      offset += 4;
      const docBuf = buf.slice(offset, offset + len);
      offset += len;
      docs.push(deserialize(docBuf));
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  return docs;
}

/**
 * Write all docs back to file (overwrite)
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

module.exports = { deleteOne, deleteMany };
