# Market Data Coverage And Rental Comps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand market ingestion from a one-category sale scrape into bounded sale and rental coverage, then use credible rental comps in rent-sensitive strategy calculations.

**Architecture:** Add explicit scrape-plan and scrape-scope units, persist listing purpose/category on properties, and keep acquisition strategies sale-only. Add a rental comp estimator with metadata and wire it into Cash Flow and Airbnb while preserving target-yield fallback behavior.

**Tech Stack:** Node.js ESM, Express, better-sqlite3, Cheerio, React, TanStack Query, Tailwind CSS, Node test runner.

---

## File Structure

- Create `server/src/scraper/searchPlan.js`: owns sale/rent category definitions, URL generation, defaults, and bounded/full crawl option normalization.
- Create `server/src/db/scrapingRunScopes.js`: records completed scrape scopes and exposes helpers for scope-aware inactive marking.
- Create `server/src/strategies/rentalComps.js`: estimates monthly rent from active rental comps and returns value plus metadata.
- Modify `server/src/db/schema.sql`: add `properties.listing_purpose`, `properties.category`, indexes, and `scraping_run_scopes`.
- Modify `server/src/db/connection.js`: migrate existing databases with new property columns and scope table.
- Modify `server/src/db/properties.js`: persist `listingPurpose` and `category`, add listing-purpose filtering, and add scoped inactive helper.
- Modify `server/src/scraper/parser.js`: accept listing metadata and attach `listingPurpose` and `category`.
- Modify `server/src/scraper/imotbg.js`: build and execute explicit scrape plans, persist run scope progress, and replace global inactive marking.
- Modify `server/src/db/scrapingRuns.js`: allow richer progress fields.
- Modify `server/src/routes/scraper.js`: accept scrape options and expose richer status fields.
- Modify `server/src/routes/overview.js`: return separate active sale and rental counts.
- Modify `server/src/routes/properties.js`: expose `listingPurpose` and `category`.
- Modify `server/src/strategies/shared.js`: expose rent-estimate metadata in strategy payloads.
- Modify `server/src/strategies/cashFlow.js`: use rental comp estimator.
- Modify `server/src/strategies/airbnb.js`: use rental comp estimator for long-term comparison.
- Modify `server/src/strategies/index.js`: explicitly query sale properties for strategy pages.
- Modify `server/test/phase2.test.js`: cover schema migration/property purpose behavior.
- Modify `server/test/phase3.test.js`: cover scrape plan, scoped inactive behavior, and richer scraper API status.
- Create `server/test/rentalComps.test.js`: cover rental comp estimator and strategy integration.
- Modify `client/src/api/client.js`: add scrape-options payload builder.
- Modify `client/src/api/client.test.js`: cover scrape-options payload builder.
- Modify `client/src/components/ScrapeButton.jsx`: add compact scrape mode controls and pass request body.
- Modify `client/src/pages/Overview.jsx`: show sale and rental counts and partial/full crawl wording.
- Modify `client/src/components/PropertyTable.jsx`: show rent source for rent-sensitive strategy rows.
- Modify `client/src/lib/labels.js`: add labels for active sale listings, rental comps, crawl scope, and rent source.

---

### Task 1: Persist Listing Purpose, Category, And Run Scopes

**Files:**
- Modify: `server/src/db/schema.sql`
- Modify: `server/src/db/connection.js`
- Modify: `server/src/db/properties.js`
- Create: `server/src/db/scrapingRunScopes.js`
- Modify: `server/test/phase2.test.js`

- [ ] **Step 1: Write failing data-layer tests**

Add imports in `server/test/phase2.test.js`:

```js
import {
  completeScrapingRunScope,
  createScrapingRunScope,
  getCompletedScrapingRunScopes
} from '../src/db/scrapingRunScopes.js';
```

Add this test inside `describe('Phase 2 data layer', () => { ... })`:

