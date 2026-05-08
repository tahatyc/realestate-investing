import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { createDatabase } from '../src/db/connection.js';
import { upsertProperty, queryProperties, getPropertyById, markInactive } from '../src/db/properties.js';
import { insertPriceHistory, getPriceHistoryByPropertyId } from '../src/db/priceHistory.js';
import { createScrapingRun, getLatestScrapingRun, updateScrapingRun } from '../src/db/scrapingRuns.js';
import { getSettings, updateSettings } from '../src/db/settings.js';
import { recomputeNeighborhoodStats } from '../src/db/neighborhoodStats.js';
import { bgnToEur, eurToBgn } from '../src/utils/currency.js';
import { breakEvenRate, dscr, monthlyPayment } from '../src/utils/mortgage.js';
import { evaluate } from '../src/utils/healthFlags.js';

let databases = [];

function memoryDb() {
  const db = createDatabase(':memory:');
  databases.push(db);
  return db;
}

afterEach(() => {
  for (const db of databases) {
    db.close();
  }
  databases = [];
});

describe('Phase 2 data layer', () => {
  test('upserts, queries, reads, and marks properties inactive', () => {
    const db = memoryDb();
    const property = upsertProperty(
      {
        externalId: 'imot-1',
        title: 'Two room apartment',
        neighborhood: 'Mladost 1',
        zone: 'Mladost',
        type: '2-bedroom',
        condition: 'good',
        priceEur: 100000,
        areaSqm: 80
      },
      db
    );

    assert.equal(property.external_id, 'imot-1');
    assert.equal(Math.round(property.price_per_sqm), 1250);
    assert.equal(queryProperties({ zone: 'Mladost' }, db).length, 1);
    assert.equal(getPropertyById(property.id, db).title, 'Two room apartment');
    assert.equal(markInactive(property.id, db), true);
    assert.equal(queryProperties({}, db).length, 0);
  });

  test('tracks price history', () => {
    const db = memoryDb();
    const property = upsertProperty({ externalId: 'imot-2', priceEur: 90000 }, db);
    insertPriceHistory({ propertyId: property.id, priceEur: 90000 }, db);
    insertPriceHistory({ propertyId: property.id, priceEur: 87500 }, db);

    const history = getPriceHistoryByPropertyId(property.id, db);
    assert.equal(history.length, 2);
    assert.equal(history[1].price_eur, 87500);
  });

  test('handles scraping run lifecycle', () => {
    const db = memoryDb();
    const run = createScrapingRun({ pagesTotal: 2 }, db);
    const updated = updateScrapingRun(run.id, {
      status: 'completed',
      pagesScraped: 2,
      listingsFound: 20,
      listingsSaved: 18
    }, db);

    assert.equal(updated.status, 'completed');
    assert.equal(updated.completed_at !== null, true);
    assert.equal(getLatestScrapingRun(db).id, run.id);
  });

  test('seeds and updates nested settings with LTV/down-payment sync', () => {
    const db = memoryDb();
    const defaults = getSettings(db);
    assert.equal(defaults.leverage.enabled, true);
    assert.equal(defaults.leverage.ltvPct, 80);

    const updated = updateSettings({ leverage: { downPaymentPct: 35 } }, db);
    assert.equal(updated.leverage.downPaymentPct, 35);
    assert.equal(updated.leverage.ltvPct, 65);

    const secondUpdate = updateSettings({ leverage: { ltvPct: 70 } }, db);
    assert.equal(secondUpdate.leverage.downPaymentPct, 30);
    assert.equal(secondUpdate.leverage.ltvPct, 70);
  });

  test('recomputes neighborhood stats from active properties', () => {
    const db = memoryDb();
    upsertProperty({ externalId: 'a', neighborhood: 'Mladost 1', zone: 'Mladost', priceEur: 100000, areaSqm: 80 }, db);
    upsertProperty({ externalId: 'b', neighborhood: 'Mladost 1', zone: 'Mladost', priceEur: 120000, areaSqm: 100 }, db);

    const stats = recomputeNeighborhoodStats(db);
    assert.equal(stats.length, 1);
    assert.equal(stats[0].property_count, 2);
    assert.equal(stats[0].avg_price_eur, 110000);
  });
});

describe('Phase 2 utilities', () => {
  test('converts BGN and EUR at the fixed rate', () => {
    assert.equal(Math.round(bgnToEur(1955.83)), 1000);
    assert.equal(Math.round(eurToBgn(1000) * 100) / 100, 1955.83);
  });

  test('calculates mortgage payment and ratios', () => {
    assert.equal(Math.round(monthlyPayment(68000, 3.5, 25) * 100) / 100, 340.42);
    assert.equal(Math.round(dscr(600, 400) * 100) / 100, 1.5);
  });

  test('finds a break-even rate near zero cash flow', () => {
    const rate = breakEvenRate({
      principal: 68000,
      termYears: 25,
      monthlyNetOperatingIncome: 450
    });
    const payment = monthlyPayment(68000, rate, 25);
    assert.ok(Math.abs(payment - 450) < 0.01);
  });

  test('evaluates negative cash flow as red with flag', () => {
    const result = evaluate(
      {
        monthlyCashFlow: -100,
        cocPct: 2,
        dscr: 0.8,
        breakEvenRate: 4
      },
      {
        leverage: { mortgageRate: 3.5 },
        flags: {
          cocGreenPct: 8,
          cocYellowPct: 4,
          dscrMinimum: 1.25,
          rateStressPct: 1
        }
      }
    );

    assert.equal(result.health, 'red');
    assert.ok(result.flags.includes('NEGATIVE_CASH_FLOW'));
  });
});
