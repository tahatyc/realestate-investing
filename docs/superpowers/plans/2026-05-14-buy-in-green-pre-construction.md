# Buy in Green Pre-Construction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `buy-in-green` show only explicit pre-Act 14 listings and exclude Act 14, Act 15, Act 16, finished, and ambiguous listings.

**Architecture:** Add a focused server-side eligibility detector used by the Buy in Green analyzer before financial calculations. Keep the route and strategy id stable, use the existing `applicable: false` strategy result pattern, and add a small client helper so property detail renders non-applicable strategy results clearly. Update metrics-guide copy to describe the strategy as pre-construction before Act 14.

**Tech Stack:** Node.js ESM, Express, better-sqlite3, React, React Query, Node test runner.

---

## File Structure

- Create: `server/src/strategies/buyInGreenEligibility.js`
  - Owns Buy in Green text/stage eligibility detection.
- Modify: `server/src/strategies/buyInGreen.js`
  - Calls the detector before calculations and uses a 24-month pre-Act 14 hold period.
- Modify: `server/src/strategies/index.js`
  - Keeps `applicable: false` results undecorated by health scoring.
- Modify: `server/test/phase4.test.js`
  - Adds direct eligibility boundary tests and API filtering coverage.
- Create: `client/src/pages/propertyDetailHelpers.js`
  - Owns display text for non-applicable strategy results.
- Create: `client/src/pages/propertyDetailHelpers.test.js`
  - Covers the helper.
- Modify: `client/src/pages/PropertyDetail.jsx`
  - Renders an explicit not-applicable state instead of empty metric lists.
- Modify: `client/src/lib/metricsGuide.js`
  - Updates Buy in Green copy and caveats.
- Modify: `client/src/lib/metricsGuide.test.js`
  - Locks the new pre-construction wording.

---

### Task 1: Server Eligibility Detector

**Files:**
- Create: `server/src/strategies/buyInGreenEligibility.js`
- Modify: `server/test/phase4.test.js`

- [ ] **Step 1: Write failing detector tests**

Add this import to `server/test/phase4.test.js`:

```js
import { isBuyInGreenEligible } from '../src/strategies/buyInGreenEligibility.js';
```

Add this test inside `describe('Phase 4 strategy engine', () => { ... })`:

```js
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
```

- [ ] **Step 2: Run the focused server test and verify RED**

Run:

```powershell
npm.cmd test -- --run server/test/phase4.test.js
```

Expected: failure because `server/src/strategies/buyInGreenEligibility.js` does not exist.

- [ ] **Step 3: Implement the detector**

Create `server/src/strategies/buyInGreenEligibility.js`:

```js
const excludedStages = new Set(['act14', 'act15', 'act16', 'finished']);

const preAct14Patterns = [
  /на\s+зелено/i,
  /в\s+проект/i,
  /преди\s+акт\s*14/i,
  /стартиращ\s+строеж/i,
  /предстоящ\s+строеж/i,
  /предстартови\s+цени/i,
  /ранен\s+етап\s+на\s+строителство/i
];

const exclusionPatterns = [
  /акт\s*14/i,
  /акт\s*15/i,
  /акт\s*16/i,
  /готов\s+за\s+нанасяне/i,
  /завършен[ао]?\s+сград[а]?/i,
  /завършено\s+строителство/i,
  /въведен[ао]?\s+в\s+експлоатация/i
];

function propertyText(property) {
  return [property.title, property.description, property.condition].filter(Boolean).join(' ');
}

export function isBuyInGreenEligible(property = {}) {
  const stage = property.construction_stage ?? property.constructionStage;
  if (stage && excludedStages.has(String(stage).toLowerCase())) {
    return false;
  }

  const text = propertyText(property);
  if (exclusionPatterns.some((pattern) => pattern.test(text))) {
    return false;
  }

  return preAct14Patterns.some((pattern) => pattern.test(text));
}
```

- [ ] **Step 4: Run the focused server test and verify GREEN for the detector**