```js
  test('stores listing purpose and category and filters sale listings by default', () => {
    const db = memoryDb();

    upsertProperty(
      {
        externalId: 'sale-1',
        listingPurpose: 'sale',
        category: 'dvustaen',
        title: 'Sale apartment',
        priceEur: 100000
      },
      db
    );
    upsertProperty(
      {
        externalId: 'rent-1',
        listingPurpose: 'rent',
        category: 'dvustaen',
        title: 'Rental apartment',
        priceEur: 600
      },
      db
    );

    assert.equal(queryProperties({}, db).length, 1);
    assert.equal(queryProperties({ listingPurpose: 'sale' }, db).length, 1);
    assert.equal(queryProperties({ listingPurpose: 'rent' }, db).length, 1);
    assert.equal(queryProperties({ includeAllPurposes: true }, db).length, 2);
    assert.equal(getPropertyByExternalId('rent-1', db).listing_purpose, 'rent');
    assert.equal(getPropertyByExternalId('rent-1', db).category, 'dvustaen');
  });

  test('records completed scraping run scopes', () => {
    const db = memoryDb();
    const run = createScrapingRun({ pagesTotal: 5 }, db);
    const scope = createScrapingRunScope(
      {
        runId: run.id,
        listingPurpose: 'sale',
        category: 'dvustaen',
        pagesPlanned: 5,
        fullScope: false
      },
      db
    );

    assert.equal(scope.completed, 0);

    const completed = completeScrapingRunScope(
      scope.id,
      {
        pagesScraped: 5,
        completed: true
      },
      db
    );

    assert.equal(completed.pages_scraped, 5);
    assert.equal(completed.completed, 1);
    assert.deepEqual(
      getCompletedScrapingRunScopes(run.id, db).map((row) => ({
        purpose: row.listing_purpose,
        category: row.category,
        pages: row.pages_scraped
      })),
      [{ purpose: 'sale', category: 'dvustaen', pages: 5 }]
    );
  });

  test('adds listing purpose and category columns to existing databases', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'realestate-purpose-'));
    tempDirs.push(tempDir);
    const dbPath = path.join(tempDir, 'legacy.db');
    const legacyDb = new Database(dbPath);
    legacyDb.exec(`
      CREATE TABLE properties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        external_id TEXT NOT NULL UNIQUE,
        source TEXT NOT NULL DEFAULT 'imot.bg',
        price_eur REAL NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE settings (
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
      INSERT INTO settings (id) VALUES (1);
    `);
    legacyDb.close();

    const migratedDb = createDatabase(dbPath);
    databases.push(migratedDb);

    const propertyColumns = migratedDb.prepare('PRAGMA table_info(properties)').all().map((column) => column.name);
    assert.ok(propertyColumns.includes('listing_purpose'));
    assert.ok(propertyColumns.includes('category'));
    assert.ok(migratedDb.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'scraping_run_scopes'").get());
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm.cmd test -- --run server/test/phase2.test.js
```

Expected: FAIL because `server/src/db/scrapingRunScopes.js` does not exist and `properties` does not support `listing_purpose` or `category`.

- [ ] **Step 3: Update schema**

Modify `server/src/db/schema.sql` so the `properties` table includes these columns after `source`:

```sql
  listing_purpose TEXT NOT NULL DEFAULT 'sale',
  category TEXT,
```

Add indexes after the existing property indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_properties_listing_purpose ON properties(listing_purpose);
CREATE INDEX IF NOT EXISTS idx_properties_category ON properties(category);
```

Add this table after `scraping_runs`:

```sql
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
```

- [ ] **Step 4: Add migrations for existing databases**

In `server/src/db/connection.js`, call a new helper from `runSchema()`:

```js
function runSchema(database) {
  const schema = fs.readFileSync(schemaPath, 'utf8');
  database.exec(schema);
  ensurePropertyColumns(database);
  ensureSettingsColumns(database);
  ensureScrapingRunScopesTable(database);
}
```

Add these helpers before `ensureSettingsColumns()`:

```js
function ensurePropertyColumns(database) {
  const columns = new Set(database.prepare('PRAGMA table_info(properties)').all().map((column) => column.name));

  if (!columns.has('listing_purpose')) {
    database.exec("ALTER TABLE properties ADD COLUMN listing_purpose TEXT NOT NULL DEFAULT 'sale'");
  }
  if (!columns.has('category')) {
    database.exec('ALTER TABLE properties ADD COLUMN category TEXT');
  }
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
```

- [ ] **Step 5: Update property persistence and filtering**

In `server/src/db/properties.js`, add columns:

```js
  'listing_purpose',
  'category',
```

Add camel-case mappings:

```js
  listingPurpose: 'listing_purpose',
```

In `toSnakeRecord()`, default listing purpose:

```js
  if (!record.listing_purpose) {
    record.listing_purpose = 'sale';
  }
```

In `whereFromFilters()`, after active handling:

```js
  if (filters.includeAllPurposes !== true) {
    clauses.push('listing_purpose = @listingPurpose');
    params.listingPurpose = filters.listingPurpose ?? 'sale';
  } else if (filters.listingPurpose) {
    clauses.push('listing_purpose = @listingPurpose');
    params.listingPurpose = filters.listingPurpose;
  }

  if (filters.category) {
    clauses.push('category = @category');
    params.category = filters.category;
  }
```

Add this export after `markInactive()`:

```js
export function markInactiveByScope({ listingPurpose, category, seenExternalIds = [] }, database = getDb()) {
  const params = { listingPurpose, category };
  const seen = [...seenExternalIds].filter(Boolean);

  if (!listingPurpose || !category) {
    throw new Error('listingPurpose and category are required for scoped inactive marking');
  }

  let seenClause = '';
  if (seen.length) {
    seenClause = `AND external_id NOT IN (${seen.map((_, index) => `@seen${index}`).join(', ')})`;
    for (const [index, externalId] of seen.entries()) {
      params[`seen${index}`] = externalId;
    }
  }

  const result = database
    .prepare(
      `UPDATE properties
       SET is_active = 0, updated_at = CURRENT_TIMESTAMP
       WHERE source = 'imot.bg'
         AND listing_purpose = @listingPurpose
         AND category = @category
         AND is_active = 1
         ${seenClause}`
    )
    .run(params);

  return result.changes;
}
```

- [ ] **Step 6: Add scraping run scope helpers**

Create `server/src/db/scrapingRunScopes.js`:

```js
import { getDb } from './connection.js';

export function createScrapingRunScope(values, database = getDb()) {
  const result = database
    .prepare(
      `INSERT INTO scraping_run_scopes (
        run_id, listing_purpose, category, pages_planned, pages_scraped, full_scope, completed
       )
       VALUES (
        @runId, @listingPurpose, @category, @pagesPlanned, @pagesScraped, @fullScope, @completed
       )`
    )
    .run({
      runId: values.runId,
      listingPurpose: values.listingPurpose,
      category: values.category,
      pagesPlanned: values.pagesPlanned,
      pagesScraped: values.pagesScraped ?? 0,
      fullScope: values.fullScope ? 1 : 0,
      completed: values.completed ? 1 : 0
    });

  return database.prepare('SELECT * FROM scraping_run_scopes WHERE id = ?').get(result.lastInsertRowid);
}

export function completeScrapingRunScope(id, values = {}, database = getDb()) {
  database
    .prepare(
      `UPDATE scraping_run_scopes
       SET pages_scraped = @pagesScraped,
           completed = @completed
       WHERE id = @id`
    )
    .run({
      id,
      pagesScraped: values.pagesScraped ?? 0,
      completed: values.completed ? 1 : 0
    });

  return database.prepare('SELECT * FROM scraping_run_scopes WHERE id = ?').get(id) || null;
}

export function getCompletedScrapingRunScopes(runId, database = getDb()) {
  return database
    .prepare(
      `SELECT *
       FROM scraping_run_scopes
       WHERE run_id = @runId
         AND completed = 1
       ORDER BY id`
    )
    .all({ runId });
}
```

- [ ] **Step 7: Run focused data-layer tests**

Run:

```powershell
npm.cmd test -- --run server/test/phase2.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit data model changes**

```powershell
git -c core.excludesfile= add server/src/db/schema.sql server/src/db/connection.js server/src/db/properties.js server/src/db/scrapingRunScopes.js server/test/phase2.test.js
git -c core.excludesfile= commit -m "Add listing purpose and scrape scopes"
```

---

### Task 2: Add Explicit Search Plan Generation

**Files:**
- Create: `server/src/scraper/searchPlan.js`
- Modify: `server/test/phase3.test.js`

- [ ] **Step 1: Write failing search-plan tests**

Add import in `server/test/phase3.test.js`:

```js
import { buildSearchPlan, normalizeScrapeOptions } from '../src/scraper/searchPlan.js';
```

Add tests inside `describe('Phase 3 scraper', () => { ... })`:

```js
  test('normalizes scrape options with conservative defaults', () => {
    assert.deepEqual(normalizeScrapeOptions({}), {
      includeSales: true,
      includeRentals: true,
      maxPagesPerCategory: 5,
      fullCrawl: false
    });

    assert.deepEqual(normalizeScrapeOptions({ includeRentals: false, maxPagesPerCategory: 2 }), {
      includeSales: true,
      includeRentals: false,
      maxPagesPerCategory: 2,
      fullCrawl: false
    });
  });

  test('builds sale and rental search work for every configured category', () => {
    const plan = buildSearchPlan({
      baseUrl: 'https://example.test',
      maxPagesPerCategory: 2
    });

    assert.equal(plan.length, 20);
    assert.deepEqual(
      plan.slice(0, 4).map((item) => ({
        purpose: item.purpose,
        category: item.category,
        page: item.resultPage,
        fullScope: item.fullScope
      })),
      [
        { purpose: 'sale', category: 'dvustaen', page: 1, fullScope: false },
        { purpose: 'sale', category: 'dvustaen', page: 2, fullScope: false },
        { purpose: 'sale', category: 'tristaen', page: 1, fullScope: false },
        { purpose: 'sale', category: 'tristaen', page: 2, fullScope: false }
      ]
    );
    assert.ok(plan.some((item) => item.purpose === 'rent' && item.category === 'kashta'));
    assert.ok(plan.every((item) => item.url.startsWith('https://example.test/')));
  });

  test('builds sale-only plan without slicing categories', () => {
    const plan = buildSearchPlan({
      baseUrl: 'https://example.test',
      includeRentals: false,
      maxPagesPerCategory: 1
    });

    assert.equal(plan.length, 5);
    assert.deepEqual(plan.map((item) => item.category), ['dvustaen', 'tristaen', 'chetiristaen', 'mnogostaen', 'kashta']);
    assert.ok(plan.every((item) => item.purpose === 'sale'));
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm.cmd test -- --run server/test/phase3.test.js
```

Expected: FAIL because `server/src/scraper/searchPlan.js` does not exist.

- [ ] **Step 3: Implement search plan module**

Create `server/src/scraper/searchPlan.js`:

```js
const DEFAULT_BASE_URL = 'https://www.imot.bg';
const DEFAULT_MAX_PAGES_PER_CATEGORY = 5;
const FULL_CRAWL_PAGE_LIMIT = 50;

export const saleCategories = [
  { id: 'dvustaen', path: '/obiavi/prodazhbi/grad-sofiya/dvustaen' },
  { id: 'tristaen', path: '/obiavi/prodazhbi/grad-sofiya/tristaen' },
  { id: 'chetiristaen', path: '/obiavi/prodazhbi/grad-sofiya/chetiristaen' },
  { id: 'mnogostaen', path: '/obiavi/prodazhbi/grad-sofiya/mnogostaen' },
  { id: 'kashta', path: '/obiavi/prodazhbi/grad-sofiya/kashta' }
];

export const rentalCategories = [
  { id: 'dvustaen', path: '/obiavi/naemi/grad-sofiya/dvustaen' },
  { id: 'tristaen', path: '/obiavi/naemi/grad-sofiya/tristaen' },
  { id: 'chetiristaen', path: '/obiavi/naemi/grad-sofiya/chetiristaen' },
  { id: 'mnogostaen', path: '/obiavi/naemi/grad-sofiya/mnogostaen' },
  { id: 'kashta', path: '/obiavi/naemi/grad-sofiya/kashta' }
];

function booleanOption(value, fallback) {
  return value == null ? fallback : Boolean(value);
}

export function normalizeScrapeOptions(options = {}) {
  const fullCrawl = Boolean(options.fullCrawl);
  const rawMaxPages = Number(options.maxPagesPerCategory);

  return {
    includeSales: booleanOption(options.includeSales, true),
    includeRentals: booleanOption(options.includeRentals, true),
    maxPagesPerCategory: fullCrawl
      ? FULL_CRAWL_PAGE_LIMIT
      : Math.max(1, Math.min(Number.isFinite(rawMaxPages) ? rawMaxPages : DEFAULT_MAX_PAGES_PER_CATEGORY, FULL_CRAWL_PAGE_LIMIT)),
    fullCrawl
  };
}

function pageUrl(path, page, baseUrl) {
  const url = new URL(path, baseUrl);
  if (page > 1) {
    url.searchParams.set('page', String(page));
  }
  return url.toString();
}

export function buildSearchPlan({ baseUrl = DEFAULT_BASE_URL, ...options } = {}) {
  const normalized = normalizeScrapeOptions(options);
  const groups = [];

  if (normalized.includeSales) {
    groups.push({ purpose: 'sale', categories: saleCategories });
  }
  if (normalized.includeRentals) {
    groups.push({ purpose: 'rent', categories: rentalCategories });
  }

  return groups.flatMap(({ purpose, categories }) =>
    categories.flatMap((category) =>
      Array.from({ length: normalized.maxPagesPerCategory }, (_, index) => {
        const resultPage = index + 1;
        return {
          purpose,
          category: category.id,
          resultPage,
          url: pageUrl(category.path, resultPage, baseUrl),
          fullScope: normalized.fullCrawl
        };
      })
    )
  );
}
```

- [ ] **Step 4: Run focused search-plan tests**

Run:

```powershell
npm.cmd test -- --run server/test/phase3.test.js
```

Expected: PASS for the new search-plan tests. Existing scrape tests may still pass because `runScrape` has not been changed yet.

- [ ] **Step 5: Commit search plan**

```powershell
git -c core.excludesfile= add server/src/scraper/searchPlan.js server/test/phase3.test.js
git -c core.excludesfile= commit -m "Add sale and rental scrape plans"
```

---

### Task 3: Wire Scraper To Plan, Purpose, And Scoped Inactive Marking

**Files:**
- Modify: `server/src/scraper/parser.js`
- Modify: `server/src/scraper/imotbg.js`
- Modify: `server/src/db/scrapingRuns.js`
- Modify: `server/src/routes/scraper.js`
- Modify: `server/test/phase3.test.js`

- [ ] **Step 1: Update scraper tests for purpose and scope behavior**

In the existing `runs a scrape, tracks price changes, marks missing listings inactive, and recomputes stats` test in `server/test/phase3.test.js`, replace the three `runScrape()` calls with:

```js
    const searchPlan = [{ purpose: 'sale', category: 'dvustaen', resultPage: 1, url: searchUrl, fullScope: true }];
    const first = await runScrape({ database: db, searchPlan, fetcher, delayMs: 0 });
```

```js
    const second = await runScrape({ database: db, searchPlan, fetcher, delayMs: 0 });
```

```js
    await runScrape({ database: db, searchPlan, fetcher, delayMs: 0 });
```

After reading `property`, add:

```js
    assert.equal(property.listing_purpose, 'sale');
    assert.equal(property.category, 'dvustaen');
```

Add this new test:

```js
  test('bounded scrape does not deactivate listings outside completed scanned scope', async () => {
    const db = memoryDb();
    upsertProperty({ externalId: 'sale-a', listingPurpose: 'sale', category: 'dvustaen', priceEur: 100000 }, db);
    upsertProperty({ externalId: 'sale-b', listingPurpose: 'sale', category: 'tristaen', priceEur: 120000 }, db);
    upsertProperty({ externalId: 'rent-a', listingPurpose: 'rent', category: 'dvustaen', priceEur: 600 }, db);

    await runScrape({
      database: db,
      searchPlan: [{ purpose: 'sale', category: 'dvustaen', resultPage: 1, url: 'https://www.imot.bg/sale-a', fullScope: true }],
      fetcher: async () => ({ body: '<main></main>' }),
      delayMs: 0
    });

    assert.equal(getPropertyByExternalId('sale-a', db).is_active, 0);
    assert.equal(getPropertyByExternalId('sale-b', db).is_active, 1);
    assert.equal(getPropertyByExternalId('rent-a', db).is_active, 1);
  });
```

In the route test scraper stub, assert the body options are passed:

```js
      let receivedOptions = null;
      const app = createApp({
        database: db,
        scraper: {
          start: async (options) => {
            receivedOptions = options;
            return runScrape({
              database: db,
              searchPlan: [],
              fetcher: async () => ({ body: '<main></main>' }),
              delayMs: 0
            });
          }
        }
      });
```

Change the start fetch:

```js
      const start = await fetch(`${baseUrl}/api/scraper/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ includeRentals: false, maxPagesPerCategory: 2 })
      });
