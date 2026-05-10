import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { createDatabase } from '../src/db/connection.js';
import {
  ALLOWED_TRIAGE_STATUSES,
  getTriageByPropertyId,
  getTriageMap,
  upsertTriage
} from '../src/db/dealTriage.js';
import { insertPriceHistory } from '../src/db/priceHistory.js';
import { upsertProperty } from '../src/db/properties.js';
import { createApp } from '../src/index.js';
import { listDealTriageOpportunities } from '../src/triage/dealTriage.js';

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
