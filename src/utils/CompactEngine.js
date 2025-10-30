const { serialize, deserialize } = require('bson');

async function streamCompact(readStream, writeStream) {
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

      if (!doc._deleted) {
        const b = serialize(doc);
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeUInt32LE(b.length, 0);
        writeStream.write(lenBuf);
        writeStream.write(b);
      }

      buffer = buffer.slice(offset);
      offset = 0;
    }
  }

  // Final flush
  if (buffer.length >= 4) {
    const docLen = buffer.readUInt32LE(0);
    if (buffer.length >= 4 + docLen) {
      const docBuf = buffer.slice(4, 4 + docLen);
      const doc = deserialize(docBuf);
      if (!doc._deleted) {
        const b = serialize(doc);
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeUInt32LE(b.length, 0);
        writeStream.write(lenBuf);
        writeStream.write(b);
      }
    }
  }
}

module.exports = { streamCompact };