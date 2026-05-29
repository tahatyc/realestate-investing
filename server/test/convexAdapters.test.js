import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { setConvexClientForTests } from '../src/convexClient.js';
import {
  getPropertyByExternalId,
  getPropertyById,
  markInactive,
  markInactiveByScope,
  queryProperties,
  upsertProperty
} from '../src/db/properties.js';
import {
  getPriceHistoryByPropertyId,
  insertPriceHistory
} from '../src/db/priceHistory.js';
import {
  createScrapingRun,
  getLatestScrapingRun,
  listScrapingRuns,
  updateScrapingRun
} from '../src/db/scrapingRuns.js';
import {
  completeScrapingRunScope,
  createScrapingRunScope,
  getCompletedScrapingRunScopes
} from '../src/db/scrapingRunScopes.js';
import { getSettings, updateSettings } from '../src/db/settings.js';
import {
  defaultTriage,
  getTriageByPropertyId,
  getTriageMap,
  upsertTriage,
  validateTriageStatus
} from '../src/db/dealTriage.js';
import {
  getNeighborhoodStats,
  recomputeNeighborhoodStats
} from '../src/db/neighborhoodStats.js';

function createFakeClient(responses = []) {
  const calls = [];
  const next = (type, fn, args) => {
    calls.push({ type, fn, args });
    if (!responses.length) {
      throw new Error(`No fake Convex response queued for ${type}`);
    }
    return responses.shift();
  };

  return {
    calls,
    query: async (fn, args) => next('query', fn, args),
    mutation: async (fn, args) => next('mutation', fn, args)
  };
}

afterEach(() => {
  setConvexClientForTests(null);
});

describe('property Convex adapter', () => {
  test('upserts, queries, reads, and marks inactive through Convex functions', async () => {
    const propertyDoc = {
      _id: 'property-1',
      externalId: 'ext-1',
      source: 'imot.bg',
      listingPurpose: 'sale',
      category: 'dvustaen',
      neighborhood: 'Lozenets',
      zone: 'South',
      priceEur: 120000,
      priceBgn: null,
      areaSqm: 80,
      pricePerSqm: 1500,
      isActive: true,
      updatedAt: '2026-05-29T10:00:00.000Z'
    };
    const fakeClient = createFakeClient([
      propertyDoc,
      [propertyDoc],
      propertyDoc,
      propertyDoc,
      true,
      3
    ]);
    setConvexClientForTests(fakeClient);

    const upserted = await upsertProperty({
      externalId: 'ext-1',
      listingPurpose: 'sale',
      priceEur: 120000,
      areaSqm: 80
    });
    const queried = await queryProperties({
      listingPurpose: 'rent',
      neighborhood: 'Lozenets',
      limit: 999,
      offset: '2'
    });
    const byId = await getPropertyById('property-1');
    const byExternalId = await getPropertyByExternalId('ext-1');
    const inactive = await markInactive('property-1');
    const inactiveByScope = await markInactiveByScope({
      listingPurpose: 'sale',
      category: 'dvustaen',
      seenExternalIds: ['ext-1']
    });

    assert.equal(upserted.external_id, 'ext-1');
    assert.equal(upserted.price_per_sqm, 1500);
    assert.equal(queried[0].neighborhood, 'Lozenets');
    assert.equal(byId.id, 'property-1');
    assert.equal(byExternalId.id, 'property-1');
    assert.equal(inactive, true);
    assert.equal(inactiveByScope, 3);
    assert.deepEqual(
      fakeClient.calls.map((call) => call.type),
      ['mutation', 'query', 'query', 'query', 'mutation', 'mutation']
    );
    assert.ok(fakeClient.calls.every((call) => call.fn && typeof call.fn === 'object'));
    assert.deepEqual(fakeClient.calls[0].args, {
      externalId: 'ext-1',
      source: 'imot.bg',
      listingPurpose: 'sale',
      priceEur: 120000,
      areaSqm: 80,
      pricePerSqm: 1500
    });
    assert.deepEqual(fakeClient.calls[1].args, {
      includeInactive: undefined,
      includeAllPurposes: undefined,
      listingPurpose: 'rent',
      category: undefined,
      neighborhood: 'Lozenets',
      zone: undefined,
      type: undefined,
      condition: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      minArea: undefined,
      maxArea: undefined,
      limit: 250,
      offset: 2
    });
  });
});

