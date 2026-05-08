# Real Estate Investment Analyzer — Requirements Specification

## 1. Project Overview

A locally-run web application that scrapes property listings from **imot.bg** (Sofia, Bulgaria), analyzes them through multiple real estate investment strategy lenses, and presents results in an interactive dashboard with key financial metrics.

**User**: Solo investor evaluating Bulgarian RE market opportunities.
**Trigger**: Manual — user initiates scraping on demand.
**Scope**: Apartments and houses for sale + rental listings in Sofia.

---

## 2. Functional Requirements

### 2.1 Data Scraping (imot.bg)

**FR-1**: Scrape **sale listings** (apartments + houses) in Sofia.
**FR-2**: Scrape **rental listings** (apartments + houses) in Sofia — needed for yield calculations.
**FR-3**: Extract the following data points per listing:

| Field | Source |
|---|---|
| Price (EUR/BGN) | Listing |
| Area (sq.m.) | Listing |
| Price per sq.m. | Calculated |
| Neighborhood/Quarter | Listing |
| Property type | Listing (1-room, 2-room, house, etc.) |
| Floor / Total floors | Listing |
| Construction year | Listing / detail page |
| Construction stage | Detail page (Act 14/15/16 for new builds) |
| Description text | Listing |
| Contact / Agency | Listing |
| Listing URL | Listing |
| Photos | Listing |
| Date scraped | System |
| Days on market | Calculated (track first-seen date) |

**FR-4**: Pagination support — scrape all result pages (40 listings/page).
**FR-5**: Manual trigger via a button in the dashboard UI. No scheduling.
**FR-6**: Deduplication — identify same property across scrape runs (by URL or content hash).
**FR-7**: Track **price history** — detect and store price changes between scrape runs.

### 2.2 Investment Strategies

Each strategy produces a filtered/scored view of the scraped data.

#### 2.2.1 Buy in Green (На Зелено)
- **Filter**: New construction listings (Act 14 / Act 15 stage, or keywords: "ново строителство", "на зелено", "в строеж")
- **Cash-only metrics**:
  - Current price per sq.m. vs. average finished price in same neighborhood
  - Estimated appreciation on completion (% discount to finished market price)
  - Developer name (extracted from listing/agency)
  - Construction stage (Act 14 → Act 15 → Act 16 progression)
  - Potential profit = (avg finished price/sqm - green price/sqm) * area
- **Leveraged metrics** (when leverage ON):
  - Loan amount (LTV% of green purchase price)
  - Down payment = cash deployed
  - Interest cost during construction (estimated: 18 months for Act 14, 8 months for Act 15)
  - Total cost with financing = down payment + interest during construction + origination fee
  - Leveraged appreciation ROI (%) = profit / cash deployed (amplified by leverage)
  - Leveraged profit = appreciation - interest cost - fees
- **Score**: Leveraged appreciation ROI (when ON) or cash profit (when OFF)
- **Flags**: Health traffic light (based on ROI), `RATE_SENSITIVE`

#### 2.2.2 BRRRR (Buy, Rehab, Rent, Refinance, Repeat)
- **Context**: Bulgarian specifics — low rents but also low bank rates (~3-4% mortgage)
- **Cash-only metrics**:
  - Purchase price
  - Estimated rehab cost (user-configurable multiplier per sq.m., default: 200-400 EUR/sqm)
  - Total investment (purchase + rehab)
  - After-Repair Value (ARV) — based on neighborhood avg price/sqm for renovated
  - Monthly rent estimate (from rental listings, same type + neighborhood)
  - Annual gross rental yield (%)
  - Annual net rental yield (after 10% expenses estimate)
- **Leveraged metrics** (when leverage ON):
  - Refinance loan amount (LTV% of ARV)
  - Cash left in deal (total investment - refinance amount)
  - Monthly mortgage payment (P+I, amortized over loan term)
  - Monthly cash flow after mortgage (net rent - mortgage payment - insurance/12)
  - Cash-on-cash return (%) = annual net cash flow / cash left in deal
  - DSCR (net operating income / annual debt service)
  - Breakeven interest rate
  - Rate sensitivity: cash flow at rate+1%, rate+2%
