// bsonStreamReader.js
// Async reader for collection .bson files (stream format)
// Supports iterating documents with filters and projections

const fs = require('fs').promises;
const { deserialize, ObjectId } = require('bson');
const path = require('path');

const MAGIC = Buffer.from('BISONIDX\0'); // 8 bytes, last byte null to make 8

/**
 * Read the latest index footer from the .bisondata file.
 * Returns a JS object (index). If file missing or no valid footer, returns { version:1, collections: {} }
 *
 * Footer layout: [indexBSON][uint32LE indexLen][8-byte magic]
 */
function readLatestIndex(filePath) {
  if (!fs.existsSync(filePath)) return { version: 1, collections: {} };

  const stat = fs.statSync(filePath);
  if (stat.size < 12) return { version: 1, collections: {} }; // no footer present

  // Read last 12 bytes (4 bytes len + 8 bytes magic)
  const fd = fs.openSync(filePath, 'r');
  const footerTail = Buffer.alloc(12);
  fs.readSync(fd, footerTail, 0, 12, stat.size - 12);

  const magic = footerTail.slice(4, 12);
  if (!magic.equals(MAGIC)) {
    // No valid footer found
    fs.closeSync(fd);
    return { version: 1, collections: {} };
  }

  const indexLen = footerTail.readUInt32LE(0);
  const indexStart = stat.size - 12 - indexLen;
  if (indexStart < 0) {
    fs.closeSync(fd);
    throw new Error('Corrupted index footer (bad index length)');
  }

  const indexBuf = Buffer.alloc(indexLen);
  fs.readSync(fd, indexBuf, 0, indexLen, indexStart);
  fs.closeSync(fd);

  const indexObj = deserialize(indexBuf);
  return indexObj;
}

/**
 * Write index footer (append) with the index object.
 * Appends: [indexBSON][uint32LE indexLen][8-byte magic]
 */
function writeIndexFooter(filePath, indexObj) {
  const indexBuf = serialize(indexObj);
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(indexBuf.length, 0);

  const footer = Buffer.concat([indexBuf, lenBuf, MAGIC]);
  fs.appendFileSync(filePath, footer);
}


/**
 * Read all documents from a collection file.
 * Supports optional filter and projection.
 *
 * @param {string} filePath
 * @param {object} [filter] MongoDB-like filter object
 * @param {object} [projection] MongoDB-like projection { field: 1 }
 * @returns {Promise<object[]>}
 */
async function readAll(filePath, filter = {}, projection = null) {
  const docs = [];
  try {
    const buf = await fs.readFile(filePath);
    let offset = 0;
    while (offset < buf.length) {
      const docLen = buf.readUInt32LE(offset);
      offset += 4;
      const docBuf = buf.slice(offset, offset + docLen);
      offset += docLen;
      let doc = deserialize(docBuf);

      // skip logically deleted docs (_deleted = true)
      if (doc._deleted) continue;

      if (matchesFilter(doc, filter)) {
        if (projection) doc = applyProjection(doc, projection);
        docs.push(doc);
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  return docs;
}

/**
 * Matches a document against a MongoDB-like filter.
 * Supports $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $and, $or, $not
 *
 * @param {object} doc
 * @param {object} filter
 * @returns {boolean}
 */
function matchesFilter(doc, filter) {
  if (!filter || Object.keys(filter).length === 0) return true;

  const keys = Object.keys(filter);

  for (const key of keys) {
    const value = filter[key];

    if (key === '$and' && Array.isArray(value)) {
      if (!value.every(f => matchesFilter(doc, f))) return false;
      continue;
    }

    if (key === '$or' && Array.isArray(value)) {
      if (!value.some(f => matchesFilter(doc, f))) return false;
      continue;
    }

    if (key === '$not' && typeof value === 'object') {
      if (matchesFilter(doc, value)) return false;
      continue;
    }

    const docVal = doc[key];

    // operator style
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof ObjectId)) {
      for (const op of Object.keys(value)) {
        const v = value[op];
        if (!applyOperator(docVal, op, v)) return false;
      }
    } else {
      if (!areEqual(docVal, value)) return false;
    }
  }

  return true;
}

/**
 * Compare two values (ObjectId + string-safe)
 */
function areEqual(a, b) {
  if (a instanceof ObjectId && b instanceof ObjectId) {
    return a.equals(b);
  }
  if (a instanceof ObjectId && typeof b === 'string') {
    return a.equals(new ObjectId(b));
  }
  if (b instanceof ObjectId && typeof a === 'string') {
    return b.equals(new ObjectId(a));
  }
  return a === b;
}

/**
 * Apply MongoDB-like operators + $like / $ilike
 */
function applyOperator(docVal, op, v) {
  switch (op) {
    case '$eq':
      return areEqual(docVal, v);
    case '$ne':
      return !areEqual(docVal, v);
    case '$gt':
      return docVal > v;
    case '$gte':
      return docVal >= v;
    case '$lt':
      return docVal < v;
    case '$lte':
      return docVal <= v;
    case '$in':
      if (!Array.isArray(v)) return false;
      return v.some(x => areEqual(docVal, x));
    case '$nin':
      if (!Array.isArray(v)) return false;
      return !v.some(x => areEqual(docVal, x));

    // 🔍 String pattern match (LIKE)
    case '$like': {
      if (typeof docVal !== 'string' || typeof v !== 'string') return false;
      const regex = new RegExp(v.replace(/%/g, '.*'), ''); // SQL-style %wildcard
      return regex.test(docVal);
    }

    // 🔍 Case-insensitive LIKE
    case '$ilike': {
      if (typeof docVal !== 'string' || typeof v !== 'string') return false;
      const regex = new RegExp(v.replace(/%/g, '.*'), 'i');
      return regex.test(docVal);
    }

    default:
      throw new Error(`Unsupported operator: ${op}`);
  }
}


/**
 * Apply field projection to a document.
 *
 * @param {object} doc
 * @param {object} projection { field: 1, field2: 0 }
 * @returns {object}
 */
function applyProjection(doc, projection) {
  const includeFields = Object.entries(projection)
    .filter(([_, v]) => v)
    .map(([k]) => k);
  if (includeFields.length === 0) return doc;

  const projected = {};
  for (const f of includeFields) {
    if (f in doc) projected[f] = doc[f];
  }
  return projected;
}

module.exports = {
  MAGIC,
  readLatestIndex,
  writeIndexFooter,
  readAll,
  matchesFilter
};