describe('supporting Convex adapters', () => {
  test('maps price history, scraping run, scope, and stat documents to rows', async () => {
    const priceDoc = {
      _id: 'price-1',
      propertyId: 'property-1',
      priceEur: 100000,
      priceBgn: null,
      recordedAt: '2026-05-28T10:00:00.000Z'
    };
    const runDoc = {
      _id: 'run-1',
      status: 'completed',
      startedAt: '2026-05-28T09:00:00.000Z',
      completedAt: '2026-05-28T10:00:00.000Z',
      pagesTotal: 4,
      pagesScraped: 4,
      salePagesScraped: 3,
      rentalPagesScraped: 1,
      currentPurpose: null,
      currentCategory: null,
      crawlMode: 'bounded',
      listingsFound: 20,
      listingsSaved: 18,
      errorMessage: null
    };
    const scopeDoc = {
      _id: 'scope-1',
      runId: 'run-1',
      listingPurpose: 'sale',
      category: 'dvustaen',
      pagesPlanned: 2,
      pagesScraped: 2,
      fullScope: true,
      completed: true
    };
    const statDoc = {
      _id: 'stat-1',
      neighborhood: 'Lozenets',
      zone: 'South',
      propertyCount: 5,
      avgPriceEur: 110000,
      avgPricePerSqm: 1600,
      minPriceEur: 90000,
      maxPriceEur: 130000,
      avgAreaSqm: 75,
      updatedAt: '2026-05-29T10:00:00.000Z'
    };
    const fakeClient = createFakeClient([
      priceDoc,
      [priceDoc],
      runDoc,
      runDoc,
      runDoc,
      [runDoc],
      scopeDoc,
      scopeDoc,
      [scopeDoc],
      [statDoc],
      [statDoc]
    ]);
    setConvexClientForTests(fakeClient);

    assert.equal((await insertPriceHistory({ propertyId: 'property-1', priceEur: 100000 })).property_id, 'property-1');
    assert.equal((await getPriceHistoryByPropertyId('property-1'))[0].price_eur, 100000);
    assert.equal((await createScrapingRun({ pagesTotal: 4 })).pages_total, 4);
    assert.equal((await updateScrapingRun('run-1', { status: 'completed' })).completed_at, '2026-05-28T10:00:00.000Z');
    assert.equal((await getLatestScrapingRun()).id, 'run-1');
    assert.equal((await listScrapingRuns()).length, 1);
    assert.equal((await createScrapingRunScope({ runId: 'run-1', listingPurpose: 'sale', category: 'dvustaen', pagesPlanned: 2 })).full_scope, 1);
    assert.equal((await completeScrapingRunScope('scope-1', { pagesScraped: 2 })).completed, 1);
    assert.equal((await getCompletedScrapingRunScopes('run-1'))[0].run_id, 'run-1');
    assert.equal((await recomputeNeighborhoodStats())[0].property_count, 5);
    assert.equal((await getNeighborhoodStats())[0].avg_price_per_sqm, 1600);

    assert.deepEqual(
      fakeClient.calls.map((call) => call.type),
      [
        'mutation',
        'query',
        'mutation',
        'mutation',
        'query',
        'query',
        'mutation',
        'mutation',
        'query',
        'mutation',
        'query'
      ]
    );
    assert.ok(fakeClient.calls.every((call) => call.fn && typeof call.fn === 'object'));
    assert.deepEqual(fakeClient.calls[5].args, { limit: 25 });
  });

  test('passes settings and deal triage through Convex with response mapping', async () => {
    const settings = {
      general: { city: 'Sofia', currency: 'EUR' },
      airbnb: { occupancyPct: 65 },
      leverage: { enabled: true, downPaymentPct: 20, ltvPct: 80 },
      flags: { dscrMinimum: 1.25 },
      updatedAt: '2026-05-29T10:00:00.000Z'
    };
    const triageDoc = {
      propertyId: 'property-1',
      status: 'watching',
      note: undefined,
      rejectedReason: null,
      updatedAt: '2026-05-29T10:00:00.000Z'
    };
    const fakeClient = createFakeClient([
      settings,
      settings,
      triageDoc,
      [triageDoc],
      triageDoc
    ]);
    setConvexClientForTests(fakeClient);

    assert.equal(validateTriageStatus(undefined), 'new');
    assert.throws(() => validateTriageStatus('bad'), /Invalid triage status: bad/);
    assert.deepEqual(defaultTriage('property-1'), {
      propertyId: 'property-1',
      status: 'new',
      note: '',
      rejectedReason: '',
      updatedAt: null
    });
    assert.equal((await getSettings()).general.city, 'Sofia');
    assert.equal((await updateSettings({ leverage: { downPaymentPct: 25 } })).leverage.ltvPct, 80);
    assert.deepEqual(await getTriageByPropertyId('property-1'), {
      propertyId: 'property-1',
      status: 'watching',
      note: '',
      rejectedReason: '',
      updatedAt: '2026-05-29T10:00:00.000Z'
    });
    assert.equal((await getTriageMap(['property-1'])).get('property-1').status, 'watching');
    assert.equal((await upsertTriage('property-1', { status: 'watching', rejected_reason: 'price' })).status, 'watching');

    assert.deepEqual(
      fakeClient.calls.map((call) => call.type),
      ['query', 'mutation', 'query', 'query', 'mutation']
    );
    assert.ok(fakeClient.calls.every((call) => call.fn && typeof call.fn === 'object'));
    assert.deepEqual(fakeClient.calls[4].args, {
      propertyId: 'property-1',
      status: 'watching',
      note: '',
      rejectedReason: 'price'
    });
  });
});
