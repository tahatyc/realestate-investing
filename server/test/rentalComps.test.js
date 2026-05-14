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
