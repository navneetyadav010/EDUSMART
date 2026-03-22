const fs = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "..", "data", "college-erp-db.json");

const EMPTY_DB = {
  colleges: [],
  users: [],
  students: [],
  attendance: [],
  marks: [],
  notifications: [],
  subscriptions: []
};

function ensureDb() {
  if (!fs.existsSync(DB_FILE)) {
    writeDb(cloneDb(EMPTY_DB));
    return;
  }

  try {
    const current = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    const normalized = { ...cloneDb(EMPTY_DB), ...current };
    writeDb(normalized);
  } catch (error) {
    writeDb(cloneDb(EMPTY_DB));
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}

function writeDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function mutateDb(mutator) {
  const db = readDb();
  const result = mutator(db);
  writeDb(db);
  return result;
}

function cloneDb(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  DB_FILE,
  EMPTY_DB,
  ensureDb,
  mutateDb,
  readDb,
  writeDb
};
