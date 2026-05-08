# Real Estate Investment Analyzer — System Design

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite)               │
│                     http://localhost:5173                 │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ Overview  │ │ Strategy │ │ Neighbor-│ │  Settings  │  │
│  │ Dashboard │ │  Pages   │ │  hoods   │ │   Page     │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘  │
│       └─────────────┴────────────┴─────────────┘         │
│                         │ React Query                    │
│                         │ (REST calls)                   │
└─────────────────────────┼───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                 BACKEND (Node.js + Express)               │
│                    http://localhost:3001                   │
│                                                           │
│  ┌───────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │  REST API  │  │   Strategy    │  │    Scraper       │  │
│  │  Routes    │  │   Engine      │  │    Service       │  │
│  │           │  │  (calculators) │  │  (Cheerio+Axios) │  │
│  └─────┬─────┘  └───────┬───────┘  └────────┬─────────┘  │
│        │                │                    │            │
│        └────────────────┴────────────────────┘            │
│                         │                                 │
│                  ┌──────┴──────┐                          │
│                  │   Data      │                          │
│                  │   Access    │                          │
│                  │   Layer     │                          │
│                  └──────┬──────┘                          │
│                         │                                 │
└─────────────────────────┼─────────────────────────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │   SQLite DB   │
                   │  (file-based) │
                   │  ./data/      │
                   │  realestate.db│
                   └──────────────┘
```

**Monorepo structure** — single repo, two packages (`client/` and `server/`), started together via npm scripts.

---

## 2. Project Structure

```
realestate-investing/
├── package.json                  # Root: workspace + scripts
├── REQUIREMENTS.md
├── DESIGN.md
│
├── server/
│   ├── package.json
│   ├── src/
│   │   ├── index.js              # Express server entry
│   │   ├── routes/
│   │   │   ├── properties.js     # GET /api/properties, GET /api/properties/:id
│   │   │   ├── scraper.js        # POST /api/scraper/start, GET /api/scraper/status
│   │   │   ├── strategies.js     # GET /api/strategies/:name
│   │   │   ├── neighborhoods.js  # GET /api/neighborhoods
│   │   │   └── settings.js       # GET/PUT /api/settings
│   │   ├── scraper/
│   │   │   ├── imotbg.js         # Main scraper: search pages + detail pages
│   │   │   ├── parser.js         # HTML → structured data extraction
│   │   │   ├── encoding.js       # windows-1251 → UTF-8 handling
│   │   │   └── neighborhoods.js  # Quarter → zone mapping
│   │   ├── strategies/
│   │   │   ├── index.js          # Strategy registry + shared helpers
│   │   │   ├── buyInGreen.js     # На зелено analysis
│   │   │   ├── brrrr.js          # BRRRR calculator
│   │   │   ├── flipper.js        # Fix & flip ROI
│   │   │   ├── cashFlow.js       # Cash flow rental
│   │   │   ├── airbnb.js         # Short-term rental
│   │   │   └── belowMarket.js    # Motivated seller detection
│   │   ├── db/
│   │   │   ├── connection.js     # SQLite connection + init
│   │   │   ├── schema.sql        # Table definitions
│   │   │   ├── properties.js     # Property CRUD + queries
│   │   │   ├── priceHistory.js   # Price tracking
│   │   │   ├── scrapingRuns.js   # Scrape run log
│   │   │   └── settings.js       # User settings persistence
│   │   └── utils/
│   │       ├── conditionDetector.js  # Bulgarian keyword → condition classifier
│   │       ├── currency.js           # BGN ↔ EUR conversion
│   │       ├── mortgage.js           # Mortgage math: payment, breakeven, sensitivity
│   │       └── healthFlags.js        # Traffic-light flag computation
│   └── data/
│       └── realestate.db         # SQLite file (gitignored)
│
├── client/
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx
│       ├── App.jsx               # Layout + routing
│       ├── api/
│       │   └── client.js         # Axios instance + React Query hooks
│       ├── pages/
│       │   ├── Overview.jsx      # Dashboard home
│       │   ├── StrategyView.jsx  # Shared strategy page (parameterized)
│       │   ├── PropertyDetail.jsx
│       │   ├── Neighborhoods.jsx
│       │   └── Settings.jsx
│       ├── components/
│       │   ├── Layout.jsx        # Sidebar + header shell
│       │   ├── PropertyTable.jsx # Sortable/filterable data table
│       │   ├── PropertyCard.jsx  # Compact card view
│       │   ├── MetricCard.jsx    # Single stat display
│       │   ├── ScoreBar.jsx      # Visual strategy score indicator
│       │   ├── HealthBadge.jsx   # Traffic-light green/yellow/red indicator
│       │   ├── RateSensitivity.jsx  # Mini rate sensitivity table/chart
│       │   ├── LeverageToggle.jsx   # Global leverage ON/OFF switch (reads settings)
│       │   ├── PriceChart.jsx    # Price history line chart
│       │   ├── NeighborhoodMap.jsx  # Neighborhood comparison chart
│       │   ├── FilterBar.jsx     # Shared filter controls
│       │   ├── ScrapeButton.jsx  # Trigger + progress indicator
│       │   └── StrategyBadge.jsx # Strategy tag on property cards
│       └── lib/
│           ├── strategies.js     # Strategy definitions (names, colors, columns)
│           └── formatters.js     # EUR formatting, % formatting, etc.
│
└── .gitignore
```

---

## 3. Database Schema (SQLite)

```sql
-- Properties table: both sale and rental listings
CREATE TABLE properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    imot_bg_url TEXT UNIQUE NOT NULL,
    content_hash TEXT NOT NULL,
    type TEXT NOT NULL,                    -- apartment_1room, apartment_2room, apartment_3room, apartment_4room, house
    transaction_type TEXT NOT NULL,         -- sale | rent
    price_eur REAL NOT NULL,
    area_sqm REAL,
    price_per_sqm REAL,
    neighborhood_zone TEXT,                -- Grouped: "Младост", "Люлин", "Център"
    neighborhood_quarter TEXT,             -- Original: "Младост 1", "Люлин 3"
    floor INTEGER,
    total_floors INTEGER,
    construction_year INTEGER,
    construction_stage TEXT,               -- act14 | act15 | act16 | finished | NULL
    condition TEXT DEFAULT 'unknown',      -- needs_rehab | partially_renovated | fully_renovated | new | unknown
    description TEXT,
    contact_info TEXT,
    agency TEXT,
    photos TEXT,                           -- JSON array of URLs
    first_seen_date TEXT NOT NULL,         -- ISO date
    last_seen_date TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_properties_zone ON properties(neighborhood_zone);
