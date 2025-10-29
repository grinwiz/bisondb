const path = require('path');
const { Collection } = require('./Collection');
const fs = require('fs').promises;

class BisonDB {
  /**
   * @param {string} dbName - database name
   * @param {string} rootFolder - optional root folder for all databases
   */
  constructor(dbName, rootFolder = '.bisondb') {
    this.rootFolder = rootFolder.replace(/[/\\]*$/, '');
    this.dbName = dbName;
    this.dbPath = path.join(this.rootFolder, dbName);
    this.collections = new Map();
  }

  /**
   * Open or create the database folder and load existing collections
   */
  async open() {
    try {
      // ensure root folder exists
      await fs.mkdir(this.rootFolder, { recursive: true });
      // ensure database folder exists
      await fs.mkdir(this.dbPath, { recursive: true });

      const files = await fs.readdir(this.dbPath);
      for (const f of files) {
        if (f.endsWith('.bson')) {
          const name = f.replace(/\.bson$/, '');
          this.collections.set(name, new Collection(name, this.dbPath));
        }
      }
    } catch (err) {
      throw new Error(`Failed to open BisonDB: ${err.message}`);
    }
  }

  /**
   * Create a new collection
   */
  async createCollection(name) {
    if (this.collections.has(name)) return this.collections.get(name);
    const col = new Collection(name, this.dbPath);
    this.collections.set(name, col);
    return col;
  }

  /**
   * Get an existing collection
   */
  getCollection(name) {
  const col = this.collections.get(name);
  if (!col) return null;

  return {
    ...col,
    filePath: col.filePath.split(path.sep).join('/')
  };
}


  /**
   * List all collections in this database
   */
  async listCollections() {
    try {
      // Read all .bson files in the database folder
      const files = await fs.readdir(this.dbPath);
      const onDisk = files
        .filter(f => f.endsWith('.bson'))
        .map(f => f.replace(/\.bson$/, ''));

      // Include in-memory collections not yet saved to disk
      const inMemory = Array.from(this.collections.keys());

      // Combine and remove duplicates
      const allCollections = new Set([...onDisk, ...inMemory]);
      return Array.from(allCollections);
    } catch (err) {
      // If folder doesn't exist or other error, still return in-memory collections
      return Array.from(this.collections.keys());
    }
  }

}

module.exports = { BisonDB };