Run:

```powershell
npm.cmd test -- --run server/test/phase4.test.js
```

Expected: detector import and boundary test pass. Other phase4 expectations may still fail until later tasks update the strategy behavior.

---

### Task 2: Strategy Applicability and Scoring

**Files:**
- Modify: `server/src/strategies/buyInGreen.js`
- Modify: `server/src/strategies/index.js`
- Modify: `server/test/phase4.test.js`

- [ ] **Step 1: Write failing strategy behavior tests**

In `seedStrategyData(db)`, change the `target` property to be eligible:

```js
constructionStage: null,
constructionYear: null,
description: 'Апартамент на зелено в проект преди акт 14'
```

Add this test inside the phase4 describe block:

```js
test('buy-in-green excludes late-stage and ambiguous listings from strategy results', async () => {
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
```

- [ ] **Step 2: Run the focused server test and verify RED**

Run:

```powershell
npm.cmd test -- --run server/test/phase4.test.js
```

Expected: failure because Buy in Green does not yet call the detector and still uses 6/8/18-month stage logic.

- [ ] **Step 3: Implement Buy in Green applicability**

Modify `server/src/strategies/buyInGreen.js`:

```js
import { baseResult, averagePricePerSqm, financingCarryCost, propertyArea, propertyPrice, transactionCosts } from './shared.js';
import { downPayment, loanAmount, originationFee } from '../utils/mortgage.js';
import { isBuyInGreenEligible } from './buyInGreenEligibility.js';

const PRE_ACT14_HOLD_MONTHS = 24;

export function analyze(property, { database, settings }) {
  if (!isBuyInGreenEligible(property)) {
    return baseResult(
      'buy-in-green',
      property,
      {},
      null,
      null,
      null,
      { applicable: false }
    );
  }

  const price = propertyPrice(property);
  const area = propertyArea(property);
  const transaction = transactionCosts(property, settings);
  const totalInvestment = price + transaction;
  const averageFinished = Math.max(averagePricePerSqm(property, database), Number(property.price_per_sqm || 0) * 1.15);
  const futureValue = averageFinished * area;
  const potentialProfit = futureValue - totalInvestment;
  const appreciationPct = totalInvestment > 0 ? (potentialProfit / totalInvestment) * 100 : 0;
  const holdMonths = PRE_ACT14_HOLD_MONTHS;
  const principal = loanAmount(price, settings.leverage.ltvPct);
  const cashDown = downPayment(price, settings.leverage.downPaymentPct);
  const cashInvested = cashDown + transaction;
  const interestCost = financingCarryCost(principal, settings, holdMonths);
  const fee = originationFee(principal, settings.leverage.originationFeePct);
  const leveragedProfit = potentialProfit - interestCost - fee;
  const leveragedRoiPct = cashInvested > 0 ? (leveragedProfit / cashInvested) * 100 : null;

  return baseResult(
    'buy-in-green',
    property,
    {
      purchasePrice: price,
      transactionCosts: transaction,
      totalInvestment,
      averageFinishedPricePerSqm: averageFinished,
      futureValue,
      potentialProfit,
      appreciationPct,
      holdMonths
    },
    {
      loanAmount: principal,
      downPayment: cashDown,
      transactionCosts: transaction,
      cashInvested,
      interestCost,
      originationFee: fee,
      leveragedProfit,
      leveragedRoiPct,
      monthlyCashFlow: leveragedProfit / Math.max(holdMonths, 1),
      cocPct: leveragedRoiPct,
      dscr: 2,
      breakEvenRate: settings.leverage.mortgageRate + 2,
      rateSensitivity: []
    },
    potentialProfit,
    leveragedRoiPct
  );
}
```

Modify `decorateResult` in `server/src/strategies/index.js` so non-applicable results do not get health/scoring decoration:

```js
function decorateResult(result, settings) {
  if (result.applicable === false) {
    return {
      ...result,
      leveragedMetrics: null,
      health: null,
      flags: [],
      rateSensitivity: [],
      breakEvenRate: null,
      score: null
    };
  }

  if (!settings.leverage.enabled) {
    return {
      ...result,
      leveragedMetrics: null,
      health: null,
      flags: [],
      rateSensitivity: [],
      breakEvenRate: null,
      score: result.cashScore
    };
  }

  const healthResult = evaluate(result.leveragedMetrics, settings);
  const flags = [...new Set([...(result.flags ?? []), ...healthResult.flags])];

  return {
    ...result,
    health: healthResult.health,
    flags,
    rateSensitivity: result.leveragedMetrics?.rateSensitivity ?? [],
    breakEvenRate: result.leveragedMetrics?.breakEvenRate ?? null,
    score: result.leveragedScore ?? result.cashScore
  };
}
```

- [ ] **Step 4: Run server tests and verify GREEN**

Run:

```powershell
npm.cmd test -- --run server/test/phase4.test.js
```

Expected: all phase4 tests pass.

---

### Task 3: Property Detail Not-Applicable Rendering

**Files:**
- Create: `client/src/pages/propertyDetailHelpers.js`
- Create: `client/src/pages/propertyDetailHelpers.test.js`
- Modify: `client/src/pages/PropertyDetail.jsx`

- [ ] **Step 1: Write failing helper tests**

Create `client/src/pages/propertyDetailHelpers.test.js`:

```js
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { isStrategyApplicable, strategyNotApplicableMessage } from './propertyDetailHelpers.js';

describe('property detail helpers', () => {
  test('detects non-applicable strategy results', () => {
    assert.equal(isStrategyApplicable({ applicable: false }), false);
    assert.equal(isStrategyApplicable({ cashMetrics: {} }), true);
    assert.equal(isStrategyApplicable(null), true);
  });

  test('describes buy-in-green non-applicability', () => {
    assert.equal(
      strategyNotApplicableMessage('buy-in-green'),
      'Not applicable: this listing is not explicitly pre-construction before Act 14.'
    );
    assert.equal(
      strategyNotApplicableMessage('cash-flow'),
      'Not applicable for this listing.'
    );
  });
});
```

- [ ] **Step 2: Run the focused client test and verify RED**

Run:

```powershell
npm.cmd test -- --run client/src/pages/propertyDetailHelpers.test.js
```

Expected: failure because `propertyDetailHelpers.js` does not exist.

- [ ] **Step 3: Implement helper and integrate it**

Create `client/src/pages/propertyDetailHelpers.js`:

```js
export function isStrategyApplicable(result) {
  return result?.applicable !== false;
}

export function strategyNotApplicableMessage(strategyId) {
  if (strategyId === 'buy-in-green') {
    return 'Not applicable: this listing is not explicitly pre-construction before Act 14.';
  }
  return 'Not applicable for this listing.';
}
```

Modify `client/src/pages/PropertyDetail.jsx`:

```js
import { isStrategyApplicable, strategyNotApplicableMessage } from './propertyDetailHelpers.js';
```

Inside the strategy card body, after the header/flags block and before the metrics grid, render:

```jsx
{isStrategyApplicable(result) ? (
  <>
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <MetricList title="Cash metrics" metrics={result.cashMetrics} />
      <MetricList title="Leveraged metrics" metrics={result.leveragedMetrics} />
    </div>
    <div className="mt-4">
      <RateSensitivity
        rateSensitivity={result.rateSensitivity}
        breakEvenRate={result.breakEvenRate}
        currentRate={query.data.leverageSettings?.mortgageRate}
      />
    </div>
  </>
) : (
  <div className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-500">
    {strategyNotApplicableMessage(id)}
  </div>
)}
```

This replaces the existing unconditional metrics grid and rate sensitivity block.

- [ ] **Step 4: Run focused client test and build**

Run:

```powershell
npm.cmd test -- --run client/src/pages/propertyDetailHelpers.test.js
npm.cmd run build --workspace client
```