CREATE INDEX idx_properties_type ON properties(type, transaction_type);
CREATE INDEX idx_properties_active ON properties(is_active, transaction_type);
CREATE INDEX idx_properties_url ON properties(imot_bg_url);

-- Price history: one row per price observation
CREATE TABLE price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL REFERENCES properties(id),
    price_eur REAL NOT NULL,
    recorded_date TEXT NOT NULL,
    scraping_run_id INTEGER REFERENCES scraping_runs(id)
);

CREATE INDEX idx_price_history_property ON price_history(property_id);

-- Scraping run log
CREATE TABLE scraping_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT DEFAULT 'running',         -- running | completed | failed
    listings_found INTEGER DEFAULT 0,
    new_listings INTEGER DEFAULT 0,
    updated_listings INTEGER DEFAULT 0,
    price_changes INTEGER DEFAULT 0,
    error_message TEXT
);

-- User settings (single row, upserted)
CREATE TABLE user_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- Enforce single row

    -- General
    rehab_cost_per_sqm REAL DEFAULT 300,
    vacancy_rate REAL DEFAULT 10,
    maintenance_pct REAL DEFAULT 10,
    transaction_costs_pct REAL DEFAULT 3,
    flip_timeline_months INTEGER DEFAULT 6,

    -- Airbnb
    airbnb_occupancy_pct REAL DEFAULT 60,
    airbnb_rates_json TEXT DEFAULT '{}',   -- {"Център": 50, "Витоша": 40, ...}

    -- Mortgage / Leverage
    leverage_enabled INTEGER DEFAULT 1,    -- 1=ON, 0=OFF
    mortgage_rate REAL DEFAULT 3.5,        -- Annual %, user updates from bank quotes
    loan_term_years INTEGER DEFAULT 25,
    down_payment_pct REAL DEFAULT 20,
    ltv_pct REAL DEFAULT 80,              -- = 100 - down_payment_pct (kept in sync)
    origination_fee_pct REAL DEFAULT 0,   -- One-time fee on loan amount
    annual_insurance_eur REAL DEFAULT 0,  -- Annual property/life insurance

    -- Investment health flag thresholds
    flag_coc_green_pct REAL DEFAULT 8,    -- Cash-on-cash >= this = green
    flag_coc_yellow_pct REAL DEFAULT 4,   -- Cash-on-cash >= this = yellow (below = red)
    flag_dscr_minimum REAL DEFAULT 1.25,  -- Debt service coverage ratio floor
    flag_rate_stress_pct REAL DEFAULT 2,  -- Rate buffer for sensitivity warnings

    updated_at TEXT DEFAULT (datetime('now'))
);

-- Seed default settings row
INSERT OR IGNORE INTO user_settings (id) VALUES (1);

-- Precomputed neighborhood stats (refreshed after each scrape)
CREATE TABLE neighborhood_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    neighborhood_zone TEXT NOT NULL,
    property_type TEXT NOT NULL,            -- apartment_1room, etc. or "all"
    avg_sale_price_sqm REAL,
    avg_rent_price REAL,                   -- Monthly rent for this type in this zone
    avg_rent_price_sqm REAL,
    listing_count_sale INTEGER DEFAULT 0,
    listing_count_rent INTEGER DEFAULT 0,
    gross_yield REAL,                      -- (avg_rent * 12) / avg_sale_price * 100
    computed_at TEXT DEFAULT (datetime('now')),
    UNIQUE(neighborhood_zone, property_type)
);
```

---

## 4. API Specification

Base URL: `http://localhost:3001/api`

### 4.1 Scraper

#### `POST /api/scraper/start`
Triggers a new scraping run. Returns immediately; scraping runs in background.

**Response** `202 Accepted`:
```json
{
  "runId": 42,
  "status": "running",
  "message": "Scraping started"
}
```

#### `GET /api/scraper/status`
Returns current/last scraping run status (polled by frontend).

**Response** `200`:
```json
{
  "runId": 42,
  "status": "running",
  "progress": {
    "phase": "sale_listings",       // sale_listings | rental_listings | detail_pages | computing_stats
    "currentPage": 12,
    "totalPages": 25,
    "listingsProcessed": 480,
    "newListings": 35,
    "priceChanges": 8
  },
  "startedAt": "2026-05-03T14:30:00Z"
}
```

#### `GET /api/scraper/history`
Returns past scraping runs.

**Response** `200`:
```json
{
  "runs": [
    {
      "id": 42,
      "startedAt": "2026-05-03T14:30:00Z",
      "completedAt": "2026-05-03T14:45:00Z",
      "status": "completed",
      "listingsFound": 1850,
      "newListings": 35,
      "priceChanges": 8
    }
  ]
}
```

### 4.2 Properties

#### `GET /api/properties`
Paginated property listing with filters.

**Query params**:
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | int | 1 | Page number |
| `limit` | int | 50 | Results per page |
| `transaction_type` | string | `sale` | `sale` or `rent` |
| `type` | string | all | Property type filter |
| `zone` | string | all | Neighborhood zone |
| `price_min` | number | — | Min price EUR |
| `price_max` | number | — | Max price EUR |
| `area_min` | number | — | Min area sqm |
| `area_max` | number | — | Max area sqm |
| `condition` | string | all | Property condition |
| `sort` | string | `price_per_sqm` | Sort field |
| `order` | string | `asc` | `asc` or `desc` |

**Response** `200`:
```json
{
  "properties": [ /* Property objects */ ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1850,
    "totalPages": 37
  }
}
```

#### `GET /api/properties/:id`
Full property detail + price history + strategy scores + leverage analysis.

