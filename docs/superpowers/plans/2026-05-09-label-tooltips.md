# Label Tooltips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw/camelCase metric labels with readable labels and add reusable explanatory tooltips across details, cards, tables, and settings.

**Architecture:** Add a client-side label metadata registry that owns all display labels and descriptions. Add a presentational `MetricLabel` component that renders the label plus a keyboard-focusable tooltip icon, then integrate it into existing display surfaces without changing backend response keys or calculation behavior.

**Tech Stack:** React 19, Vite, Tailwind CSS, lucide-react, node:test.

---

## File Structure

- Create `client/src/lib/labels.js`: central metadata registry, fallback humanizer, metadata lookup helpers.
- Create `client/src/lib/labels.test.js`: node:test coverage for known metadata and fallback labels.
- Modify `client/src/lib/strategies.js`: keep `metricLabels` export working by deriving it from the new metadata registry.
- Create `client/src/components/MetricLabel.jsx`: reusable visual label with optional tooltip.
- Modify `client/src/components/MetricCard.jsx`: render labels through `MetricLabel`.
- Modify `client/src/pages/PropertyDetail.jsx`: use metadata helper and `MetricLabel` for strategy metric lists.
- Modify `client/src/components/PropertyTable.jsx`: use metadata labels in sortable table headers.
- Modify `client/src/pages/Settings.jsx`: use `MetricLabel` for field labels and stable metadata keys for settings fields.

## Task 1: Label Metadata Registry

**Files:**
- Create: `client/src/lib/labels.js`
- Create: `client/src/lib/labels.test.js`

- [ ] **Step 1: Write the failing metadata tests**

Create `client/src/lib/labels.test.js`:

```js
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { getLabelMeta, humanizeKey, labelMetadata } from './labels.js';

describe('label metadata helpers', () => {
  test('returns known labels with descriptions', () => {
    assert.equal(getLabelMeta('cocPct').label, 'Cash-on-cash return');
    assert.match(getLabelMeta('cocPct').description, /cash invested/i);
    assert.equal(getLabelMeta('pricePerSqm').label, 'Price per sqm');
  });

  test('humanizes camelCase, snake_case, and kebab-case fallbacks', () => {
    assert.equal(humanizeKey('monthlyCashFlow'), 'Monthly cash flow');
    assert.equal(humanizeKey('avg_price_per_sqm'), 'Avg price per sqm');
    assert.equal(humanizeKey('break-even-rate'), 'Break even rate');
  });

  test('handles acronyms and nullish keys safely', () => {
    assert.equal(humanizeKey('ltvPct'), 'LTV pct');
    assert.equal(humanizeKey(''), 'Unknown');
    assert.equal(humanizeKey(null), 'Unknown');
  });

  test('falls back without a tooltip description for unknown keys', () => {
    assert.deepEqual(getLabelMeta('newBackendMetric'), {
      key: 'newBackendMetric',
      label: 'New backend metric',
      description: ''
    });
  });

  test('covers the strategy metric keys shown on detail pages', () => {
    for (const key of [
      'appreciationPct',
      'arv',
      'breakEvenRate',
      'cashDeployed',
      'cashLeftInDeal',
      'cocPct',
      'daysOnMarket',
      'discountAmount',
      'discountPct',
      'downPayment',
      'dscr',
      'effectiveLtvPct',
      'equityOnCashRatio',
      'holdMonths',
      'instantEquity',
      'interestCost',
      'leveragedPaybackYears',
      'leveragedProfit',
      'leveragedRoiPct',
      'loanAmount',
      'longTermComparison',
      'longTermMonthlyCashFlow',
      'longTermMonthlyRent',
      'marketValue',
      'monthlyCashFlow',
      'monthlyPayment',
      'monthlyRent',
      'monthlyRevenue',
      'netYieldPct',
      'noi',
      'originationFee',
      'paybackYears',
      'potentialProfit',
      'profit',
      'purchasePrice',
      'rateSensitivity',
      'refinanceLoan',
      'rehabCost',
      'roiPct',
      'annualizedRoiPct',
      'totalInvestment',
      'transactionCosts'
    ]) {
      assert.ok(labelMetadata[key], `${key} should have metadata`);
      assert.ok(labelMetadata[key].label, `${key} should have a label`);
      assert.ok(labelMetadata[key].description, `${key} should have a description`);
    }
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run from the repo root:

```powershell
node --test client/src/lib/labels.test.js
```

Expected: FAIL with an import/module-not-found error for `client/src/lib/labels.js`.

- [ ] **Step 3: Implement the metadata registry**

Create `client/src/lib/labels.js`:

```js
const acronyms = new Map([
  ['arv', 'ARV'],
  ['coc', 'CoC'],
  ['dscr', 'DSCR'],
  ['ltv', 'LTV'],
  ['noi', 'NOI'],
  ['roi', 'ROI'],
  ['sqm', 'sqm'],
  ['pct', 'pct'],
  ['eur', 'EUR']
]);

