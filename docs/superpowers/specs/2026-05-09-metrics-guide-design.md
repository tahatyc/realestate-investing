# Metrics Guide Page Design

## Goal

Add a user-facing `Metrics Guide` page that explains every major metric, strategy, and supporting system in the application. The page should help an investor understand what the app is calculating, where assumptions come from, how scores are chosen, and what simplified estimates are currently used.

The guide must reflect the current implementation rather than an idealized future model. Where the code uses simplified assumptions, the guide should say so plainly.

## Scope

Build a static in-app reference page at `/metrics-guide` and add it to the main navigation. The page covers:

- Data ingestion and freshness: scraped listings, price history, active listings, and last scrape status.
- Settings and assumptions: general rental targets, vacancy, management fee, leverage, Airbnb assumptions, and health thresholds.
- Leverage and mortgage math: loan amount, down payment, monthly payment, origination fee, interest-only carry cost, DSCR, break-even rate, and rate sensitivity.
- Health flags and traffic-light ratings.
- Strategy systems and scoring for Buy in Green, BRRRR, Fix & Flip, Cash Flow Rental, Airbnb, and Below Market.
- Neighborhood metrics, including price per sqm and yield context.
- A glossary of important metrics shown across cards, tables, and property detail pages.

The first version does not add a backend documentation endpoint, editable formulas, live examples, or an interactive calculator.

## Content Source

Create a dedicated client-side guide content module at `client/src/lib/metricsGuide.js`. Do not put long-form reference copy into `client/src/lib/labels.js`; that file should remain the short label and tooltip metadata registry.

The content module should export structured data for rendering:

- `systemGuides`: data pipeline, settings, leverage, mortgage math, rate sensitivity, health flags, neighborhoods.
- `strategyGuides`: one guide entry per strategy in `client/src/lib/strategies.js`.
- `metricGlossary`: important metric entries grouped by topic.

Each strategy guide entry should include:

- The strategy name and id.
- What the strategy is trying to identify.
- Main inputs used by the current code.
- Cash metrics.
- Leveraged metrics.
- Score behavior when leverage is off and when leverage is on.
- Current simplified assumptions and caveats.

The guide may reuse label names from `getLabel()` or `MetricLabel` where useful, but the explanatory content should be authored explicitly so it can describe formulas and caveats in full.

## Current Calculation Details To Document

The page should document these current formulas and implementation details:

### Shared Rental And Leverage Math

- Estimated monthly rent: `price * targetGrossYieldPct / 100 / 12`.
- Monthly NOI: `monthlyRent * (1 - (vacancyPct + managementFeePct) / 100)`.
- Loan amount: `price * ltvPct / 100`.
- Down payment: `price * downPaymentPct / 100`.
- Origination fee: `loanAmount * originationFeePct / 100`.
- Monthly mortgage payment: fixed amortizing principal-and-interest payment from principal, annual rate, and loan term.
- Interest-only carry cost: `principal * mortgageRate / 100 / 12 * months`.
- Monthly cash flow: `monthlyNOI - monthlyPayment - annualInsurance / 12`.
- Cash-on-cash return: `monthlyCashFlow * 12 / cashInvested * 100`.
- DSCR: `monthlyNOI / monthlyDebtService`.
- Break-even rate: the mortgage rate where monthly cash flow reaches zero, found by searching between 0% and 20%.
- Rate sensitivity: monthly payment and cash flow at current mortgage rate, current + 1%, and current + 2%.

### Health Flags

- `NEGATIVE_CASH_FLOW`: monthly cash flow is below zero.
- `LOW_DSCR`: DSCR is below the configured minimum.
- `RATE_SENSITIVE`: break-even rate is at or below current rate plus the configured stress buffer.
- `STRONG_LEVERAGED_RETURN`: cash-on-cash return clears the green threshold and cash flow is positive.
- `REFINANCE_VIABLE`: refinance coverage is above 75%.
- `INSTANT_EQUITY`: estimated discount amount is larger than the down payment.

Health rating behavior:

- Green: cash-on-cash return clears the green threshold, cash flow is positive, and DSCR clears the minimum.
- Yellow: default leveraged state when a deal is neither green nor red.
- Red: cash flow is negative while cash-on-cash is below the yellow threshold, or break-even rate is at or below the current mortgage rate.
- When leverage is off, leveraged metrics, health, flags, rate sensitivity, and break-even rate are hidden; score falls back to the cash score.

### Strategy Systems

Buy in Green:

- Future value uses the greater of neighborhood average finished price per sqm and current price per sqm increased by 15%, multiplied by area.
- Potential profit is future value minus price.
- Appreciation is potential profit divided by price.
- Hold months are based on construction stage: act 14 uses 18 months, act 15 uses 8 months, otherwise 6 months.
- Leveraged profit subtracts interest carry cost and origination fee.
- Leveraged ROI is leveraged profit divided by down payment.
- Cash score is potential profit; leveraged score is leveraged ROI.

BRRRR:

- Rehab cost is `area * 300`.
- ARV is the greater of neighborhood average price per sqm times area and price increased by 15%.
- Total investment is price plus rehab cost.
- Rent is estimated from ARV using the shared gross yield setting.
- Gross and net yields use total investment.
- Refinance loan is `ARV * ltvPct / 100`.
- Cash left in deal is `max(totalInvestment - refinanceLoan, 0)`.
- Cash-on-cash uses cash left in deal when cash remains after refinance.
- Cash score is net yield; leveraged score is monthly cash flow.

Fix & Flip:

- Rehab cost is `area * 300`.
- ARV is the greater of neighborhood average price per sqm times area and price increased by 12%.
- Transaction costs are `price * 0.03`.
- Profit is ARV minus price, rehab cost, and transaction costs.
- Total investment is price plus rehab cost plus transaction costs.
- ROI is profit divided by total investment.
- Annualized ROI currently doubles ROI, matching a six-month flip assumption.
- Leveraged profit subtracts interest carry cost and origination fee.
- Cash deployed is down payment plus rehab cost.
- Cash score is ROI; leveraged score is leveraged ROI.

Cash Flow Rental:

- Rent and NOI use the shared rental assumptions.
- Gross yield is annual rent divided by price.
- Net yield is annual NOI divided by price.
- Cap rate is currently the same value as net yield.
- Payback years are `100 / netYieldPct` when net yield is positive.
- Leveraged metrics come from shared rental leverage math.
- Cash score is net yield; leveraged score is cash-on-cash return.

Airbnb:

- Monthly revenue is `dailyRateEur * 30 * occupancyPct / 100`.
- Operating expenses are `monthlyRevenue * operatingExpensePct / 100`.
- Monthly NOI is revenue minus operating expenses.
- Net yield is annual Airbnb NOI divided by price.
- Long-term NOI is calculated from the shared rental assumptions for comparison.
- Long-term comparison is Airbnb NOI divided by long-term NOI.
- Leveraged metrics use Airbnb NOI; the guide should also explain long-term monthly cash flow comparison.
- Cash score is Airbnb net yield; leveraged score is cash-on-cash return.

Below Market:

- Market value is the greater of neighborhood average price per sqm times area and price.
- Discount amount is market value minus price.
- Discount percentage is discount amount divided by market value.
- Days on market comes from the first seen timestamp.
- Price drops count decreases in recorded price history.
- Effective LTV is loan amount divided by market value.
- Equity-to-cash ratio is discount amount divided by down payment.
- Cash score is discount percentage.
- Leveraged score is discount percentage plus equity-to-cash ratio times 10.

## UI Design

Add `client/src/pages/MetricsGuide.jsx`.

The page should match the existing app style:

- Compact dashboard page header with a plain-language description.
- Full-width sections with constrained inner content.
- Repeated reference cards for strategy guides and metric groups.
- Formula rows using small, readable text rather than large code blocks.
- No marketing hero, no decorative illustration, and no unrelated visuals.

Use local presentational components inside `MetricsGuide.jsx`:

- `GuideSection`: titled section with optional intro copy.
- `FormulaBlock`: rows of label, readable formula, and explanation.
- `StrategyGuideCard`: repeated strategy explanation.
- `MetricGlossaryTable`: grouped glossary of metric names, meanings, and formulas.

The page should be readable on mobile. Long formulas should wrap cleanly instead of overflowing.

## Navigation

Add a main navigation item named `Metrics Guide`, routed to `/metrics-guide`.

Place it after `Overview` in the sidebar and include it in the mobile horizontal navigation. Use the existing Lucide `BookOpen` icon.

Add a route in `client/src/App.jsx`.

## Testing

Add focused tests for the guide content module:

- Every strategy id in `strategyList` has a matching guide entry.
- Every strategy guide references the metric keys shown in that strategy's cash and leveraged columns.
- Required system guide ids are present: data freshness, settings, leverage, mortgage payment, rate sensitivity, health flags, neighborhoods.
- Important formula or assumption references are present for mortgage payment, break-even rate, `area * 300`, Airbnb revenue, and leverage-off score behavior.

Existing client build and test commands should be used after implementation.

## Out Of Scope

- Changing any calculation behavior.
- Adding backend metadata endpoints.
- Making formulas editable from the guide page.
- Adding live deal examples or an interactive calculator.
- Reworking the existing tooltip label registry beyond optional label reuse.
- Changing strategy table columns or property detail metric rendering.

## Risks And Mitigations

Risk: The guide can drift from implementation as formulas change.

Mitigation: Keep guide content in one structured module with tests that verify strategy coverage and required formula references. Future calculation changes should update the guide module in the same change.

Risk: The page becomes too dense for non-technical users.

Mitigation: Lead each section with plain-language explanations and keep formulas in compact supporting rows.

Risk: Duplicating label descriptions creates inconsistent wording.

Mitigation: Reuse label names from existing metadata where helpful, but allow the guide to have fuller explanations than tooltips.
