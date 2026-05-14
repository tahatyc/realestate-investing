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
  if (tableExists(database, 'properties')) {
    ensurePropertyColumns(database);
  }
  database.exec(schema);
  ensurePropertyColumns(database);
  ensureScrapingRunScopesTable(database);
  ensureScrapingRunColumns(database);
  ensureSettingsColumns(database);
}

function tableExists(database, name) {
  return Boolean(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

function ensurePropertyColumns(database) {
  const columns = new Set(database.prepare('PRAGMA table_info(properties)').all().map((column) => column.name));
  const additions = {
    source: "TEXT NOT NULL DEFAULT 'imot.bg'",
    listing_purpose: "TEXT NOT NULL DEFAULT 'sale'",
    category: 'TEXT',
    url: 'TEXT',
    title: 'TEXT',
    neighborhood: 'TEXT',
    zone: 'TEXT',
    type: 'TEXT',
    condition: 'TEXT',
    price_eur: 'REAL',
    price_bgn: 'REAL',
    area_sqm: 'REAL',
    price_per_sqm: 'REAL',
    floor: 'INTEGER',
    total_floors: 'INTEGER',
    rooms: 'REAL',
    construction_year: 'INTEGER',
    construction_stage: 'TEXT',
    description: 'TEXT',
    image_url: 'TEXT',
    first_seen_at: 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP',
    last_seen_at: 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP',
    is_active: 'INTEGER NOT NULL DEFAULT 1',
    created_at: 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP',
    updated_at: 'TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP'
  };

  for (const [column, definition] of Object.entries(additions)) {
    if (!columns.has(column)) {
      database.exec(`ALTER TABLE properties ADD COLUMN ${column} ${definition}`);
    }
  }

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_properties_zone ON properties(zone);
    CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(type);
    CREATE INDEX IF NOT EXISTS idx_properties_condition ON properties(condition);
    CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price_eur);
    CREATE INDEX IF NOT EXISTS idx_properties_area ON properties(area_sqm);
    CREATE INDEX IF NOT EXISTS idx_properties_active ON properties(is_active);
    CREATE INDEX IF NOT EXISTS idx_properties_listing_purpose ON properties(listing_purpose);
    CREATE INDEX IF NOT EXISTS idx_properties_category ON properties(category);
  `);
}

function ensureScrapingRunScopesTable(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS scraping_run_scopes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      listing_purpose TEXT NOT NULL,
      category TEXT NOT NULL,
      pages_planned INTEGER NOT NULL,
      pages_scraped INTEGER NOT NULL DEFAULT 0,
      full_scope INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (run_id) REFERENCES scraping_runs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_scraping_run_scopes_run ON scraping_run_scopes(run_id);
    CREATE INDEX IF NOT EXISTS idx_scraping_run_scopes_scope ON scraping_run_scopes(listing_purpose, category);
  `);
}

function ensureScrapingRunColumns(database) {
  const columns = new Set(database.prepare('PRAGMA table_info(scraping_runs)').all().map((column) => column.name));
  const additions = {
    sale_pages_scraped: 'INTEGER NOT NULL DEFAULT 0',
    rental_pages_scraped: 'INTEGER NOT NULL DEFAULT 0',
    current_purpose: 'TEXT',
    current_category: 'TEXT',
    crawl_mode: "TEXT NOT NULL DEFAULT 'bounded'"
  };

  for (const [column, definition] of Object.entries(additions)) {
    if (!columns.has(column)) {
      database.exec(`ALTER TABLE scraping_runs ADD COLUMN ${column} ${definition}`);
    }
  }
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
