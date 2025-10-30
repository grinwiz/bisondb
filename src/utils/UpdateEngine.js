const { serialize, deserialize } = require('bson');
const { matchesFilter } = require('./QueryMatcher.js');

function applyUpdateOperators(doc, update) {
  const newDoc = { ...doc };
  for (const [op, changes] of Object.entries(update)) {
    switch (op) {
      case '$set':
        Object.assign(newDoc, changes);
        break;
      case '$inc':
        for (const [k, v] of Object.entries(changes)) {
          newDoc[k] = (typeof newDoc[k] === 'number' ? newDoc[k] + v : v);
        }
        break;
      case '$unset':
        for (const k of Object.keys(changes)) delete newDoc[k];
        break;
      case '$push':
        for (const [k, v] of Object.entries(changes)) {
          if (!Array.isArray(newDoc[k])) newDoc[k] = [];
          newDoc[k].push(v);
        }
        break;
      default:
        throw new Error(`Unsupported update operator: ${op}`);
    }
  }
  return newDoc;
}

async function streamUpdateOne(readStream, writeStream, filter, update, returnDocument) {
  let matched = false;
  let modified = false;
  let resultDoc = null;

  let buffer = Buffer.alloc(0);
  let offset = 0;

  try {

  } catch (error) {
    console.log(error);
  }

  for await (const chunk of readStream) {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= offset + 4) {
      const docLen = buffer.readUInt32LE(offset);
      offset += 4;
      if (buffer.length < offset + docLen) break;

      const docBuf = buffer.slice(offset, offset + docLen);
      const doc = deserialize(docBuf);
      offset += docLen;

      if (doc._deleted) {
        writeStream.write(buffer.slice(0, offset));
        buffer = buffer.slice(offset);
        offset = 0;
        continue;
      }

      if (!matched && matchesFilter(doc, filter)) {
        const original = { ...doc };
        const updated = applyUpdateOperators(doc, update);
        modified = JSON.stringify(updated) !== JSON.stringify(original);
        resultDoc = returnDocument === 'after' ? updated : original;

        const b = serialize(updated);
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeUInt32LE(b.length, 0);
        writeStream.write(lenBuf);
        writeStream.write(b);

        matched = true;
      } else {
        writeStream.write(buffer.slice(offset - docLen - 4, offset));
      }

      buffer = buffer.slice(offset);
      offset = 0;
    }
    if (matched) {
      writeStream.write(buffer);
      break;
    }
  }

  if (!matched && buffer.length > 0) writeStream.write(buffer);

  return {
    acknowledged: true,
    matchedCount: matched ? 1 : 0,
    modifiedCount: modified ? 1 : 0,
    document: resultDoc
  };
}

async function streamUpdateMany(readStream, writeStream, filter, update, returnDocument) {
  let matchedCount = 0;
  let modifiedCount = 0;
  let lastUpdatedDoc = null;

  let buffer = Buffer.alloc(0);
  let offset = 0;

  for await (const chunk of readStream) {
    buffer = Buffer.concat([buffer, chunk]);

    while (buffer.length >= offset + 4) {
      const docLen = buffer.readUInt32LE(offset);
      offset += 4;
      if (buffer.length < offset + docLen) break;

      const docBuf = buffer.slice(offset, offset + docLen);
      const doc = deserialize(docBuf);
      offset += docLen;

      if (doc._deleted) {
        writeStream.write(buffer.slice(offset - docLen - 4, offset));
        continue;
      }

      if (matchesFilter(doc, filter)) {
        matchedCount++;
        const original = { ...doc };
        const updated = applyUpdateOperators(doc, update);
        const changed = JSON.stringify(updated) !== JSON.stringify(original);
        if (changed) modifiedCount++;

        const b = serialize(updated);
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeUInt32LE(b.length, 0);
        writeStream.write(lenBuf);
        writeStream.write(b);

        if (returnDocument === 'after') {
          lastUpdatedDoc = updated;
        }
      } else {
        writeStream.write(buffer.slice(offset - docLen - 4, offset));
      }
    }

    buffer = buffer.slice(offset);
    offset = 0;
  }

  if (buffer.length > 0) writeStream.write(buffer);
  writeStream.end();

  return {
    matchedCount,
    modifiedCount,
    ...(lastUpdatedDoc ? { document: lastUpdatedDoc } : {})
  };
}

module.exports = {
  applyUpdateOperators,
  streamUpdateOne,
  streamUpdateMany
};