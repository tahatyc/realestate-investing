# Detail Metric Value Colors Design

## Context

The property details page now shows readable strategy metric labels with tooltips. The numeric values in the `Cash metrics` and `Leveraged metrics` lists are still visually neutral, even when a value is clearly favorable or unfavorable.

The goal is to add red/green value coloring to analytical outcome metrics on the property details page without implying that neutral inputs such as price, rent, loan amount, costs, or area are good or bad.

## Approved Approach

Use outcome-only sign coloring on the property detail strategy metric lists.

Coloring rules:

- Positive values on outcome metrics render green.
- Negative values on outcome metrics render red.
- Zero values render neutral.
- Missing, null, non-numeric, and non-outcome values render neutral.

Outcome metrics include keys whose meaning is naturally better when positive:

- Profit and upside: `profit`, `potentialProfit`, `leveragedProfit`.
- Cash flow: `cashFlow`, `monthlyCashFlow`, `longTermMonthlyCashFlow`.
- Return and yield: `roi`, `roiPct`, `leveragedRoiPct`, `annualizedRoiPct`, `yield`, `netYieldPct`, `cocPct`.
- Discount and equity: `discountPct`, `discountAmount`, `instantEquity`, `equityOnCashRatio`.
- Growth or comparison: `appreciationPct`, `longTermComparison`.

Neutral metrics stay uncolored even when positive:

- Prices and values: purchase price, listing price, ARV, market value.
- Financing amounts: loan amount, refinance loan, down payment, monthly payment.
- Costs and fees: rehab cost, transaction costs, interest cost, origination fee.
- Operational assumptions: rent, revenue, NOI, LTV, DSCR, hold period, days on market, payback period, rate sensitivity.

## UI Scope

Apply coloring only to values inside `PropertyDetail.jsx` strategy metric lists:

- `Cash metrics`
- `Leveraged metrics`

Do not change:

- Summary metric cards.
- Strategy table rows.
- Settings fields.
- Charts.
- Health badges.
- Backend strategy result data.

## Implementation Shape

Add a small helper for determining the value color class in `client/src/lib/metricValueStyles.js`, with tests in `client/src/lib/metricValueStyles.test.js`.

`MetricList` will apply the returned class to the `<dd>` value element. The existing `formatMetric` behavior remains unchanged.

The helper should accept the metric key and raw value, not the formatted value, so numeric parsing stays reliable.

## Testing And Verification

Add focused tests for the color decision helper. Cover:

- Positive outcome metric returns green.
- Negative outcome metric returns red.
- Zero outcome metric returns neutral.
- Positive neutral metric returns neutral.
- Null and non-numeric values return neutral.

Run client tests and the client build after implementation.

## Out Of Scope

- Per-metric lower-is-better coloring.
- Coloring metric cards or table cells.
- Changing number formatting.
- Changing calculation logic.