export const labelMetadata = {
  activeListings: {
    label: 'Active listings',
    description: 'Listings currently available in the dataset. Useful for judging market coverage.'
  },
  annualInsuranceEur: {
    label: 'Annual insurance',
    description: 'Estimated yearly insurance cost used in leveraged cash flow calculations.'
  },
  annualizedRoiPct: {
    label: 'Annualized ROI',
    description: 'Projected return adjusted to a yearly rate. Useful for comparing deals with different hold periods.'
  },
  appreciationPct: {
    label: 'Appreciation',
    description: 'Expected price growth over the hold period. Useful for judging upside from market movement.'
  },
  area: {
    label: 'Area',
    description: 'Property size in square meters. Useful for comparing price efficiency.'
  },
  areaSqm: {
    label: 'Area',
    description: 'Property size in square meters. Useful for comparing price efficiency.'
  },
  arv: {
    label: 'ARV',
    description: 'After-repair value estimate. Useful for judging refinance or resale potential after improvements.'
  },
  breakEvenRate: {
    label: 'Break-even rate',
    description: 'Mortgage rate where monthly cash flow reaches zero. Useful for interest-rate risk checks.'
  },
  breakeven: {
    label: 'Break-even rate',
    description: 'Mortgage rate where monthly cash flow reaches zero. Useful for interest-rate risk checks.'
  },
  cashFlow: {
    label: 'Cash flow',
    description: 'Monthly income left after operating costs and debt service. Useful for checking if the deal pays for itself.'
  },
  cashDeployed: {
    label: 'Cash deployed',
    description: 'Cash put into the deal before exit. Useful for calculating leveraged flip returns.'
  },
  cashLeftInDeal: {
    label: 'Cash left in deal',
    description: 'Cash still tied up after refinance. Useful for judging BRRRR capital recycling.'
  },
  coc: {
    label: 'Cash-on-cash return',
    description: 'Annual cash flow divided by cash invested. Useful for comparing leveraged deals.'
  },
  cocGreenPct: {
    label: 'CoC green threshold',
    description: 'Minimum cash-on-cash return for a green health rating.'
  },
  cocPct: {
    label: 'Cash-on-cash return',
    description: 'Annual cash flow divided by cash invested. Useful for comparing leveraged deals.'
  },
  cocYellowPct: {
    label: 'CoC yellow threshold',
    description: 'Minimum cash-on-cash return for a yellow health rating.'
  },
  condition: {
    label: 'Condition',
    description: 'Detected property condition from the listing. Useful for estimating work needed before renting or reselling.'
  },
  dailyRateEur: {
    label: 'Daily rate',
    description: 'Expected nightly Airbnb price. Useful for estimating short-term rental revenue.'
  },
  daysOnMarket: {
    label: 'Days on market',
    description: 'How long the listing has been visible. Useful for spotting stale listings and negotiation room.'
  },
  discountAmount: {
    label: 'Discount amount',
    description: 'Estimated euro difference between market value and asking price. Useful for sizing instant upside.'
  },
  discountPct: {
    label: 'Discount',
    description: 'Estimated percentage below market value. Useful for finding underpriced listings.'
  },
  downPayment: {
    label: 'Down payment',
    description: 'Cash paid upfront toward the property purchase. Useful for calculating cash invested.'
  },
  downPaymentPct: {
    label: 'Down payment',
    description: 'Share of the purchase price paid in cash. Useful for calculating loan size and cash invested.'
  },
  dscr: {
    label: 'DSCR',
    description: 'Debt service coverage ratio: operating income divided by debt payments. Useful for loan safety checks.'
  },
  dscrMinimum: {
    label: 'DSCR minimum',
    description: 'Lowest acceptable debt service coverage ratio before a deal is flagged as risky.'
  },
  effectiveLtvPct: {
    label: 'Effective LTV',
    description: 'Loan-to-value after accounting for discount or equity. Useful for judging financing risk.'
  },
  equityOnCashRatio: {
    label: 'Equity-to-cash ratio',
    description: 'Instant equity compared with cash invested. Useful for measuring how much value each cash euro creates.'
  },
  greenCount: {
    label: 'Green',
    description: 'Count of listings that pass the leveraged health checks.'
  },
  health: {
    label: 'Health',
    description: 'Traffic-light rating from cash flow, return, debt coverage, and rate stress checks.'
  },
  healthMode: {
    label: 'Health mode',
    description: 'Shows whether leveraged health checks are active or hidden.'
  },
  holdMonths: {
    label: 'Hold period',
    description: 'Expected months before exit. Useful for annualizing returns and interest costs.'
  },
  instantEquity: {
    label: 'Instant equity',
    description: 'Estimated value gained at purchase from buying below market. Useful for downside protection.'
  },
  interestCost: {
    label: 'Interest cost',
    description: 'Estimated financing interest over the strategy period. Useful for understanding leverage drag.'
  },
  loanAmount: {
    label: 'Loan amount',
    description: 'Estimated borrowed principal. Useful for understanding debt exposure.'
  },
  loanTermYears: {
    label: 'Loan term',
    description: 'Mortgage length in years. Useful for calculating monthly payments.'
  },
  longTermComparison: {
    label: 'Vs long-term rent',
    description: 'Short-term rental result compared with long-term rental income. Useful for choosing rental strategy.'
  },
  longTermMonthlyCashFlow: {
    label: 'Long-term cash flow',
    description: 'Estimated monthly cash flow using long-term rent. Useful as a fallback comparison for Airbnb deals.'
  },
  longTermMonthlyRent: {
    label: 'Long-term monthly rent',
    description: 'Estimated monthly rent for a traditional lease. Useful for comparing Airbnb against a simpler rental strategy.'
  },
  ltvPct: {
    label: 'LTV',
    description: 'Loan-to-value ratio. Useful for calculating loan size and financing risk.'
  },
  managementFeePct: {
    label: 'Management fee',
    description: 'Share of rent reserved for property management. Useful for net income estimates.'
  },
  marketValue: {
    label: 'Market value',
    description: 'Estimated fair value from neighborhood pricing. Useful for identifying discounts.'
  },
  monthlyCashFlow: {
    label: 'Monthly cash flow',
    description: 'Monthly income left after operating costs and debt service. Useful for checking if the deal pays for itself.'
  },
  monthlyRent: {
    label: 'Monthly rent',
    description: 'Estimated long-term monthly rent. Useful for yield and cash flow calculations.'
  },
  monthlyRevenue: {
    label: 'Monthly revenue',
    description: 'Estimated Airbnb gross monthly revenue before expenses. Useful for short-term rental screening.'
  },
  monthlyPayment: {
    label: 'Monthly payment',
    description: 'Estimated monthly mortgage payment. Useful for judging debt burden.'
  },
  mortgageRate: {
    label: 'Mortgage rate',
    description: 'Annual interest rate used for leveraged calculations and stress checks.'
  },
  netYieldPct: {
    label: 'Net yield',
    description: 'Annual net rental income divided by purchase price. Useful for comparing rental efficiency.'
  },
  noi: {
    label: 'NOI',
    description: 'Net operating income after expected operating costs. Useful for rental return and debt coverage checks.'
  },
  occupancyPct: {
    label: 'Occupancy',
    description: 'Expected share of nights booked for Airbnb. Useful for estimating short-term rental revenue.'
  },
  operatingExpensePct: {
    label: 'Operating expense',
    description: 'Share of Airbnb revenue reserved for operating costs. Useful for net short-term rental income.'
  },
  originationFeePct: {
    label: 'Origination fee',
    description: 'Loan setup fee as a share of borrowed amount. Useful for calculating upfront financing costs.'
  },
  originationFee: {
    label: 'Origination fee',
    description: 'Estimated loan setup cost in euros. Useful for calculating financing cash needs.'
  },
  paybackYears: {
    label: 'Payback period',
    description: 'Years needed for income to recover the investment. Useful for comparing capital recovery speed.'
  },
  potentialProfit: {
    label: 'Potential profit',
    description: 'Estimated euro upside after the strategy assumptions. Useful for sizing the opportunity.'
  },
  price: {
    label: 'Price',
    description: 'Listing asking price. Useful as the base for all return and financing calculations.'
  },
  priceEur: {
    label: 'Price',
    description: 'Listing asking price. Useful as the base for all return and financing calculations.'
  },
  pricePerSqm: {
    label: 'Price per sqm',
    description: 'Asking price divided by area. Useful for comparing listings across neighborhoods and sizes.'
  },
  profit: {
    label: 'Profit',
    description: 'Estimated euro gain after costs. Useful for understanding total upside.'
  },
  property: {
    label: 'Property',
    description: 'Listing title and location. Useful for identifying the deal.'
  },
  purchasePrice: {
    label: 'Purchase price',
    description: 'Assumed acquisition price used by the strategy. Useful as the baseline for returns and costs.'
  },
  rateSensitivity: {
    label: 'Rate sensitivity',
    description: 'Cash flow at different mortgage rates. Useful for judging interest-rate risk.'
  },
  rateStressPct: {
    label: 'Rate stress',
    description: 'Interest-rate buffer added during health checks. Useful for testing whether a deal survives rate increases.'
  },
  redCount: {
    label: 'Red',
    description: 'Count of listings that fail leveraged health checks.'
  },
  results: {
    label: 'Results',
    description: 'Number of listings matching the current strategy and filters.'
  },
  refinanceLoan: {
    label: 'Refinance loan',
    description: 'Expected loan amount after refinance. Useful for BRRRR cash recovery estimates.'
  },
  rehabCost: {
    label: 'Rehab cost',
    description: 'Estimated renovation budget. Useful for judging total investment and resale upside.'
  },
  roiPct: {
    label: 'ROI',
    description: 'Return on investment before annualization. Useful for comparing total return against cash required.'
  },
  score: {
    label: 'Score',
    description: 'Strategy ranking score. Useful for sorting the strongest matches first.'
  },
  targetGrossYieldPct: {
    label: 'Target gross yield',
    description: 'Desired rent before expenses as a share of price. Useful for quick rental screening.'
  },
  targetNetYieldPct: {
    label: 'Target net yield',
    description: 'Desired rent after expenses as a share of price. Useful for judging real rental performance.'
  },
  totalInvestment: {
    label: 'Total investment',
    description: 'Purchase price plus strategy costs. Useful for calculating total return.'
  },
  transactionCosts: {
    label: 'Transaction costs',
    description: 'Estimated buying and selling costs. Useful for keeping profit estimates realistic.'
  },
  vacancyPct: {
    label: 'Vacancy',
    description: 'Expected share of time without rent. Useful for conservative net income estimates.'
  },
  yellowCount: {
    label: 'Yellow',
    description: 'Count of listings with acceptable but weaker leveraged health checks.'
  },
  leveragedProfit: {
    label: 'Leveraged profit',
    description: 'Estimated profit after financing costs. Useful for seeing how debt changes the strategy result.'
  },
  leveragedRoiPct: {
    label: 'Leveraged ROI',
    description: 'Return on cash invested when using debt. Useful for comparing financed opportunities.'
  },
  leveragedPaybackYears: {
    label: 'Leveraged payback period',
    description: 'Years needed for leveraged cash flow to recover cash invested. Useful for judging capital recovery with debt.'
  },
  lastScrape: {
    label: 'Last scrape',
    description: 'Most recent scraper run status and date. Useful for judging how fresh the data is.'
  }
};

