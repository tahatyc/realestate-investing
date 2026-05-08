import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(dirname, '../../..');
const schemaPath = path.join(dirname, 'schema.sql');
export const defaultDbPath = path.join(projectRoot, 'data', 'realestate.db');

let db = null;
let activePath = null;

function ensureParentDirectory(dbPath) {
  if (dbPath === ':memory:') {
    return;
  }

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

function runSchema(database) {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  database.exec(schema);
}

export function createDatabase(dbPath = defaultDbPath) {
  ensureParentDirectory(dbPath);
  const database = new Database(dbPath);
  database.pragma('foreign_keys = ON');
  database.pragma('journal_mode = WAL');
  runSchema(database);
  return database;
}

export function initializeDatabase(dbPath = process.env.DB_PATH || defaultDbPath) {
  const resolvedPath = dbPath === ':memory:' ? dbPath : path.resolve(dbPath);

  if (!db || activePath !== resolvedPath) {
    if (db) {
      db.close();
    }
    db = createDatabase(resolvedPath);
    activePath = resolvedPath;
  }

  return db;
}

export function getDb() {
  return db || initializeDatabase();
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    activePath = null;
  }
}
