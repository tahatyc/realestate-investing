# Deal Triage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Deal Triage page and API that ranks actionable property opportunities, explains why each listing matters, and persists the investor's status and notes.

**Architecture:** Add a small triage persistence table for human decisions, then compute ranked opportunities on demand from active properties, price history, and existing strategy analyzers. The frontend adds a `/triage` operational page using the existing API hook, route, navigation, formatting, loading, error, and health badge patterns.

**Tech Stack:** Node.js, Express, better-sqlite3, node:test, React, React Query, React Router, Tailwind CSS, lucide-react.

---

## File Structure

- Create `server/src/db/dealTriage.js`: persistence helpers for triage state, status validation, upsert, and lookup.
- Create `server/src/triage/dealTriage.js`: computed ranking, signal generation, price-drop detection, and response assembly.
- Create `server/src/routes/triage.js`: Express route for `GET /api/triage` and `PUT /api/triage/:propertyId`.
- Modify `server/src/db/schema.sql`: add `deal_triage` table.
- Modify `server/src/index.js`: mount the triage route.
- Create `server/test/dealTriage.test.js`: backend persistence, ranking, signals, and route tests.
- Modify `client/src/api/client.js`: add `useDealTriage()` and `useUpdateDealTriage()`.
- Modify `client/src/api/client.test.js`: add helper-level tests for `buildTriageUpdate()`.
- Create `client/src/pages/dealTriageHelpers.js`: status constants and pure helper functions testable by Node's test runner.
- Create `client/src/pages/DealTriage.jsx`: dense triage inbox page.
- Create `client/src/pages/dealTriageHelpers.test.js`: helper tests for labels and rejected visibility.
- Modify `client/src/App.jsx`: add `/triage` route.
- Modify `client/src/components/Layout.jsx`: add `Deal Triage` navigation item.

---

### Task 1: Database Table And Triage Persistence

**Files:**
- Modify: `server/src/db/schema.sql`
- Create: `server/src/db/dealTriage.js`
- Test: `server/test/dealTriage.test.js`

- [ ] **Step 1: Write the failing persistence tests**

Add this file:

```js
import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { createDatabase } from '../src/db/connection.js';
import {
  ALLOWED_TRIAGE_STATUSES,
  getTriageByPropertyId,
  getTriageMap,
  upsertTriage
} from '../src/db/dealTriage.js';
import { upsertProperty } from '../src/db/properties.js';

let databases = [];

function memoryDb() {
  const db = createDatabase(':memory:');
  databases.push(db);
  return db;
}

function seedProperty(db, overrides = {}) {
  return upsertProperty(
    {
      externalId: overrides.externalId ?? 'triage-property-1',
      title: overrides.title ?? 'Two room apartment',
      neighborhood: overrides.neighborhood ?? 'Mladost 1',
      zone: overrides.zone ?? 'Mladost',
      type: overrides.type ?? '2-bedroom',
      condition: overrides.condition ?? 'good',
      priceEur: overrides.priceEur ?? 100000,
      areaSqm: overrides.areaSqm ?? 80,
      description: overrides.description ?? 'Test listing',
      ...overrides
    },
    db
  );
}

afterEach(() => {
  for (const db of databases) {
    db.close();
  }
  databases = [];
});

describe('deal triage persistence', () => {
  test('schema creates deal_triage with new status defaults', () => {
    const db = memoryDb();
    const columns = db.prepare('PRAGMA table_info(deal_triage)').all();

    assert.ok(columns.some((column) => column.name === 'property_id'));
    assert.ok(columns.some((column) => column.name === 'status'));
    assert.ok(columns.some((column) => column.name === 'note'));
    assert.ok(columns.some((column) => column.name === 'rejected_reason'));
  });

  test('exports the allowed status list', () => {
    assert.deepEqual(ALLOWED_TRIAGE_STATUSES, [
      'new',
      'watching',
      'needs_call',
      'visited',
      'made_offer',
      'rejected'
    ]);
  });

  test('upserts and reads triage state for a property', () => {
    const db = memoryDb();
    const property = seedProperty(db);

    const saved = upsertTriage(
      property.id,
      {
        status: 'watching',
        note: 'Call broker about documents',
        rejectedReason: ''
      },
      db
    );

    assert.equal(saved.propertyId, property.id);
    assert.equal(saved.status, 'watching');
    assert.equal(saved.note, 'Call broker about documents');
    assert.equal(saved.rejectedReason, '');
    assert.match(saved.updatedAt, /\d{4}-\d{2}-\d{2}/);

    const found = getTriageByPropertyId(property.id, db);
    assert.deepEqual(found, saved);
  });

  test('getTriageMap returns persisted states by property id', () => {
    const db = memoryDb();
    const first = seedProperty(db, { externalId: 'triage-map-1' });
    const second = seedProperty(db, { externalId: 'triage-map-2' });

    upsertTriage(first.id, { status: 'needs_call', note: 'Ask about roof' }, db);
    upsertTriage(second.id, { status: 'rejected', note: '', rejectedReason: 'Too expensive' }, db);

    const map = getTriageMap([first.id, second.id], db);

    assert.equal(map.get(first.id).status, 'needs_call');
    assert.equal(map.get(second.id).status, 'rejected');
  });

  test('rejects invalid statuses before writing', () => {
    const db = memoryDb();
    const property = seedProperty(db);

    assert.throws(
      () => upsertTriage(property.id, { status: 'maybe', note: '' }, db),
      /Invalid triage status: maybe/
    );
    assert.equal(getTriageByPropertyId(property.id, db), null);
  });
});
```

