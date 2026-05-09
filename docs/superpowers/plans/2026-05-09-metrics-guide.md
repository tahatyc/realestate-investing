# Metrics Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a user-facing `Metrics Guide` page that explains the app's metrics, strategy systems, assumptions, formulas, health flags, scoring, and data flow.

**Architecture:** Add a static client-side documentation module at `client/src/lib/metricsGuide.js`, test its coverage against `strategyList`, then render it in a new `client/src/pages/MetricsGuide.jsx` page. Wire the page into `App.jsx` and `Layout.jsx` as `/metrics-guide` using the existing React Router and Tailwind layout patterns.

**Tech Stack:** React 19, React Router, Vite, Tailwind CSS, Lucide React, Node built-in test runner.

---

## File Structure

- Create `client/src/lib/metricsGuide.js`: structured guide content only. It exports `systemGuides`, `strategyGuides`, `metricGlossary`, `requiredSystemGuideIds`, `findStrategyGuide`, and `flattenGuideText`.
- Create `client/src/lib/metricsGuide.test.js`: coverage tests for the content module and formula references.
- Create `client/src/pages/MetricsGuide.jsx`: static reference page that renders the guide data using local presentational components.
- Modify `client/src/App.jsx`: import `MetricsGuide` and add the `/metrics-guide` route.
- Modify `client/src/components/Layout.jsx`: add the `Metrics Guide` nav item after `Overview` with the Lucide `BookOpen` icon.

Do not modify backend calculation code, scraper code, settings persistence, or the existing tooltip registry except through read-only imports.

The current worktree already contains unrelated client changes. Do not revert them. Stage and commit only files touched by this plan.

---

### Task 1: Add Failing Guide Content Tests

**Files:**
- Create: `client/src/lib/metricsGuide.test.js`
- Read: `client/src/lib/strategies.js`

- [ ] **Step 1: Create the failing content coverage test**

Create `client/src/lib/metricsGuide.test.js` with this complete content:

```js
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  findStrategyGuide,
  flattenGuideText,
  metricGlossary,
  requiredSystemGuideIds,
  strategyGuides,
  systemGuides
} from './metricsGuide.js';
import { strategyList } from './strategies.js';

describe('metrics guide content', () => {
  test('documents every frontend strategy', () => {
    assert.deepEqual(
      strategyGuides.map((guide) => guide.id),
      strategyList.map((strategy) => strategy.id)
    );

    for (const strategy of strategyList) {
      const guide = findStrategyGuide(strategy.id);
      assert.ok(guide, `${strategy.id} should have a guide entry`);
      assert.equal(guide.label, strategy.label);
      assert.ok(guide.summary, `${strategy.id} should explain the strategy purpose`);
      assert.ok(guide.cashScore, `${strategy.id} should explain the cash score`);
      assert.ok(guide.leveragedScore, `${strategy.id} should explain the leveraged score`);
      assert.ok(guide.caveats.length > 0, `${strategy.id} should explain current assumptions`);
    }
  });

  test('strategy guide metric keys cover the strategy table columns', () => {
    for (const strategy of strategyList) {
      const guide = findStrategyGuide(strategy.id);
      const guideKeys = new Set(guide.metricKeys);

      for (const key of [...strategy.cashColumns, ...strategy.leveragedColumns]) {
        assert.ok(
          guideKeys.has(key),
          `${strategy.id} guide should include the ${key} metric key`
        );
      }
    }
  });

  test('includes the required system guides', () => {
    const ids = new Set(systemGuides.map((guide) => guide.id));

    for (const id of requiredSystemGuideIds) {
      assert.ok(ids.has(id), `system guide ${id} should exist`);
    }

    assert.deepEqual(requiredSystemGuideIds, [
      'data-freshness',
      'settings',
      'leverage',
      'mortgage-payment',
      'rate-sensitivity',
      'health-flags',
      'neighborhoods'
    ]);
  });

  test('documents important code-backed formulas and assumptions', () => {
    const text = flattenGuideText();

    for (const phrase of [
      'fixed amortizing principal-and-interest payment',
      'break-even rate',
      '0% and 20%',
      'area * 300',
      'dailyRateEur * 30 * occupancyPct / 100',
      'When leverage is off',
      'score falls back to the cash score'
    ]) {
      assert.match(text, new RegExp(escapeRegExp(phrase), 'i'));
    }
  });

  test('glossary has named groups with entries', () => {
    assert.ok(metricGlossary.length >= 4);

    for (const group of metricGlossary) {
      assert.ok(group.title);
      assert.ok(group.entries.length > 0, `${group.title} should include entries`);

      for (const entry of group.entries) {
        assert.ok(entry.label);
        assert.ok(entry.description);
      }
    }
  });
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
node --test client/src/lib/metricsGuide.test.js
```

Expected: FAIL because `client/src/lib/metricsGuide.js` does not exist yet. The failure should include `ERR_MODULE_NOT_FOUND` for `./metricsGuide.js`.

