# Detail Metric Value Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Color positive and negative analytical outcome metric values on the property details page while leaving neutral/input values uncolored.

**Architecture:** Add a small tested client utility that decides whether a metric value should receive a green, red, or neutral text class. Integrate that utility into `PropertyDetail.jsx` only, applying the class to strategy metric list values without changing formatting, labels, tooltips, tables, cards, or backend data.

**Tech Stack:** React 19, Vite, Tailwind CSS, node:test.

---

## File Structure

- Create `client/src/lib/metricValueStyles.js`: owns semantic outcome-key detection and value color class selection.
- Create `client/src/lib/metricValueStyles.test.js`: node:test coverage for positive, negative, zero, neutral-key, null, and non-numeric behavior.
- Modify `client/src/pages/PropertyDetail.jsx`: import the utility and apply its returned class to `<dd>` values in `MetricList`.

## Task 1: Metric Value Style Helper

**Files:**
- Create: `client/src/lib/metricValueStyles.js`
- Create: `client/src/lib/metricValueStyles.test.js`

- [ ] **Step 1: Write the failing tests**

Create `client/src/lib/metricValueStyles.test.js`:

```js
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { getMetricValueClass, isOutcomeMetric } from './metricValueStyles.js';

describe('metric value styles', () => {
  test('identifies outcome metrics that should receive sign coloring', () => {
    assert.equal(isOutcomeMetric('profit'), true);
    assert.equal(isOutcomeMetric('monthlyCashFlow'), true);
    assert.equal(isOutcomeMetric('leveragedRoiPct'), true);
    assert.equal(isOutcomeMetric('discountAmount'), true);
    assert.equal(isOutcomeMetric('instantEquity'), true);
    assert.equal(isOutcomeMetric('longTermComparison'), true);
  });

  test('keeps neutral and input metrics uncolored', () => {
    assert.equal(isOutcomeMetric('purchasePrice'), false);
    assert.equal(isOutcomeMetric('loanAmount'), false);
    assert.equal(isOutcomeMetric('monthlyPayment'), false);
    assert.equal(isOutcomeMetric('interestCost'), false);
    assert.equal(isOutcomeMetric('monthlyRent'), false);
    assert.equal(isOutcomeMetric('arv'), false);
    assert.equal(isOutcomeMetric('dscr'), false);
    assert.equal(isOutcomeMetric('effectiveLtvPct'), false);
  });

  test('colors positive outcome values green', () => {
    assert.equal(getMetricValueClass('monthlyCashFlow', 250), 'text-emerald-700');
    assert.equal(getMetricValueClass('roiPct', 12.5), 'text-emerald-700');
  });

  test('colors negative outcome values red', () => {
    assert.equal(getMetricValueClass('monthlyCashFlow', -120), 'text-rose-700');
    assert.equal(getMetricValueClass('longTermComparison', -35), 'text-rose-700');
  });

  test('leaves zero, missing, non-numeric, and neutral metrics uncolored', () => {
    assert.equal(getMetricValueClass('monthlyCashFlow', 0), 'text-slate-900');
    assert.equal(getMetricValueClass('monthlyCashFlow', null), 'text-slate-900');
    assert.equal(getMetricValueClass('monthlyCashFlow', 'n/a'), 'text-slate-900');
    assert.equal(getMetricValueClass('loanAmount', 50000), 'text-slate-900');
  });
});
```

- [ ] **Step 2: Run the failing helper tests**

Run from the repo root:

```powershell
node --test client/src/lib/metricValueStyles.test.js
```

Expected: FAIL with an import/module-not-found error for `client/src/lib/metricValueStyles.js`.

- [ ] **Step 3: Implement the helper**

Create `client/src/lib/metricValueStyles.js`:

```js
const outcomeMetricKeys = new Set([
  'annualizedRoiPct',
  'appreciationPct',
  'cashFlow',
  'cocPct',
  'discountAmount',
  'discountPct',
  'equityOnCashRatio',
  'instantEquity',
  'leveragedProfit',
  'leveragedRoiPct',
  'longTermComparison',
  'longTermMonthlyCashFlow',
  'monthlyCashFlow',
  'netYieldPct',
  'potentialProfit',
  'profit',
  'roiPct'
]);

export const neutralMetricValueClass = 'text-slate-900';
export const positiveMetricValueClass = 'text-emerald-700';
export const negativeMetricValueClass = 'text-rose-700';

export function isOutcomeMetric(key) {
  return outcomeMetricKeys.has(key);
}

export function getMetricValueClass(key, value) {
  if (!isOutcomeMetric(key)) {
    return neutralMetricValueClass;
  }

  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) {
    return neutralMetricValueClass;
  }

  return number > 0 ? positiveMetricValueClass : negativeMetricValueClass;
}
```

- [ ] **Step 4: Run helper tests**

Run:

```powershell
node --test client/src/lib/metricValueStyles.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```powershell
git -c core.excludesfile= add client/src/lib/metricValueStyles.js client/src/lib/metricValueStyles.test.js
git -c core.excludesfile= commit -m "Add detail metric value style helper"
```

## Task 2: Apply Value Coloring In Property Detail

**Files:**
- Modify: `client/src/pages/PropertyDetail.jsx`

- [ ] **Step 1: Import the helper**

Add this import to `client/src/pages/PropertyDetail.jsx`:

```js
import { getMetricValueClass } from '../lib/metricValueStyles.js';
```

The import block should include it near the other lib imports:

```js
import { formatCashFlow, formatEur, formatPercent, formatSqm } from '../lib/formatters.js';
import { getMetricValueClass } from '../lib/metricValueStyles.js';
import { getStrategy } from '../lib/strategies.js';
```

- [ ] **Step 2: Apply the class to metric values**

In `MetricList`, replace the `<dd>` line:

```jsx
<dd className="font-medium">{formatMetric(key, value)}</dd>
```

with:

```jsx
<dd className={`font-medium ${getMetricValueClass(key, value)}`}>{formatMetric(key, value)}</dd>
```

The full mapped metric block becomes:

```jsx
{Object.entries(metrics).slice(0, 10).map(([key, value]) => (
  <div key={key}>
    <dt>
      <MetricLabel labelKey={key} variant="metric" />
    </dt>
    <dd className={`font-medium ${getMetricValueClass(key, value)}`}>{formatMetric(key, value)}</dd>
  </div>
))}
```

- [ ] **Step 3: Run focused tests**

Run:

```powershell
node --test client/src/lib/metricValueStyles.test.js client/src/lib/labels.test.js
```

Expected: PASS.

- [ ] **Step 4: Run client build**

Run:

```powershell
npm.cmd run build --workspace client
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

Run:

```powershell
git -c core.excludesfile= add client/src/pages/PropertyDetail.jsx
git -c core.excludesfile= commit -m "Color detail outcome metric values"
```

## Task 3: Final Verification

**Files:**
- No code changes expected unless verification finds a defect.

- [ ] **Step 1: Run full tests**

Run:

```powershell
npm.cmd test
```

Expected: PASS for server and client tests.

- [ ] **Step 2: Run client build**

Run:

```powershell
npm.cmd run build --workspace client
```

Expected: PASS.

- [ ] **Step 3: Inspect working tree**

Run:

```powershell
git -c core.excludesfile= status --short
```

Expected: no output after all task commits.