- [ ] **Step 2: Run the persistence tests to verify they fail**

Run:

```powershell
npm.cmd test --workspace server -- --test-name-pattern "deal triage persistence"
```

Expected: FAIL because `server/src/db/dealTriage.js` does not exist and the schema has no `deal_triage` table.

- [ ] **Step 3: Add the table to the schema**

Append this table after the `price_history` index in `server/src/db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS deal_triage (
  property_id INTEGER PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'new',
  note TEXT,
  rejected_reason TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);
```

- [ ] **Step 4: Add the persistence module**

Create `server/src/db/dealTriage.js`:

```js
import { getDb } from './connection.js';

export const ALLOWED_TRIAGE_STATUSES = [
  'new',
  'watching',
  'needs_call',
  'visited',
  'made_offer',
  'rejected'
];

const allowedStatusSet = new Set(ALLOWED_TRIAGE_STATUSES);

function toResponse(row) {
  if (!row) {
    return null;
  }

  return {
    propertyId: row.property_id,
    status: row.status,
    note: row.note ?? '',
    rejectedReason: row.rejected_reason ?? '',
    updatedAt: row.updated_at
  };
}

export function validateTriageStatus(status) {
  const normalized = status ?? 'new';
  if (!allowedStatusSet.has(normalized)) {
    throw new Error(`Invalid triage status: ${normalized}`);
  }
  return normalized;
}

export function defaultTriage(propertyId) {
  return {
    propertyId,
    status: 'new',
    note: '',
    rejectedReason: '',
    updatedAt: null
  };
}

export function getTriageByPropertyId(propertyId, database = getDb()) {
  const row = database.prepare('SELECT * FROM deal_triage WHERE property_id = ?').get(propertyId);
  return toResponse(row);
}

export function getTriageMap(propertyIds, database = getDb()) {
  if (!propertyIds.length) {
    return new Map();
  }

  const placeholders = propertyIds.map(() => '?').join(', ');
  const rows = database.prepare(`SELECT * FROM deal_triage WHERE property_id IN (${placeholders})`).all(...propertyIds);
  return new Map(rows.map((row) => [row.property_id, toResponse(row)]));
}

export function upsertTriage(propertyId, updates, database = getDb()) {
  const status = validateTriageStatus(updates.status);
  const note = updates.note ?? '';
  const rejectedReason = updates.rejectedReason ?? updates.rejected_reason ?? '';

  database
    .prepare(
      `INSERT INTO deal_triage (property_id, status, note, rejected_reason, updated_at)
       VALUES (@propertyId, @status, @note, @rejectedReason, CURRENT_TIMESTAMP)
       ON CONFLICT(property_id) DO UPDATE SET
         status = excluded.status,
         note = excluded.note,
         rejected_reason = excluded.rejected_reason,
         updated_at = CURRENT_TIMESTAMP`
    )
    .run({ propertyId, status, note, rejectedReason });

  return getTriageByPropertyId(propertyId, database);
}
```

- [ ] **Step 5: Run the persistence tests to verify they pass**

Run:

```powershell
npm.cmd test --workspace server -- --test-name-pattern "deal triage persistence"
```

Expected: PASS for all persistence tests.

- [ ] **Step 6: Commit**

Run:

```powershell
git -c core.excludesfile= add server/src/db/schema.sql server/src/db/dealTriage.js server/test/dealTriage.test.js
git -c core.excludesfile= commit -m "Add deal triage persistence"
```

---

### Task 2: Triage Ranking And Signal Service

**Files:**
- Create: `server/src/triage/dealTriage.js`
- Modify: `server/test/dealTriage.test.js`

- [ ] **Step 1: Add failing service tests**

Append these imports to `server/test/dealTriage.test.js`:

```js
import { insertPriceHistory } from '../src/db/priceHistory.js';
import { listDealTriageOpportunities } from '../src/triage/dealTriage.js';
```

Append this describe block:

```js
describe('deal triage ranking', () => {
  test('ranks discounted and price-dropped candidates above weak listings', () => {
    const db = memoryDb();
    const strong = seedProperty(db, {
      externalId: 'strong-deal',
      title: 'Discounted apartment',
      priceEur: 80000,
      areaSqm: 80,
      condition: 'needs_rehab',
      description: 'Needs renovation'
    });
    seedProperty(db, {
      externalId: 'renovated-comp',
      priceEur: 120000,
      areaSqm: 80,
      condition: 'fully_renovated'
    });
    seedProperty(db, {
      externalId: 'weak-deal',
      title: 'Expensive apartment',
      priceEur: 130000,
      areaSqm: 80,
      condition: 'fully_renovated'
    });

    insertPriceHistory({ propertyId: strong.id, priceEur: 90000 }, db);
    insertPriceHistory({ propertyId: strong.id, priceEur: 80000 }, db);

    const response = listDealTriageOpportunities({ limit: 10 }, db);

    assert.ok(response.opportunities.length >= 1);
    assert.equal(response.opportunities[0].property.externalId, 'strong-deal');
    assert.equal(response.opportunities[0].triage.status, 'new');
    assert.ok(response.opportunities[0].rankScore > 0);
    assert.ok(response.opportunities[0].signals.some((signal) => signal.type === 'discount'));
    assert.ok(response.opportunities[0].signals.some((signal) => signal.type === 'price_drop'));
  });

  test('keeps non-new triage entries even when rank score is zero', () => {
    const db = memoryDb();
    const property = seedProperty(db, {
      externalId: 'manual-watch',
      priceEur: 120000,
      areaSqm: 80,
      condition: 'fully_renovated'
    });
    upsertTriage(property.id, { status: 'watching', note: 'Manual follow-up' }, db);

    const response = listDealTriageOpportunities({ limit: 10 }, db);
    const found = response.opportunities.find((item) => item.property.externalId === 'manual-watch');

    assert.ok(found);
    assert.equal(found.triage.status, 'watching');
    assert.equal(found.triage.note, 'Manual follow-up');
  });

  test('hides rejected entries by default and includes them when requested', () => {
    const db = memoryDb();
    const property = seedProperty(db, {
      externalId: 'rejected-deal',
      priceEur: 80000,
      areaSqm: 80,
      condition: 'needs_rehab'
    });
    seedProperty(db, {
      externalId: 'rejected-comp',
      priceEur: 120000,
      areaSqm: 80,
      condition: 'fully_renovated'
    });
    upsertTriage(property.id, { status: 'rejected', rejectedReason: 'Bad building' }, db);

    const hidden = listDealTriageOpportunities({ limit: 10 }, db);
    const shown = listDealTriageOpportunities({ includeRejected: true, limit: 10 }, db);

    assert.equal(hidden.opportunities.some((item) => item.property.externalId === 'rejected-deal'), false);
    assert.equal(shown.opportunities.some((item) => item.property.externalId === 'rejected-deal'), true);
    assert.equal(hidden.summary.hiddenRejected, 1);
  });
});
```

- [ ] **Step 2: Run the ranking tests to verify they fail**

Run:

```powershell
npm.cmd test --workspace server -- --test-name-pattern "deal triage ranking"
```

Expected: FAIL because `server/src/triage/dealTriage.js` does not exist.

- [ ] **Step 3: Add the triage service**

Create `server/src/triage/dealTriage.js`:

```js
import { getTriageMap, defaultTriage } from '../db/dealTriage.js';
import { getDb } from '../db/connection.js';
import { getPriceHistoryByPropertyId } from '../db/priceHistory.js';
import { queryProperties } from '../db/properties.js';
import { getSettings } from '../db/settings.js';
import { analyzeProperty } from '../strategies/index.js';
import { toPropertyResponse } from '../routes/properties.js';

const STRATEGY_LABELS = {
  'buy-in-green': 'Buy in Green',
  brrrr: 'BRRRR',
  flip: 'Fix & Flip',
  'cash-flow': 'Cash Flow',
  airbnb: 'Airbnb',
  'below-market': 'Below Market'
};

function parseBoolean(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function addSignal(signals, signal) {
  if (!signals.some((existing) => existing.type === signal.type && existing.label === signal.label)) {
    signals.push(signal);
  }
}

function formatEur(value) {
  return `EUR ${Math.round(value).toLocaleString('en-US')}`;
}

function priceDropSignal(property, database) {
  const history = getPriceHistoryByPropertyId(property.id, database);
  if (history.length < 2) {
    return null;
  }

  const first = history[0].price_eur;
  const current = property.price_eur;
  const drop = first - current;

  if (drop <= 0) {
    return null;
  }

  return {
    type: 'price_drop',
    label: `Price dropped ${formatEur(drop)}`,
    severity: 'positive',
    weight: Math.min(20, Math.max(5, drop / 1000))
  };
}

function deriveSignals(result, property, database) {
  const signals = [];
  const cash = result.cashMetrics ?? {};
  const leveraged = result.leveragedMetrics ?? {};

  if (result.health === 'green') {
    addSignal(signals, {
      type: 'green_health',
      label: `Green health in ${STRATEGY_LABELS[result.strategy] ?? result.strategy}`,
      severity: 'positive',
      weight: 18
    });
  }

  if (result.health === 'red') {
    addSignal(signals, {
      type: 'red_health',
      label: `Red health in ${STRATEGY_LABELS[result.strategy] ?? result.strategy}`,
      severity: 'risk',
      weight: -15
    });
  }

  if (Number.isFinite(cash.discountPct) && cash.discountPct > 0) {
    addSignal(signals, {
      type: 'discount',
      label: `${Math.round(cash.discountPct)}% below neighborhood average`,
      severity: 'positive',
      weight: Math.min(30, cash.discountPct)
    });
  }

  if (Number.isFinite(leveraged.monthlyCashFlow) && leveraged.monthlyCashFlow > 0) {
    addSignal(signals, {
      type: 'cash_flow',
      label: `Positive monthly cash flow: ${formatEur(leveraged.monthlyCashFlow)}`,
      severity: 'positive',
      weight: Math.min(20, leveraged.monthlyCashFlow / 25)
    });
  }

  if (Number.isFinite(leveraged.monthlyCashFlow) && leveraged.monthlyCashFlow < 0) {
    addSignal(signals, {
      type: 'negative_cash_flow',
      label: `Negative monthly cash flow: ${formatEur(Math.abs(leveraged.monthlyCashFlow))}`,
      severity: 'risk',
      weight: -12
    });
  }

  if (Number.isFinite(cash.roiPct) && cash.roiPct >= 10) {
    addSignal(signals, {
      type: 'cash_roi',
      label: `Cash ROI ${Math.round(cash.roiPct)}%`,
      severity: 'positive',
      weight: Math.min(20, cash.roiPct)
    });
  }

  if (Number.isFinite(leveraged.leveragedRoiPct) && leveraged.leveragedRoiPct >= 10) {
    addSignal(signals, {
      type: 'leveraged_roi',
      label: `Leveraged ROI ${Math.round(leveraged.leveragedRoiPct)}%`,
      severity: 'positive',
      weight: Math.min(20, leveraged.leveragedRoiPct)
    });
  }

  if (result.flags?.includes('INSTANT_EQUITY')) {
    addSignal(signals, {
      type: 'instant_equity',
      label: 'Instant equity signal',
      severity: 'positive',
      weight: 12
    });
  }

  if (result.flags?.includes('REFINANCE_VIABLE')) {
    addSignal(signals, {
      type: 'refinance_viable',
      label: 'Refinance covers most of investment',
      severity: 'positive',
      weight: 10
    });
  }

  const priceDrop = priceDropSignal(property, database);
  if (priceDrop) {
    addSignal(signals, priceDrop);
  }

  return signals;
}

function summarizeStrategyResult(strategy, result, property, database) {
  const signals = deriveSignals({ ...result, strategy }, property, database);
  const signalScore = signals.reduce((sum, signal) => sum + signal.weight, 0);
  const score = toNumber(result.score) ?? 0;
  const healthBonus = result.health === 'green' ? 15 : result.health === 'red' ? -15 : 0;

  return {
    strategy,
    bestScore: score,
    health: result.health,
    signals,
    rankScore: Math.max(0, signalScore + healthBonus + Math.min(20, Math.max(0, score / 2)))
  };
}

function bestOpportunityForProperty(property, database, settings) {
  let results;
  try {
    results = analyzeProperty(property, { database, settings });
  } catch {
    return null;
  }

  const candidates = Object.entries(results)
    .filter(([, result]) => result.applicable !== false)
    .map(([strategy, result]) => summarizeStrategyResult(strategy, result, property, database));

  if (!candidates.length) {
    return null;
  }

  candidates.sort((a, b) => b.rankScore - a.rankScore || b.bestScore - a.bestScore);
  return candidates[0];
}

export function listDealTriageOpportunities(options = {}, database = getDb()) {
  const limit = Math.min(Number(options.limit) || 50, 250);
  const includeRejected = parseBoolean(options.includeRejected);
  const settings = getSettings(database);
  const properties = queryProperties(
    {
      zone: options.zone,
      type: options.type,
      minPrice: options.minPrice,
      maxPrice: options.maxPrice,
      minArea: options.minArea,
      maxArea: options.maxArea,
      limit: 10000
    },
    database
  );
  const triageMap = getTriageMap(properties.map((property) => property.id), database);
  let hiddenRejected = 0;

  const opportunities = properties
    .map((property) => {
      const triage = triageMap.get(property.id) ?? defaultTriage(property.id);
      const best = bestOpportunityForProperty(property, database, settings);
      if (!best) {
        return null;
      }

      return {
        property: toPropertyResponse(property),
        triage,
        bestStrategy: best.strategy,
        bestScore: best.bestScore,
        rankScore: best.rankScore,
        health: best.health,
        signals: best.signals.map(({ weight, ...signal }) => signal)
      };
    })
    .filter(Boolean)
    .filter((item) => item.rankScore > 0 || item.triage.status !== 'new')
    .filter((item) => {
      if (item.triage.status === 'rejected' && !includeRejected) {
        hiddenRejected += 1;
        return false;
      }
      return true;
    })
    .sort((a, b) => b.rankScore - a.rankScore || b.bestScore - a.bestScore)
    .slice(0, limit);

  return {
    opportunities,
    summary: {
      total: opportunities.length,
      hiddenRejected
    }
  };
}
```