export function humanizeKey(key) {
  if (key == null || key === '') return 'Unknown';

  const spaced = String(key)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();

  if (!spaced) return 'Unknown';

  const words = spaced.split(/\s+/).map((word) => acronyms.get(word) ?? word);
  const first = words[0];
  const capitalizedFirst = acronyms.has(String(first).toLowerCase())
    ? first
    : `${first.charAt(0).toUpperCase()}${first.slice(1)}`;

  return [capitalizedFirst, ...words.slice(1)].join(' ');
}

export function getLabelMeta(key) {
  const metadata = labelMetadata[key];
  if (metadata) {
    return {
      key,
      label: metadata.label,
      description: metadata.description ?? ''
    };
  }

  return {
    key,
    label: humanizeKey(key),
    description: ''
  };
}

export function getLabel(key) {
  return getLabelMeta(key).label;
}
```

- [ ] **Step 4: Run the metadata tests**

Run:

```powershell
node --test client/src/lib/labels.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

Run:

```powershell
git -c core.excludesfile= add client/src/lib/labels.js client/src/lib/labels.test.js
git -c core.excludesfile= commit -m "Add label metadata helpers"
```

## Task 2: Keep Strategy Label Exports Compatible

**Files:**
- Modify: `client/src/lib/strategies.js`
- Modify: `client/src/lib/strategies.test.js`

