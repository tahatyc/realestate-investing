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
