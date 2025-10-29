# BisonDB (WIP)

> A lightweight BSON-based, document-oriented database for Node.js, Electron, and the browser — built for speed, simplicity, and happiness.

## Target Folder Structure
```
bisondb/
├── package.json
├── index.js                # Server entry (Node adapter)
├── client.js               # Browser entry (IndexedDB adapter)
├── src/
│   ├── core/
│   │   ├── BisonDB.js      # Main DB class (adapter-agnostic)
│   │   ├── Collection.js   # Collection abstraction
│   │   └── interfaces/
│   │       └── IStorageAdapter.js  # Defines adapter contract
│   │
│   ├── adapters/
│   │   ├── NodeFSAdapter.js     # Uses fs/promises
│   │   └── IndexedDBAdapter.js  # Uses IndexedDB for browser
│   │
│   ├── bson/
│   │   ├── BsonStreamWriter.js
│   │   ├── BsonStreamReader.js
│   │   ├── BsonStreamUpdater.js
│   │   ├── BsonStreamDeleter.js
│   │   └── BsonStreamCompact.js
│   │
│   └── utils/
│       └── ensureFile.js
│
└── README.md
```