- [ ] **Step 1: Extend the strategy test**

Modify `client/src/lib/strategies.test.js` to import `metricLabels` and add a test:

```js
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { getStrategy, metricLabels, strategyList } from './strategies.js';

describe('strategy frontend definitions', () => {
  test('defines all server strategy routes with cash and leveraged columns', () => {
    assert.deepEqual(strategyList.map((strategy) => strategy.id), [
      'buy-in-green',
      'brrrr',
      'flip',
      'cash-flow',
      'airbnb',
      'below-market'
    ]);

    for (const strategy of strategyList) {
      assert.ok(strategy.label);
      assert.ok(strategy.path);
      assert.ok(strategy.cashColumns.length > 0);
      assert.ok(strategy.leveragedColumns.length > 0);
    }
  });

  test('looks up unknown strategies with a stable fallback', () => {
    assert.equal(getStrategy('cash-flow').label, 'Cash Flow Rental');
    assert.equal(getStrategy('missing').id, 'missing');
  });

  test('derives readable metric labels from shared metadata', () => {
    assert.equal(metricLabels.cocPct, 'Cash-on-cash return');
    assert.equal(metricLabels.monthlyCashFlow, 'Monthly cash flow');
    assert.equal(metricLabels.breakEvenRate, 'Break-even rate');
  });
});
```

