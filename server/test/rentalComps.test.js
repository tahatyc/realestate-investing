import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { setConvexClientForTests } from '../src/convexClient.js';
import { upsertProperty } from '../src/db/properties.js';
import { analyzeStrategy } from '../src/strategies/index.js';
import { estimateMonthlyRentFromComps } from '../src/strategies/rentalComps.js';
import { installFakeConvex } from './helpers/fakeConvex.js';

const settings = {
  general: {
    targetGrossYieldPct: 6,
    transactionCostPct: 3,
    vacancyPct: 5,
    managementFeePct: 8
  },
  leverage: {
    enabled: true,
    ltvPct: 80,
    downPaymentPct: 20,
    mortgageRate: 3.5,
    loanTermYears: 25,
    originationFeePct: 1,
    annualInsuranceEur: 250
  },
  flags: {
    cocGreenPct: 8,
    cocYellowPct: 4,
    dscrMinimum: 1.25,
    rateStressPct: 1
  },
  airbnb: {
    dailyRateEur: 65,
    occupancyPct: 65,
    operatingExpensePct: 30
  }
};

afterEach(() => {
  setConvexClientForTests(null);
});

describe('rental comp estimator', () => {
  test('uses neighborhood rent per sqm comps when sample is credible', async () => {
    installFakeConvex();
    const sale = await upsertProperty({
      externalId: 'sale-1',
      listingPurpose: 'sale',
      category: 'dvustaen',
      neighborhood: 'Mladost 1',
      zone: 'Mladost',
      type: '2-bedroom',
      rooms: 2,
      priceEur: 100000,
      areaSqm: 70
    });

    for (const [id, rent, area] of [
      ['rent-1', 600, 60],
      ['rent-2', 700, 70],
      ['rent-3', 800, 80]
    ]) {
      await upsertProperty({
        externalId: id,
        listingPurpose: 'rent',
        category: 'dvustaen',
        neighborhood: 'Mladost 1',
        zone: 'Mladost',
        type: '2-bedroom',
        rooms: 2,
        priceEur: rent,
        areaSqm: area
      });
    }

    assert.deepEqual(await estimateMonthlyRentFromComps(sale, { settings }), {
      monthlyRent: 700,
      source: 'neighborhood_comps',
      sampleSize: 3,
      fallback: false
    });
  });

  test('falls back to zone comps when neighborhood sample is sparse', async () => {
    installFakeConvex();
    const sale = await upsertProperty({
      externalId: 'sale-2',
      listingPurpose: 'sale',
      neighborhood: 'Mladost 2',
      zone: 'Mladost',
      type: '2-bedroom',
      rooms: 2,
      priceEur: 120000,
      areaSqm: 60
    });

    for (const [id, neighborhood, rent] of [
      ['rent-zone-1', 'Mladost 1', 550],
      ['rent-zone-2', 'Mladost 3', 650],
      ['rent-zone-3', 'Mladost 4', 750]
    ]) {
      await upsertProperty({
        externalId: id,
        listingPurpose: 'rent',
        category: 'dvustaen',
        neighborhood,
        zone: 'Mladost',
        type: '2-bedroom',
        rooms: 2,
        priceEur: rent,
        areaSqm: 60
      });
    }

    assert.deepEqual(await estimateMonthlyRentFromComps(sale, { settings }), {
      monthlyRent: 650,
      source: 'zone_comps',
      sampleSize: 3,
      fallback: false
    });
  });

  test('falls back to target yield when comps are sparse', async () => {
    installFakeConvex();
    const sale = await upsertProperty({
      externalId: 'sale-3',
      listingPurpose: 'sale',
      neighborhood: 'Boyana',
      zone: 'Boyana',
      type: 'house',
      priceEur: 200000,
      areaSqm: 120
    });

    assert.deepEqual(await estimateMonthlyRentFromComps(sale, { settings }), {
      monthlyRent: 1000,
      source: 'target_yield_fallback',
      sampleSize: 0,
      fallback: true
    });
  });

  test('cash flow and airbnb strategies use rental comp metadata', async () => {
    installFakeConvex();
    await upsertProperty({
      externalId: 'sale-strategy',
      listingPurpose: 'sale',
      category: 'dvustaen',
      neighborhood: 'Mladost 1',
      zone: 'Mladost',
      type: '2-bedroom',
      rooms: 2,
      priceEur: 100000,
      areaSqm: 70
    });
    await upsertProperty({
      externalId: 'rent-hidden',
      listingPurpose: 'rent',
      category: 'dvustaen',
      neighborhood: 'Mladost 1',
      zone: 'Mladost',
      type: '2-bedroom',
      rooms: 2,
      priceEur: 700,
      areaSqm: 70
    });
    await upsertProperty({
      externalId: 'rent-hidden-2',
      listingPurpose: 'rent',
      category: 'dvustaen',
      neighborhood: 'Mladost 1',
      zone: 'Mladost',
      type: '2-bedroom',
      rooms: 2,
      priceEur: 800,
      areaSqm: 80
    });
    await upsertProperty({
      externalId: 'rent-hidden-3',
      listingPurpose: 'rent',
      category: 'dvustaen',
      neighborhood: 'Mladost 1',
      zone: 'Mladost',
      type: '2-bedroom',
      rooms: 2,
      priceEur: 600,
      areaSqm: 60
    });

    const cashFlow = await analyzeStrategy('cash-flow', { settings, limit: 10 });
    const airbnb = await analyzeStrategy('airbnb', { settings, limit: 10 });

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
});
