const { serialize, deserialize } = require('bson');
const { matchesFilter } = require('./QueryMatcher.js');

async function streamDeleteOne(readStream, writeStream, filter) {
  let deleted = false;

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
        writeStream.write(buffer.slice(0, offset));
        buffer = buffer.slice(offset);
        offset = 0;
        continue;
      }

      if (!deleted && matchesFilter(doc, filter)) {
        doc._deleted = true;
        const b = serialize(doc);
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeUInt32LE(b.length, 0);
        writeStream.write(lenBuf);
        writeStream.write(b);
        deleted = true;
      } else {
        writeStream.write(buffer.slice(offset - docLen - 4, offset));
      }

      buffer = buffer.slice(offset);
      offset = 0;
    }

    if (deleted) {
      writeStream.write(buffer);
      break;
    }
  }

  if (!deleted && buffer.length > 0) writeStream.write(buffer);

  return { deletedCount: deleted ? 1 : 0 };
}

async function streamDeleteMany(readStream, writeStream, filter) {
  let deletedCount = 0;
  let buffer = Buffer.alloc(0);
  let offset = 0;
  let foundInLastChunk = true;

  for await (const chunk of readStream) {
    buffer = Buffer.concat([buffer, chunk]);
    let deletedInThisChunk = false;

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

      if (matchesFilter(doc, filter)) {
        doc._deleted = true;
        deletedCount++;
        deletedInThisChunk = true;
        const b = serialize(doc);
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeUInt32LE(b.length, 0);
        writeStream.write(lenBuf);
        writeStream.write(b);
      } else {
        writeStream.write(buffer.slice(offset - docLen - 4, offset));
      }

      buffer = buffer.slice(offset);
      offset = 0;
    }

    // ✅ if previously found deletions but none in this chunk, we can stop early
    if (!deletedInThisChunk && !foundInLastChunk && deletedCount > 0) {
      if (buffer.length > 0) writeStream.write(buffer);
      writeStream.end();
      return { deletedCount };
    }

    foundInLastChunk = deletedInThisChunk;
  }

  // flush leftover data
  if (buffer.length > 0) writeStream.write(buffer);

  // ✅ ensure the stream ends properly so deleteMany can continue
  writeStream.end();

  return { deletedCount };
}

module.exports = {
  streamDeleteOne,
  streamDeleteMany
};