- **Score**: Monthly leveraged cash flow (when leverage ON) or net yield (when OFF)
- **Flags**: `REFINANCE_VIABLE` (refinance covers >75% of investment), health traffic light, `RATE_SENSITIVE`, `NEGATIVE_CASH_FLOW`

#### 2.2.3 Fix & Flip
- **Filter**: Properties priced below neighborhood average (potential undervalued)
- **Cash-only metrics**:
  - Purchase price
  - Estimated rehab cost (configurable)
  - ARV (neighborhood avg for renovated)
  - Estimated profit = ARV - purchase - rehab - transaction costs (3% notary/tax)
  - ROI (%) = profit / total investment
  - Flip timeline estimate (user-configurable, default: 6 months)
  - Annualized ROI
- **Leveraged metrics** (when leverage ON):
  - Loan amount (LTV% of purchase price)
  - Down payment + rehab cost = cash deployed
  - Interest cost during hold period (monthly payment * flip_timeline_months)
  - Origination fee cost
  - Leveraged profit = ARV - purchase - rehab - transaction costs - interest cost - fees
  - Leveraged ROI (%) = leveraged profit / cash deployed
  - Leveraged annualized ROI
- **Score**: Leveraged ROI % (when ON) or cash ROI % (when OFF)
- **Flags**: Health traffic light (based on ROI thresholds), `RATE_SENSITIVE`

#### 2.2.4 Cash Flow Rental
- **Filter**: All properties
- **Cash-only metrics**:
  - Purchase price
  - Monthly rent estimate (from rental data)
  - Gross yield (annual rent / purchase price)
  - Net yield (after vacancy + maintenance %)
  - Cap rate
  - Price-to-rent ratio
  - Payback period (years)
- **Leveraged metrics** (when leverage ON):
  - Loan amount (LTV% of purchase price)
  - Down payment = cash deployed
  - Monthly mortgage payment (P+I)
  - Monthly cash flow (net rent - mortgage - insurance/12)
  - Cash-on-cash return (%) = annual net cash flow / down payment
  - DSCR
  - Breakeven interest rate
  - Rate sensitivity: cash flow at rate+1%, rate+2%
  - Leveraged payback period (years to recoup down payment from cash flow)
- **Score**: Cash-on-cash return (when leverage ON) or net yield (when OFF)
- **Flags**: Health traffic light, `NEGATIVE_CASH_FLOW`, `LOW_DSCR`, `RATE_SENSITIVE`

#### 2.2.5 Vacation / Airbnb Short-Term Rental
- **Filter**: Properties in central/tourist-friendly neighborhoods
- **Cash-only metrics**:
  - Purchase price
  - Estimated nightly rate (user-configurable per neighborhood)
  - Estimated occupancy rate (default: 60%)
  - Estimated monthly revenue
  - Gross yield vs. long-term rental yield comparison
  - Operating expenses (higher than long-term: 30% of revenue)
  - Net annual income
- **Leveraged metrics** (when leverage ON):
  - Loan amount, down payment
  - Monthly mortgage payment (P+I)
  - Monthly cash flow (net Airbnb revenue - mortgage - insurance/12)
  - Cash-on-cash return (%)
  - DSCR
  - Breakeven interest rate
  - Rate sensitivity: cash flow at rate+1%, rate+2%
  - Leveraged yield vs. long-term rental leveraged yield comparison
- **Score**: Leveraged net yield (when ON) or cash net yield (when OFF)
- **Flags**: Health traffic light, `NEGATIVE_CASH_FLOW`, `RATE_SENSITIVE`