**Response** `200`:
```json
{
  "property": {
    "id": 123,
    "imotBgUrl": "https://...",
    "type": "apartment_2room",
    "transactionType": "sale",
    "priceEur": 85000,
    "areaSqm": 65,
    "pricePerSqm": 1307.69,
    "neighborhoodZone": "Младост",
    "neighborhoodQuarter": "Младост 1А",
    "floor": 4,
    "totalFloors": 8,
    "constructionYear": 2005,
    "constructionStage": null,
    "condition": "needs_rehab",
    "description": "...",
    "agency": "...",
    "photos": ["url1", "url2"],
    "firstSeenDate": "2026-04-15",
    "lastSeenDate": "2026-05-03",
    "daysOnMarket": 18,
    "isActive": true
  },
  "priceHistory": [
    { "priceEur": 89000, "date": "2026-04-15" },
    { "priceEur": 85000, "date": "2026-04-28" }
  ],
  "neighborhoodContext": {
    "avgSalePriceSqm": 1450,
    "avgRentPrice": 450,
    "grossYield": 4.2
  },
  "leverageSettings": {
    "enabled": true,
    "mortgageRate": 3.5,
    "loanTermYears": 25,
    "downPaymentPct": 20,
    "ltvPct": 80
  },
  "strategies": {
    "brrrr": {
      "score": 125,
      "health": "yellow",
      "flags": ["REFINANCE_VIABLE"],
      "cashMetrics": {
        "totalInvestment": 104500,
        "arv": 94250,
        "monthlyRent": 450,
        "grossYield": 5.17,
        "netYield": 4.14
      },
      "leveragedMetrics": {
        "refinanceLoan": 75400,
        "cashLeftInDeal": 29100,
        "monthlyPayment": 378,
        "monthlyCashFlow": -18,
        "cashOnCash": -7.4,
        "dscr": 0.95,
        "refinanceCovers": 72.1
      },
      "rateSensitivity": [
        { "rate": 3.5, "payment": 378, "cashFlow": -18 },
        { "rate": 4.5, "payment": 418, "cashFlow": -58 },
        { "rate": 5.5, "payment": 460, "cashFlow": -100 }
      ],
      "breakEvenRate": 3.1
    },
    "cashFlow": {
      "score": 4.8,
      "health": "red",
      "flags": ["NEGATIVE_CASH_FLOW", "RATE_SENSITIVE"],
      "cashMetrics": {
        "monthlyRent": 450,
        "grossYield": 6.35,
        "netYield": 4.8,
        "capRate": 4.8,
        "priceToRent": 15.7,
        "paybackYears": 20.8
      },
      "leveragedMetrics": {
        "loanAmount": 68000,
        "downPayment": 17000,
        "monthlyPayment": 341,
        "monthlyCashFlow": -21,
        "cashOnCash": -14.8,
        "dscr": 0.94,
        "leveragedPayback": null
      },
      "rateSensitivity": [
        { "rate": 3.5, "payment": 341, "cashFlow": -21 },
        { "rate": 4.5, "payment": 378, "cashFlow": -58 },
        { "rate": 5.5, "payment": 416, "cashFlow": -96 }
      ],
      "breakEvenRate": 3.0
    }
  }
}
```

### 4.3 Strategies

#### `GET /api/strategies/:name`
Returns properties analyzed through a specific strategy lens with leverage analysis.

**Params**: `name` = `buy-in-green | brrrr | flip | cash-flow | airbnb | below-market`

**Query params**: Same filters as `/api/properties` + `score_min` (minimum strategy score) + `health` (`green|yellow|red` filter).

**Response** `200`:
```json
{
  "strategy": "brrrr",
  "leverageEnabled": true,
  "currentRate": 3.5,
  "summary": {
    "totalCandidates": 245,
    "positiveCashFlow": 68,
    "negativeCashFlow": 177,
    "avgMonthlyFlow": -45,
    "avgCashOnCash": 2.1,
    "topScore": 340,
    "refinanceViable": 42,
    "healthBreakdown": { "green": 12, "yellow": 56, "red": 177 }
  },
  "properties": [
    {
      "id": 123,
      "type": "apartment_2room",
      "priceEur": 85000,
      "areaSqm": 65,
      "neighborhoodZone": "Младост",
      "condition": "needs_rehab",
      "daysOnMarket": 18,
      "score": 125,
      "health": "yellow",
      "flags": ["REFINANCE_VIABLE"],
      "cashMetrics": {
        "purchasePrice": 85000,
        "rehabCost": 19500,
        "totalInvestment": 104500,
        "arv": 94250,
        "monthlyRent": 450,
        "grossYield": 5.17,
        "netYield": 4.14
      },
      "leveragedMetrics": {
        "refinanceLoan": 75400,
        "cashLeftInDeal": 29100,
        "monthlyPayment": 378,
        "monthlyCashFlow": -18,
        "cashOnCash": -7.4,
        "dscr": 0.95,
        "refinanceCovers": 72.1
      },
      "breakEvenRate": 3.1,
      "rateSensitivity": [
        { "rate": 3.5, "payment": 378, "cashFlow": -18 },
        { "rate": 4.5, "payment": 418, "cashFlow": -58 },
        { "rate": 5.5, "payment": 460, "cashFlow": -100 }
      ]
    }
  ],
  "pagination": { /* ... */ }
}
```

### 4.4 Neighborhoods

#### `GET /api/neighborhoods`
Aggregated neighborhood statistics.

**Response** `200`:
```json
{
  "neighborhoods": [
    {
      "zone": "Младост",
      "quarters": ["Младост 1", "Младост 1А", "Младост 2", "Младост 3", "Младост 4"],
      "avgSalePriceSqm": 1450,
      "avgRentPriceSqm": 8.5,
      "avgMonthlyRent": { "apartment_1room": 350, "apartment_2room": 480 },
      "grossYield": 4.2,
      "listingCountSale": 245,
      "listingCountRent": 89,
      "priceTrend": [
        { "date": "2026-04-01", "avgPriceSqm": 1420 },
        { "date": "2026-05-01", "avgPriceSqm": 1450 }
      ]
    }
  ]
}
```

### 4.5 Settings

