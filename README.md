## ![BisonDB](https://raw.githubusercontent.com/grinwiz/bisondb/refs/heads/main/bisondb-logo-transparent.png "BisonDB")

## The Javascript Database

> A lightweight BSON-based, document-oriented database for Javascript — built for speed, simplicity, and happiness.

## Introduction

**BisonDB** is a lightweight, BSON-based, document-oriented database designed to run seamlessly in Node.js, Electron, and the browser. It stores data in a compact binary format (`[len][bson]…`) and supports a familiar MongoDB-like API — `insertOne`, `find`, `updateOne`, `aggregate`, and more — without any build step or external dependencies beyond `bson`.

### Why BisonDB?

| Feature                  | Benefit                                    |
| ------------------------ | ------------------------------------------ |
| **Zero config**          | `new BisonDB()` works instantly            |
| **File-based (Node.js)** | Auto-saves to `.bisondb/`                  |
| **IndexedDB (Browser)**  | Full offline support                       |
| **Streaming engine**     | O(1) memory, no full loads                 |
| **MongoDB-like API**     | `insertOne`, `find`, `update`, `aggregate` |
| **Transactions**         | ACID guarantees                            |
| **No build step**        | Pure JS, no TypeScript                     |

> Whether you need an embedded datastore for a server, a desktop app, or a client-side web app, BisonDB delivers speed, simplicity, and reliability in a single pure-JavaScript package.

---

## Table of Contents

- [Introduction](#introduction)
- [Installation](#installation)
- [API Reference](#api-reference)
  - [BisonDB](#bisondb)
  - [Collection](#collection)
  - [Transactions](#transactions)
- [Usage](#usage)
  - [Backend (Node.js)](#backend-nodejs)
  - [Frontend (Browser / React)](#frontend-browser--react)
  - [More Usage Examples](#more-usage-examples)
- [Performance](#performance)
- [Contributing](#contributing)
- [License](#license)

---

## Installations

Module name on npm is `bisondb`.

```bash
npm install --save bisondb
```

---

## API Reference

### `BisonDB`

```js
const db = new BisonDB();
```

| Method                         | Description                     |
| ------------------------------ | ------------------------------- |
| `collection(name)`             | Returns a `Collection` instance |
| `transaction(collections, fn)` | ACID transaction                |

### `Collection`

```js
const users = db.collection("users");
```

| Method                               | Returns                                         | Example                   |
| ------------------------------------ | ----------------------------------------------- | ------------------------- |
| `insertOne(doc, { returnDocument })` | `doc` or `{ _id }`                              | `returnDocument: 'after'` |
| `insertMany(docs)`                   | `[_id]`                                         |                           |
| `find(query, { projection })`        | `doc[]`                                         | `{ name: 1 }`             |
| `findOne(query, { projection })`     | `doc \| null`                                   |                           |
| `updateOne(filter, update, options)` | result                                          | `$set: { x: 1 }`          |
| `update(filter, update, options)`    | `{ acknowledged, matchedCount, modifiedCount }` | `$set: { x: 1 }`          |
| `deleteOne(filter)`                  | `{ deletedCount }`                              |                           |
| `delete(filter)`                     | `{ deletedCount }`                              |                           |
| `aggregate(pipeline)`                | `any[]`                                         | `$match`, `$group`        |

---

## Usage

### Backend (Node.js)

```js
const { BisonDB } = require("bisondb");
const db = new BisonDB();

await db.collection("users").insertOne({ name: "Alice" });
console.log(await db.collection("users").find());
```

> Saves to `.bisondb/users.bson` in your project root.

### Frontend (Browser / React)

```js
import { BisonDB } from "bisondb/client";
const db = new BisonDB();

await db.collection("todos").insertOne({ task: "Learn BisonDB" });
```

> Uses **IndexedDB** — full offline persistence.

### More Usage Examples

```js
const { BisonDB } = require("bisondb");

(async () => {
	console.log("BisonDB Usage Demo\n");

	// 1. Initialize DB
	const db = new BisonDB();
	const users = db.collection("users");
	const posts = db.collection("posts");

	console.log("1. Collections created: users, posts");

	// 2. insertOne + returnDocument: 'after'
	const alice = await users.insertOne(
		{ name: "Alice", email: "alice@example.com", role: "admin" },
		{ returnDocument: "after" }
	);
	console.log("2. insertOne (returnDocument:after):", alice);

	// 3. findById (using _id from insert)
	const foundUser = await users.findOne({ _id: alice._id });
	console.log("3. findById:", foundUser);

	// 4. insertMany
	const newUsers = [
		{ name: "Bob", email: "bob@example.com", role: "user" },
		{ name: "Charlie", email: "charlie@example.com", role: "moderator" },
	];
	const inserted = await users.insertMany(newUsers);
	console.log("4. insertMany result:", inserted); // Returns array of _id strings

	// 5. insert a post
	const post = await posts.insertOne(
		{ title: "First Post", authorId: alice._id, content: "Hello BisonDB!" },
		{ returnDocument: "after" }
	);
	console.log("5. Post inserted:", post);

	// 6. updateOne with returnDocument: 'after'
	const updatedUser = await users.updateOne(
		{ _id: "690355f49c12ad51e1721bad" },
		{ $set: { lastLogin: new Date(), status: "online" } },
		{ returnDocument: "after" }
	);
	console.log("6. updateOne (returnDocument:after):", updatedUser);

	// 7. updateMany
	const updatedUsers = await users.update({}, { $set: { status: "offline" } });
	console.log("7. updateMany:", updatedUsers);

	// 8. findOne
	const userByEmail = await users.findOne({ email: "bob@example.com" });
	console.log("8. findOne by email:", userByEmail);

	// 9. deleteOne
	const deleteResult = await users.deleteOne({ email: "charlie@example.com" });
	console.log("9. deleteOne result:", deleteResult);

	// 10. deleteMany
	const deleteManyResult = await users.delete({ email: "bob@example.com" });
	console.log("9. deleteOne result:", deleteManyResult);

	// 10. findOne with projection (name only)
	const nameOnly = await users.findOne(
		{ email: "alice@example.com" },
		{ projection: { name: 1 } }
	);
	console.log("10. findOne with projection { name: 1 }:", nameOnly);

	// Bonus: Aggregation example
	const stats = await users.aggregate([
		{ $match: { role: { $ne: "admin" } } },
		{ $group: { _id: "$role", count: { $sum: 1 } } },
	]);
	console.log("\nBonus: Aggregation $group by role:", stats);

	console.log("\nAll operations completed successfully!");
})();
```

---

## Performance

| Dataset   | NeDB (Est.) | BisonDB              |
| --------- | ----------- | -------------------- |
| 10k docs  | ~80ms load  | **Streaming: <10ms** |
| 100k docs | OOM risk    | **Stable, low RAM**  |

> BisonDB uses **zero-copy streaming** — never loads full file.

---

## Contributing

Contributions, issues, and feature requests are welcome!
Feel free to open an issue or submit a pull request on GitHub.

### Steps to Contribute

1. Fork the repository
2. Create a new branch
   ```bash
   git checkout -b feature/my-new-feature
   ```
3. Commit your changes
   ```bash
   git commit -m "feat(my-new-feature): Add my new feature"
   ```
4. Push to your branch
   ```bash
   git push origin feature/my-new-feature
   ```
5. Open a Pull Request 🚀

> **Liked BisonDB?** Give it a star on GitHub to show your support!
> [https://github.com/grinwiz/bisondb](https://github.com/grinwiz/bisondb)

---

## License

[MIT](LICENSE) — free for commercial & open-source use.

---