- [ ] **Step 3: Commit the failing test**

Run:

```powershell
git -c core.excludesfile= add client/src/lib/metricsGuide.test.js
git -c core.excludesfile= commit -m "Add metrics guide content tests"
```

Expected: commit succeeds with only `client/src/lib/metricsGuide.test.js` staged.

---

### Task 2: Implement The Guide Content Module

**Files:**
- Create: `client/src/lib/metricsGuide.js`
- Test: `client/src/lib/metricsGuide.test.js`

- [ ] **Step 1: Create the guide content module**

Create `client/src/lib/metricsGuide.js` with this complete content:

```js
import { getLabel } from './labels.js';
import { strategyList } from './strategies.js';

export const requiredSystemGuideIds = [
  'data-freshness',
  'settings',
  'leverage',
  'mortgage-payment',
  'rate-sensitivity',
  'health-flags',
  'neighborhoods'
];

export const systemGuides = [
  {
    id: 'data-freshness',
    title: 'Data ingestion and freshness',
    summary:
      'The dashboard works from locally stored imot.bg listing data. Active listings, property details, and price history come from scraper runs, so every result should be read in the context of the last scrape time.',
    formulas: [
      {
        label: 'Active listings',
        formula: 'Listings where the local dataset still marks the property as active.',
        detail: 'The overview uses this count to show how much current market coverage the app has.'
      },
      {
        label: 'Price history',
        formula: 'Stored price observations ordered by scrape time.',
        detail: 'Property detail pages use this to show price movement and Below Market counts price drops from decreases in the recorded sequence.'
      },
      {
        label: 'Last scrape',
        formula: 'Most recent scraper run status and timestamp.',
        detail: 'A stale scrape means metrics may be mathematically correct but based on old market data.'
      }
    ]
  },
  {
    id: 'settings',
    title: 'Settings and assumptions',
    summary:
      'Settings are global assumptions used by every strategy calculation. Changing rental yield targets, expenses, leverage, Airbnb assumptions, or health thresholds changes future API results immediately.',
    formulas: [
      {
        label: 'Estimated monthly rent',
        formula: 'price * targetGrossYieldPct / 100 / 12',
        detail: 'The app estimates long-term rent from the configured gross yield target rather than from a separate rent listing match.'
      },
      {
        label: 'Monthly NOI',
        formula: 'monthlyRent * (1 - (vacancyPct + managementFeePct) / 100)',
        detail: 'NOI is net operating income after vacancy and management assumptions, before mortgage payment and insurance.'
      },
      {
        label: 'Airbnb monthly revenue',
        formula: 'dailyRateEur * 30 * occupancyPct / 100',
        detail: 'Short-term rental revenue uses a 30-day month and the configured occupancy assumption.'
      }
    ]
  },
  {
    id: 'leverage',
    title: 'Leverage behavior',
    summary:
      'Leverage controls whether financed metrics, health flags, rate sensitivity, and leveraged scoring are visible. The cash-only metrics are still calculated either way.',
    formulas: [
      {
        label: 'Loan amount',
        formula: 'price * ltvPct / 100',
        detail: 'The borrowed principal is based on the configured loan-to-value ratio.'
      },
      {
        label: 'Down payment',
        formula: 'price * downPaymentPct / 100',
        detail: 'The cash paid upfront is used as invested cash for many leveraged return calculations.'
      },
      {
        label: 'Origination fee',
        formula: 'loanAmount * originationFeePct / 100',
        detail: 'Loan setup cost is included in leveraged profit calculations for strategies that model financing carry.'
      },
      {
        label: 'Leverage off',
        formula: 'When leverage is off, score falls back to the cash score.',
        detail: 'Leveraged metrics, health, flags, rate sensitivity, and break-even rate are hidden in API results.'
      }
    ]
  },
  {
    id: 'mortgage-payment',
    title: 'Mortgage payment math',
    summary:
      'The mortgage payment is a fixed amortizing principal-and-interest payment calculated from principal, annual rate, and loan term. It is a screening estimate, not a bank offer.',
    formulas: [
      {
        label: 'Monthly rate',
        formula: 'annualRatePct / 100 / 12',
        detail: 'The annual mortgage rate setting is converted to a monthly decimal rate.'
      },
      {
        label: 'Monthly payment',
        formula: 'principal * r * (1 + r)^n / ((1 + r)^n - 1)',
        detail: 'This is the standard amortizing payment formula. If the rate is 0%, the app uses principal divided by months.'
      },
      {
        label: 'Interest-only carry cost',
        formula: 'principal * mortgageRate / 100 / 12 * months',
        detail: 'Buy in Green and Fix & Flip use interest-only carry cost over the assumed hold period.'
      },
      {
        label: 'DSCR',
        formula: 'monthlyNOI / monthlyDebtService',
        detail: 'Debt service coverage ratio compares operating income with the mortgage payment.'
      }
    ]
  },
  {
    id: 'rate-sensitivity',
    title: 'Rate sensitivity and break-even rate',
    summary:
      'Rate sensitivity shows whether a financed deal still works if mortgage rates move higher. Break-even rate estimates the rate where monthly cash flow reaches zero.',
    formulas: [
      {
        label: 'Rate sensitivity',
        formula: 'currentRate, currentRate + 1%, currentRate + 2%',
        detail: 'For each rate, the app recalculates monthly payment and monthly cash flow.'
      },
      {
        label: 'Break-even rate',
        formula: 'Search between 0% and 20% until payment equals NOI available for debt service.',
        detail: 'A low break-even rate means the deal has less room to absorb higher borrowing costs.'
      },
      {
        label: 'Monthly cash flow',
        formula: 'monthlyNOI - monthlyPayment - annualInsurance / 12',
        detail: 'Rental-style leveraged strategies subtract mortgage payment and monthly insurance from NOI.'
      }
    ]
  },
  {
    id: 'health-flags',
    title: 'Health flags and traffic lights',
    summary:
      'Health is a leveraged screening system. It combines cash flow, cash-on-cash return, DSCR, break-even rate, refinance coverage, and instant equity signals.',
    formulas: [
      {
        label: 'Green',
        formula: 'cocPct >= cocGreenPct AND monthlyCashFlow > 0 AND dscr >= dscrMinimum',
        detail: 'Green means the deal clears the configured return and debt coverage thresholds.'
      },
      {
        label: 'Yellow',
        formula: 'Default leveraged state when a deal is neither green nor red.',
        detail: 'Yellow means the deal is watchable but does not clearly pass or fail the health rules.'
      },
      {
        label: 'Red',
        formula: '(monthlyCashFlow < 0 AND cocPct < cocYellowPct) OR breakEvenRate <= currentRate',
        detail: 'Red means the deal is already weak on cash flow or cannot tolerate the current mortgage rate.'
      },
      {
        label: 'Flags',
        formula: 'NEGATIVE_CASH_FLOW, LOW_DSCR, RATE_SENSITIVE, STRONG_LEVERAGED_RETURN, REFINANCE_VIABLE, INSTANT_EQUITY',
        detail: 'Flags explain which specific rule or signal affected the deal.'
      }
    ]
  },
  {
    id: 'neighborhoods',
    title: 'Neighborhood metrics',
    summary:
      'Neighborhood data gives context for price per sqm, estimated market value, and relative deal quality. Several strategies compare a listing against neighborhood price levels.',
    formulas: [
      {
        label: 'Average price per sqm',
        formula: 'Average active property price_per_sqm in the same zone, excluding the current listing.',
        detail: 'When no stronger comparison exists, strategy code falls back to the current listing price per sqm.'
      },
      {
        label: 'Market value',
        formula: 'averagePricePerSqm * area',
        detail: 'Buy in Green, BRRRR, Fix & Flip, and Below Market use this as part of future value or discount estimates.'
      },
      {
        label: 'Price per sqm',
        formula: 'price / area',
        detail: 'This is the basic price efficiency metric used to compare listings across sizes and neighborhoods.'
      }
    ]
  }
];

const strategyGuideById = {
  'buy-in-green': {
    id: 'buy-in-green',
    summary:
      'Finds new-build or near-finished properties where the expected finished value is higher than the current asking price.',
    inputs: ['price', 'areaSqm', 'pricePerSqm', 'constructionStage', 'zone', 'mortgageRate', 'ltvPct', 'downPaymentPct', 'originationFeePct'],
    cashMetrics: [
      'averageFinishedPricePerSqm',
      'futureValue',
      'potentialProfit',
      'appreciationPct',
      'holdMonths'
    ],
    leveragedMetrics: [
      'loanAmount',
      'downPayment',
      'interestCost',
      'originationFee',
      'leveragedProfit',
      'leveragedRoiPct',
      'monthlyCashFlow',
      'cocPct',
      'dscr',
      'breakEvenRate'
    ],
    metricKeys: [
      'appreciationPct',
      'potentialProfit',
      'holdMonths',
      'leveragedRoiPct',
      'leveragedProfit',
      'interestCost'
    ],
    formulas: [
      {
        label: 'Future value',
        formula: 'max(neighborhoodAveragePricePerSqm, pricePerSqm * 1.15) * area',
        detail: 'The app assumes finished value is at least 15% above the current price per sqm when neighborhood data is lower.'
      },
      {
        label: 'Potential profit',
        formula: 'futureValue - price',
        detail: 'Cash-only upside before financing costs.'
      },
      {
        label: 'Leveraged ROI',
        formula: '(potentialProfit - interestCost - originationFee) / downPayment * 100',
        detail: 'Debt amplifies the return by comparing profit with cash down instead of full price.'
      }
    ],
    cashScore: 'Potential profit.',
    leveragedScore: 'Leveraged ROI.',
    caveats: [
      'Hold months are 18 for act 14, 8 for act 15, and 6 for other stages.',
      'The strategy uses a simplified future value estimate and does not model construction delays or closing risk.',
      'DSCR and break-even values are placeholders for health compatibility on this non-rental strategy.'
    ]
  },
  brrrr: {
    id: 'brrrr',
    summary:
      'Screens for buy, rehab, rent, refinance, repeat deals where refinance proceeds can recover a meaningful part of total investment.',
    inputs: ['price', 'areaSqm', 'zone', 'targetGrossYieldPct', 'vacancyPct', 'managementFeePct', 'ltvPct', 'mortgageRate', 'loanTermYears'],
    cashMetrics: [
      'purchasePrice',
      'rehabCost',
      'totalInvestment',
      'arv',
      'monthlyRent',
      'grossYieldPct',
      'netYieldPct'
    ],
    leveragedMetrics: [
      'loanAmount',
      'downPayment',
      'monthlyPayment',
      'monthlyCashFlow',
      'cocPct',
      'dscr',
      'breakEvenRate',
      'rateSensitivity',
      'refinanceLoan',
      'cashLeftInDeal',
      'refinanceCoveragePct'
    ],
    metricKeys: ['arv', 'netYieldPct', 'monthlyRent', 'monthlyCashFlow', 'cocPct', 'dscr'],
    formulas: [
      {
        label: 'Rehab cost',
        formula: 'area * 300',
        detail: 'The current model uses a fixed EUR 300 per sqm rehab assumption.'
      },
      {
        label: 'ARV',
        formula: 'max(neighborhoodAveragePricePerSqm * area, price * 1.15)',
        detail: 'After-repair value is the greater of neighborhood value and a 15% uplift over price.'
      },
      {
        label: 'Cash left in deal',
        formula: 'max(totalInvestment - refinanceLoan, 0)',
        detail: 'If refinance proceeds cover the full investment, cash left in the deal bottoms out at zero.'
      }
    ],
    cashScore: 'Net yield on total investment.',
    leveragedScore: 'Monthly cash flow.',
    caveats: [
      'Rehab cost is a simple area-based estimate.',
      'Rent is estimated from ARV using the global target gross yield setting.',
      'Refinance terms are modeled from the global LTV setting.'
    ]
  },
  flip: {
    id: 'flip',
    summary:
      'Estimates fix-and-flip upside from resale value, renovation cost, transaction costs, and optional financing carry.',
    inputs: ['price', 'areaSqm', 'zone', 'mortgageRate', 'ltvPct', 'downPaymentPct', 'originationFeePct'],
    cashMetrics: ['purchasePrice', 'rehabCost', 'arv', 'transactionCosts', 'profit', 'roiPct', 'annualizedRoiPct'],
    leveragedMetrics: [
      'loanAmount',
      'cashDeployed',
      'downPayment',
      'interestCost',
      'originationFee',
      'leveragedProfit',
      'leveragedRoiPct',
      'leveragedAnnualizedRoiPct',
      'monthlyCashFlow',
      'cocPct',
      'dscr',
      'breakEvenRate'
    ],
    metricKeys: ['profit', 'roiPct', 'annualizedRoiPct', 'leveragedProfit', 'leveragedRoiPct', 'interestCost'],
    formulas: [
      {
        label: 'Rehab cost',
        formula: 'area * 300',
        detail: 'The current model uses a fixed EUR 300 per sqm rehab assumption.'
      },
      {
        label: 'Profit',
        formula: 'arv - price - rehabCost - transactionCosts',
        detail: 'Cash profit after estimated renovation and transaction costs.'
      },
      {
        label: 'Annualized ROI',
        formula: 'roiPct * 2',
        detail: 'The current flip model assumes a six-month timeline, so total ROI is doubled.'
      }
    ],
    cashScore: 'Cash ROI.',
    leveragedScore: 'Leveraged ROI.',
    caveats: [
      'ARV uses the greater of neighborhood value and a 12% uplift over current price.',
      'Transaction costs are modeled as 3% of price.',
      'The model does not include taxes, contractor delays, or selling time variability.'
    ]
  },
  'cash-flow': {
    id: 'cash-flow',
    summary:
      'Ranks traditional long-term rentals by estimated net yield or leveraged cash-on-cash return.',
    inputs: ['price', 'targetGrossYieldPct', 'vacancyPct', 'managementFeePct', 'mortgageRate', 'loanTermYears', 'annualInsuranceEur'],
    cashMetrics: ['monthlyRent', 'monthlyNOI', 'grossYieldPct', 'netYieldPct', 'capRatePct', 'paybackYears'],
    leveragedMetrics: [
      'loanAmount',
      'downPayment',
      'originationFee',
      'monthlyPayment',
      'monthlyCashFlow',
      'cocPct',
      'dscr',
      'breakEvenRate',
      'rateSensitivity',
      'leveragedPaybackYears'
    ],
    metricKeys: ['monthlyRent', 'netYieldPct', 'paybackYears', 'monthlyCashFlow', 'cocPct', 'breakEvenRate'],
    formulas: [
      {
        label: 'Gross yield',
        formula: 'monthlyRent * 12 / price * 100',
        detail: 'Annual rent before vacancy and management assumptions divided by purchase price.'
      },
      {
        label: 'Net yield',
        formula: 'monthlyNOI * 12 / price * 100',
        detail: 'Annual NOI divided by purchase price. Cap rate currently uses the same value.'
      },
      {
        label: 'Payback years',
        formula: '100 / netYieldPct',
        detail: 'Only shown when net yield is positive.'
      }
    ],
    cashScore: 'Net yield.',
    leveragedScore: 'Cash-on-cash return.',
    caveats: [
      'Rent is estimated from the configured target gross yield, not from a matched rental comp.',
      'NOI subtracts vacancy and management assumptions only.',
      'Insurance is subtracted after NOI in leveraged cash flow.'
    ]
  },
  airbnb: {
    id: 'airbnb',
    summary:
      'Compares short-term rental income potential against traditional long-term rental assumptions.',
    inputs: ['price', 'dailyRateEur', 'occupancyPct', 'operatingExpensePct', 'targetGrossYieldPct', 'mortgageRate', 'loanTermYears'],
    cashMetrics: [
      'monthlyRevenue',
      'operatingExpenses',
      'monthlyNOI',
      'netYieldPct',
      'longTermMonthlyNOI',
      'longTermComparison'
    ],
    leveragedMetrics: [
      'loanAmount',
      'downPayment',
      'originationFee',
      'monthlyPayment',
      'monthlyCashFlow',
      'cocPct',
      'dscr',
      'breakEvenRate',
      'rateSensitivity',
      'leveragedPaybackYears',
      'longTermMonthlyCashFlow'
    ],
    metricKeys: ['monthlyRevenue', 'netYieldPct', 'longTermComparison', 'monthlyCashFlow', 'cocPct', 'longTermMonthlyCashFlow'],
    formulas: [
      {
        label: 'Monthly revenue',
        formula: 'dailyRateEur * 30 * occupancyPct / 100',
        detail: 'Gross short-term rental revenue from daily rate, 30 days, and occupancy.'
      },
      {
        label: 'Operating expenses',
        formula: 'monthlyRevenue * operatingExpensePct / 100',
        detail: 'Short-term rental operating cost reserve.'
      },
      {
        label: 'Long-term comparison',
        formula: 'airbnbNOI / longTermNOI',
        detail: 'Compares Airbnb NOI against the traditional rental NOI estimate.'
      }
    ],
    cashScore: 'Airbnb net yield.',
    leveragedScore: 'Cash-on-cash return.',
    caveats: [
      'Revenue uses a 30-day month.',
      'The model does not include seasonality, licensing limits, platform fees, or cleaning fee treatment.',
      'Long-term comparison uses the same global rental assumptions as Cash Flow Rental.'
    ]
  },
  'below-market': {
    id: 'below-market',
    summary:
      'Finds listings priced below estimated neighborhood market value and highlights instant equity signals.',
    inputs: ['price', 'areaSqm', 'zone', 'firstSeenAt', 'priceHistory', 'ltvPct', 'downPaymentPct'],
    cashMetrics: ['marketValue', 'discountAmount', 'discountPct', 'daysOnMarket', 'priceDrops'],
    leveragedMetrics: [
      'loanAmount',
      'downPayment',
      'monthlyPayment',
      'monthlyCashFlow',
      'cocPct',
      'dscr',
      'breakEvenRate',
      'rateSensitivity',
      'instantEquity',
      'discountAmount',
      'effectiveLtvPct',
      'equityOnCashRatio'
    ],
    metricKeys: ['discountPct', 'discountAmount', 'daysOnMarket', 'instantEquity', 'effectiveLtvPct', 'equityOnCashRatio'],
    formulas: [
      {
        label: 'Market value',
        formula: 'max(neighborhoodAveragePricePerSqm * area, price)',
        detail: 'The model does not let estimated market value fall below current asking price.'
      },
      {
        label: 'Discount',
        formula: '(marketValue - price) / marketValue * 100',
        detail: 'Estimated percentage below market value.'
      },
      {
        label: 'Leveraged score',
        formula: 'discountPct + equityOnCashRatio * 10',
        detail: 'Leverage gives extra ranking weight to discount relative to down payment.'
      }
    ],
    cashScore: 'Discount percentage.',
    leveragedScore: 'Discount percentage plus equity-to-cash ratio times 10.',
    caveats: [
      'Market value depends on available neighborhood price per sqm data.',
      'Price drops are counted from recorded price history, so old missing data cannot be recovered.',
      'Instant equity is an estimate, not an appraisal.'
    ]
  }
};

export const strategyGuides = strategyList.map((strategy) => ({
  ...strategyGuideById[strategy.id],
  label: strategy.label,
  tone: strategy.tone,
  tableColumns: {
    cash: strategy.cashColumns,
    leveraged: strategy.leveragedColumns
  }
}));

export const metricGlossary = [
  {
    title: 'Core property metrics',
    entries: [
      glossaryEntry('price', 'Asking price used as the base for return and financing calculations.'),
      glossaryEntry('areaSqm', 'Property size in square meters.'),
      glossaryEntry('pricePerSqm', 'Asking price divided by area, used for neighborhood comparisons.'),
      glossaryEntry('marketValue', 'Estimated fair value from neighborhood price per sqm context.'),
      glossaryEntry('daysOnMarket', 'Days since the listing was first seen by the scraper.')
    ]
  },
  {
    title: 'Rental income metrics',
    entries: [
      glossaryEntry('monthlyRent', 'Estimated long-term monthly rent from the target gross yield setting.', 'price * targetGrossYieldPct / 100 / 12'),
      glossaryEntry('noi', 'Net operating income after vacancy and management assumptions.', 'monthlyRent * (1 - expensesPct / 100)'),
      glossaryEntry('grossYieldPct', 'Annual rent divided by purchase price.', 'monthlyRent * 12 / price * 100'),
      glossaryEntry('netYieldPct', 'Annual NOI divided by purchase price.', 'monthlyNOI * 12 / price * 100'),
      glossaryEntry('paybackYears', 'Estimated years for net yield to recover the investment.', '100 / netYieldPct')
    ]
  },
  {
    title: 'Leverage metrics',
    entries: [
      glossaryEntry('loanAmount', 'Estimated borrowed principal.', 'price * ltvPct / 100'),
      glossaryEntry('downPayment', 'Cash paid upfront toward the property purchase.', 'price * downPaymentPct / 100'),
      glossaryEntry('monthlyPayment', 'Fixed amortizing principal-and-interest payment.'),
      glossaryEntry('monthlyCashFlow', 'Income left after operating costs, mortgage payment, and monthly insurance.'),
      glossaryEntry('cocPct', 'Annual cash flow divided by cash invested.', 'monthlyCashFlow * 12 / cashInvested * 100'),
      glossaryEntry('dscr', 'Debt service coverage ratio.', 'monthlyNOI / monthlyDebtService'),
      glossaryEntry('breakEvenRate', 'Mortgage rate where monthly cash flow reaches zero.')
    ]
  },
  {
    title: 'Strategy outcome metrics',
    entries: [
      glossaryEntry('potentialProfit', 'Estimated upside before financing costs.'),
      glossaryEntry('roiPct', 'Profit divided by total investment.'),
      glossaryEntry('annualizedRoiPct', 'ROI adjusted to an annual rate in the flip model.'),
      glossaryEntry('arv', 'After-repair value estimate.'),
      glossaryEntry('discountPct', 'Estimated percentage below market value.'),
      glossaryEntry('equityOnCashRatio', 'Instant equity divided by down payment.'),
      glossaryEntry('longTermComparison', 'Airbnb NOI divided by long-term rental NOI.')
    ]
  }
];

export function findStrategyGuide(id) {
  return strategyGuides.find((guide) => guide.id === id);
}

export function flattenGuideText() {
  return [
    ...systemGuides.flatMap((guide) => [
      guide.id,
      guide.title,
      guide.summary,
      ...guide.formulas.flatMap((formula) => [formula.label, formula.formula, formula.detail])
    ]),
    ...strategyGuides.flatMap((guide) => [
      guide.id,
      guide.label,
      guide.summary,
      guide.cashScore,
      guide.leveragedScore,
      ...guide.inputs,
      ...guide.cashMetrics,
      ...guide.leveragedMetrics,
      ...guide.metricKeys,
      ...guide.caveats,
      ...guide.formulas.flatMap((formula) => [formula.label, formula.formula, formula.detail])
    ]),
    ...metricGlossary.flatMap((group) => [
      group.title,
      ...group.entries.flatMap((entry) => [entry.key, entry.label, entry.description, entry.formula ?? ''])
    ])
  ].join(' ');
}

function glossaryEntry(key, description, formula = '') {
  return {
    key,
    label: getLabel(key),
    description,
    formula
  };
}
```