#### `GET /api/settings`
Returns current user settings.

**Response** `200`:
```json
{
  "general": {
    "rehabCostPerSqm": 300,
    "vacancyRate": 10,
    "maintenancePct": 10,
    "transactionCostsPct": 3,
    "flipTimelineMonths": 6
  },
  "airbnb": {
    "occupancyPct": 60,
    "rates": { "Център": 50, "Витоша": 40 }
  },
  "leverage": {
    "enabled": true,
    "mortgageRate": 3.5,
    "loanTermYears": 25,
    "downPaymentPct": 20,
    "ltvPct": 80,
    "originationFeePct": 0,
    "annualInsuranceEur": 0
  },
  "flags": {
    "cocGreenPct": 8,
    "cocYellowPct": 4,
    "dscrMinimum": 1.25,
    "rateStressPct": 2
  }
}
```

#### `PUT /api/settings`
Updates settings. Body is partial — only send changed fields. Nested structure matches GET.

**Request body** (example — update mortgage rate and toggle leverage):
```json
{
  "leverage": {
    "mortgageRate": 3.8,
    "enabled": true
  }
}
```

**Special behavior**: When `downPaymentPct` is sent, `ltvPct` is auto-computed as `100 - downPaymentPct` and vice versa.

**Response** `200`: Returns full updated settings object (same shape as GET).

### 4.6 Overview

#### `GET /api/overview`
Dashboard summary data. Includes leverage state and health breakdowns.

**Response** `200`:
```json
{
  "totalSaleListings": 1850,
  "totalRentListings": 620,
  "lastScrape": {
    "date": "2026-05-03T14:45:00Z",
    "newListings": 35,
    "priceChanges": 8
  },
  "leverage": {
    "enabled": true,
    "mortgageRate": 3.5,
    "loanTermYears": 25,
    "ltvPct": 80
  },
  "strategySummaries": {
    "buyInGreen": { "count": 42, "avgDiscount": 12.5 },
    "brrrr": {
      "count": 68,
      "avgCashFlow": -45,
      "avgCashOnCash": 2.1,
      "healthBreakdown": { "green": 12, "yellow": 56, "red": 0 }
    },
    "flip": { "count": 34, "avgRoi": 15.2, "avgLeveragedRoi": 28.6 },
    "cashFlow": {
      "count": 120,
      "avgYield": 4.8,
      "avgCashOnCash": 1.2,
      "healthBreakdown": { "green": 8, "yellow": 45, "red": 67 }
    },
    "airbnb": {
      "count": 55,
      "avgYieldVsLongTerm": 1.8,
      "healthBreakdown": { "green": 18, "yellow": 30, "red": 7 }
    },
    "belowMarket": { "count": 28, "avgDiscount": 18.3 }
  },
  "topNeighborhoods": [
    { "zone": "Надежда", "grossYield": 5.8 },
    { "zone": "Люлин", "grossYield": 5.2 }
  ]
}
```

---

## 5. Strategy Engine Design

Each strategy is a pure function: `(property, neighborhoodStats, settings) → { cashMetrics, leveragedMetrics, score, flags, health }`.

Strategies are computed **on-the-fly** when the API is called, using current settings. This means changing the mortgage rate or toggling leverage immediately recalculates all scores — no recomputation job needed.

### 5.1 Mortgage Math Utility (`server/src/utils/mortgage.js`)

Shared functions used by all strategies. No strategy implements mortgage math directly.

```js
module.exports = {
  // Standard annuity formula — fixed monthly P+I payment
  // M = P * [r(1+r)^n] / [(1+r)^n - 1]
  // where r = monthly rate, n = total months
  monthlyPayment(principal, annualRatePct, termYears) → number,

  // Total cost of loan over its lifetime
  totalInterestPaid(principal, annualRatePct, termYears) → number,

  // Interest-only monthly payment (used for Buy in Green during construction)
  interestOnlyPayment(principal, annualRatePct) → number,

  // Find the max annual rate where monthlyCashFlow >= 0
  // Uses binary search between 0% and 20%
  breakEvenRate(principal, termYears, monthlyNetIncome) → number | null,

  // Cash flow at multiple rate points
  // Returns: [{ rate, monthlyPayment, monthlyCashFlow }]
  rateSensitivity(principal, termYears, monthlyNetIncome, currentRate, steps = [0, 1, 2]) → array,

  // Loan amount from property price and LTV
  loanAmount(propertyPrice, ltvPct) → number,

  // Down payment (= price - loan)
  downPayment(propertyPrice, downPaymentPct) → number,

  // Origination fee (one-time)
  originationFee(loanAmount, feePct) → number,

  // DSCR = Net Operating Income / Annual Debt Service
  dscr(annualNOI, annualDebtService) → number
}
```

### 5.2 Health Flag Engine (`server/src/utils/healthFlags.js`)

Evaluates a property's leveraged metrics against configurable thresholds. Returns a traffic-light color and an array of flag labels.

```js
// Input: leveraged metrics from any strategy + flag thresholds from settings
// Output: { health: 'green' | 'yellow' | 'red', flags: string[] }

module.exports = {
  evaluate(leveragedMetrics, settings) → {
    health: 'green' | 'yellow' | 'red',
    flags: [
      // Possible flags:
      // 'STRONG_LEVERAGED_RETURN' — CoC >= green threshold
      // 'NEGATIVE_CASH_FLOW'     — monthly cash flow < 0
      // 'LOW_DSCR'               — DSCR < minimum
      // 'RATE_SENSITIVE'         — breakeven rate within stress buffer of current rate
      // 'REFINANCE_VIABLE'       — (BRRRR only) refinance covers >75% of investment
      // 'INSTANT_EQUITY'         — (Below-Market only) discount > down payment
    ]
  }
}
```

**Traffic-light logic** (evaluated in order, first match wins):

```
GREEN if:
  cashOnCash >= flag_coc_green_pct
  AND monthlyCashFlow > 0
  AND dscr >= flag_dscr_minimum

RED if:
  monthlyCashFlow < 0 AND cashOnCash < flag_coc_yellow_pct
  OR breakEvenRate <= currentRate

YELLOW: everything else
```