- [ ] **Step 2: Run the strategy test to verify failure**

Run:

```powershell
node --test client/src/lib/strategies.test.js
```

Expected: FAIL because `metricLabels.cocPct` is still `CoC`.

- [ ] **Step 3: Derive `metricLabels` from shared metadata**

Modify `client/src/lib/strategies.js`:

```js
import { getLabel } from './labels.js';

export const strategyList = [
  {
    id: 'buy-in-green',
    label: 'Buy in Green',
    path: '/strategy/buy-in-green',
    tone: 'emerald',
    cashColumns: ['appreciationPct', 'potentialProfit', 'holdMonths'],
    leveragedColumns: ['leveragedRoiPct', 'leveragedProfit', 'interestCost']
  },
  {
    id: 'brrrr',
    label: 'BRRRR',
    path: '/strategy/brrrr',
    tone: 'indigo',
    cashColumns: ['arv', 'netYieldPct', 'monthlyRent'],
    leveragedColumns: ['monthlyCashFlow', 'cocPct', 'dscr']
  },
  {
    id: 'flip',
    label: 'Fix & Flip',
    path: '/strategy/flip',
    tone: 'amber',
    cashColumns: ['profit', 'roiPct', 'annualizedRoiPct'],
    leveragedColumns: ['leveragedProfit', 'leveragedRoiPct', 'interestCost']
  },
  {
    id: 'cash-flow',
    label: 'Cash Flow Rental',
    path: '/strategy/cash-flow',
    tone: 'sky',
    cashColumns: ['monthlyRent', 'netYieldPct', 'paybackYears'],
    leveragedColumns: ['monthlyCashFlow', 'cocPct', 'breakEvenRate']
  },
  {
    id: 'airbnb',
    label: 'Airbnb',
    path: '/strategy/airbnb',
    tone: 'rose',
    cashColumns: ['monthlyRevenue', 'netYieldPct', 'longTermComparison'],
    leveragedColumns: ['monthlyCashFlow', 'cocPct', 'longTermMonthlyCashFlow']
  },
  {
    id: 'below-market',
    label: 'Below Market',
    path: '/strategy/below-market',
    tone: 'teal',
    cashColumns: ['discountPct', 'discountAmount', 'daysOnMarket'],
    leveragedColumns: ['instantEquity', 'effectiveLtvPct', 'equityOnCashRatio']
  }
];

export function getStrategy(id) {
  return (
    strategyList.find((strategy) => strategy.id === id) ?? {
      id,
      label: id,
      path: `/strategy/${id}`,
      tone: 'slate',
      cashColumns: [],
      leveragedColumns: []
    }
  );
}

const metricLabelKeys = [
  'appreciationPct',
  'potentialProfit',
  'holdMonths',
  'leveragedRoiPct',
  'leveragedProfit',
  'interestCost',
  'arv',
  'netYieldPct',
  'monthlyRent',
  'paybackYears',
  'monthlyCashFlow',
  'cocPct',
  'dscr',
  'profit',
  'roiPct',
  'annualizedRoiPct',
  'monthlyRevenue',
  'longTermComparison',
  'longTermMonthlyCashFlow',
  'discountPct',
  'discountAmount',
  'daysOnMarket',
  'instantEquity',
  'effectiveLtvPct',
  'equityOnCashRatio',
  'breakEvenRate'
];

export const metricLabels = Object.fromEntries(metricLabelKeys.map((key) => [key, getLabel(key)]));
```

- [ ] **Step 4: Run related tests**

Run:

```powershell
node --test client/src/lib/labels.test.js client/src/lib/strategies.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

Run:

```powershell
git -c core.excludesfile= add client/src/lib/strategies.js client/src/lib/strategies.test.js
git -c core.excludesfile= commit -m "Use shared metadata for strategy metric labels"
```

## Task 3: Reusable Tooltip Label Component

**Files:**
- Create: `client/src/components/MetricLabel.jsx`

- [ ] **Step 1: Create the component**

Create `client/src/components/MetricLabel.jsx`:

```jsx
import { Info } from 'lucide-react';
import { getLabelMeta } from '../lib/labels.js';

