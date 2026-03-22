const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { MongoClient } = require("mongodb");

const DB_FILE = path.join(__dirname, "..", "data", "college-erp-db.json");
const COLLECTION_NAMES = ["colleges", "users", "students", "attendance", "marks", "notifications", "subscriptions"];

const EMPTY_DB = {
  colleges: [],
  users: [],
  students: [],
  attendance: [],
  marks: [],
  notifications: [],
  subscriptions: []
};

let mongoClientPromise = null;
let indexesReadyPromise = null;

function shouldUseMongo() {
  return Boolean(process.env.MONGODB_URI);
}

async function ensureDb() {
  if (shouldUseMongo()) {
    await ensureMongoIndexes();
    return;
  }

  await ensureFileDb();
}

async function readDb() {
  await ensureDb();

  if (shouldUseMongo()) {
    return readMongoDb();
  }

  return JSON.parse(await fsp.readFile(DB_FILE, "utf8"));
}

async function writeDb(db) {
  const normalized = normalizeDb(db);

  if (shouldUseMongo()) {
    await writeMongoDb(normalized);
    return;
  }

  await fsp.mkdir(path.dirname(DB_FILE), { recursive: true });
  await fsp.writeFile(DB_FILE, JSON.stringify(normalized, null, 2));
}

async function mutateDb(mutator) {
  const db = await readDb();
  const result = await mutator(db);
  await writeDb(db);
  return result;
}

async function ensureFileDb() {
  await fsp.mkdir(path.dirname(DB_FILE), { recursive: true });

  if (!fs.existsSync(DB_FILE)) {
    await writeDb(cloneDb(EMPTY_DB));
    return;
  }

  try {
    const current = JSON.parse(await fsp.readFile(DB_FILE, "utf8"));
    const normalized = normalizeDb(current);
    await fsp.writeFile(DB_FILE, JSON.stringify(normalized, null, 2));
  } catch (error) {
    await fsp.writeFile(DB_FILE, JSON.stringify(cloneDb(EMPTY_DB), null, 2));
  }
}

async function getMongoClient() {
  if (!mongoClientPromise) {
    mongoClientPromise = new MongoClient(process.env.MONGODB_URI, {
      maxPoolSize: 10
    })
      .connect()
      .catch(function resetOnFailure(error) {
        mongoClientPromise = null;
        throw error;
      });
  }

  return mongoClientPromise;
}

async function getMongoDb() {
  const client = await getMongoClient();
  const dbName = process.env.MONGODB_DB_NAME || inferDbName(process.env.MONGODB_URI);
  return client.db(dbName || "edusmart");
}

async function ensureMongoIndexes() {
  if (!indexesReadyPromise) {
    indexesReadyPromise = (async function createIndexes() {
      const db = await getMongoDb();

      await Promise.all([
        db.collection("users").createIndex({ email: 1 }, { unique: true }),
        db.collection("users").createIndex({ collegeId: 1, role: 1 }),
        db.collection("students").createIndex({ collegeId: 1, rollNumber: 1 }),
        db.collection("students").createIndex({ collegeId: 1, department: 1, semester: 1 }),
        db.collection("attendance").createIndex({ collegeId: 1, studentId: 1, date: 1 }, { unique: true }),
        db.collection("marks").createIndex({ collegeId: 1, studentId: 1, recordedAt: 1 }),
        db.collection("notifications").createIndex({ collegeId: 1, studentId: 1, createdAt: -1 }),
        db.collection("subscriptions").createIndex({ collegeId: 1 }, { unique: true }),
        db.collection("colleges").createIndex({ slug: 1 }, { unique: true })
      ]);
    })().catch(function resetOnFailure(error) {
      indexesReadyPromise = null;
      throw error;
    });
  }

  return indexesReadyPromise;
}

async function readMongoDb() {
  const db = await getMongoDb();
  const snapshot = cloneDb(EMPTY_DB);

  for (const collectionName of COLLECTION_NAMES) {
    snapshot[collectionName] = await db.collection(collectionName).find({}).toArray();
  }

  return normalizeDb(snapshot);
}

async function writeMongoDb(dbSnapshot) {
  await ensureMongoIndexes();
  const db = await getMongoDb();

  for (const collectionName of COLLECTION_NAMES) {
    const collection = db.collection(collectionName);
    await collection.deleteMany({});

    if (dbSnapshot[collectionName].length) {
      await collection.insertMany(dbSnapshot[collectionName]);
    }
  }
}

function inferDbName(connectionString) {
  if (!connectionString) {
    return "";
  }

  try {
    const parsed = new URL(connectionString);
    return parsed.pathname.replace(/^\/+/, "");
  } catch (error) {
    return "";
  }
}

function normalizeDb(value) {
  const db = { ...cloneDb(EMPTY_DB), ...(value || {}) };

  COLLECTION_NAMES.forEach(function ensureCollection(key) {
    if (!Array.isArray(db[key])) {
      db[key] = [];
    }
  });

  return db;
}

function cloneDb(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  COLLECTION_NAMES,
  DB_FILE,
  EMPTY_DB,
  ensureDb,
  mutateDb,
  readDb,
  shouldUseMongo,
  writeDb
};
