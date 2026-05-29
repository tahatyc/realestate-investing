import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setConvexClientForTests } from '../src/convexClient.js';
import { createDatabase } from '../src/db/connection.js';
import { upsertProperty, queryProperties, getPropertyById, getPropertyByExternalId, markInactive } from '../src/db/properties.js';
import { insertPriceHistory, getPriceHistoryByPropertyId } from '../src/db/priceHistory.js';
import { createScrapingRun, getLatestScrapingRun, updateScrapingRun } from '../src/db/scrapingRuns.js';
import {
  completeScrapingRunScope,
  createScrapingRunScope,
  getCompletedScrapingRunScopes
} from '../src/db/scrapingRunScopes.js';
import { getSettings, updateSettings } from '../src/db/settings.js';
import { recomputeNeighborhoodStats } from '../src/db/neighborhoodStats.js';
import { bgnToEur, eurToBgn } from '../src/utils/currency.js';
import { breakEvenRate, dscr, monthlyPayment } from '../src/utils/mortgage.js';
import { evaluate } from '../src/utils/healthFlags.js';
import { installFakeConvex } from './helpers/fakeConvex.js';

let databases = [];
let tempDirs = [];

function memoryDb() {
  const db = createDatabase(':memory:');
  databases.push(db);
  return db;
}

