CREATE TABLE IF NOT EXISTS properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  external_id TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'imot.bg',
  url TEXT,
  title TEXT,
  neighborhood TEXT,
  zone TEXT,
  type TEXT,
  condition TEXT,
  price_eur REAL NOT NULL,
  price_bgn REAL,
  area_sqm REAL,
  price_per_sqm REAL,
  floor INTEGER,
  total_floors INTEGER,
  rooms REAL,
  construction_year INTEGER,
  construction_stage TEXT,
  description TEXT,
  image_url TEXT,
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_properties_zone ON properties(zone);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(type);
CREATE INDEX IF NOT EXISTS idx_properties_condition ON properties(condition);
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price_eur);
CREATE INDEX IF NOT EXISTS idx_properties_area ON properties(area_sqm);
CREATE INDEX IF NOT EXISTS idx_properties_active ON properties(is_active);

CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL,
  price_eur REAL NOT NULL,
  price_bgn REAL,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_price_history_property ON price_history(property_id);

CREATE TABLE IF NOT EXISTS scraping_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  pages_total INTEGER NOT NULL DEFAULT 0,
  pages_scraped INTEGER NOT NULL DEFAULT 0,
  listings_found INTEGER NOT NULL DEFAULT 0,
  listings_saved INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_scraping_runs_started ON scraping_runs(started_at);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  city TEXT NOT NULL DEFAULT 'Sofia',
  currency TEXT NOT NULL DEFAULT 'EUR',
  target_gross_yield_pct REAL NOT NULL DEFAULT 6,
  target_net_yield_pct REAL NOT NULL DEFAULT 4.5,
  vacancy_pct REAL NOT NULL DEFAULT 5,
  management_fee_pct REAL NOT NULL DEFAULT 8,
  airbnb_occupancy_pct REAL NOT NULL DEFAULT 65,
  airbnb_daily_rate_eur REAL NOT NULL DEFAULT 65,
  airbnb_operating_expense_pct REAL NOT NULL DEFAULT 30,
  leverage_enabled INTEGER NOT NULL DEFAULT 1,
  mortgage_rate REAL NOT NULL DEFAULT 3.5,
  loan_term_years INTEGER NOT NULL DEFAULT 25,
  down_payment_pct REAL NOT NULL DEFAULT 20,
  ltv_pct REAL NOT NULL DEFAULT 80,
  origination_fee_pct REAL NOT NULL DEFAULT 1,
  annual_insurance_eur REAL NOT NULL DEFAULT 250,
  flag_coc_green_pct REAL NOT NULL DEFAULT 8,
  flag_coc_yellow_pct REAL NOT NULL DEFAULT 4,
  flag_dscr_minimum REAL NOT NULL DEFAULT 1.25,
  flag_rate_stress_pct REAL NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS neighborhood_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  neighborhood TEXT NOT NULL,
  zone TEXT,
  property_count INTEGER NOT NULL DEFAULT 0,
  avg_price_eur REAL,
  avg_price_per_sqm REAL,
  min_price_eur REAL,
  max_price_eur REAL,
  avg_area_sqm REAL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (neighborhood, zone)
);

CREATE INDEX IF NOT EXISTS idx_neighborhood_stats_zone ON neighborhood_stats(zone);