const sizeClasses = {
  card: 'text-xs font-medium uppercase text-slate-500',
  default: 'text-sm font-medium text-slate-700',
  table: 'text-xs font-semibold uppercase text-slate-500',
  metric: 'text-xs text-slate-500'
};

export default function MetricLabel({ labelKey, label, description, variant = 'default', className = '' }) {
  const metadata = labelKey ? getLabelMeta(labelKey) : { label: label ?? 'Unknown', description: description ?? '' };
  const displayLabel = label ?? metadata.label;
  const tooltip = description ?? metadata.description;
  const textClass = `${sizeClasses[variant] ?? sizeClasses.default} ${className}`.trim();

  return (
    <span className="group/metric-label relative inline-flex max-w-full items-center gap-1 align-middle">
      <span className={textClass}>{displayLabel}</span>
      {tooltip ? (
        <span className="relative inline-flex">
          <span
            tabIndex={0}
            aria-label={`${displayLabel}: ${tooltip}`}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 outline-none transition hover:text-slate-700 focus:text-slate-700 focus:ring-2 focus:ring-slate-300"
          >
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span
            role="tooltip"
            className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-64 -translate-x-1/2 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-xs font-normal normal-case leading-snug text-slate-700 shadow-lg group-hover/metric-label:block group-focus-within/metric-label:block"
          >
            {tooltip}
          </span>
        </span>
      ) : null}
    </span>
  );
}
```

- [ ] **Step 2: Run the client build**

Run:

```powershell
npm.cmd run build --workspace client
```

Expected: PASS. There are no component tests yet because the project currently has no React test renderer dependency.

- [ ] **Step 3: Commit Task 3**

Run:

```powershell
git -c core.excludesfile= add client/src/components/MetricLabel.jsx
git -c core.excludesfile= commit -m "Add reusable metric label tooltip"
```

## Task 4: Integrate Labels Into Detail Metrics And Cards

**Files:**
- Modify: `client/src/components/MetricCard.jsx`
- Modify: `client/src/pages/PropertyDetail.jsx`

- [ ] **Step 1: Update `MetricCard` to use `MetricLabel`**

Replace `client/src/components/MetricCard.jsx` with:

```jsx
import MetricLabel from './MetricLabel.jsx';

export default function MetricCard({ label, labelKey, value, detail, tone = 'slate' }) {
  const toneClass = {
    slate: 'border-slate-200',
    green: 'border-emerald-200',
    yellow: 'border-amber-200',
    red: 'border-rose-200',
    blue: 'border-sky-200'
  }[tone] ?? 'border-slate-200';

  return (
    <div className={`rounded-md border bg-white p-4 ${toneClass}`}>
      <MetricLabel labelKey={labelKey} label={label} variant="card" />
      <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
      {detail ? <p className="mt-1 text-sm text-slate-500">{detail}</p> : null}
    </div>
  );
}
```

- [ ] **Step 2: Update property detail imports and metric cards**

Modify the imports in `client/src/pages/PropertyDetail.jsx`:

```jsx
import { ExternalLink } from 'lucide-react';
import { useParams } from 'react-router-dom';
import HealthBadge from '../components/HealthBadge.jsx';
import MetricCard from '../components/MetricCard.jsx';
import MetricLabel from '../components/MetricLabel.jsx';
import PriceChart from '../components/PriceChart.jsx';
import RateSensitivity from '../components/RateSensitivity.jsx';
import { ErrorState, LoadingState } from '../components/StatusViews.jsx';
import { useProperty } from '../api/client.js';
import { formatCashFlow, formatEur, formatPercent, formatSqm } from '../lib/formatters.js';
import { getStrategy } from '../lib/strategies.js';
```

Change the top metric cards:

```jsx
<MetricCard labelKey="price" value={formatEur(property.priceEur)} />
<MetricCard labelKey="area" value={formatSqm(property.areaSqm)} />
<MetricCard labelKey="pricePerSqm" value={formatEur(property.pricePerSqm)} />
<MetricCard labelKey="condition" value={property.condition ?? '-'} />
```

- [ ] **Step 3: Update detail metric list labels**

In `MetricList`, replace the `<dt>` line:

```jsx
<dt>
  <MetricLabel labelKey={key} variant="metric" />