Additional flags are appended independently of the traffic light color.

### 5.3 Strategy Interface (Updated)

```js
module.exports = {
  name: 'brrrr',
  displayName: 'BRRRR',

  isApplicable(property) → boolean,

  // Returns BOTH cash-only and leveraged analysis
  analyze(property, neighborhoodStats, settings) → {
    cashMetrics: { ... },           // Always computed
    leveragedMetrics: { ... },      // Computed when settings.leverage_enabled
    score: number,                  // Based on leveragedMetrics when ON, cashMetrics when OFF
    health: 'green'|'yellow'|'red', // Traffic light (null when leverage OFF)
    flags: string[],                // Flag labels
    rateSensitivity: [              // null when leverage OFF
      { rate: 3.5, payment: 320, cashFlow: 130 },
      { rate: 4.5, payment: 356, cashFlow: 94 },
      { rate: 5.5, payment: 394, cashFlow: 56 }
    ],
    breakEvenRate: number | null    // null when leverage OFF or no rental income
  },

  summarize(results[]) → { ... }
}
```

### 5.4 Strategy Computation Flow (Updated)

```
GET /api/strategies/brrrr
  │
  ├─ 1. Load user_settings (includes leverage + flag thresholds)
  ├─ 2. Load neighborhood_stats
  ├─ 3. Query properties (sale, active, with filters)
  ├─ 4. For each property:
  │     ├─ brrrr.isApplicable(property) → skip if false
  │     ├─ brrrr.analyze(property, stats, settings) → result
  │     │     ├─ Always compute cashMetrics
  │     │     ├─ If leverage_enabled:
  │     │     │     ├─ Compute leveragedMetrics using mortgage.js
  │     │     │     ├─ Compute rateSensitivity + breakEvenRate
  │     │     │     ├─ Compute health + flags via healthFlags.evaluate()
  │     │     │     └─ score = leveraged score
  │     │     └─ Else:
  │     │           ├─ leveragedMetrics = null
  │     │           ├─ health = null, flags = []
  │     │           └─ score = cash-only score
  │     └─ Attach result to property
  ├─ 5. Sort by score descending
  ├─ 6. Paginate
  └─ 7. brrrr.summarize(allResults) → summary stats (includes leverage summary)
```

### 5.5 Per-Strategy Leverage Calculations

#### Buy in Green

```
cashMetrics:
  potentialProfit = (avgFinishedPriceSqm - greenPriceSqm) * area
  appreciationPct = potentialProfit / (greenPriceSqm * area) * 100

leveragedMetrics:
  loan = loanAmount(purchasePrice, ltvPct)
  down = downPayment(purchasePrice, downPaymentPct)
  holdMonths = constructionStage == 'act14' ? 18 : 8
  interestDuringConstruction = interestOnlyPayment(loan, mortgageRate) * holdMonths
  origFee = originationFee(loan, originationFeePct)
  totalCashDeployed = down + interestDuringConstruction + origFee
  leveragedProfit = potentialProfit - interestDuringConstruction - origFee
  leveragedROI = leveragedProfit / totalCashDeployed * 100
```

#### BRRRR

```
cashMetrics:
  totalInvestment = purchasePrice + rehabCost
  arv = neighborhoodStats.avgSalePriceSqm * area  (for renovated)
  monthlyRent = neighborhoodStats.avgRentPrice
  grossYield = (monthlyRent * 12) / totalInvestment * 100
  netYield = grossYield * (1 - vacancyRate/100 - maintenancePct/100)

leveragedMetrics:
  refinanceLoan = loanAmount(arv, ltvPct)
  cashLeftInDeal = max(0, totalInvestment - refinanceLoan)
  payment = monthlyPayment(refinanceLoan, mortgageRate, loanTermYears)
  monthlyNOI = monthlyRent * (1 - vacancyRate/100 - maintenancePct/100)
  monthlyCashFlow = monthlyNOI - payment - annualInsurance/12
  cashOnCash = cashLeftInDeal > 0 ? (monthlyCashFlow * 12) / cashLeftInDeal * 100 : Infinity
  dscr = (monthlyNOI * 12) / (payment * 12)
  refinanceCovers = refinanceLoan / totalInvestment * 100
```

#### Fix & Flip

```
cashMetrics:
  arv = neighborhoodStats.avgSalePriceSqm * area
  profit = arv - purchasePrice - rehabCost - (arv * transactionCostsPct/100)
  roi = profit / (purchasePrice + rehabCost) * 100
  annualizedROI = roi * (12 / flipTimelineMonths)

leveragedMetrics:
  loan = loanAmount(purchasePrice, ltvPct)
  down = downPayment(purchasePrice, downPaymentPct)
  cashDeployed = down + rehabCost
  interestCost = monthlyPayment(loan, mortgageRate, loanTermYears) * flipTimelineMonths
  origFee = originationFee(loan, originationFeePct)
  leveragedProfit = arv - purchasePrice - rehabCost - (arv * transactionCostsPct/100) - interestCost - origFee
  leveragedROI = leveragedProfit / cashDeployed * 100
  leveragedAnnualizedROI = leveragedROI * (12 / flipTimelineMonths)
```

#### Cash Flow Rental

```
cashMetrics:
  monthlyRent = neighborhoodStats.avgRentPrice
  grossYield = (monthlyRent * 12) / purchasePrice * 100
  monthlyNOI = monthlyRent * (1 - vacancyRate/100 - maintenancePct/100)
  netYield = (monthlyNOI * 12) / purchasePrice * 100
  capRate = netYield  (same for unleveraged)
  priceToRent = purchasePrice / (monthlyRent * 12)
  paybackYears = purchasePrice / (monthlyNOI * 12)

leveragedMetrics:
  loan = loanAmount(purchasePrice, ltvPct)
  down = downPayment(purchasePrice, downPaymentPct)
  payment = monthlyPayment(loan, mortgageRate, loanTermYears)
  monthlyCashFlow = monthlyNOI - payment - annualInsurance/12
  cashOnCash = (monthlyCashFlow * 12) / down * 100
  dscr = (monthlyNOI * 12) / (payment * 12)
  leveragedPayback = down / (monthlyCashFlow * 12)  (if cashFlow > 0, else Infinity)
```