#### 2.2.6 Below-Market Deals (Motivated Sellers)
- **Filter**: Listings with price drops, long days on market (>60 days), price below neighborhood avg by >15%
- **Cash-only metrics**:
  - Current price vs. neighborhood average (% below)
  - Price drop history (number of drops, total reduction)
  - Days on market
  - Estimated market value
  - Discount amount (EUR)
- **Leveraged metrics** (when leverage ON):
  - Instant equity captured = discount amount (you buy at X below market, bank values at market)
  - Effective LTV (loan / market value — lower than stated LTV due to discount)
  - Equity-on-cash ratio = instant equity / down payment (leverage amplifies the discount)
  - If rented: leveraged cash flow and CoC (same as Cash Flow strategy)
- **Score**: Combined score of discount % + days on market + price drops + equity-on-cash ratio (when leveraged)
- **Flags**: Health traffic light, `INSTANT_EQUITY` (when discount > down payment)

### 2.3 Dashboard

**FR-8**: **Overview page** with summary cards:
  - Total listings scraped (sale + rent)
  - Average price/sqm by neighborhood (heat map or table)
  - Number of opportunities found per strategy
  - Last scrape date + duration

**FR-9**: **Strategy tabs/pages** — one view per strategy showing:
  - Filtered property list with strategy-specific columns
  - Sortable by score/any metric
  - Filters: neighborhood, property type, price range, area range
  - Top 10 highlighted opportunities

**FR-10**: **Property detail view**:
  - All scraped data
  - Strategy scores across all applicable strategies
  - Price history chart (if multiple scrapes)
  - Link to original imot.bg listing
  - Neighborhood context (avg prices, avg rents)

**FR-11**: **Neighborhood analytics page**:
  - Average sale price/sqm per neighborhood
  - Average rent/sqm per neighborhood
  - Gross yield by neighborhood
  - Number of listings per neighborhood
  - Price trend (across scrape runs)

**FR-12**: **Settings/Configuration page**:
  - Rehab cost per sq.m. (default: 300 EUR)
  - Vacancy rate (default: 10%)
  - Maintenance cost % (default: 10%)
  - Transaction costs % (default: 3%)
  - Airbnb nightly rates per neighborhood
  - Airbnb occupancy rate (default: 60%)
  - **Mortgage / Leverage panel** (see FR-13)
  - **Investment flag thresholds** (see FR-14)

**FR-13**: **Mortgage / Leverage settings** — a dedicated panel in Settings:

| Field | Default | Notes |
|---|---|---|
| Enable leverage toggle | ON | Compare leveraged vs. cash-only across all strategies |
| Interest rate (%) | 3.5 | User updates this when bank quote changes; dynamic/variable |
| Loan term (years) | 25 | Standard Bulgarian mortgage term |
| Down payment (%) | 20 | Linked to LTV — changing one updates the other |
| LTV (%) | 80 | = 100 - down payment; bank's max loan-to-value |
| Origination fee (%) | 0 | One-time bank fee on loan amount (optional) |
| Annual insurance (EUR/year) | 0 | Property/life insurance required by bank (optional) |

When leverage is **ON**, every strategy shows both cash-only and leveraged metrics side by side. When **OFF**, strategies show only cash-only metrics (current behavior).

**FR-14**: **Investment health flags** — traffic-light system applied to every property across all strategies:

| Color | Meaning | Conditions (configurable thresholds in Settings) |
|---|---|---|
| Green | Strong deal | Cash-on-cash return ≥ 8% AND positive monthly cash flow AND DSCR ≥ 1.25 |
| Yellow | Marginal / watch | CoC 4–8% OR cash flow positive but DSCR < 1.25 OR breakeven rate within +2% of current rate |
| Red | Risky / bad | Negative monthly cash flow AND CoC < 4% OR breakeven rate below current rate |

Configurable thresholds in Settings:
  - CoC green threshold (default: 8%)
  - CoC yellow threshold (default: 4%)
  - DSCR minimum (default: 1.25)
  - Rate stress buffer (default: +2%)