- [ ] **Step 4: Run the ranking tests to verify they pass**

Run:

```powershell
npm.cmd test --workspace server -- --test-name-pattern "deal triage ranking"
```

Expected: PASS for all ranking tests.

- [ ] **Step 5: Commit**

Run:

```powershell
git -c core.excludesfile= add server/src/triage/dealTriage.js server/test/dealTriage.test.js
git -c core.excludesfile= commit -m "Add deal triage ranking service"
```

---

### Task 3: Triage API Route

**Files:**
- Create: `server/src/routes/triage.js`
- Modify: `server/src/index.js`
- Modify: `server/test/dealTriage.test.js`

- [ ] **Step 1: Add failing route tests**

Append these imports to `server/test/dealTriage.test.js`:

```js
import { createApp } from '../src/index.js';
```

Append this helper and describe block:

```js
async function withServer(app, callback) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  try {
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('deal triage routes', () => {
  test('GET /api/triage returns ranked opportunities', async () => {
    const db = memoryDb();
    seedProperty(db, {
      externalId: 'route-deal',
      priceEur: 80000,
      areaSqm: 80,
      condition: 'needs_rehab'
    });
    seedProperty(db, {
      externalId: 'route-comp',
      priceEur: 120000,
      areaSqm: 80,
      condition: 'fully_renovated'
    });
    const app = createApp({ database: db });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/triage?limit=10`);
      assert.equal(response.status, 200);
      const json = await response.json();

      assert.ok(Array.isArray(json.opportunities));
      assert.equal(json.opportunities[0].property.externalId, 'route-deal');
      assert.ok(json.opportunities[0].signals.length > 0);
    });
  });

  test('PUT /api/triage/:propertyId validates and persists triage updates', async () => {
    const db = memoryDb();
    const property = seedProperty(db, { externalId: 'route-update' });
    const app = createApp({ database: db });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/triage/${property.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'visited', note: 'Saw it on Sunday' })
      });
      assert.equal(response.status, 200);
      const json = await response.json();

      assert.equal(json.triage.propertyId, property.id);
      assert.equal(json.triage.status, 'visited');
      assert.equal(json.triage.note, 'Saw it on Sunday');
    });
  });

  test('PUT /api/triage/:propertyId returns 400 for invalid status and 404 for missing property', async () => {
    const db = memoryDb();
    const property = seedProperty(db, { externalId: 'route-invalid' });
    const app = createApp({ database: db });

    await withServer(app, async (baseUrl) => {
      const invalid = await fetch(`${baseUrl}/api/triage/${property.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'maybe' })
      });
      assert.equal(invalid.status, 400);
      assert.match((await invalid.json()).error, /Invalid triage status/);

      const missing = await fetch(`${baseUrl}/api/triage/999999`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'watching' })
      });
      assert.equal(missing.status, 404);
    });
  });
});
```

- [ ] **Step 2: Run the route tests to verify they fail**

Run:

```powershell
npm.cmd test --workspace server -- --test-name-pattern "deal triage routes"
```

Expected: FAIL with 404 for `/api/triage` because the route is not mounted.

- [ ] **Step 3: Add the route module**

Create `server/src/routes/triage.js`:

```js
import { Router } from 'express';
import { getPropertyById } from '../db/properties.js';
import { upsertTriage } from '../db/dealTriage.js';
import { listDealTriageOpportunities } from '../triage/dealTriage.js';

export function createTriageRouter({ database } = {}) {
  const router = Router();

  router.get('/', (req, res) => {
    const result = listDealTriageOpportunities(
      {
        includeRejected: req.query.includeRejected,
        zone: req.query.zone,
        type: req.query.type,
        minPrice: req.query.minPrice,
        maxPrice: req.query.maxPrice,
        minArea: req.query.minArea,
        maxArea: req.query.maxArea,
        limit: req.query.limit
      },
      database
    );

    res.json(result);
  });

  router.put('/:propertyId', (req, res) => {
    const property = getPropertyById(req.params.propertyId, database);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    try {
      const triage = upsertTriage(
        property.id,
        {
          status: req.body.status,
          note: req.body.note,
          rejectedReason: req.body.rejectedReason
        },
        database
      );
      return res.json({ triage });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  return router;
}
```

- [ ] **Step 4: Mount the route**

Modify `server/src/index.js` imports:

```js
import { createTriageRouter } from './routes/triage.js';
```

Add this line after the properties route:

```js
app.use('/api/triage', createTriageRouter({ database: activeDatabase }));
```

- [ ] **Step 5: Run the route tests to verify they pass**

Run:

```powershell
npm.cmd test --workspace server -- --test-name-pattern "deal triage routes"
```

Expected: PASS for all route tests.

- [ ] **Step 6: Commit**

Run:

```powershell
git -c core.excludesfile= add server/src/routes/triage.js server/src/index.js server/test/dealTriage.test.js
git -c core.excludesfile= commit -m "Expose deal triage API"
```

---

### Task 4: Client API Hooks

**Files:**
- Modify: `client/src/api/client.js`
- Modify: `client/src/api/client.test.js`

- [ ] **Step 1: Add failing API helper test**

Extend the import in `client/src/api/client.test.js`:

```js
import { buildQueryString, buildSettingsUpdate, buildTriageUpdate } from './client.js';
```

Append this test:

```js
test('normalizes triage update payloads', () => {
  assert.deepEqual(
    buildTriageUpdate({
      status: 'watching',
      note: null,
      rejectedReason: undefined
    }),
    {
      status: 'watching',
      note: '',
      rejectedReason: ''
    }
  );
});
```

- [ ] **Step 2: Run the client API tests to verify they fail**

Run:

```powershell
npm.cmd test --workspace client -- --test-name-pattern "normalizes triage"
```

Expected: FAIL because `buildTriageUpdate` is not exported.

- [ ] **Step 3: Add the helper and hooks**

Modify `client/src/api/client.js` by adding:

```js
export function buildTriageUpdate(updates) {
  return {
    status: updates.status,
    note: updates.note ?? '',
    rejectedReason: updates.rejectedReason ?? ''
  };
}
```

Add these hooks after `useProperty`:

```js
export function useDealTriage(filters = {}) {
  return useQuery({
    queryKey: ['deal-triage', filters],
    queryFn: () => getJson(`/triage${buildQueryString(filters)}`)
  });
}

export function useUpdateDealTriage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ propertyId, updates }) => {
      const response = await api.put(`/triage/${propertyId}`, buildTriageUpdate(updates));
      return response.data.triage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-triage'] });
    }
  });
}
```

- [ ] **Step 4: Run the client API tests to verify they pass**

Run:

```powershell
npm.cmd test --workspace client -- --test-name-pattern "triage"
```

Expected: PASS for the triage API helper test.

- [ ] **Step 5: Commit**

Run:

```powershell
git -c core.excludesfile= add client/src/api/client.js client/src/api/client.test.js
git -c core.excludesfile= commit -m "Add deal triage client hooks"
```

---

### Task 5: Deal Triage Page, Route, And Navigation

**Files:**
- Create: `client/src/pages/dealTriageHelpers.js`
- Create: `client/src/pages/DealTriage.jsx`
- Create: `client/src/pages/dealTriageHelpers.test.js`
- Modify: `client/src/App.jsx`
- Modify: `client/src/components/Layout.jsx`

- [ ] **Step 1: Add a pure status helper test**

Create `client/src/pages/dealTriageHelpers.test.js`:

```js
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { shouldHideRejected, statusLabel } from './dealTriageHelpers.js';

describe('DealTriage helpers', () => {
  test('labels triage statuses for controls', () => {
    assert.equal(statusLabel('new'), 'New');
    assert.equal(statusLabel('needs_call'), 'Needs call');
    assert.equal(statusLabel('made_offer'), 'Made offer');
    assert.equal(statusLabel('unknown'), 'unknown');
  });

  test('hides rejected rows only when includeRejected is false', () => {
    assert.equal(shouldHideRejected({ triage: { status: 'rejected' } }, false), true);
    assert.equal(shouldHideRejected({ triage: { status: 'rejected' } }, true), false);
    assert.equal(shouldHideRejected({ triage: { status: 'watching' } }, false), false);
  });
});
```

- [ ] **Step 2: Run the page helper tests to verify they fail**

Run:

```powershell
npm.cmd test --workspace client -- --test-name-pattern "DealTriage helpers"
```

Expected: FAIL because `client/src/pages/dealTriageHelpers.js` does not exist.

- [ ] **Step 3: Add the helper module**

Create `client/src/pages/dealTriageHelpers.js`:

```js
export const TRIAGE_STATUSES = ['new', 'watching', 'needs_call', 'visited', 'made_offer', 'rejected'];

export function statusLabel(status) {
  const labels = {
    new: 'New',
    watching: 'Watching',
    needs_call: 'Needs call',
    visited: 'Visited',
    made_offer: 'Made offer',
    rejected: 'Rejected'
  };
  return labels[status] ?? status;
}

export function shouldHideRejected(item, includeRejected) {
  return item.triage?.status === 'rejected' && !includeRejected;
}
```

- [ ] **Step 4: Add the Deal Triage page**

Create `client/src/pages/DealTriage.jsx`:

```jsx
import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import HealthBadge from '../components/HealthBadge.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/StatusViews.jsx';
import { useDealTriage, useUpdateDealTriage } from '../api/client.js';
import { formatEur, formatNumber, formatSqm } from '../lib/formatters.js';
import { getStrategy } from '../lib/strategies.js';
import { statusLabel, TRIAGE_STATUSES } from './dealTriageHelpers.js';

export default function DealTriage() {
  const [includeRejected, setIncludeRejected] = useState(false);
  const query = useDealTriage({ limit: 50, includeRejected: includeRejected ? 'true' : '' });
  const updateTriage = useUpdateDealTriage();

  if (query.isLoading) {
    return <LoadingState label="Loading deal triage..." />;
  }
  if (query.isError) {
    return <ErrorState error={query.error} />;
  }

  const opportunities = query.data.opportunities ?? [];
  const summary = query.data.summary ?? {};

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Deal Triage</h1>
          <p className="text-sm text-slate-500">Ranked opportunities that need a decision.</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          {formatNumber(summary.total ?? opportunities.length)} active candidates
          {summary.hiddenRejected ? `, ${formatNumber(summary.hiddenRejected)} rejected hidden` : ''}
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300"
          checked={includeRejected}
          onChange={(event) => setIncludeRejected(event.target.checked)}
        />
        Show rejected
      </label>

      {opportunities.length ? (
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3 text-left font-semibold">Property</th>
                  <th className="px-3 py-3 text-left font-semibold">Deal signal</th>
                  <th className="px-3 py-3 text-left font-semibold">Status</th>
                  <th className="px-3 py-3 text-left font-semibold">Note</th>
                  <th className="px-3 py-3 text-left font-semibold">Links</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((item) => (
                  <TriageRow key={item.property.id} item={item} updateTriage={updateTriage} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState title="No triage candidates yet" detail="Run a fresh scrape or adjust filters." />
      )}
    </div>
  );
}

function TriageRow({ item, updateTriage }) {
  const property = item.property;
  const triage = item.triage;

  function saveStatus(status) {
    updateTriage.mutate({
      propertyId: property.id,
      updates: {
        status,
        note: triage.note,
        rejectedReason: triage.rejectedReason
      }
    });
  }

  function saveNote(event) {
    updateTriage.mutate({
      propertyId: property.id,
      updates: {
        status: triage.status,
        note: event.currentTarget.value,
        rejectedReason: triage.rejectedReason
      }
    });
  }

  return (
    <tr className="border-t border-slate-100 align-top hover:bg-slate-50">
      <td className="min-w-64 px-3 py-3">
        <Link className="font-medium text-slate-900 hover:text-sky-700" to={`/property/${property.id}`}>
          {property.title || property.neighborhood || `Property #${property.id}`}
        </Link>
        <p className="text-xs text-slate-500">
          {property.neighborhood || '-'} - {property.type || '-'}
        </p>
        <p className="mt-1 text-xs text-slate-600">
          {formatEur(property.priceEur)} - {formatSqm(property.areaSqm)} - {formatEur(property.pricePerSqm)}/sqm
        </p>
      </td>
      <td className="min-w-72 px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
            {getStrategy(item.bestStrategy).label}
          </span>
          <HealthBadge health={item.health} size="sm" />
          <span className="text-xs text-slate-500">Rank {Math.round(item.rankScore)}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.signals.slice(0, 4).map((signal) => (
            <span
              key={`${signal.type}-${signal.label}`}
              className={[
                'rounded-full px-2 py-1 text-xs font-medium',
                signal.severity === 'risk'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-emerald-100 text-emerald-800'
              ].join(' ')}
            >
              {signal.label}
            </span>
          ))}
        </div>
      </td>
      <td className="px-3 py-3">
        <select
          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm"
          value={triage.status}
          onChange={(event) => saveStatus(event.target.value)}
        >
          {TRIAGE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
      </td>
      <td className="min-w-64 px-3 py-3">
        <textarea
          className="h-16 w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          defaultValue={triage.note}
          onBlur={saveNote}
          placeholder="Broker notes, legal questions, next action"
        />
        {updateTriage.isError ? <p className="mt-1 text-xs text-rose-700">{updateTriage.error.message}</p> : null}
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col gap-2">
          <Link className="text-sm font-medium text-sky-700" to={`/property/${property.id}`}>
            Detail
          </Link>
          {property.url ? (
            <a className="inline-flex items-center gap-1 text-sm font-medium text-sky-700" href={property.url} target="_blank" rel="noreferrer">
              Original <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
```

- [ ] **Step 5: Add the route**

Modify `client/src/App.jsx` imports:

```jsx
import DealTriage from './pages/DealTriage.jsx';
```

Add the route after Overview:

```jsx
<Route path="/triage" element={<DealTriage />} />
```

- [ ] **Step 6: Add navigation**

Modify `client/src/components/Layout.jsx` import:

```jsx
import { BookOpen, Building2, ChartColumn, ClipboardList, Gauge, Home, Settings, TableProperties } from 'lucide-react';
```

Add this item after Overview:

```jsx
{ to: '/triage', label: 'Deal Triage', icon: ClipboardList },
```

- [ ] **Step 7: Run the page helper tests to verify they pass**

Run:

```powershell
npm.cmd test --workspace client -- --test-name-pattern "DealTriage helpers"
```

Expected: PASS for the Deal Triage helper tests.

- [ ] **Step 8: Run the client build**

Run:

```powershell
npm.cmd run build
```

Expected: PASS and Vite produces a production build.

- [ ] **Step 9: Commit**

Run:

```powershell
git -c core.excludesfile= add client/src/pages/dealTriageHelpers.js client/src/pages/dealTriageHelpers.test.js client/src/pages/DealTriage.jsx client/src/App.jsx client/src/components/Layout.jsx
git -c core.excludesfile= commit -m "Add deal triage page"
```

---

### Task 6: Full Verification And Polish

**Files:**
- Modify only files from previous tasks if verification exposes a concrete defect.

- [ ] **Step 1: Run all server tests**

Run:

```powershell
npm.cmd test --workspace server
```

Expected: PASS for all server tests.

- [ ] **Step 2: Run all client tests**

Run:

```powershell
npm.cmd test --workspace client
```

Expected: PASS for all client tests.

- [ ] **Step 3: Run the production build**

Run:

```powershell
npm.cmd run build
```

Expected: PASS with no build errors.

- [ ] **Step 4: Run full root test command**

Run:

```powershell
npm.cmd test
```

Expected: PASS for server and client workspaces.

- [ ] **Step 5: Inspect changed files**

Run:

```powershell
git diff --stat HEAD~5..HEAD
git status --short
```

Expected: only Deal Triage implementation files are changed after the planned commits. `git status --short` should be clean unless the current session intentionally leaves uncommitted verification notes.

- [ ] **Step 6: Commit verification fixes if any were needed**

If Step 1 through Step 4 exposed and fixed defects, commit those fixes:

```powershell
git -c core.excludesfile= add server client
git -c core.excludesfile= commit -m "Stabilize deal triage implementation"
```

Expected: create this commit only when there are actual verification fixes.

---

## Self-Review

- Spec coverage: The plan covers persistence, computed ranking, signal generation, rejected-hidden default behavior, API routes, frontend hooks, page UI, navigation, error states, and tests.
- Scope check: The plan excludes alerts, configurable weights, strategy refactors, and external services.
- Type consistency: `rejectedReason`, `updatedAt`, `rankScore`, `bestStrategy`, `signals`, and `triage.status` use the same names across backend responses and frontend consumers.
- Test-first flow: Each implementation task starts with a failing test and a command that verifies the failure before code changes.
