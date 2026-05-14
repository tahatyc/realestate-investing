import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { createDatabase } from '../src/db/connection.js';
import { upsertProperty } from '../src/db/properties.js';
import { updateSettings } from '../src/db/settings.js';
import { createApp } from '../src/index.js';
import { analyzeProperty, analyzeStrategy, strategyNames } from '../src/strategies/index.js';
import { isBuyInGreenEligible } from '../src/strategies/buyInGreenEligibility.js';

let databases = [];

function memoryDb() {
  const db = createDatabase(':memory:');
  databases.push(db);
  return db;
}

function seedStrategyData(db) {
  const target = upsertProperty(
    {
      externalId: 'deal-1',
      title: 'Two room apartment',
      neighborhood: 'Младост 1',
      zone: 'Младост',
      type: '2-bedroom',
      condition: 'needs_rehab',
      constructionStage: null,
      constructionYear: null,
      priceEur: 100000,
      areaSqm: 80,
      description: 'Апартамент на зелено в проект преди акт 14'
    },
    db
  );
  upsertProperty(
    {
      externalId: 'comp-1',
      neighborhood: 'Младост 1',
      zone: 'Младост',
      type: '2-bedroom',
      condition: 'fully_renovated',
      priceEur: 132000,
      areaSqm: 80
    },
    db
  );
  upsertProperty(
    {
      externalId: 'deal-2',
      neighborhood: 'Люлин 7',
      zone: 'Люлин',
      type: '2-bedroom',
      condition: 'good',
      priceEur: 80000,
      areaSqm: 70
    },
    db
  );
  return target;
}

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

afterEach(() => {
  for (const db of databases) {
    db.close();
  }
  databases = [];
});