Flag labels shown on properties:
  - `STRONG_LEVERAGED_RETURN` — CoC ≥ green threshold
  - `NEGATIVE_CASH_FLOW` — mortgage payment exceeds net rental income
  - `LOW_DSCR` — debt service coverage ratio < DSCR minimum
  - `RATE_SENSITIVE` — deal turns negative within rate stress buffer
  - `BREAKEVEN_RATE: X.X%` — the max interest rate where cash flow stays ≥ 0

**FR-15**: **Rate sensitivity view** — per-property mini analysis:
  - Show monthly cash flow at: current rate, current+1%, current+2%
  - Show the **breakeven interest rate** (max rate where monthly cash flow ≥ 0)
  - Properties where breakeven rate is within +2% of current rate get a `RATE_SENSITIVE` warning
  - Displayed in property detail view and as a tooltip/expandable row in strategy tables

---

## 3. Non-Functional Requirements

**NFR-1**: Runs locally on Windows 10 (dev machine with XAMPP).
**NFR-2**: React frontend (Vite or CRA).
**NFR-3**: Data persistence — local database (SQLite or JSON file store) to track listings across scrape runs.
**NFR-4**: Scraping must handle imot.bg's encoding (windows-1251) and structure.
**NFR-5**: Scraping should be respectful — reasonable delays between requests, no parallel bombardment.
**NFR-6**: Dashboard should load and filter ~2000-5000 listings without lag.
**NFR-7**: No authentication needed (single user, local).

---

## 4. User Stories

| ID | Story | Acceptance Criteria |
|---|---|---|
| US-1 | As an investor, I want to trigger a scrape so I get fresh listing data | Button starts scrape, progress shown, data stored |
| US-2 | As an investor, I want to see BRRRR candidates ranked by cash flow | BRRRR tab shows properties with positive monthly cash flow first |
| US-3 | As an investor, I want to see "buy in green" discounts | Green tab shows new-build discount vs finished market price |
| US-4 | As an investor, I want to compare neighborhoods by yield | Neighborhood page shows avg yield, sortable |
| US-5 | As an investor, I want to track price drops over time | Properties show price history when scraped multiple times |
| US-6 | As an investor, I want to adjust financial assumptions | Settings page lets me change rates, costs; dashboard recalculates |
| US-7 | As an investor, I want to see flip ROI estimates | Flip tab shows estimated profit and ROI per property |
| US-8 | As an investor, I want to find motivated sellers | Below-market tab flags old listings with price drops |
| US-9 | As an investor, I want to evaluate Airbnb potential | Airbnb tab compares short-term vs long-term yield |
| US-10 | As an investor, I want to input my bank's current mortgage rate and see how it affects all deals | Settings mortgage panel accepts rate; all strategy views recalculate with leverage |
| US-11 | As an investor, I want to see leveraged vs. cash-only metrics side by side | Each strategy table shows both columns when leverage toggle is ON |
| US-12 | As an investor, I want a clear green/yellow/red indicator on each property | Traffic light badge appears on every property row based on CoC, DSCR, cash flow |
| US-13 | As an investor, I want to know at what interest rate a deal breaks even | Property detail shows breakeven rate; strategy table shows it as a column |
| US-14 | As an investor, I want to see how rate increases would affect my cash flow | Rate sensitivity shows cash flow at current, +1%, +2% in property detail |
| US-15 | As an investor, I want to toggle leverage off to compare cash-only returns | Leverage toggle in settings switches all views to cash-only mode |
| US-16 | As an investor, I want to adjust flag thresholds to match my risk tolerance | Settings page has configurable CoC, DSCR, and rate stress thresholds |

---

## 5. Data Model (Conceptual)

