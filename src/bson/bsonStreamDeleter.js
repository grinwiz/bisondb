const fs = require('fs').promises;
const { deserialize, serialize } = require('bson');
const { matchesFilter } = require('../utils/QueryMatcher');
const { compact } = require('./bsonStreamCompact');

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