#### Airbnb / Short-Term

```
cashMetrics:
  monthlyRevenue = nightlyRate * 30 * occupancyPct/100
  opex = monthlyRevenue * 0.30
  monthlyNet = monthlyRevenue - opex
  grossYield = (monthlyRevenue * 12) / purchasePrice * 100
  netYield = (monthlyNet * 12) / purchasePrice * 100

leveragedMetrics:
  loan = loanAmount(purchasePrice, ltvPct)
  down = downPayment(purchasePrice, downPaymentPct)
  payment = monthlyPayment(loan, mortgageRate, loanTermYears)
  monthlyCashFlow = monthlyNet - payment - annualInsurance/12
  cashOnCash = (monthlyCashFlow * 12) / down * 100
  dscr = (monthlyNet * 12) / (payment * 12)
  // Also compute long-term rental leveraged yield for comparison
  ltMonthlyRent = neighborhoodStats.avgRentPrice
  ltMonthlyCashFlow = ltMonthlyRent * 0.8 - payment - annualInsurance/12
  leveragedYieldMultiplier = monthlyCashFlow / ltMonthlyCashFlow  (if ltCashFlow > 0)
```

#### Below-Market Deals

```
cashMetrics:
  marketValue = neighborhoodStats.avgSalePriceSqm * area
  discountAmount = marketValue - purchasePrice
  discountPct = discountAmount / marketValue * 100
  (+ priceDrops, daysOnMarket from property data)

leveragedMetrics:
  loan = loanAmount(purchasePrice, ltvPct)
  down = downPayment(purchasePrice, downPaymentPct)
  instantEquity = discountAmount
  effectiveLTV = loan / marketValue * 100   (lower than stated LTV)
  equityOnCash = instantEquity / down * 100
  // If rented (has rental data), also compute leveraged cash flow:
  monthlyRent = neighborhoodStats.avgRentPrice  (may be null)
  if monthlyRent:
    monthlyNOI = monthlyRent * (1 - vacancyRate/100 - maintenancePct/100)
    payment = monthlyPayment(loan, mortgageRate, loanTermYears)
    monthlyCashFlow = monthlyNOI - payment - annualInsurance/12
    cashOnCash = (monthlyCashFlow * 12) / down * 100
```

### 5.6 Neighborhood Stats (Precomputed)

After each scraping run, `neighborhood_stats` is refreshed:

```
For each (zone, property_type) combination:
  - avg_sale_price_sqm = AVG(price_per_sqm) WHERE transaction_type='sale'
  - avg_rent_price     = AVG(price_eur) WHERE transaction_type='rent'
  - gross_yield        = (avg_rent * 12) / (avg_sale_price_sqm * avg_area) * 100
```

This avoids expensive aggregations on every strategy request.

---

## 6. Scraper Design

### 6.1 Scraping Flow

```
User clicks "Start Scrape"
  │
  ├─ POST /api/scraper/start
  │     └─ Creates scraping_run row, spawns async worker
  │
  ├─ Phase 1: Sale Listings
  │     ├─ Fetch search page 1 (apartments, Sofia, sale)
  │     ├─ Parse listing count → compute total pages
  │     ├─ For each page (with 1-2s delay between):
  │     │     ├─ Fetch page HTML
  │     │     ├─ Decode windows-1251 → UTF-8
  │     │     ├─ Parse each listing card → extract fields
  │     │     ├─ Fetch detail page for each listing (with 0.5-1s delay)
  │     │     │     └─ Extract: construction year, stage, full description
  │     │     ├─ Classify condition via keyword matching
  │     │     ├─ Convert BGN → EUR if needed
  │     │     ├─ Map quarter → zone
  │     │     └─ Upsert into properties table
  │     └─ Update scraping_run progress
  │
  ├─ Phase 2: Rental Listings (same flow)
  │
  ├─ Phase 3: Post-Processing
  │     ├─ Detect price changes (compare with previous price_history)
  │     ├─ Mark unseen properties as is_active=0
  │     └─ Recompute neighborhood_stats
  │
  └─ Phase 4: Complete
        └─ Update scraping_run: status=completed, stats
```

### 6.2 Encoding Handling

imot.bg uses `windows-1251` encoding. The scraper will:
1. Fetch raw response as `ArrayBuffer` (not auto-decoded)
2. Decode using `iconv-lite` with `win1251` codec
3. All internal storage and API responses in UTF-8

### 6.3 Condition Detection (Bulgarian Keywords)

```js
const CONDITION_PATTERNS = {
  needs_rehab: [
    'за ремонт', 'необходим ремонт', 'за основен ремонт',
    'стар ремонт', 'без ремонт'
  ],
  partially_renovated: [
    'частичен ремонт', 'частично ремонтиран'
  ],
  fully_renovated: [
    'луксозно ремонтиран', 'ремонтиран', 'след ремонт',
    'основен ремонт', 'ново обзавеждане', 'обзаведен',
    'отлично състояние'
  ],
  new: [
    'ново строителство', 'нова кооперация', 'Акт 16',
    'до ключ', 'първи собственик'
  ]
};
```

### 6.4 Neighborhood Zone Mapping

