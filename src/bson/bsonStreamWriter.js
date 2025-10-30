const fs = require('fs').promises;
const { serialize, ObjectId } = require('bson');
const path = require('path');

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