- [ ] **Step 2: Run the focused content test**

Run:

```powershell
node --test client/src/lib/metricsGuide.test.js
```

Expected: PASS. The output should report `metrics guide content` tests passing.

- [ ] **Step 3: Run existing related lib tests**

Run:

```powershell
node --test client/src/lib/strategies.test.js client/src/lib/labels.test.js client/src/lib/metricsGuide.test.js
```

Expected: PASS.

- [ ] **Step 4: Commit the content module**

Run:

```powershell
git -c core.excludesfile= add client/src/lib/metricsGuide.js client/src/lib/metricsGuide.test.js
git -c core.excludesfile= commit -m "Add metrics guide content"
```

Expected: commit succeeds with the content module and its test.

---

### Task 3: Add The Metrics Guide Page

**Files:**
- Create: `client/src/pages/MetricsGuide.jsx`
- Read: `client/src/lib/metricsGuide.js`

- [ ] **Step 1: Create the static page component**

Create `client/src/pages/MetricsGuide.jsx` with this complete content:

```jsx
import { metricGlossary, strategyGuides, systemGuides } from '../lib/metricsGuide.js';

export default function MetricsGuide() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Metrics Guide</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          A plain-language reference for the data, assumptions, formulas, strategy scores, and health checks used by the investment analyzer.
        </p>
      </div>

      <GuideSection
        title="Systems"
        intro="These systems explain where the numbers come from before they appear in strategy tables or property detail pages."
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {systemGuides.map((guide) => (
            <SystemGuideCard key={guide.id} guide={guide} />
          ))}
        </div>
      </GuideSection>

      <GuideSection
        title="Strategy Calculations"
        intro="Each strategy has a cash-only score and a leveraged score. When leverage is off, the app hides financed metrics and ranks by the cash score."
      >
        <div className="grid gap-3 xl:grid-cols-2">
          {strategyGuides.map((guide) => (
            <StrategyGuideCard key={guide.id} guide={guide} />
          ))}
        </div>
      </GuideSection>

      <GuideSection
        title="Metric Glossary"
        intro="Common metric names used across cards, tables, property details, and guide formulas."
      >
        <div className="space-y-3">
          {metricGlossary.map((group) => (
            <MetricGlossaryTable key={group.title} group={group} />
          ))}
        </div>
      </GuideSection>
    </div>
  );
}

function GuideSection({ title, intro, children }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {intro ? <p className="mt-1 max-w-4xl text-sm text-slate-500">{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}

function SystemGuideCard({ guide }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <h3 className="font-semibold">{guide.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{guide.summary}</p>
      <FormulaBlock formulas={guide.formulas} />
    </article>
  );
}

function StrategyGuideCard({ guide }) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{guide.label}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{guide.summary}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
          {guide.id}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <TextList title="Main inputs" items={guide.inputs} />
        <div className="rounded-md bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-800">Scoring</p>
          <dl className="mt-2 space-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Cash score</dt>
              <dd className="font-medium text-slate-800">{guide.cashScore}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Leveraged score</dt>
              <dd className="font-medium text-slate-800">{guide.leveragedScore}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <TextList title="Cash metrics" items={guide.cashMetrics} />
        <TextList title="Leveraged metrics" items={guide.leveragedMetrics} />
      </div>

      <FormulaBlock formulas={guide.formulas} />
      <TextList title="Current assumptions and caveats" items={guide.caveats} />
    </article>
  );
}

function FormulaBlock({ formulas }) {
  if (!formulas?.length) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
      {formulas.map((formula) => (
        <div key={`${formula.label}-${formula.formula}`} className="border-t border-slate-200 p-3 first:border-t-0">
          <p className="text-sm font-semibold text-slate-800">{formula.label}</p>
          <p className="mt-1 break-words rounded bg-slate-50 px-2 py-1 font-mono text-xs text-slate-700">
            {formula.formula}
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{formula.detail}</p>
        </div>
      ))}
    </div>
  );
}

function TextList({ title, items }) {
  if (!items?.length) return null;

  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-slate-600">
        {items.map((item) => (
          <li key={item} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MetricGlossaryTable({ group }) {
  return (
    <article className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="font-semibold">{group.title}</h3>
      </div>
      <div className="divide-y divide-slate-200">
        {group.entries.map((entry) => (
          <div key={entry.key} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[12rem_1fr]">
            <div>
              <p className="font-medium text-slate-900">{entry.label}</p>
              <p className="break-words font-mono text-xs text-slate-500">{entry.key}</p>
            </div>
            <div>
              <p className="leading-6 text-slate-600">{entry.description}</p>
              {entry.formula ? (
                <p className="mt-1 break-words rounded bg-slate-50 px-2 py-1 font-mono text-xs text-slate-700">
                  {entry.formula}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Run a client build to catch JSX/import errors**

Run:

```powershell
npm.cmd run build --workspace client
```

Expected: PASS. Vite should produce a production build under `client/dist`.

- [ ] **Step 3: Commit the page component**

Run:

```powershell
git -c core.excludesfile= add client/src/pages/MetricsGuide.jsx
git -c core.excludesfile= commit -m "Add metrics guide page"
```

Expected: commit succeeds with only the page component staged.

---

### Task 4: Wire Route And Navigation

**Files:**
- Modify: `client/src/App.jsx`
- Modify: `client/src/components/Layout.jsx`
- Read: `client/src/pages/MetricsGuide.jsx`

- [ ] **Step 1: Update `client/src/App.jsx`**

Replace the full file with:

```jsx
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Overview from './pages/Overview.jsx';
import StrategyView from './pages/StrategyView.jsx';
import PropertyDetail from './pages/PropertyDetail.jsx';
import Neighborhoods from './pages/Neighborhoods.jsx';
import MetricsGuide from './pages/MetricsGuide.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/metrics-guide" element={<MetricsGuide />} />
        <Route path="/strategy/:name" element={<StrategyView />} />
        <Route path="/property/:id" element={<PropertyDetail />} />
        <Route path="/neighborhoods" element={<Neighborhoods />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
```

- [ ] **Step 2: Update `client/src/components/Layout.jsx`**

Replace the full file with:

```jsx
import { BookOpen, Building2, ChartColumn, Gauge, Home, Settings, TableProperties } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { strategyList } from '../lib/strategies.js';

const navItems = [
  { to: '/', label: 'Overview', icon: Gauge },
  { to: '/metrics-guide', label: 'Metrics Guide', icon: BookOpen },
  ...strategyList.map((strategy) => ({ to: strategy.path, label: strategy.label, icon: TableProperties })),
  { to: '/neighborhoods', label: 'Neighborhoods', icon: ChartColumn },
  { to: '/settings', label: 'Settings', icon: Settings }
];

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Real Estate</p>
            <p className="text-xs text-slate-500">Investment Analyzer</p>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                ].join(' ')
              }
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <NavLink to="/" className="flex items-center gap-2 text-sm font-semibold">
            <Home className="h-4 w-4" />
            Real Estate Analyzer
          </NavLink>
          <NavLink to="/settings" className="rounded-md border border-slate-200 p-2">
            <Settings className="h-4 w-4" />
          </NavLink>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-3">
          {navItems.slice(0, -1).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  'whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium',
                  isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Run the build**

Run:

```powershell
npm.cmd run build --workspace client
```

Expected: PASS.

- [ ] **Step 4: Commit routing and navigation**

Run:

```powershell
git -c core.excludesfile= add client/src/App.jsx client/src/components/Layout.jsx
git -c core.excludesfile= commit -m "Add metrics guide route"
```

Expected: commit succeeds with route and navigation changes.

---

### Task 5: Full Verification And Cleanup Check

**Files:**
- Verify: `client/src/lib/metricsGuide.js`
- Verify: `client/src/lib/metricsGuide.test.js`
- Verify: `client/src/pages/MetricsGuide.jsx`
- Verify: `client/src/App.jsx`
- Verify: `client/src/components/Layout.jsx`

- [ ] **Step 1: Run all client tests**

Run:

```powershell
npm.cmd test --workspace client
```

Expected: PASS.

- [ ] **Step 2: Run the client build**

Run:

```powershell
npm.cmd run build --workspace client
```

Expected: PASS.

- [ ] **Step 3: Inspect the final diff for scope**

Run:

```powershell
git -c core.excludesfile= status --short
git -c core.excludesfile= diff -- client/src/lib/metricsGuide.js client/src/lib/metricsGuide.test.js client/src/pages/MetricsGuide.jsx client/src/App.jsx client/src/components/Layout.jsx
```

Expected: `status --short` may still show unrelated pre-existing client changes. The diff for the five files in this plan should be empty if all task commits were made.

- [ ] **Step 4: If any planned files are uncommitted, commit them**

Run this only if Step 3 shows uncommitted changes in the five planned files:

```powershell
git -c core.excludesfile= add client/src/lib/metricsGuide.js client/src/lib/metricsGuide.test.js client/src/pages/MetricsGuide.jsx client/src/App.jsx client/src/components/Layout.jsx
git -c core.excludesfile= commit -m "Complete metrics guide"
```

Expected: commit succeeds. Do not stage unrelated files.

---

## Self-Review

Spec coverage:

- Static `/metrics-guide` page: Task 3 and Task 4.
- Main navigation item after Overview using `BookOpen`: Task 4.
- Dedicated `client/src/lib/metricsGuide.js` module: Task 2.
- Strategy, system, and glossary content: Task 2.
- Exact current formulas and caveats: Task 2.
- Content coverage tests: Task 1 and Task 2.
- Build and client test verification: Task 3, Task 4, and Task 5.
- No backend endpoint or calculation changes: File structure and task scopes keep backend untouched.

Placeholder scan:

- The plan contains no placeholder markers, incomplete file paths, or steps that ask the implementer to invent missing behavior.
- Code steps provide complete file contents or exact commands.

Type and property consistency:

- `metricsGuide.test.js` imports `findStrategyGuide`, `flattenGuideText`, `metricGlossary`, `requiredSystemGuideIds`, `strategyGuides`, and `systemGuides`.
- `metricsGuide.js` exports all imported names.
- `MetricsGuide.jsx` reads `metricGlossary`, `strategyGuides`, and `systemGuides`.
- `Layout.jsx` imports `BookOpen` and uses it in the `navItems` array.