```
Property
  - id (internal)
  - imot_bg_url (unique identifier)
  - content_hash (dedup)
  - type (apartment_1room, apartment_2room, ..., house)
  - transaction_type (sale | rent)
  - price (EUR only, BGN converted at 1.95583)
  - area_sqm
  - price_per_sqm
  - neighborhood_zone (grouped zone)
  - neighborhood_quarter (original imot.bg quarter name)
  - floor / total_floors
  - construction_year
  - construction_stage (act14 | act15 | act16 | finished | null)
  - condition (needs_rehab | partially_renovated | fully_renovated | new | unknown)
  - description
  - contact_info
  - agency
  - photos[]
  - first_seen_date
  - last_seen_date
  - is_active

PriceHistory
  - property_id
  - price
  - date_recorded

ScrapingRun
  - id
  - started_at
  - completed_at
  - listings_found
  - new_listings
  - price_changes_detected

UserSettings
  - rehab_cost_per_sqm
  - vacancy_rate
  - maintenance_pct
  - transaction_costs_pct
  - airbnb_rates (per neighborhood)
  - airbnb_occupancy_pct
  - leverage_enabled (boolean, default: true)
  - mortgage_rate (%, dynamic — user updates from bank quotes)
  - loan_term_years (default: 25)
  - down_payment_pct (linked to ltv_pct)
  - ltv_pct (linked to down_payment_pct)
  - origination_fee_pct (default: 0)
  - annual_insurance_eur (default: 0)
  - flag_coc_green_threshold (default: 8%)
  - flag_coc_yellow_threshold (default: 4%)
  - flag_dscr_minimum (default: 1.25)
  - flag_rate_stress_buffer (default: 2%)
```

---

## 6. Resolved Decisions

1. **Rental data matching**: Same neighborhood + same room count is sufficient for rent estimates.
2. **Rehab detection**: Yes — use Bulgarian keyword matching on descriptions to classify condition (e.g., "за ремонт", "ново обзавеждане", "луксозно ремонтиран", "след основен ремонт").
3. **Currency**: EUR only throughout the dashboard. Convert BGN prices at fixed rate (1 EUR = 1.95583 BGN).
4. **Export**: No CSV/Excel export — visual web dashboard only.
5. **Neighborhoods**: Group Sofia quarters into larger neighborhood zones (e.g., Младост 1/2/3/4 → Младост zone, Люлин 1-10 → Люлин zone) while keeping the original quarter name available for drill-down.
6. **Mortgage rate**: Single global rate (not per-property). User updates it manually when they get a new bank quote. All strategies recalculate on the fly.
7. **Leverage toggle**: Global ON/OFF — affects all strategies simultaneously. When OFF, leveraged columns are hidden, scores revert to cash-only.
8. **Mortgage math**: Standard annuity formula (fixed monthly P+I payment). Bulgarian variable rates change periodically, but at any point in time the payment is computed as if the current rate holds for the full term. This is how Bulgarian banks present it.
9. **Flag thresholds**: Configurable in settings, but defaults are tuned for Bulgarian market (low yields, low rates). The traffic light considers multiple signals, not just one metric.
10. **Construction hold period**: For Buy in Green, estimated months until completion: Act 14 = 18 months, Act 15 = 8 months. User pays interest-only during this period (no principal, since property isn't finished).

---

## 7. Suggested Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | React + Vite | Fast dev, your preference |
| UI Components | Shadcn/ui or Ant Design | Tables, charts, filters out of the box |
| Charts | Recharts or Chart.js | Yield charts, price trends |
| Backend | Node.js (Express) | Same JS ecosystem, simple API |
| Scraper | Cheerio + Axios (Node) | Lightweight HTML parsing, no browser needed |
| Database | SQLite (via better-sqlite3) | Zero config, file-based, perfect for local |
| State | React Query | Async data fetching + caching |

---

## 8. Next Steps

After you confirm/adjust these requirements:
1. **`/sc:design`** — Architecture, component design, API contracts
2. **`/sc:implement`** — Build it out

---

*Generated: 2026-05-03 | Project: realestate-investing*
