const { IStorageAdapter } = require('../../interfaces/IStorageAdapter.js');
const { matchesFilter, applyProjection } = require('../../../utils/QueryMatcher.js');
const { applyUpdateOperators } = require('../../../utils/UpdateEngine.js');
const { ObjectId } = require('bson');

const DB_NAME = 'BisonDB';
let DB_VERSION = 1;

class IndexedDBAdapter extends IStorageAdapter {
  #dbPromise;

  constructor() {
    super();
    this.#dbPromise = this.#openDB();
  }

  #openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => { };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async #getStore(collection, mode = 'readonly') {
    const db = await this.#dbPromise;
    if (!db.objectStoreNames.contains(collection)) {
      DB_VERSION++;
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      return new Promise((res, rej) => {
        req.onupgradeneeded = (e) => {
          e.target.result.createObjectStore(collection, { keyPath: '_id' });
        };
        req.onsuccess = () => res(req.result.transaction(collection, mode).objectStore(collection));
        req.onerror = () => rej(req.error);
      });
    }
    return db.transaction(collection, mode).objectStore(collection);
  }

  async write(collection, doc) {
    const id = doc._id ?? new ObjectId().toHexString();
    const payload = { ...doc, _id: id };
    const store = await this.#getStore(collection, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.add(payload);
      req.onsuccess = () => resolve(id);
      req.onerror = () => reject(req.error);
    });
  }

  async find(collection, query = {}, projection = null) {
    const store = await this.#getStore(collection);
    return new Promise((resolve, reject) => {
      const results = [];
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const doc = cursor.value;
          if (doc._deleted) { cursor.continue(); return; }
          if (matchesFilter(doc, query)) {
            results.push(projection ? applyProjection(doc, projection) : doc);
          }
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async updateOne(collection, filter, update, options = {}) {
    const store = await this.#getStore(collection, 'readwrite');
    return new Promise((resolve, reject) => {
      let matched = false;
      let modified = false;
      let resultDoc = null;
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor && !matched) {
          const doc = cursor.value;
          if (doc._deleted) { cursor.continue(); return; }
          if (matchesFilter(doc, filter)) {
            const original = { ...doc };
            const updated = applyUpdateOperators(doc, update);
            modified = JSON.stringify(updated) !== JSON.stringify(original);
            resultDoc = options.returnDocument === 'after' ? updated : original;
            cursor.update(updated);
            matched = true;
          } else {
            cursor.continue();
          }
        } else {
          resolve({
            acknowledged: true,
            matchedCount: matched ? 1 : 0,
            modifiedCount: modified ? 1 : 0,
            ...(options.returnDocument ? { document: resultDoc } : {})
          });
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteOne(collection, filter, options = {}) {
    const store = await this.#getStore(collection, 'readwrite');
    return new Promise((resolve, reject) => {
      let deleted = false;
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor && !deleted) {
          const doc = cursor.value;
          if (doc._deleted) { cursor.continue(); return; }
          if (matchesFilter(doc, filter)) {
            doc._deleted = true;
            cursor.update(doc);
            deleted = true;
          } else {
            cursor.continue();
          }
        } else {
          resolve({ deletedCount: deleted ? 1 : 0 });
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteMany(collection, filter, options = {}) {
    const store = await this.#getStore(collection, 'readwrite');
    return new Promise((resolve, reject) => {
      let count = 0;
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const doc = cursor.value;
          if (doc._deleted) { cursor.continue(); return; }
          if (matchesFilter(doc, filter)) {
            doc._deleted = true;
            cursor.update(doc);
            count++;
          }
          cursor.continue();
        } else {
          resolve({ deletedCount: count });
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async compact(collection) {
    const docs = await this.find(collection, {});
    const store = await this.#getStore(collection, 'readwrite');
    return new Promise((res, rej) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        if (docs.length === 0) res();
        let pending = docs.length;
        docs.forEach(d => {
          const putReq = store.put(d);
          putReq.onsuccess = () => { if (--pending === 0) res(); };
          putReq.onerror = () => rej(putReq.error);
        });
      };
      clearReq.onerror = () => rej(clearReq.error);
    });
  }

  async beginTransaction() { return null; }
  async commitTransaction() { }
  async rollbackTransaction() { }
}

module.exports = { IndexedDBAdapter };