describe('Phase 4 strategy engine', () => {
  test('buy-in-green eligibility requires explicit pre-Act 14 signals', () => {
    assert.equal(
      isBuyInGreenEligible({
        title: 'Двустаен апартамент на зелено',
        description: 'Продажба преди акт 14',
        constructionStage: null
      }),
      true
    );
    assert.equal(
      isBuyInGreenEligible({
        title: 'Апартамент в проект',
        description: 'Предстоящ строеж',
        construction_stage: null
      }),
      true
    );

    for (const constructionStage of ['act14', 'act15', 'act16', 'finished']) {
      assert.equal(
        isBuyInGreenEligible({
          title: 'Апартамент на зелено',
          description: 'Промоционална цена',
          constructionStage
        }),
        false,
        `${constructionStage} should be excluded`
      );
    }

    assert.equal(
      isBuyInGreenEligible({
        title: 'Ново строителство с акт 16',
        description: 'Готов за нанасяне'
      }),
      false
    );
    assert.equal(
      isBuyInGreenEligible({
        title: 'Двустаен апартамент',
        description: 'Ново строителство'
      }),
      false
    );
  });

  test('registers all strategy names and returns the required result contract', () => {
    const db = memoryDb();
    const property = seedStrategyData(db);

    assert.deepEqual(strategyNames().sort(), [
      'airbnb',
      'below-market',
      'brrrr',
      'buy-in-green',
      'cash-flow',
      'flip'
    ]);

    const results = analyzeProperty(property, { database: db });
    assert.equal(Object.keys(results).length, 6);
    for (const result of Object.values(results)) {
      assert.ok(result.cashMetrics);
      assert.ok(result.leveragedMetrics);
      assert.equal(typeof result.score, 'number');
      assert.match(result.health, /green|yellow|red/);
      assert.ok(Array.isArray(result.flags));
      assert.ok(Array.isArray(result.rateSensitivity));
      assert.equal(typeof result.breakEvenRate, 'number');
    }
  });

  test('cash-flow strategy calculates leveraged mortgage math and breakeven rate', () => {
    const db = memoryDb();
    seedStrategyData(db);
    updateSettings(
      {
        general: { targetGrossYieldPct: 6, vacancyPct: 5, managementFeePct: 8 },
        leverage: { mortgageRate: 3.5, loanTermYears: 25, downPaymentPct: 20, annualInsuranceEur: 250 }
      },
      db
    );

    const { results } = analyzeStrategy('cash-flow', { database: db, limit: 10 });
    const deal = results.find((result) => result.property.externalId === 'deal-1');

    assert.ok(deal);
    assert.equal(Math.round(deal.leveragedMetrics.loanAmount), 80000);
    assert.equal(Math.round(deal.leveragedMetrics.downPayment), 20000);
    assert.equal(Math.round(deal.cashMetrics.monthlyRent), 500);
    assert.ok(Math.abs(deal.leveragedMetrics.monthlyCashFlow - 13.7) < 0.5);
    assert.ok(Math.abs(deal.rateSensitivity[0].monthlyCashFlow - deal.leveragedMetrics.monthlyCashFlow) < 0.01);
    assert.ok(Math.abs(deal.breakEvenRate - 4) < 0.5);
  });

  test('buy-in-green excludes late-stage and ambiguous listings from strategy results', () => {
    const db = memoryDb();
    const eligible = seedStrategyData(db);
    const act14 = upsertProperty(
      {
        externalId: 'act14',
        title: 'Апартамент на зелено',
        zone: 'Младост',
        constructionStage: 'act14',
        priceEur: 90000,
        areaSqm: 70,
        description: 'Акт 14'
      },
      db
    );
    upsertProperty(
      {
        externalId: 'ambiguous',
        title: 'Ново строителство',
        zone: 'Младост',
        priceEur: 91000,
        areaSqm: 70,
        description: 'Без етап'
      },
      db
    );

    const propertyResults = analyzeProperty(act14, { database: db });
    assert.equal(propertyResults['buy-in-green'].applicable, false);
    assert.equal(propertyResults['buy-in-green'].health, null);
    assert.equal(propertyResults['buy-in-green'].score, null);

    const { results } = analyzeStrategy('buy-in-green', { database: db, limit: 10 });
    assert.deepEqual(
      results.map((result) => result.property.externalId),
      [eligible.external_id]
    );
    assert.equal(results[0].cashMetrics.holdMonths, 24);
  });

  test('rehab strategies use configured rehab cost per sqm', () => {
    const db = memoryDb();
    const property = seedStrategyData(db);
    updateSettings({ general: { rehabCostPerSqm: 450 } }, db);

    const results = analyzeProperty(property, { database: db });

    assert.equal(results.brrrr.cashMetrics.rehabCost, 36000);
    assert.equal(results.flip.cashMetrics.rehabCost, 36000);
  });

  test('all strategies include configured transaction costs', () => {
    const db = memoryDb();
    const property = seedStrategyData(db);
    updateSettings({ general: { transactionCostPct: 4 } }, db);

    const results = analyzeProperty(property, { database: db });

    for (const [strategy, result] of Object.entries(results)) {
      assert.equal(result.cashMetrics.transactionCosts, 4000, `${strategy} should include transaction costs`);
      assert.equal(result.cashMetrics.acquisitionCosts, undefined, `${strategy} should not expose duplicate acquisition costs`);
    }

    assert.equal(results['cash-flow'].cashMetrics.totalInvestment, 104000);
    assert.ok(Math.abs(results['cash-flow'].cashMetrics.netYieldPct - 5.019) < 0.01);
    assert.equal(results.brrrr.cashMetrics.totalInvestment, 128000);
    assert.equal(results.flip.cashMetrics.totalInvestment, 128000);
    assert.equal(results['buy-in-green'].cashMetrics.potentialProfit, 28000);
    assert.equal(results['below-market'].cashMetrics.discountAmount, 28000);
    assert.equal(results['cash-flow'].leveragedMetrics.cashInvested, 24000);
    assert.equal(results.airbnb.leveragedMetrics.cashInvested, 24000);
    assert.equal(results.brrrr.leveragedMetrics.transactionCosts, 4000);
    assert.equal(results.flip.leveragedMetrics.transactionCosts, 4000);
    assert.equal(results.flip.leveragedMetrics.acquisitionCosts, undefined);
  });

  test('turning leverage off returns null leveraged metrics and cash-only scores', () => {
    const db = memoryDb();
    seedStrategyData(db);
    updateSettings({ leverage: { enabled: false } }, db);

    const { results, summary } = analyzeStrategy('cash-flow', { database: db });
    assert.equal(summary.leverageEnabled, false);
    assert.equal(results[0].leveragedMetrics, null);
    assert.equal(results[0].health, null);
    assert.equal(results[0].score, results[0].cashMetrics.netYieldPct);
  });

  test('strategy routes, property detail, neighborhoods, settings, and overview return JSON contracts', async () => {
    const db = memoryDb();
    const property = seedStrategyData(db);
    const app = createApp({ database: db });

    await withServer(app, async (baseUrl) => {
      const strategy = await fetch(`${baseUrl}/api/strategies/cash-flow?limit=10&health=yellow`);
      assert.equal(strategy.status, 200);
      const strategyJson = await strategy.json();
      assert.equal(strategyJson.strategy, 'cash-flow');
      assert.equal(strategyJson.summary.leverageEnabled, true);
      assert.ok(strategyJson.summary.healthBreakdown.yellow >= 0);
      assert.ok(strategyJson.properties.every((item) => item.health === 'yellow'));

      const detail = await fetch(`${baseUrl}/api/properties/${property.id}`);
      assert.equal(detail.status, 200);
      const detailJson = await detail.json();
      assert.equal(detailJson.property.id, property.id);
      assert.ok(detailJson.leverageSettings.enabled);
      assert.ok(detailJson.strategies['cash-flow'].cashMetrics);

      const neighborhoods = await fetch(`${baseUrl}/api/neighborhoods`);
      assert.equal(neighborhoods.status, 200);
      assert.ok(Array.isArray((await neighborhoods.json()).neighborhoods));

      const settingsUpdate = await fetch(`${baseUrl}/api/settings`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ leverage: { ltvPct: 65 } })
      });
      assert.equal(settingsUpdate.status, 200);
      const settingsJson = await settingsUpdate.json();
      assert.equal(settingsJson.settings.leverage.downPaymentPct, 35);

      const overview = await fetch(`${baseUrl}/api/overview`);
      assert.equal(overview.status, 200);
      const overviewJson = await overview.json();
      assert.ok(overviewJson.leverage);
      assert.ok(overviewJson.strategies['cash-flow'].healthBreakdown);
    });
  });
});