afterEach(() => {
  setConvexClientForTests(null);
  for (const db of databases) {
    db.close();
  }
  databases = [];
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

describe('Phase 2 data layer', () => {
  test('upserts, queries, reads, and marks properties inactive', async () => {
    installFakeConvex();
    const property = await upsertProperty(
      {
        externalId: 'imot-1',
        title: 'Two room apartment',
        neighborhood: 'Mladost 1',
        zone: 'Mladost',
        type: '2-bedroom',
        condition: 'good',
        priceEur: 100000,
        areaSqm: 80
      }
    );

    assert.equal(property.external_id, 'imot-1');
    assert.equal(Math.round(property.price_per_sqm), 1250);
    assert.equal((await queryProperties({ zone: 'Mladost' })).length, 1);
    assert.equal((await getPropertyById(property.id)).title, 'Two room apartment');
    assert.equal(await markInactive(property.id), true);
    assert.equal((await queryProperties({})).length, 0);
  });

  test('tracks price history', async () => {
    installFakeConvex();
    const property = await upsertProperty({ externalId: 'imot-2', priceEur: 90000 });
    await insertPriceHistory({ propertyId: property.id, priceEur: 90000 });
    await insertPriceHistory({ propertyId: property.id, priceEur: 87500 });

    const history = await getPriceHistoryByPropertyId(property.id);
    assert.equal(history.length, 2);
    assert.equal(history[1].price_eur, 87500);
  });

  test('stores listing purpose and category and filters sale listings by default', async () => {
    installFakeConvex();

    await upsertProperty(
      {
        externalId: 'sale-1',
        listingPurpose: 'sale',
        category: 'dvustaen',
        title: 'Sale apartment',
        priceEur: 100000
      }
    );
    await upsertProperty(
      {
        externalId: 'rent-1',
        listingPurpose: 'rent',
        category: 'dvustaen',
        title: 'Rental apartment',
        priceEur: 600
      }
    );

    assert.equal((await queryProperties({})).length, 1);
    assert.equal((await queryProperties({ listingPurpose: 'sale' })).length, 1);
    assert.equal((await queryProperties({ listingPurpose: 'rent' })).length, 1);
    assert.equal((await queryProperties({ includeAllPurposes: true })).length, 2);
    assert.equal((await getPropertyByExternalId('rent-1')).listing_purpose, 'rent');
    assert.equal((await getPropertyByExternalId('rent-1')).category, 'dvustaen');
  });

  test('handles scraping run lifecycle', async () => {
    installFakeConvex();
    const run = await createScrapingRun({ pagesTotal: 2 });
    const updated = await updateScrapingRun(run.id, {
      status: 'completed',
      pagesScraped: 2,
      listingsFound: 20,
      listingsSaved: 18
    });

    assert.equal(updated.status, 'completed');
    assert.equal(updated.completed_at !== null, true);
    assert.equal((await getLatestScrapingRun()).id, run.id);
  });

  test('records completed scraping run scopes', async () => {
    installFakeConvex();
    const run = await createScrapingRun({ pagesTotal: 5 });
    const scope = await createScrapingRunScope(
      {
        runId: run.id,
        listingPurpose: 'sale',
        category: 'dvustaen',
        pagesPlanned: 5,
        fullScope: false
      }
    );

    assert.equal(scope.completed, 0);

    const completed = await completeScrapingRunScope(
      scope.id,
      {
        pagesScraped: 5,
        completed: true
      }
    );

    assert.equal(completed.pages_scraped, 5);
    assert.equal(completed.completed, 1);
    assert.deepEqual(
      (await getCompletedScrapingRunScopes(run.id)).map((row) => ({
        purpose: row.listing_purpose,
        category: row.category,
        pages: row.pages_scraped
      })),
      [{ purpose: 'sale', category: 'dvustaen', pages: 5 }]
    );
  });

  test('seeds and updates nested settings with LTV/down-payment sync', async () => {
    installFakeConvex();
    const defaults = await getSettings();
    assert.equal(defaults.leverage.enabled, true);
    assert.equal(defaults.leverage.ltvPct, 80);
    assert.equal(defaults.general.rehabCostPerSqm, 300);
    assert.equal(defaults.general.transactionCostPct, 3);

    const updated = await updateSettings({ general: { rehabCostPerSqm: 425, transactionCostPct: 2.5 }, leverage: { downPaymentPct: 35 } });
    assert.equal(updated.general.rehabCostPerSqm, 425);
    assert.equal(updated.general.transactionCostPct, 2.5);
    assert.equal(updated.leverage.downPaymentPct, 35);
    assert.equal(updated.leverage.ltvPct, 65);

    const secondUpdate = await updateSettings({ leverage: { ltvPct: 70 } });
    assert.equal(secondUpdate.leverage.downPaymentPct, 30);
    assert.equal(secondUpdate.leverage.ltvPct, 70);
  });

  test('adds transaction and rehab cost settings to existing databases', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'realestate-settings-'));
    tempDirs.push(tempDir);
    const dbPath = path.join(tempDir, 'legacy.db');
    const legacyDb = new Database(dbPath);
    legacyDb.exec(`
      CREATE TABLE settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        city TEXT NOT NULL DEFAULT 'Sofia',
        currency TEXT NOT NULL DEFAULT 'EUR',
        target_gross_yield_pct REAL NOT NULL DEFAULT 6,
        target_net_yield_pct REAL NOT NULL DEFAULT 4.5,
        acquisition_tax_pct REAL NOT NULL DEFAULT 4,
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

    const columns = migratedDb.prepare('PRAGMA table_info(settings)').all().map((column) => column.name);
    assert.ok(columns.includes('rehab_cost_per_sqm'));
    assert.ok(columns.includes('transaction_cost_pct'));
    const settings = migratedDb.prepare('SELECT rehab_cost_per_sqm, transaction_cost_pct FROM settings WHERE id = 1').get();
    assert.equal(settings.rehab_cost_per_sqm, 300);
    assert.equal(settings.transaction_cost_pct, 4);
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

  test('recomputes neighborhood stats from active properties', async () => {
    installFakeConvex();
    await upsertProperty({ externalId: 'a', neighborhood: 'Mladost 1', zone: 'Mladost', priceEur: 100000, areaSqm: 80 });
    await upsertProperty({ externalId: 'b', neighborhood: 'Mladost 1', zone: 'Mladost', priceEur: 120000, areaSqm: 100 });

    const stats = await recomputeNeighborhoodStats();
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
