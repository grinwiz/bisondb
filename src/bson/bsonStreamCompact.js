// bsonStreamCompact.js
// Async compactor for collection .bson files
// Removes documents marked as _deleted to reclaim space

const fs = require('fs').promises;
const { deserialize, serialize } = require('bson');

/**
 * compact - rewrites the collection file excluding _deleted documents
 * @param {string} filePath
 */
async function compact(filePath) {
  let docs = [];
  try {
    const buf = await fs.readFile(filePath);
    let offset = 0;
    while (offset < buf.length) {
      const len = buf.readUInt32LE(offset);
      offset += 4;
      const docBuf = buf.slice(offset, offset + len);
      offset += len;
      const doc = deserialize(docBuf);
      if (!doc._deleted) docs.push(doc);
    }
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }

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

module.exports = { compact };
