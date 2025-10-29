// bsonStreamWriter.js
// Async append-only writer for collection .bson files (stream format).
// Each document is written as: [uint32LE length][bson bytes]

const fs = require('fs').promises;
const { serialize, ObjectId } = require('bson');
const path = require('path');

/**
 * Ensure the collection file exists (creates parent dir if needed).
 * @param {string} filePath
 */
async function ensureFile(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    // create empty file
    await fs.writeFile(filePath, Buffer.alloc(0));
  }
}

/**
 * Append a single document to a .bson collection file.
 * Ensures _id exists (ObjectId).
 *
 * @param {string} filePath
 * @param {object} doc
 * @returns {object} the document written (with _id)
 */
async function appendDoc(filePath, doc) {
  if (!doc._id) doc._id = new ObjectId();
  // serialize
  const b = serialize(doc);
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(b.length, 0);
  const buf = Buffer.concat([lenBuf, b]);

  await ensureFile(filePath);
  await fs.appendFile(filePath, buf);
  return doc;
}

/**
 * Append many documents in a single atomic append (one syscall).
 * Ensures each doc has _id.
 *
 * @param {string} filePath
 * @param {object[]} docs
 * @returns {object[]} docs (with _id)
 */
async function appendMany(filePath, docs) {
  if (!Array.isArray(docs) || docs.length === 0) return [];
  const parts = [];
  for (const d of docs) {
    if (!d._id) d._id = new ObjectId();
    const b = serialize(d);
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32LE(b.length, 0);
    parts.push(lenBuf, b);
  }
  const buf = Buffer.concat(parts);
  await ensureFile(filePath);
  await fs.appendFile(filePath, buf);
  return docs;
}

module.exports = { appendDoc, appendMany };
