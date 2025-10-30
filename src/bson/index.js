const { appendDoc, appendMany } = require('./bsonStreamWriter.js');
const { readAll } = require('./bsonStreamReader.js');
const { updateOne, updateMany } = require('./bsonStreamUpdater.js');
const { deleteOne, deleteMany } = require('./bsonStreamDeleter.js');
const { compact } = require('./bsonStreamCompact.js');

module.exports = {
  appendDoc, appendMany,
  readAll,
  updateOne, updateMany,
  deleteOne, deleteMany,
  compact
};