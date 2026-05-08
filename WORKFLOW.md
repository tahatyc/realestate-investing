# Real Estate Investment Analyzer — Implementation Workflow

## Execution Summary

**Total phases**: 6
**Estimated implementation tasks**: 40
**Dependencies**: Linear phases (each builds on prior), parallel tasks within phases where noted.

```
Phase 1: Project Scaffold ──► Phase 2: Database + Data Layer ──► Phase 3: Scraper
     │                              │                                  │
     └── no dependencies            └── needs scaffold                 └── needs DB layer
                                                                       │
Phase 4: Strategy Engine ──► Phase 5: Frontend Dashboard ──► Phase 6: Integration & Polish
     │                            │                               │
     └── needs DB + scraper       └── needs API endpoints         └── needs everything
         (for test data)              from phases 3-4
```

---

## Phase 1: Project Scaffold & Configuration

**Goal**: Monorepo structure, both dev servers running, basic wiring confirmed.

| # | Task | Files | Depends On | Checkpoint |
|---|---|---|---|---|
| 1.1 | Init root `package.json` with npm workspaces (`server/`, `client/`) | `package.json` | — | `npm install` succeeds |
| 1.2 | Scaffold Express server with health endpoint | `server/package.json`, `server/src/index.js` | 1.1 | `GET /api/health` returns `200` |
| 1.3 | Scaffold React + Vite app | `client/` (vite init) | 1.1 | `npm run dev` shows React page |
| 1.4 | Install shared deps: Tailwind, shadcn/ui, React Router, React Query, Recharts, Axios | `client/package.json`, tailwind config, shadcn init | 1.3 | Tailwind classes render |
| 1.5 | Configure Vite proxy (`/api` → `localhost:3001`) | `client/vite.config.js` | 1.2, 1.3 | Frontend fetches `/api/health` through proxy |
| 1.6 | Add root dev script (`concurrently` to run both) | `package.json` | 1.2, 1.3 | `npm run dev` starts both servers |
| 1.7 | Create `.gitignore` (node_modules, data/*.db, dist) | `.gitignore` | — | — |

**Checkpoint**: Run `npm run dev` from root → Express on :3001, Vite on :5173, proxy works.

---

## Phase 2: Database & Data Access Layer

**Goal**: SQLite schema created, CRUD operations working, settings seeded.

| # | Task | Files | Depends On | Checkpoint |
|---|---|---|---|---|
| 2.1 | Install `better-sqlite3` | `server/package.json` | 1.2 | Import succeeds |
| 2.2 | Create DB connection module (auto-creates `data/realestate.db`, runs schema) | `server/src/db/connection.js` | 2.1 | DB file created on server start |
| 2.3 | Write full SQL schema | `server/src/db/schema.sql` | — | — |
| 2.4 | Property data access (upsert, query with filters, getById, markInactive) | `server/src/db/properties.js` | 2.2, 2.3 | Insert + query returns data |
| 2.5 | Price history data access (insert, getByPropertyId) | `server/src/db/priceHistory.js` | 2.2, 2.3 | Price change tracked |
| 2.6 | Scraping runs data access (create, update progress, getLatest) | `server/src/db/scrapingRuns.js` | 2.2, 2.3 | Run lifecycle works |
| 2.7 | Settings data access (get, update — single-row pattern). Schema includes leverage fields (`leverage_enabled`, `mortgage_rate`, `loan_term_years`, `down_payment_pct`, `ltv_pct`, `origination_fee_pct`, `annual_insurance_eur`) and flag threshold fields (`flag_coc_green_pct`, `flag_coc_yellow_pct`, `flag_dscr_minimum`, `flag_rate_stress_pct`). GET returns nested structure (`general`, `airbnb`, `leverage`, `flags`). PUT accepts partial nested updates; auto-syncs `downPaymentPct` ↔ `ltvPct`. | `server/src/db/settings.js` | 2.2, 2.3 | Defaults seeded, update works, LTV/down-payment sync works |
| 2.8 | Neighborhood stats data access (recompute, getAll) | `server/src/db/neighborhoodStats.js` | 2.2, 2.3 | Stats computed from sample data |
| 2.9 | Currency utility (BGN→EUR conversion at fixed rate 1.95583) | `server/src/utils/currency.js` | — | — |
| 2.10 | Mortgage math utility — `monthlyPayment` (annuity formula), `interestOnlyPayment`, `breakEvenRate` (binary search 0–20%), `rateSensitivity` (cash flow at rate+0/+1%/+2%), `loanAmount`, `downPayment`, `originationFee`, `dscr` | `server/src/utils/mortgage.js` | — | Unit test: €68k loan at 3.5% / 25yr → €339.48/mo |
| 2.11 | Health flag engine — `evaluate(leveragedMetrics, settings)` → `{ health: green|yellow|red, flags: string[] }`. Logic: green if CoC≥8% + cashFlow>0 + DSCR≥1.25; red if cashFlow<0 + CoC<4% or breakeven≤current rate; yellow otherwise. Appends `NEGATIVE_CASH_FLOW`, `LOW_DSCR`, `RATE_SENSITIVE`, `STRONG_LEVERAGED_RETURN`, `REFINANCE_VIABLE`, `INSTANT_EQUITY` flags independently. | `server/src/utils/healthFlags.js` | 2.10 | Unit test: negative cash flow + low CoC → red + NEGATIVE_CASH_FLOW flag |

**Checkpoint**: Server starts, DB file exists in `data/`, inserting and querying a test property works. Mortgage math utility produces correct monthly payment. Health flags return correct traffic light for sample inputs.

---

## Phase 3: Scraper

**Goal**: Full scraping pipeline — fetches imot.bg, parses listings, stores in DB.

| # | Task | Files | Depends On | Checkpoint |
|---|---|---|---|---|
| 3.1 | Encoding handler (`iconv-lite` for windows-1251 → UTF-8) | `server/src/scraper/encoding.js` | — | Cyrillic text decoded correctly |
| 3.2 | Neighborhood zone mapping (quarter → zone lookup) | `server/src/scraper/neighborhoods.js` | — | "Младост 1" → "Младост" |
| 3.3 | Condition detector (Bulgarian keyword → condition enum) | `server/src/utils/conditionDetector.js` | — | "за ремонт" → "needs_rehab" |
| 3.4 | HTML parser — search results page (extract listing cards) | `server/src/scraper/parser.js` | 3.1 | Parse sample HTML → array of properties |
| 3.5 | HTML parser — detail page (construction year, stage, full description) | `server/src/scraper/parser.js` (extend) | 3.1 | Parse sample detail → extra fields |
| 3.6 | Main scraper orchestrator (fetch pages, rate-limit, retry, progress tracking) | `server/src/scraper/imotbg.js` | 3.1-3.5, 2.4-2.8 | Scrapes 1 page successfully |
| 3.7 | Post-processing (price change detection, mark inactive, recompute stats) | `server/src/scraper/imotbg.js` (extend) | 3.6, 2.5, 2.8 | Price changes detected |
| 3.8 | Scraper API routes (`POST /start`, `GET /status`, `GET /history`) | `server/src/routes/scraper.js` | 3.6, 2.6 | Trigger scrape via API, poll progress |

**Checkpoint**: `POST /api/scraper/start` triggers scrape, `GET /api/scraper/status` shows progress, properties appear in DB.

**IMPORTANT**: After this phase, do a **real test scrape** of imot.bg (limit to 2-3 pages) to validate:
- Encoding decodes correctly
- Parser extracts all fields
- Deduplication works
- Zone mapping works
- Data stores correctly

---

## Phase 4: Strategy Engine & API

**Goal**: All 6 strategies compute cash-only AND leveraged metrics, with health flags and rate sensitivity. API serves scored results.

| # | Task | Files | Depends On | Checkpoint |
|---|---|---|---|---|
| 4.1 | Strategy interface + registry. Each strategy returns `{ cashMetrics, leveragedMetrics, score, health, flags, rateSensitivity, breakEvenRate }`. When `settings.leverage_enabled=false`, `leveragedMetrics=null`, `health=null`, score uses cash-only metric. Registry calls `healthFlags.evaluate()` after each strategy's `analyze()`. | `server/src/strategies/index.js` | 2.10, 2.11 | — |
| 4.2 | Buy in Green strategy — cash: potential profit + appreciation %. Leveraged: loan amount, down payment, interest-only during construction (18mo Act 14, 8mo Act 15), origination fee, leveraged ROI. | `server/src/strategies/buyInGreen.js` | 4.1, 2.8, 2.10 | Leveraged ROI > cash ROI due to leverage amplification |
| 4.3 | BRRRR strategy — cash: total investment, ARV, yields. Leveraged: refinance loan (LTV% of ARV), cash left in deal, monthly P+I, cash flow after mortgage, CoC, DSCR. Flag: `REFINANCE_VIABLE` when refinance covers >75%. | `server/src/strategies/brrrr.js` | 4.1, 2.7, 2.8, 2.10 | Cash flow calculated; refinance flag fires correctly |
| 4.4 | Fix & Flip strategy — cash: profit, ROI, annualized ROI. Leveraged: down+rehab=cash deployed, interest cost during hold, origination fee, leveraged profit/ROI. | `server/src/strategies/flipper.js` | 4.1, 2.7, 2.8, 2.10 | Leveraged ROI higher than cash ROI (less capital deployed) |
| 4.5 | Cash Flow Rental strategy — cash: gross/net yield, cap rate, payback. Leveraged: monthly P+I, cash flow, CoC on down payment, DSCR, leveraged payback. | `server/src/strategies/cashFlow.js` | 4.1, 2.7, 2.8, 2.10 | Net yield + leveraged CoC both calculated |
| 4.6 | Airbnb strategy — cash: revenue, opex (30%), net yield. Leveraged: monthly P+I, cash flow, CoC, DSCR. Plus leveraged LT comparison. | `server/src/strategies/airbnb.js` | 4.1, 2.7, 2.8, 2.10 | Leveraged Airbnb vs leveraged LT yield comparison |
| 4.7 | Below Market strategy — cash: discount amount/%, drops, days. Leveraged: instant equity, effective LTV, equity-on-cash ratio. If rental data exists: leveraged cash flow + CoC. Flag: `INSTANT_EQUITY` when discount > down payment. | `server/src/strategies/belowMarket.js` | 4.1, 2.5, 2.8, 2.10 | Equity-on-cash calculated; INSTANT_EQUITY flag fires |
| 4.8 | Strategy API route (`GET /api/strategies/:name`). Accepts `health` query param filter (green/yellow/red). Response includes `leverageEnabled`, `currentRate`, `healthBreakdown` in summary. Each property has `cashMetrics`, `leveragedMetrics`, `health`, `flags`, `rateSensitivity`, `breakEvenRate`. | `server/src/routes/strategies.js` | 4.2-4.7 | Returns scored + paginated results with leverage data; health filter works |
| 4.9 | Properties API route (`GET /api/properties`, `GET /api/properties/:id`). Detail includes `leverageSettings` + per-strategy `cashMetrics`/`leveragedMetrics`/`health`/`flags`/`rateSensitivity`/`breakEvenRate`. | `server/src/routes/properties.js` | 2.4, 4.1 | Detail includes all strategy scores + leverage |
| 4.10 | Neighborhoods API route (`GET /api/neighborhoods`) | `server/src/routes/neighborhoods.js` | 2.8 | Zone stats returned |
| 4.11 | Settings API route (`GET/PUT /api/settings`). GET returns nested structure (`general`, `airbnb`, `leverage`, `flags`). PUT accepts partial nested body, auto-syncs downPayment↔LTV. | `server/src/routes/settings.js` | 2.7 | Update rate → strategies recalculate; LTV/down-payment sync |
| 4.12 | Overview API route (`GET /api/overview`). Response includes `leverage` state and `healthBreakdown` per strategy (when leverage ON). | `server/src/routes/overview.js` | 4.2-4.7, 2.8 | Dashboard summary with health counts |
| 4.13 | Register all routes in Express app | `server/src/index.js` (extend) | 4.8-4.12 | All endpoints respond |

**Checkpoint**: With test data in DB, every API endpoint returns correct JSON. Verify BRRRR leveraged cash flow math manually for one property. Verify breakeven rate is correct (cash flow ≈ 0 at that rate). Verify health flag colors match expectations. Toggle leverage off → confirm leveragedMetrics is null and scores revert to cash-only.

---

## Phase 5: Frontend Dashboard

**Goal**: All pages functional, connected to live API.

### 5A — Shell & Shared Components (do first)

| # | Task | Files | Depends On | Checkpoint |
|---|---|---|---|---|
| 5.1 | App shell: sidebar layout + React Router setup | `App.jsx`, `components/Layout.jsx` | 1.4 | Navigate between routes |
| 5.2 | API client (Axios instance + React Query provider + hooks). Include `useSettings()`, `useUpdateSettings()` hooks — settings are fetched once and cached, invalidated on mutation. | `api/client.js` | 1.5 | `useProperties()` returns data |
| 5.3 | Shared: MetricCard component | `components/MetricCard.jsx` | 1.4 | Renders stat with label |
| 5.4 | Shared: PropertyTable (TanStack Table, sortable, paginated). When leverage is ON, table shows extra columns: Health badge, Cash Flow, CoC, Breakeven Rate. Rows are expandable to show rate sensitivity. When OFF, leveraged columns hidden. | `components/PropertyTable.jsx` | 1.4, 5.8a | Sorts + paginates; leverage columns toggle with setting |
| 5.5 | Shared: FilterBar (zone, type, price range, area range, condition). When leverage ON, adds Health filter dropdown (All/Green/Yellow/Red). | `components/FilterBar.jsx` | 5.2 | Filters update query params; health filter works |
| 5.6 | Shared: ScrapeButton (trigger + progress polling) | `components/ScrapeButton.jsx` | 5.2 | Shows progress, re-fetches on done |
| 5.7 | Shared: formatters (EUR, %, sqm, date) | `lib/formatters.js` | — | — |
| 5.8 | Strategy definitions (names, colors, columns per strategy). Each strategy defines both `cashColumns` and `leveragedColumns`. | `lib/strategies.js` | — | — |
| 5.8a | HealthBadge component — small colored circle/pill: green, yellow, red. Props: `health`, `size`. Renders nothing when `health=null` (leverage off). | `components/HealthBadge.jsx` | 1.4 | Green/yellow/red renders correctly |
| 5.8b | RateSensitivity component — expandable mini-table: cash flow at current/+1%/+2% rate + breakeven rate. Highlights breakeven in red when within stress buffer. Used in table expandable rows + PropertyDetail. | `components/RateSensitivity.jsx` | 1.4, 5.7 | Shows 3 rate rows + breakeven |
| 5.8c | LeverageToggle component — reads leverage state from settings cache. Shows "Leverage: ON/OFF" toggle in strategy page headers + overview. Toggling calls PUT settings and invalidates all strategy/overview queries. | `components/LeverageToggle.jsx` | 5.2, 4.11 | Toggle ON→OFF hides leveraged columns, scores change |

### 5B — Pages (can be built in parallel after 5A)

| # | Task | Files | Depends On | Checkpoint |
|---|---|---|---|---|
| 5.9 | Overview page — summary cards + mortgage assumptions bar (rate, term, LTV, leverage toggle) + strategy opportunity cards with health breakdown counts (G/Y/R) + neighborhood charts. | `pages/Overview.jsx` | 5.1-5.3, 5.8a, 5.8c, 4.12 | Dashboard renders with live data; mortgage bar shows current rate |
| 5.10 | StrategyView page — parameterized. Summary cards include health breakdown + avg CoC. Table shows health badge + leveraged columns when ON. Expandable rows for rate sensitivity. Health filter in FilterBar. LeverageToggle in header. | `pages/StrategyView.jsx` | 5.4, 5.5, 5.8, 5.8a-c, 4.8 | Each strategy shows leveraged data; expanding row shows rate sensitivity |
| 5.11 | PropertyDetail page — all data, price chart, strategy scores with cashMetrics + leveragedMetrics side by side, full rate sensitivity table per applicable strategy, flags displayed as badges, health traffic light prominent. | `pages/PropertyDetail.jsx` | 5.3, 5.8a, 5.8b, 4.9 | Detail shows leveraged vs cash side by side; rate sensitivity table visible |
| 5.12 | Neighborhoods page (zone stats table + yield chart + price chart) | `pages/Neighborhoods.jsx` | 5.4, 4.10 | Zone comparison works |
| 5.13 | Settings page — 4 panels: General Assumptions, Mortgage/Leverage (toggle + rate/term/LTV linked fields + fees), Investment Health Thresholds (CoC green/yellow, DSCR min, rate stress), Airbnb. Down payment ↔ LTV linked in UI (change one, other updates). Save invalidates all strategy + overview queries. | `pages/Settings.jsx` | 5.2, 4.11 | Save settings → strategies recalculate; LTV/down-payment linked; toggle leverage ON/OFF |

**Checkpoint**: Navigate every page. Trigger a scrape from the UI. Click a property → see detail with leveraged metrics + rate sensitivity. Change mortgage rate in settings → verify all strategy scores update. Toggle leverage OFF → leveraged columns disappear, scores revert. Change health thresholds → verify flag colors change.

---

## Phase 6: Integration, Polish & Validation

**Goal**: End-to-end flow works, edge cases handled, UI polished.

| # | Task | Files | Depends On | Checkpoint |
|---|---|---|---|---|
| 6.1 | End-to-end test: full scrape → dashboard → strategy → detail | All | Phases 1-5 | Complete flow works |
| 6.2 | Handle empty states (no data yet, no matches for strategy) | Various components | 5.9-5.13 | No crashes on empty DB |
| 6.3 | Loading states + error states across all pages | Various components | 5.9-5.13 | Spinners shown during fetch |
| 6.4 | Scraper error resilience (skip bad listings, partial failures) | `server/src/scraper/imotbg.js` | 3.6 | Scrape doesn't crash on bad data |
| 6.5 | Responsive layout tweaks (readable on smaller screens) | Various components | 5.1 | Dashboard usable at 1024px width |
| 6.6 | Price history chart in PropertyDetail (Recharts line chart) | `components/PriceChart.jsx`, `pages/PropertyDetail.jsx` | 5.11 | Multi-scrape price trend visible |
| 6.7 | Neighborhood bar charts (yield + price/sqm) | `components/NeighborhoodMap.jsx` | 5.9, 5.12 | Charts render correctly |
| 6.8 | Final validation: verify BRRRR math, flip ROI, yield calcs against manual spreadsheet. **Must also verify**: monthly mortgage payment formula, breakeven rate accuracy (plug breakeven rate back in → cash flow ≈ 0), leveraged ROI vs cash ROI relationship, DSCR calculation, health flag thresholds. | — | 4.2-4.7 | Numbers match hand calculations; breakeven rate verified |
| 6.9 | Leverage UX validation: toggle leverage ON/OFF across all pages, verify columns appear/disappear. Change rate → verify all scores update. Change health thresholds → verify flag colors change. Test edge cases: 0% rate, 100% down payment (no leverage), very high rate (all red). | — | 5.9-5.13 | All leverage edge cases handled gracefully |

**Checkpoint**: Full end-to-end: start fresh DB → scrape → browse strategies → inspect property → adjust settings → re-check scores. Verify leverage toggle works across all views. Verify rate sensitivity warnings match expectations.

---

## Execution Order (Quick Reference)

```
 Phase 1 ─────────────────────────────────────────►  ~30 min
   1.1 → 1.2, 1.3 (parallel) → 1.4, 1.5 → 1.6, 1.7

 Phase 2 ─────────────────────────────────────────►  ~1.5 hr
   2.1 → 2.2 → 2.3 → 2.4, 2.5, 2.6, 2.7, 2.8 (parallel) → 2.9
   2.10, 2.11 (parallel, no DB dependency — pure utility functions)

 Phase 3 ─────────────────────────────────────────►  ~2 hr
   3.1, 3.2, 3.3 (parallel) → 3.4 → 3.5 → 3.6 → 3.7 → 3.8
   *** REAL SCRAPE TEST (2-3 pages) ***

 Phase 4 ─────────────────────────────────────────►  ~3 hr
   4.1 → 4.2-4.7 (parallel, each now includes leverage math) → 4.8-4.12 (parallel) → 4.13

 Phase 5 ─────────────────────────────────────────►  ~4 hr
   5A: 5.1 → 5.2-5.8, 5.8a-5.8c (parallel)
   5B: 5.9-5.13 (parallel, after 5A)

 Phase 6 ─────────────────────────────────────────►  ~1.5 hr
   6.1 → 6.2-6.7 (parallel) → 6.8, 6.9 (parallel)
```

---

## Critical Path

The longest dependency chain that gates project completion:

```
1.1 → 1.2 → 2.1 → 2.2 → 2.4 → 3.4 → 3.6 → 4.1 → 4.3 (now includes leverage) → 4.8 → 5.2 → 5.10 → 6.1
```

**Bottleneck**: Phase 3 (scraper) — it requires real-world testing against imot.bg's HTML structure, which may need iterative parser adjustments. Budget extra time here.

**Secondary bottleneck**: Phase 4 strategies are ~50% heavier now due to leverage math, but the formulas are straightforward — the mortgage.js utility does the heavy lifting.

---

## Validation Gates (Do Not Skip)

| Gate | When | What to Verify |
|---|---|---|
| **G1** | After Phase 1 | Both dev servers running, proxy works |
| **G2** | After Phase 2 | DB created, test insert/query works. Mortgage utility: `monthlyPayment(68000, 3.5, 25)` ≈ 339.48. Health flags: known inputs → expected color. |
| **G3** | After Phase 3 | Real scrape of 2-3 pages produces correct data in DB |
| **G4** | After Phase 4 | API returns correct strategy scores with leverage data. Verify: BRRRR leveraged cash flow, breakeven rate (plug back in → cash flow ≈ 0), health flags match thresholds. Toggle leverage OFF → leveragedMetrics is null, scores use cash-only. |
| **G5** | After Phase 5 | Every page renders. Leverage toggle hides/shows columns. Health badges appear. Rate sensitivity expandable rows work. Settings mortgage panel saves + recalculates. LTV↔down payment linked. |
| **G6** | After Phase 6 | Full end-to-end flow, edge cases (0% rate, 100% down, all red), empty states |

---

*Updated: 2026-05-04 | Project: realestate-investing*
*Next: `/sc:implement` to start building phase by phase*