```js
const ZONE_MAP = {
  'Младост': ['Младост 1', 'Младост 1А', 'Младост 2', 'Младост 3', 'Младост 4'],
  'Люлин': ['Люлин 1', 'Люлин 2', 'Люлин 3', 'Люлин 4', 'Люлин 5',
             'Люлин 6', 'Люлин 7', 'Люлин 8', 'Люлин 9', 'Люлин 10'],
  'Център': ['Център', 'Оборище', 'Средец', 'Възраждане', 'Сердика'],
  'Витоша': ['Витоша', 'Бояна', 'Драгалевци', 'Симеоново'],
  'Лозенец': ['Лозенец'],
  'Студентски град': ['Студентски град', 'Малинова долина'],
  'Надежда': ['Надежда 1', 'Надежда 2', 'Надежда 3', 'Надежда 4'],
  'Дружба': ['Дружба 1', 'Дружба 2'],
  'Овча купел': ['Овча купел 1', 'Овча купел 2'],
  'Банишора': ['Банишора'],
  'Борово': ['Борово', 'Бъкстон'],
  'Гео Милев': ['Гео Милев'],
  'Дианабад': ['Дианабад'],
  'Докторски паметник': ['Докторски паметник'],
  'Иван Вазов': ['Иван Вазов'],
  'Изгрев': ['Изгрев'],
  'Изток': ['Изток'],
  'Красна поляна': ['Красна поляна 1', 'Красна поляна 2', 'Красна поляна 3'],
  'Красно село': ['Красно село'],
  'Кръстова вада': ['Кръстова вада'],
  'Левски': ['Левски В', 'Левски Г'],
  'Манастирски ливади': ['Манастирски ливади'],
  'Мусагеница': ['Мусагеница'],
  'Обеля': ['Обеля 1', 'Обеля 2'],
  'Подуяне': ['Подуяне'],
  'Редута': ['Редута'],
  'Слатина': ['Слатина'],
  'Стрелбище': ['Стрелбище'],
  'Хаджи Димитър': ['Хаджи Димитър'],
  'Хиподрума': ['Хиподрума'],
  'Хладилника': ['Хладилника'],
  'Яворов': ['Яворов']
};
// Quarters not in this map get their own zone (zone = quarter)
```

### 6.5 Rate Limiting

- **Between search pages**: 1.5s delay
- **Between detail pages**: 0.8s delay
- **Max concurrent requests**: 1 (sequential)
- **User-Agent**: Standard browser UA string
- **On HTTP 429 or 503**: Exponential backoff (2s, 4s, 8s), max 3 retries

---

## 7. Frontend Component Design

### 7.1 Page Layout

```
┌──────────────────────────────────────────────────────────────┐
│  RE Investment Analyzer          [Scrape Now ▶]  Last: 2h ago│
├──────────┬───────────────────────────────────────────────────┤
│          │                                                    │
│ SIDEBAR  │              MAIN CONTENT AREA                    │
│          │                                                    │
│ Overview │  (varies by selected page)                        │
│ ──────── │                                                    │
│ STRATEGIES│                                                   │
│ На Зелено│                                                    │
│ BRRRR    │                                                    │
│ Flip     │                                                    │
│ Cash Flow│                                                    │
│ Airbnb   │                                                    │
│ Below Mkt│                                                    │
│ ──────── │                                                    │
│ Neighborh│                                                    │
│ Settings │                                                    │
│          │                                                    │
└──────────┴───────────────────────────────────────────────────┘
```

### 7.2 Overview Page

```
┌──────────────────────────────────────────────────────────────────┐
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────┐           │
│  │  1,850  │ │   620   │ │  Last   │ │   35 new     │           │
│  │  Sales  │ │ Rentals │ │ Scrape  │ │  8 price Δ   │           │
│  └─────────┘ └─────────┘ └─────────┘ └──────────────┘           │
│                                                                   │
│  ┌─ Current Mortgage Assumptions ──────────────────────────────┐  │
│  │ Rate: 3.5%  |  Term: 25yr  |  LTV: 80%  |  Leverage: [ON] │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Strategy Opportunities                                           │
│  ┌────────────┬────────────┬────────────┬────────────┐           │
│  │ На Зелено  │   BRRRR   │    Flip    │ Cash Flow  │           │
│  │  42 deals  │  68 deals │  34 deals  │ 120 deals  │           │
│  │ avg -12.5% │ avg CoC 2%│ avg 15% ROI│ avg CoC 1% │           │
│  │            │ G12 Y56   │            │ G8 Y45     │           │
│  └────────────┴────────────┴────────────┴────────────┘           │
│  ┌────────────┬────────────┐                                     │
│  │   Airbnb   │ Below Mkt  │                                     │
│  │  55 deals  │  28 deals  │                                     │
│  │ 1.8x vs LT │ avg -18%  │                                     │
│  │ G18 Y30    │            │                                     │
│  └────────────┴────────────┘                                     │
│                                                                   │
│  Top Neighborhoods by Yield        Price/sqm by Zone             │
│  ┌────────────────────────┐  ┌────────────────────────┐          │
│  │  Bar chart             │  │  Horizontal bar chart  │          │
│  │  (yield % by zone)     │  │  (avg price/sqm)       │          │
│  └────────────────────────┘  └────────────────────────┘          │
└──────────────────────────────────────────────────────────────────┘
```

The overview shows current mortgage assumptions as a compact bar so you always know what rate is being used. Strategy summary cards include health breakdown counts (G=green, Y=yellow) when leverage is ON.

### 7.3 Strategy Page (Shared Layout, Strategy-Specific Columns)

```
┌──────────────────────────────────────────────────────────────────────┐
│  BRRRR Strategy                                   68 opportunities   │
│                                                                      │
│  Summary Cards:                                                      │
│  [Avg Cash Flow: -€45] [Avg CoC: 2.1%] [Refinance Viable: 42]      │
│  [🟢 12] [🟡 56] [🔴 177]                  Leverage: [ON ▪ off]    │
│                                                                      │
│  ┌─ Filters ──────────────────────────────────────────────────────┐  │
│  │ Zone: [All ▼]  Type: [All ▼]  Price: [___]-[___]              │  │
│  │ Area: [___]-[___]  Condition: [All ▼]  Health: [All ▼]        │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌─ Results Table ────────────────────────────────────────────────┐  │
│  │    │▼Score│ Price │ Area│ Zone   │ Yield│CashFlow│ CoC  │BERate│  │
│  │────────────────────────────────────────────────────────────────│  │
│  │ 🟢 │ 340  │45000 │ 55  │Надежда │ 6.2% │ +€140  │10.2% │ 6.8% │  │
│  │ 🟡 │ 285  │62000 │ 70  │Люлин   │ 5.8% │  +€42  │ 5.1% │ 4.9% │  │
│  │ 🔴 │ 125  │85000 │ 65  │Младост │ 4.1% │  -€18  │-7.4% │ 3.1% │  │
│  │    │      │      │     │        │      │  [▸]   │      │      │  │
│  │    │ Rate sensitivity (expanded):                              │  │
│  │    │ 3.5%: -€18/mo  │  4.5%: -€58/mo  │  5.5%: -€100/mo     │  │
│  │    │ Breakeven: 3.1% ⚠️ RATE_SENSITIVE                        │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                        Page 1 of 5   │
└──────────────────────────────────────────────────────────────────────┘
```

