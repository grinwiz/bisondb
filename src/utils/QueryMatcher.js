const { ObjectId } = require('bson');

function areEqual(a, b) {
  if (a instanceof ObjectId && b instanceof ObjectId) return a.equals(b);
  if (a instanceof ObjectId && typeof b === 'string') return a.equals(new ObjectId(b));
  if (b instanceof ObjectId && typeof a === 'string') return b.equals(new ObjectId(a));
  return a === b;
}

function applyOperator(docVal, op, v) {
  switch (op) {
    case '$eq': return areEqual(docVal, v);
    case '$ne': return !areEqual(docVal, v);
    case '$gt': return docVal > v;
    case '$gte': return docVal >= v;
    case '$lt': return docVal < v;
    case '$lte': return docVal <= v;
    case '$in': return Array.isArray(v) && v.some(x => areEqual(docVal, x));
    case '$nin': return !Array.isArray(v) || !v.some(x => areEqual(docVal, x));
    case '$like': {
      if (typeof docVal !== 'string' || typeof v !== 'string') return false;
      const regex = new RegExp(v.replace(/%/g, '.*'));
      return regex.test(docVal);
    }
    case '$ilike': {
      if (typeof docVal !== 'string' || typeof v !== 'string') return false;
      const regex = new RegExp(v.replace(/%/g, '.*'), 'i');
      return regex.test(docVal);
    }
    default:
      throw new Error(`Unsupported operator: ${op}`);
  }
}

function matchesFilter(doc, filter) {
  if (!filter || Object.keys(filter).length === 0) return true;

  for (const key of Object.keys(filter)) {
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

    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof ObjectId)) {
      for (const op of Object.keys(value)) {
        if (!applyOperator(docVal, op, value[op])) return false;
      }
    } else {
      if (!areEqual(docVal, value)) return false;
    }
  }
  return true;
}

function applyProjection(doc, projection) {
  if (!projection) return doc;
  const include = Object.entries(projection).filter(([_, v]) => v).map(([k]) => k);
  if (include.length === 0) return doc;

  const result = {};
  for (const field of include) {
    if (field in doc) result[field] = doc[field];
  }
  return result;
}

module.exports = {
  matchesFilter,
  applyProjection,
  areEqual,
  applyOperator
};