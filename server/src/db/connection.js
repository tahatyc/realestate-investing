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
  ensureSettingsColumns(database);
}

function ensureSettingsColumns(database) {
  const columns = new Set(database.prepare('PRAGMA table_info(settings)').all().map((column) => column.name));

  if (!columns.has('rehab_cost_per_sqm')) {
    database.exec('ALTER TABLE settings ADD COLUMN rehab_cost_per_sqm REAL NOT NULL DEFAULT 300');
  }
  if (!columns.has('transaction_cost_pct')) {
    database.exec('ALTER TABLE settings ADD COLUMN transaction_cost_pct REAL NOT NULL DEFAULT 3');
    if (columns.has('acquisition_tax_pct')) {
      database.exec('UPDATE settings SET transaction_cost_pct = acquisition_tax_pct');
    }
  }
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