**Table columns when leverage ON**: Health badge, Score, Price, Area, Zone, Net Yield (cash), Cash Flow (leveraged), CoC (leveraged), Breakeven Rate. Each row expandable to show rate sensitivity mini-table.

**Table columns when leverage OFF**: Score, Price, Area, Zone, Net Yield, Gross Yield (strategy-specific columns only — no leveraged columns shown).

### 7.4 Settings Page (Updated with Mortgage Panel)

```
┌──────────────────────────────────────────────────────────────────┐
│  Settings                                                         │
│                                                                   │
│  ┌─ General Assumptions ───────────────────────────────────────┐  │
│  │ Rehab cost/sqm: [300] EUR    Vacancy rate: [10] %          │  │
│  │ Maintenance:    [10] %       Transaction costs: [3] %      │  │
│  │ Flip timeline:  [6] months                                 │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌─ Mortgage / Leverage ───────────────────────────────────────┐  │
│  │ Enable leverage analysis:  [■ ON / □ OFF]                  │  │
│  │                                                             │  │
│  │ Interest rate:     [3.5] %    ← Update when bank quote     │  │
│  │                                  changes                    │  │
│  │ Loan term:         [25] years                               │  │
│  │ Down payment:      [20] %  ←→  LTV: [80] %  (linked)      │  │
│  │ Origination fee:   [0] %                                    │  │
│  │ Annual insurance:  [0] EUR/year                             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌─ Investment Health Thresholds ──────────────────────────────┐  │
│  │ 🟢 Green (strong): CoC ≥ [8] %  AND  DSCR ≥ [1.25]       │  │
│  │ 🟡 Yellow (watch):  CoC ≥ [4] %                            │  │
│  │ 🔴 Red (risky):     below yellow thresholds                │  │
│  │ Rate stress test:   current rate + [2] %                    │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌─ Airbnb ────────────────────────────────────────────────────┐  │
│  │ Occupancy rate: [60] %                                      │  │
│  │ Nightly rates by neighborhood:                              │  │
│  │   Център: [50] EUR    Витоша: [40] EUR    ...               │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│                                           [Save Settings]         │
└──────────────────────────────────────────────────────────────────┘
```

### 7.5 New Frontend Components

#### `HealthBadge.jsx`
Small colored circle/pill badge: green, yellow, or red. Shown in table rows and property cards.
- Props: `health: 'green' | 'yellow' | 'red' | null`, `size: 'sm' | 'md'`
- When `null` (leverage off): renders nothing

#### `RateSensitivity.jsx`
Expandable mini-table showing cash flow at 3 rate points + breakeven rate.
- Props: `rateSensitivity: array`, `breakEvenRate: number`, `currentRate: number`
- Used in: strategy table expandable rows + PropertyDetail page
- Highlights the breakeven rate in red if within stress buffer

#### `LeverageToggle.jsx`
Reads leverage state from settings React Query cache. Shows "Leverage: ON/OFF" toggle in strategy page headers.
- Toggling calls `PUT /api/settings` and invalidates all strategy queries
- Visual: switch/toggle component matching the app's design system

### 7.6 React Routing

```
/                          → Overview
/strategy/buy-in-green     → StrategyView (strategy="buy-in-green")
/strategy/brrrr            → StrategyView (strategy="brrrr")
/strategy/flip             → StrategyView (strategy="flip")
/strategy/cash-flow        → StrategyView (strategy="cash-flow")
/strategy/airbnb           → StrategyView (strategy="airbnb")
/strategy/below-market     → StrategyView (strategy="below-market")
/property/:id              → PropertyDetail
/neighborhoods             → Neighborhoods
/settings                  → Settings
```

### 7.7 Key Frontend Libraries

| Library | Purpose |
|---|---|
| `react-router-dom` | Client-side routing |
| `@tanstack/react-query` | Server state management, polling scraper status |
| `@tanstack/react-table` | Headless table with sorting, filtering, pagination |
| `recharts` | Charts (bar, line, area) |
| `tailwindcss` | Utility-first styling |
| `shadcn/ui` | Pre-built components (cards, buttons, tabs, inputs) |
| `lucide-react` | Icons |
| `axios` | HTTP client |

---

## 8. Scrape Progress & Real-Time Updates

No WebSockets needed — simple polling:

```
Frontend:                          Backend:
                                   
ScrapeButton click                 
  → POST /api/scraper/start        → Creates run, spawns worker
  → Start polling every 2s:        
     GET /api/scraper/status        → Returns progress object
  → Update progress bar             
  → When status=completed:          
     → Stop polling                 
     → Invalidate React Query       
       cache (refetch all data)     
```

---

## 9. Error Handling Strategy

| Layer | Approach |
|---|---|
| Scraper HTTP errors | Retry 3x with backoff, then skip listing and log |
| Scraper parse errors | Log + skip individual listing, continue run |
| DB errors | Fail the scraping run, return error in status |
| API errors | Standard HTTP codes + JSON error body |
| Frontend errors | React Query retry (3x), error states in UI |

---

## 10. Performance Considerations

| Concern | Solution |
|---|---|
| 2000-5000 listings in memory | Server-side pagination (50/page default) |
| Strategy computation on 2000+ rows | Computed per-request but fast (pure math, no I/O) |
| Leverage + sensitivity adds ~3x math per property | Still pure arithmetic — no measurable latency impact |
| Breakeven rate binary search per property | Converges in ~15 iterations, <0.1ms per property |
| Neighborhood stats aggregation | Precomputed after scrape, stored in `neighborhood_stats` |
| Scrape duration (~15-30 min) | Background worker, async, progress polling |
| SQLite concurrent access | Single writer (scraper), multiple readers (API) — fine for SQLite |

---

*Updated: 2026-05-04 | Project: realestate-investing*
*Next: `/sc:implement` to build it*