</dt>
```

The full `MetricList` function should become:

```jsx
function MetricList({ title, metrics }) {
  if (!metrics) {
    return <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">{title}: not active</div>;
  }
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-sm font-semibold">{title}</p>
      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
        {Object.entries(metrics).slice(0, 10).map(([key, value]) => (
          <div key={key}>
            <dt>
              <MetricLabel labelKey={key} variant="metric" />
            </dt>
            <dd className="font-medium">{formatMetric(key, value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
```

- [ ] **Step 4: Run build**

Run:

```powershell
npm.cmd run build --workspace client
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

Run:

```powershell
git -c core.excludesfile= add client/src/components/MetricCard.jsx client/src/pages/PropertyDetail.jsx
git -c core.excludesfile= commit -m "Show tooltips on property detail metrics"
```

## Task 5: Integrate Labels Into Overview And Strategy Cards

**Files:**
- Modify: `client/src/pages/Overview.jsx`
- Modify: `client/src/pages/StrategyView.jsx`

- [ ] **Step 1: Add label keys to overview cards**

In `client/src/pages/Overview.jsx`, update the four `MetricCard` calls:

```jsx
<MetricCard labelKey="activeListings" value={formatNumber(overview.data.totalListings)} />
<MetricCard labelKey="mortgageRate" value={formatPercent(leverage.mortgageRate)} detail={`${leverage.loanTermYears} years, ${formatPercent(leverage.ltvPct, 0)} LTV`} />
<MetricCard labelKey="lastScrape" value={overview.data.lastScrape?.status ?? 'none'} detail={formatDate(overview.data.lastScrape?.started_at)} />
<MetricCard labelKey="healthMode" value={leverage.enabled ? 'Leveraged' : 'Cash-only'} detail={leverage.enabled ? 'Traffic lights active' : 'Leveraged columns hidden'} />
```

- [ ] **Step 2: Add label keys to strategy view cards**

In `client/src/pages/StrategyView.jsx`, update the four `MetricCard` calls:

```jsx
<MetricCard labelKey="results" value={formatNumber(summary.total ?? 0)} />
<MetricCard labelKey="coc" value={formatPercent(summary.avgCocPct)} />
<MetricCard labelKey="greenCount" value={health.green} tone="green" />
<MetricCard labelKey="redCount" value={health.red} tone="red" />
```

- [ ] **Step 3: Run build**

Run:

```powershell
npm.cmd run build --workspace client
```

Expected: PASS.

- [ ] **Step 4: Commit Task 5**

Run:

```powershell
git -c core.excludesfile= add client/src/pages/Overview.jsx client/src/pages/StrategyView.jsx
git -c core.excludesfile= commit -m "Add metadata labels to summary cards"
```

## Task 6: Integrate Labels Into Strategy Table Headers

**Files:**
- Modify: `client/src/components/PropertyTable.jsx`

- [ ] **Step 1: Import `MetricLabel`**

Add this import:

```jsx
import MetricLabel from './MetricLabel.jsx';
```

- [ ] **Step 2: Replace string headers with label components**

Change the column headers in `client/src/components/PropertyTable.jsx`:

```jsx
{
  id: 'health',
  header: <MetricLabel labelKey="health" variant="table" />,
  accessorFn: (row) => row.health,
  cell: ({ getValue }) => <HealthBadge health={getValue()} size="sm" />
}
```

Use these replacements for the other headers:

```jsx
header: <MetricLabel labelKey="score" variant="table" />
header: <MetricLabel labelKey="property" variant="table" />
header: <MetricLabel labelKey="price" variant="table" />
header: <MetricLabel labelKey="area" variant="table" />
header: <MetricLabel labelKey="netYieldPct" variant="table" />
header: <MetricLabel labelKey="cashFlow" variant="table" />
header: <MetricLabel labelKey="coc" variant="table" />
header: <MetricLabel labelKey="breakEvenRate" variant="table" />
```

Keep the existing table render logic:

```jsx
<button className="font-semibold" onClick={header.column.getToggleSortingHandler()}>
  {flexRender(header.column.columnDef.header, header.getContext())}
</button>
```

- [ ] **Step 3: Run build**

Run:

```powershell
npm.cmd run build --workspace client
```

Expected: PASS and sortable headers should still compile.

- [ ] **Step 4: Commit Task 6**

Run:

```powershell
git -c core.excludesfile= add client/src/components/PropertyTable.jsx
git -c core.excludesfile= commit -m "Add tooltips to strategy table headers"
```

## Task 7: Integrate Labels Into Settings Fields

**Files:**
- Modify: `client/src/pages/Settings.jsx`

- [ ] **Step 1: Import `MetricLabel`**

Add:

```jsx
import MetricLabel from '../components/MetricLabel.jsx';
```

- [ ] **Step 2: Pass metadata keys to settings fields**

Update field calls in `client/src/pages/Settings.jsx`:

```jsx
<Field labelKey="targetGrossYieldPct" value={form.general.targetGrossYieldPct} onChange={(value) => patch('general', 'targetGrossYieldPct', value)} />
<Field labelKey="targetNetYieldPct" value={form.general.targetNetYieldPct} onChange={(value) => patch('general', 'targetNetYieldPct', value)} />
<Field labelKey="vacancyPct" value={form.general.vacancyPct} onChange={(value) => patch('general', 'vacancyPct', value)} />
<Field labelKey="managementFeePct" value={form.general.managementFeePct} onChange={(value) => patch('general', 'managementFeePct', value)} />
```

```jsx
<Field labelKey="mortgageRate" value={form.leverage.mortgageRate} onChange={(value) => patch('leverage', 'mortgageRate', value)} />
<Field labelKey="loanTermYears" value={form.leverage.loanTermYears} onChange={(value) => patch('leverage', 'loanTermYears', value)} />
<Field labelKey="downPaymentPct" value={form.leverage.downPaymentPct} onChange={(value) => patch('leverage', 'downPaymentPct', value)} />
<Field labelKey="ltvPct" value={form.leverage.ltvPct} onChange={(value) => patch('leverage', 'ltvPct', value)} />
<Field labelKey="originationFeePct" value={form.leverage.originationFeePct} onChange={(value) => patch('leverage', 'originationFeePct', value)} />
<Field labelKey="annualInsuranceEur" value={form.leverage.annualInsuranceEur} onChange={(value) => patch('leverage', 'annualInsuranceEur', value)} />
```

```jsx
<Field labelKey="cocGreenPct" value={form.flags.cocGreenPct} onChange={(value) => patch('flags', 'cocGreenPct', value)} />
<Field labelKey="cocYellowPct" value={form.flags.cocYellowPct} onChange={(value) => patch('flags', 'cocYellowPct', value)} />
<Field labelKey="dscrMinimum" value={form.flags.dscrMinimum} onChange={(value) => patch('flags', 'dscrMinimum', value)} />
<Field labelKey="rateStressPct" value={form.flags.rateStressPct} onChange={(value) => patch('flags', 'rateStressPct', value)} />
```

```jsx
<Field labelKey="occupancyPct" value={form.airbnb.occupancyPct} onChange={(value) => patch('airbnb', 'occupancyPct', value)} />
<Field labelKey="dailyRateEur" value={form.airbnb.dailyRateEur} onChange={(value) => patch('airbnb', 'dailyRateEur', value)} />
<Field labelKey="operatingExpensePct" value={form.airbnb.operatingExpensePct} onChange={(value) => patch('airbnb', 'operatingExpensePct', value)} />
```

- [ ] **Step 3: Replace the `Field` helper**

Replace the `Field` function with:

```jsx
function Field({ labelKey, label, value, onChange }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block">
        <MetricLabel labelKey={labelKey} label={label} />
      </span>
      <input className="input" type="number" step="0.01" value={value ?? ''} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
```

- [ ] **Step 4: Run build**

Run:

```powershell
npm.cmd run build --workspace client
```

Expected: PASS.

- [ ] **Step 5: Commit Task 7**

Run:

```powershell
git -c core.excludesfile= add client/src/pages/Settings.jsx
git -c core.excludesfile= commit -m "Add tooltips to settings labels"
```

## Task 8: Final Verification

**Files:**
- No code changes expected unless verification finds a defect.

- [ ] **Step 1: Run focused client tests**

Run:

```powershell
node --test client/src/lib/labels.test.js client/src/lib/strategies.test.js client/src/lib/formatters.test.js client/src/api/client.test.js
```

Expected: PASS.

- [ ] **Step 2: Run full client build**

Run:

```powershell
npm.cmd run build --workspace client
```

Expected: PASS.

- [ ] **Step 3: Inspect for raw metric label fallback usage**

Run:

```powershell
rg "metricLabels\\[|label=\\\"Avg CoC\\\"|label=\\\"Price/sqm\\\"|label=\\\"Breakeven\\\"|label=\\\"CoC" client/src
```

Expected: no matches for user-facing old label strings except intentional metadata labels or tests.

- [ ] **Step 4: Commit any verification fixes**

If Step 3 finds stale labels, replace them with `labelKey` usage or metadata labels, then run:

```powershell
npm.cmd run build --workspace client
git -c core.excludesfile= add client/src
git -c core.excludesfile= commit -m "Clean up stale metric labels"
```

Expected: build passes and the commit contains only stale-label cleanup.