Expected: helper tests pass and client build succeeds.

---

### Task 4: Metrics Guide Copy

**Files:**
- Modify: `client/src/lib/metricsGuide.js`
- Modify: `client/src/lib/metricsGuide.test.js`

- [ ] **Step 1: Write failing metrics guide test**

In `client/src/lib/metricsGuide.test.js`, add these phrases to the list in `documents important code-backed formulas and assumptions`:

```js
'pre-construction before Act 14',
'24 months',
'not generic new construction'
```

- [ ] **Step 2: Run focused client test and verify RED**

Run:

```powershell
npm.cmd test -- --run client/src/lib/metricsGuide.test.js
```

Expected: failure because the guide still says new-build or near-finished and old hold-month assumptions.

- [ ] **Step 3: Update Buy in Green guide copy**

In `client/src/lib/metricsGuide.js`, update the Buy in Green summary:

```js
summary:
  'Finds explicit pre-construction before Act 14 listings where the expected finished value is higher than the current asking price. It is not generic new construction and excludes Act 14, Act 15, Act 16, finished, and ambiguous listings.',
```

Update the first caveat:

```js
'Eligible Buy in Green listings use a 24 months hold period because Act 14 and Act 15 listings are excluded.',
```

Keep the other caveats unless implementation shows they are obsolete.

- [ ] **Step 4: Run focused client test and verify GREEN**

Run:

```powershell
npm.cmd test -- --run client/src/lib/metricsGuide.test.js
```

Expected: metrics guide tests pass.

---

### Task 5: Final Verification and Commit

**Files:**
- Verify all modified files.
- Commit all implementation changes.

- [ ] **Step 1: Run full test suite**

Run:

```powershell
npm.cmd test
```

Expected: server and client test suites pass.

- [ ] **Step 2: Run client build**

Run:

```powershell
npm.cmd run build
```

Expected: Vite production build succeeds.

- [ ] **Step 3: Review git diff**

Run:

```powershell
git -c core.excludesfile= diff --stat
git -c core.excludesfile= diff -- server/src/strategies/buyInGreenEligibility.js server/src/strategies/buyInGreen.js server/src/strategies/index.js server/test/phase4.test.js client/src/pages/propertyDetailHelpers.js client/src/pages/propertyDetailHelpers.test.js client/src/pages/PropertyDetail.jsx client/src/lib/metricsGuide.js client/src/lib/metricsGuide.test.js
```

Expected: diff is limited to the planned files and contains no unrelated changes.

- [ ] **Step 4: Commit implementation**

Run:

```powershell
git -c core.excludesfile= add server/src/strategies/buyInGreenEligibility.js server/src/strategies/buyInGreen.js server/src/strategies/index.js server/test/phase4.test.js client/src/pages/propertyDetailHelpers.js client/src/pages/propertyDetailHelpers.test.js client/src/pages/PropertyDetail.jsx client/src/lib/metricsGuide.js client/src/lib/metricsGuide.test.js docs/superpowers/plans/2026-05-14-buy-in-green-pre-construction.md
git -c core.excludesfile= commit -m "Restrict buy in green to pre-construction listings"
```

Expected: one implementation commit is created.

---

## Self-Review

Spec coverage:

- Strict pre-Act 14 eligibility is covered by Task 1 and Task 2.
- Act 14/15/16/finished/ambiguous exclusions are covered by Task 1 and Task 2.
- Existing strategy id and route stay stable; no route changes are planned.
- Existing formulas remain, with the hold period changed to 24 months in Task 2.
- Property detail non-applicable rendering is covered by Task 3.
- UI/docs wording is covered by Task 4.
- Focused tests and final verification are covered by Task 5.

Placeholder scan:

- No TBD, TODO, or unspecified implementation steps remain.

Type consistency:

- The detector accepts both database-style `construction_stage` and client/test-style `constructionStage`.
- `applicable: false` is handled before leverage decoration, so health and score remain `null`.