```

After `startJson` assertions, add:

```js
      assert.deepEqual(receivedOptions, { includeRentals: false, maxPagesPerCategory: 2 });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm.cmd test -- --run server/test/phase3.test.js
```

Expected: FAIL because `runScrape` does not accept `searchPlan`, parser does not attach purpose/category, and inactive marking is global.

- [ ] **Step 3: Update parser to attach listing metadata**

Change the signature in `server/src/scraper/parser.js`:

```js
export function parseSearchResults(html, baseUrl = 'https://www.imot.bg', metadata = {}) {
```

Add these fields to the returned listing object:

```js
        listingPurpose: metadata.listingPurpose ?? metadata.purpose ?? 'sale',
        category: metadata.category ?? null,
```

- [ ] **Step 4: Expand scraping run progress fields**

In `server/src/db/scrapingRuns.js`, add allowed update mappings:

```js
    salePagesScraped: 'sale_pages_scraped',
    rentalPagesScraped: 'rental_pages_scraped',
    currentPurpose: 'current_purpose',
    currentCategory: 'current_category',
    crawlMode: 'crawl_mode'
```

Before this step, add these columns to `scraping_runs` in `server/src/db/schema.sql`:

```sql
  sale_pages_scraped INTEGER NOT NULL DEFAULT 0,
  rental_pages_scraped INTEGER NOT NULL DEFAULT 0,
  current_purpose TEXT,
  current_category TEXT,
  crawl_mode TEXT NOT NULL DEFAULT 'bounded',
```

Also add migration logic in `server/src/db/connection.js`:

```js
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
```

Call `ensureScrapingRunColumns(database);` from `runSchema()` after `ensureScrapingRunScopesTable(database);`.

- [ ] **Step 5: Update scraper implementation**

In `server/src/scraper/imotbg.js`, update imports:

```js
import { markInactiveByScope, getPropertyByExternalId, queryProperties, upsertProperty } from '../db/properties.js';
import { completeScrapingRunScope, createScrapingRunScope } from '../db/scrapingRunScopes.js';
import { buildSearchPlan, normalizeScrapeOptions } from './searchPlan.js';
```

Keep `buildSearchUrls()` as a compatibility wrapper, but make it use the new plan:

```js
export function buildSearchUrls({ pages = 1, baseUrl = DEFAULT_BASE_URL } = {}) {
  return buildSearchPlan({ baseUrl, includeRentals: false, maxPagesPerCategory: pages }).map((item) => item.url);
}
```

Replace `runScrape()` setup with:

```js
export async function runScrape({
  database = getDb(),
  pages,
  searchUrls,
  searchPlan,
  fetcher = defaultFetcher,
  delayMs = 750,
  retries = 2,
  ...options
} = {}) {
  const normalizedOptions = normalizeScrapeOptions({ ...options, maxPagesPerCategory: options.maxPagesPerCategory ?? pages });
  const plan =
    searchPlan ??
    (searchUrls
      ? searchUrls.map((url, index) => ({
          purpose: 'sale',
          category: `legacy-${index + 1}`,
          resultPage: 1,
          url,
          fullScope: true
        }))
      : buildSearchPlan(normalizedOptions));

  const run = createScrapingRun(
    {
      pagesTotal: plan.length,
      crawlMode: normalizedOptions.fullCrawl ? 'full' : 'bounded'
    },
    database
  );
  const seenByScope = new Map();
  const scopeRows = new Map();
  let listingsFound = 0;
  let listingsSaved = 0;
  let priceChanges = 0;
  let salePagesScraped = 0;
  let rentalPagesScraped = 0;
```

Before scraping pages, create scope rows:

```js
  for (const item of plan) {
    const key = `${item.purpose}:${item.category}`;
    if (!scopeRows.has(key)) {
      const pagesPlanned = plan.filter((entry) => entry.purpose === item.purpose && entry.category === item.category).length;
      scopeRows.set(
        key,
        createScrapingRunScope(
          {
            runId: run.id,
            listingPurpose: item.purpose,
            category: item.category,
            pagesPlanned,
            fullScope: item.fullScope
          },
          database
        )
      );
      seenByScope.set(key, new Set());
    }
  }
```

Change the scrape loop to use `plan` entries:

```js
    for (const [index, item] of plan.entries()) {
      const html = await withRetries(() => fetchHtml(fetcher, item.url), retries);
      const listings = parseSearchResults(html, DEFAULT_BASE_URL, {
        listingPurpose: item.purpose,
        category: item.category
      });
      listingsFound += listings.length;

      if (item.purpose === 'sale') {
        salePagesScraped += 1;
      } else if (item.purpose === 'rent') {
        rentalPagesScraped += 1;
      }

      const scopeKey = `${item.purpose}:${item.category}`;
      const seenExternalIds = seenByScope.get(scopeKey);

      for (const listing of listings) {
        seenExternalIds.add(listing.externalId);
        const existing = getPropertyByExternalId(listing.externalId, database);
        let propertyData = listing;

        if (listing.url) {
          try {
            const detailHtml = await withRetries(() => fetchHtml(fetcher, listing.url), retries);
            propertyData = mergeDetail(listing, parseDetailPage(detailHtml));
          } catch {
            propertyData = listing;
          }
        }

        const saved = upsertProperty(propertyData, database);
        listingsSaved += 1;

        if (!existing || Number(existing.price_eur) !== Number(saved.price_eur)) {
          insertPriceHistory(
            { propertyId: saved.id, priceEur: saved.price_eur, priceBgn: saved.price_bgn },
            database
          );
          if (existing) {
            priceChanges += 1;
          }
        }

        if (delayMs > 0) {
          await sleep(delayMs);
        }
      }

      updateScrapingRun(
        run.id,
        {
          pagesScraped: index + 1,
          listingsFound,
          listingsSaved,
          salePagesScraped,
          rentalPagesScraped,
          currentPurpose: item.purpose,
          currentCategory: item.category
        },
        database
      );
    }
```

Replace global inactive marking with scope completion:

```js
    for (const [key, scope] of scopeRows.entries()) {
      const [listingPurpose, category] = key.split(':');
      const planned = plan.filter((item) => item.purpose === listingPurpose && item.category === category).length;
      completeScrapingRunScope(scope.id, { pagesScraped: planned, completed: true }, database);
      markInactiveByScope(
        {
          listingPurpose,
          category,
          seenExternalIds: seenByScope.get(key)
        },
        database
      );
    }
```

Delete the old loop that called `queryProperties({ includeInactive: true, limit: 10000 }, database)` and `markInactive(property.id, database)`.

Return richer completion:

```js
    const completed = updateScrapingRun(
      run.id,
      {
        status: 'completed',
        listingsFound,
        listingsSaved,
        pagesScraped: plan.length,
        salePagesScraped,
        rentalPagesScraped,
        currentPurpose: null,
        currentCategory: null
      },
      database
    );

    return { ...completed, listingsFound, listingsSaved, priceChanges };
```

- [ ] **Step 6: Update scraper route response**

In `server/src/routes/scraper.js`, update `toRunResponse()` progress:

```js
    crawlMode: run.crawl_mode ?? 'bounded',
    progress: {
      currentPage: run.pages_scraped,
      totalPages: run.pages_total,
      listingsProcessed: run.listings_saved,
      salePagesScraped: run.sale_pages_scraped ?? 0,
      rentalPagesScraped: run.rental_pages_scraped ?? 0,
      currentPurpose: run.current_purpose,
      currentCategory: run.current_category
    },
```

- [ ] **Step 7: Run focused scraper tests**

Run:

```powershell
npm.cmd test -- --run server/test/phase3.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit scraper changes**

```powershell
git -c core.excludesfile= add server/src/scraper/parser.js server/src/scraper/imotbg.js server/src/db/scrapingRuns.js server/src/routes/scraper.js server/src/db/schema.sql server/src/db/connection.js server/test/phase3.test.js
git -c core.excludesfile= commit -m "Use scoped sale and rental scrapes"
```

---

### Task 4: Add Rental Comp Estimator

**Files:**
- Create: `server/src/strategies/rentalComps.js`
- Create: `server/test/rentalComps.test.js`

- [ ] **Step 1: Write failing rental comp tests**

Create `server/test/rentalComps.test.js`:

```js
import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { createDatabase } from '../src/db/connection.js';
import { upsertProperty } from '../src/db/properties.js';
import { estimateMonthlyRentFromComps } from '../src/strategies/rentalComps.js';

let databases = [];

function memoryDb() {
  const db = createDatabase(':memory:');
  databases.push(db);
  return db;
}

const settings = {
  general: {
    targetGrossYieldPct: 6
  }
};

afterEach(() => {
  for (const db of databases) {
    db.close();
  }
  databases = [];
});

describe('rental comp estimator', () => {
  test('uses neighborhood rent per sqm comps when sample is credible', () => {
    const db = memoryDb();
    const sale = upsertProperty({
      externalId: 'sale-1',
      listingPurpose: 'sale',
      category: 'dvustaen',
      neighborhood: 'Mladost 1',
      zone: 'Mladost',
      type: '2-bedroom',
      rooms: 2,
      priceEur: 100000,
      areaSqm: 70
    }, db);

    for (const [id, rent, area] of [
      ['rent-1', 600, 60],
      ['rent-2', 700, 70],
      ['rent-3', 800, 80]
    ]) {
      upsertProperty({
        externalId: id,
        listingPurpose: 'rent',
        category: 'dvustaen',
        neighborhood: 'Mladost 1',
        zone: 'Mladost',
        type: '2-bedroom',
        rooms: 2,
        priceEur: rent,
        areaSqm: area
      }, db);
    }

    assert.deepEqual(estimateMonthlyRentFromComps(sale, { database: db, settings }), {
      monthlyRent: 700,
      source: 'neighborhood_comps',
      sampleSize: 3,
      fallback: false
    });
  });

  test('falls back to zone comps when neighborhood sample is sparse', () => {
    const db = memoryDb();
    const sale = upsertProperty({
      externalId: 'sale-2',
      listingPurpose: 'sale',
      neighborhood: 'Mladost 2',
      zone: 'Mladost',
      type: '2-bedroom',
      rooms: 2,
      priceEur: 120000,
      areaSqm: 60
    }, db);

    for (const [id, neighborhood, rent] of [
      ['rent-zone-1', 'Mladost 1', 550],
      ['rent-zone-2', 'Mladost 3', 650],
      ['rent-zone-3', 'Mladost 4', 750]
    ]) {
      upsertProperty({
        externalId: id,
        listingPurpose: 'rent',
        category: 'dvustaen',
        neighborhood,
        zone: 'Mladost',
        type: '2-bedroom',
        rooms: 2,
        priceEur: rent,
        areaSqm: 60
      }, db);
    }

    assert.deepEqual(estimateMonthlyRentFromComps(sale, { database: db, settings }), {
      monthlyRent: 650,
      source: 'zone_comps',
      sampleSize: 3,
      fallback: false
    });
  });

  test('falls back to target yield when comps are sparse', () => {
    const db = memoryDb();
    const sale = upsertProperty({
      externalId: 'sale-3',
      listingPurpose: 'sale',
      neighborhood: 'Boyana',
      zone: 'Boyana',
      type: 'house',
      priceEur: 200000,
      areaSqm: 120
    }, db);

    assert.deepEqual(estimateMonthlyRentFromComps(sale, { database: db, settings }), {
      monthlyRent: 1000,
      source: 'target_yield_fallback',
      sampleSize: 0,
      fallback: true
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm.cmd test -- --run server/test/rentalComps.test.js
```

Expected: FAIL because `server/src/strategies/rentalComps.js` does not exist.

- [ ] **Step 3: Implement estimator**

Create `server/src/strategies/rentalComps.js`:

```js
import { propertyArea, propertyPrice } from './shared.js';

const MIN_SAMPLE_SIZE = 3;

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) {
    return null;
  }
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function estimatedMonthlyRentFallback(property, settings) {
  return propertyPrice(property) * (Number(settings.general?.targetGrossYieldPct ?? 6) / 100) / 12;
}

function matchingTypeClause(property) {
  if (property.rooms != null) {
    return { clause: 'rooms = @rooms', params: { rooms: property.rooms } };
  }
  if (property.type) {
    return { clause: 'type = @type', params: { type: property.type } };
  }
  return { clause: '1 = 1', params: {} };
}

function rentalComps(database, property, scope) {
  const typeMatch = matchingTypeClause(property);
  const scopeClause = scope === 'neighborhood' ? 'neighborhood = @neighborhood' : 'zone = @zone';

  return database
    .prepare(
      `SELECT *
       FROM properties
       WHERE is_active = 1
         AND listing_purpose = 'rent'
         AND ${scopeClause}
         AND ${typeMatch.clause}
         AND price_eur IS NOT NULL`
    )
    .all({
      neighborhood: property.neighborhood,
      zone: property.zone,
      ...typeMatch.params
    });
}

function estimateFromSelectedComps(property, comps, source) {
  const area = propertyArea(property);
  const compsWithArea = comps.filter((comp) => Number(comp.area_sqm) > 0 && Number(comp.price_eur) > 0);

  if (area > 0 && compsWithArea.length >= MIN_SAMPLE_SIZE) {
    const medianRentPerSqm = median(compsWithArea.map((comp) => Number(comp.price_eur) / Number(comp.area_sqm)));
    return {
      monthlyRent: Math.round(medianRentPerSqm * area),
      source,
      sampleSize: compsWithArea.length,
      fallback: false
    };
  }

  return {
    monthlyRent: median(comps.map((comp) => Number(comp.price_eur))),
    source,
    sampleSize: comps.length,
    fallback: false
  };
}

export function estimateMonthlyRentFromComps(property, { database, settings }) {
  const neighborhoodComps = rentalComps(database, property, 'neighborhood');
  if (neighborhoodComps.length >= MIN_SAMPLE_SIZE) {
    return estimateFromSelectedComps(property, neighborhoodComps, 'neighborhood_comps');
  }

  const zoneComps = rentalComps(database, property, 'zone');
  if (zoneComps.length >= MIN_SAMPLE_SIZE) {
    return estimateFromSelectedComps(property, zoneComps, 'zone_comps');
  }

  return {
    monthlyRent: estimatedMonthlyRentFallback(property, settings),
    source: 'target_yield_fallback',
    sampleSize: 0,
    fallback: true
  };
}
```

- [ ] **Step 4: Run rental comp tests**

Run:

```powershell
npm.cmd test -- --run server/test/rentalComps.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit estimator**

```powershell
git -c core.excludesfile= add server/src/strategies/rentalComps.js server/test/rentalComps.test.js
git -c core.excludesfile= commit -m "Estimate rent from rental comps"
```

---

### Task 5: Wire Rental Estimates Into Strategies

**Files:**
- Modify: `server/src/strategies/shared.js`
- Modify: `server/src/strategies/cashFlow.js`
- Modify: `server/src/strategies/airbnb.js`
- Modify: `server/src/strategies/index.js`
- Modify: `server/test/rentalComps.test.js`

- [ ] **Step 1: Add failing strategy integration tests**

Add imports in `server/test/rentalComps.test.js`:

```js
import { analyzeStrategy } from '../src/strategies/index.js';
```

Add this test inside `describe('rental comp estimator', () => { ... })`:

```js
  test('cash flow and airbnb strategies use rental comp metadata', () => {
    const db = memoryDb();
    upsertProperty({
      externalId: 'sale-strategy',
      listingPurpose: 'sale',
      category: 'dvustaen',
      neighborhood: 'Mladost 1',
      zone: 'Mladost',
      type: '2-bedroom',
      rooms: 2,
      priceEur: 100000,
      areaSqm: 70
    }, db);
    upsertProperty({
      externalId: 'rent-hidden',
      listingPurpose: 'rent',
      category: 'dvustaen',
      neighborhood: 'Mladost 1',
      zone: 'Mladost',
      type: '2-bedroom',
      rooms: 2,
      priceEur: 700,
      areaSqm: 70
    }, db);
    upsertProperty({
      externalId: 'rent-hidden-2',
      listingPurpose: 'rent',
      category: 'dvustaen',
      neighborhood: 'Mladost 1',
      zone: 'Mladost',
      type: '2-bedroom',
      rooms: 2,
      priceEur: 800,
      areaSqm: 80
    }, db);
    upsertProperty({
      externalId: 'rent-hidden-3',
      listingPurpose: 'rent',
      category: 'dvustaen',
      neighborhood: 'Mladost 1',
      zone: 'Mladost',
      type: '2-bedroom',
      rooms: 2,
      priceEur: 600,
      areaSqm: 60
    }, db);

    const cashFlow = analyzeStrategy('cash-flow', { database: db, settings, limit: 10 });
    const airbnb = analyzeStrategy('airbnb', { database: db, settings, limit: 10 });

    assert.equal(cashFlow.summary.total, 1);
    assert.equal(cashFlow.results[0].cashMetrics.monthlyRent, 700);
    assert.deepEqual(cashFlow.results[0].cashMetrics.rentEstimate, {
      monthlyRent: 700,
      source: 'neighborhood_comps',
      sampleSize: 3,
      fallback: false
    });
    assert.equal(airbnb.summary.total, 1);
    assert.equal(airbnb.results[0].cashMetrics.longTermRentEstimate.source, 'neighborhood_comps');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm.cmd test -- --run server/test/rentalComps.test.js
```

Expected: FAIL because strategies still use target-yield rent directly and strategy queries include rent records unless filtered.

- [ ] **Step 3: Update shared property payload and rent helper**

In `server/src/strategies/shared.js`, add payload fields:

```js
    listingPurpose: property.listing_purpose,
    category: property.category,
```

Change `estimatedMonthlyRent()` to keep the old behavior as fallback only:

```js
export function estimatedMonthlyRent(property, settings) {
  return propertyPrice(property) * (Number(settings.general.targetGrossYieldPct ?? 6) / 100) / 12;
}
```

No behavior change is needed here; later strategy files will choose comp-based estimates.

- [ ] **Step 4: Update Cash Flow strategy**

In `server/src/strategies/cashFlow.js`, import estimator:

```js
import { estimateMonthlyRentFromComps } from './rentalComps.js';
```

Change the analyzer signature:

```js
export function analyze(property, { database, settings }) {
```

Replace monthly rent assignment:

```js
  const rentEstimate = estimateMonthlyRentFromComps(property, { database, settings });
  const monthlyRent = rentEstimate.monthlyRent;
```

Add metadata inside `cashMetrics`:

```js
      rentEstimate,
```

- [ ] **Step 5: Update Airbnb strategy**

In `server/src/strategies/airbnb.js`, import estimator:

```js
import { estimateMonthlyRentFromComps } from './rentalComps.js';
```

Change the analyzer signature:

```js
export function analyze(property, { database, settings }) {
```

Replace long-term NOI setup:

```js
  const longTermRentEstimate = estimateMonthlyRentFromComps(property, { database, settings });
  const longTermNoi = monthlyNoi(property, settings, longTermRentEstimate.monthlyRent);
```

Add metadata inside `cashMetrics`:

```js
      longTermRentEstimate,
```

- [ ] **Step 6: Force strategy pages to use sale listings**

In `server/src/strategies/index.js`, change the `queryProperties()` call:

```js
  const properties = queryProperties({ ...options.filters, listingPurpose: 'sale', limit: 10000 }, database);
```

- [ ] **Step 7: Run strategy integration tests**

Run:

```powershell
npm.cmd test -- --run server/test/rentalComps.test.js
```

Expected: PASS.

- [ ] **Step 8: Commit strategy integration**

```powershell
git -c core.excludesfile= add server/src/strategies/shared.js server/src/strategies/cashFlow.js server/src/strategies/airbnb.js server/src/strategies/index.js server/test/rentalComps.test.js
git -c core.excludesfile= commit -m "Use rental comps in rent-sensitive strategies"
```

---

### Task 6: Expose Overview Counts And Property Purpose

**Files:**
- Modify: `server/src/routes/overview.js`
- Modify: `server/src/routes/properties.js`
- Modify: `server/test/phase3.test.js`

- [ ] **Step 1: Add failing API assertions**

In `server/test/phase3.test.js`, add this test:

```js
  test('overview reports sale listings and rental comps separately', async () => {
    const db = memoryDb();
    upsertProperty({ externalId: 'overview-sale', listingPurpose: 'sale', category: 'dvustaen', priceEur: 100000 }, db);
    upsertProperty({ externalId: 'overview-rent', listingPurpose: 'rent', category: 'dvustaen', priceEur: 600 }, db);
    const app = createApp({ database: db });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/overview`);
      assert.equal(response.status, 200);
      const json = await response.json();
      assert.equal(json.totalListings, 1);
      assert.equal(json.activeSaleListings, 1);
      assert.equal(json.activeRentalComps, 1);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm.cmd test -- --run server/test/phase3.test.js
```

Expected: FAIL because overview does not return `activeSaleListings` or `activeRentalComps`.

- [ ] **Step 3: Update overview route**

In `server/src/routes/overview.js`, replace `totalListings` query with:

```js
    const activeSaleListings = database
      .prepare("SELECT COUNT(*) AS count FROM properties WHERE is_active = 1 AND listing_purpose = 'sale'")
      .get().count;
    const activeRentalComps = database
      .prepare("SELECT COUNT(*) AS count FROM properties WHERE is_active = 1 AND listing_purpose = 'rent'")
      .get().count;
```

Return:

```js
      totalListings: activeSaleListings,
      activeSaleListings,
      activeRentalComps,
```

- [ ] **Step 4: Update property response**

In `server/src/routes/properties.js`, add:

```js
    listingPurpose: property.listing_purpose,
    category: property.category,
```

- [ ] **Step 5: Run focused API tests**

Run:

```powershell
npm.cmd test -- --run server/test/phase3.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit API surface changes**

```powershell
git -c core.excludesfile= add server/src/routes/overview.js server/src/routes/properties.js server/test/phase3.test.js
git -c core.excludesfile= commit -m "Expose sale and rental inventory counts"
```

---

### Task 7: Add Client Scrape Options And Rent Source Display

**Files:**
- Modify: `client/src/api/client.js`
- Modify: `client/src/api/client.test.js`
- Modify: `client/src/components/ScrapeButton.jsx`
- Modify: `client/src/pages/Overview.jsx`
- Modify: `client/src/components/PropertyTable.jsx`
- Modify: `client/src/lib/labels.js`

- [ ] **Step 1: Add failing client helper tests**

Modify import in `client/src/api/client.test.js`:

```js
import { buildQueryString, buildScrapeRequest, buildSettingsUpdate, buildTriageUpdate } from './client.js';
```

Add test:

```js
  test('builds scraper request bodies from compact modes', () => {
    assert.deepEqual(buildScrapeRequest('default', true), {
      includeSales: true,
      includeRentals: true,
      maxPagesPerCategory: 5,
      fullCrawl: false
    });
    assert.deepEqual(buildScrapeRequest('deep', false), {
      includeSales: true,
      includeRentals: false,
      maxPagesPerCategory: 10,
      fullCrawl: false
    });
    assert.deepEqual(buildScrapeRequest('full', true), {
      includeSales: true,
      includeRentals: true,
      fullCrawl: true
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm.cmd test -- --run client/src/api/client.test.js
```

Expected: FAIL because `buildScrapeRequest()` does not exist.

- [ ] **Step 3: Add scraper request helper**

In `client/src/api/client.js`, add:

```js
export function buildScrapeRequest(mode = 'default', includeRentals = true) {
  if (mode === 'full') {
    return {
      includeSales: true,
      includeRentals,
      fullCrawl: true
    };
  }

  return {
    includeSales: true,
    includeRentals,
    maxPagesPerCategory: mode === 'deep' ? 10 : 5,
    fullCrawl: false
  };
}
```

- [ ] **Step 4: Update ScrapeButton controls**

In `client/src/components/ScrapeButton.jsx`, import `useState` and helper:

```js
import { useEffect, useState } from 'react';
import { buildScrapeRequest, useScraperStatus, useStartScraper } from '../api/client.js';
```

Add state inside component:

```js
  const [mode, setMode] = useState('default');
  const [includeRentals, setIncludeRentals] = useState(true);
```

Change click handler:

```jsx
        onClick={() => start.mutate(buildScrapeRequest(mode, includeRentals))}
```

Add controls before the button:

```jsx
      <select
        className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm"
        value={mode}
        disabled={running}
        onChange={(event) => setMode(event.target.value)}
      >
        <option value="default">Default crawl</option>
        <option value="deep">Deep crawl</option>
        <option value="full">Full crawl</option>
      </select>
      <label className="inline-flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={includeRentals}
          disabled={running}
          onChange={(event) => setIncludeRentals(event.target.checked)}
        />
        Rentals
      </label>
```

Update progress text:

```jsx
          {status.data.status} · {status.data.crawlMode ?? 'bounded'} · {status.data.progress.currentPage}/{status.data.progress.totalPages} pages
```

- [ ] **Step 5: Update Overview metrics**

In `client/src/pages/Overview.jsx`, change metric grid to five columns:

```jsx
      <div className="grid gap-3 md:grid-cols-5">
```

Replace first metric card and add rental count:

```jsx
        <MetricCard labelKey="activeSaleListings" value={formatNumber(overview.data.activeSaleListings ?? overview.data.totalListings)} />
        <MetricCard labelKey="activeRentalComps" value={formatNumber(overview.data.activeRentalComps ?? 0)} />
```

Update last scrape detail:

```jsx
        <MetricCard
          labelKey="lastScrape"
          value={overview.data.lastScrape?.status ?? 'none'}
          detail={`${overview.data.lastScrape?.crawl_mode ?? 'bounded'} · ${formatDate(overview.data.lastScrape?.started_at)}`}
        />
```

- [ ] **Step 6: Update PropertyTable rent source display**

In `client/src/components/PropertyTable.jsx`, add helper above the component:

```js
function rentEstimateLabel(row) {
  const estimate = row.cashMetrics?.rentEstimate ?? row.cashMetrics?.longTermRentEstimate;
  if (!estimate) {
    return null;
  }
  const labels = {
    neighborhood_comps: `Neighborhood comps (${estimate.sampleSize})`,
    zone_comps: `Zone comps (${estimate.sampleSize})`,
    target_yield_fallback: 'Target-yield fallback'
  };
  return labels[estimate.source] ?? null;
}
```

Add a column after yield:

```js
      {
        id: 'rentSource',
        header: <MetricLabel labelKey="rentSource" variant="table" />,
        accessorFn: (row) => rentEstimateLabel(row) ?? '',
        cell: ({ getValue }) => {
          const value = getValue();
          return value ? <span className="text-xs text-slate-500">{value}</span> : <span className="text-xs text-slate-400">-</span>;
        }
      },
```

- [ ] **Step 7: Add labels**

In `client/src/lib/labels.js`, add entries:

```js
  activeSaleListings: {
    label: 'Sale listings',
    description: 'Active purchase listings from the latest stored imot.bg sale data.'
  },
  activeRentalComps: {
    label: 'Rental comps',
    description: 'Active rental listings used as market rent comps when enough similar records exist.'
  },
  rentSource: {
    label: 'Rent source',
    description: 'Shows whether rent-sensitive metrics use neighborhood comps, zone comps, or the target-yield fallback.'
  },
```

- [ ] **Step 8: Run client helper tests and build**

Run:

```powershell
npm.cmd test -- --run client/src/api/client.test.js
npm.cmd run build
```

Expected: PASS for helper tests and successful Vite build.

- [ ] **Step 9: Commit client UI changes**

```powershell
git -c core.excludesfile= add client/src/api/client.js client/src/api/client.test.js client/src/components/ScrapeButton.jsx client/src/pages/Overview.jsx client/src/components/PropertyTable.jsx client/src/lib/labels.js
git -c core.excludesfile= commit -m "Show scrape options and rental comp sources"
```

---

### Task 8: Final Verification

**Files:**
- Read: all files changed by Tasks 1-7

- [ ] **Step 1: Run complete test suite**

Run:

```powershell
npm.cmd test
```

Expected: PASS for server and client tests.

- [ ] **Step 2: Run production build**

Run:

```powershell
npm.cmd run build
```

Expected: PASS with Vite build output and no build errors.

- [ ] **Step 3: Inspect final diff**

Run:

```powershell
git -c core.excludesfile= status --short
git -c core.excludesfile= diff --stat HEAD
```

Expected: clean status if every task committed. If there are uncommitted changes, review and either commit them with the relevant task message or explain why they are intentionally left uncommitted.

- [ ] **Step 4: Manual smoke test**

Start the app:

```powershell
npm.cmd run dev
```

Manual checks:

- Overview loads.
- Scrape controls show default/deep/full modes and rental toggle.
- Starting a default scrape sends a bounded request body.
- Overview displays separate sale and rental counts after API data loads.
- Cash Flow or Airbnb table can show rent source text when the API returns rental estimate metadata.

- [ ] **Step 5: Final implementation summary**

Report:

- Tests run and result.
- Build result.
- Whether manual smoke test was completed.
- Any remaining data-quality limitations, especially imot.bg pagination assumptions and rental comp noise.

---

## Self-Review Notes

Spec coverage:

- Complete sale/rental category coverage: Task 2 and Task 3.
- Configurable bounded/default/full crawl: Task 2, Task 3, Task 7.
- Scoped inactive marking: Task 1 and Task 3.
- Rental listings persisted separately: Task 1 and Task 3.
- Rental comp estimator and fallback: Task 4.
- Cash Flow/Airbnb integration: Task 5.
- Overview/API status: Task 3 and Task 6.
- UI controls and rent source labels: Task 7.
- Regression verification: Task 8.

Placeholder scan:

- No unfinished markers or vague implementation gaps remain.

Type consistency:

- Plan uses `listingPurpose` in JavaScript inputs and `listing_purpose` in SQLite rows.
- Plan uses `category` consistently across scraper, persistence, and scope helpers.
- Rent estimate metadata uses `monthlyRent`, `source`, `sampleSize`, and `fallback`.
