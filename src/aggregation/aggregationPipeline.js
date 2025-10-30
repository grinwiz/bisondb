const { matchesFilter } = require('../utils/QueryMatcher.js');

class AggregationPipeline {
  static run(docs, pipeline) {
    let result = [...docs];

    for (const stage of pipeline) {
      const op = Object.keys(stage)[0];
      const expr = stage[op];

      switch (op) {
        case '$match':
          result = result.filter(doc => matchesFilter(doc, expr));
          break;

        case '$project':
          result = result.map(doc => {
            const projected = {};
            for (const [k, v] of Object.entries(expr)) {
              if (v === 1) projected[k] = doc[k];
            }
            return projected;
          });
          break;

        case '$group':
          const groups = new Map();
          const idField = expr._id;

          for (const doc of result) {
            // Compute group key
            const key = typeof idField === 'string' && idField.startsWith('$')
              ? doc[idField.slice(1)]
              : idField;

            if (!groups.has(key)) {
              groups.set(key, { _id: key });
            }

            const group = groups.get(key);

            // Process each accumulator (e.g., count: { $sum: 1 })
            for (const [field, accumulator] of Object.entries(expr)) {
              if (field === '_id') continue;

              const [operator, value] = Object.entries(accumulator)[0]; // e.g., ['$sum', 1]

              if (!group[field]) group[field] = 0;

              switch (operator) {
                case '$sum':
                  group[field] += (typeof value === 'number' ? value : doc[value.slice(1)] || 0);
                  break;
                case '$avg':
                  group[field] += doc[value.slice(1)] || 0;
                  if (!group[`_${field}_count`]) group[`_${field}_count`] = 0;
                  group[`_${field}_count`]++;
                  break;
                case '$min':
                  const val = doc[value.slice(1)];
                  group[field] = group[field] === undefined ? val : Math.min(group[field], val);
                  break;
                case '$max':
                  const val2 = doc[value.slice(1)];
                  group[field] = group[field] === undefined ? val2 : Math.max(group[field], val2);
                  break;
                default:
                  throw new Error(`Unsupported accumulator: ${operator}`);
              }
            }
          }

          // Finalize $avg
          for (const group of groups.values()) {
            for (const field of Object.keys(group)) {
              if (field.startsWith('_') && field.endsWith('_count')) {
                const realField = field.slice(1, -6);
                if (group[realField] !== undefined) {
                  group[realField] /= group[field];
                }
                delete group[field];
              }
            }
          }

          result = Array.from(groups.values());
          break;

        default:
          throw new Error(`Unsupported stage: ${op}`);
      }
    }

    return result;
  }
}

module.exports = { AggregationPipeline };