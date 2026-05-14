# Market Data Coverage And Rental Comps Design

## Context

The application currently scrapes imot.bg sale listings and uses those records to power strategy pages, neighborhood stats, price history, and deal triage. The current scraper has a data-validity problem: `pages = 1` only selects the first sale category URL, so the default run scans a small slice of the Sofia sale market rather than page 1 across every category.

The scraper also marks every previously seen imot.bg listing inactive when it is absent from that partial run. That can make listings look inactive simply because the latest scrape did not cover their category.

Strategy rent assumptions are also model-based. `estimatedMonthlyRent()` derives rent from purchase price and target gross yield, so Cash Flow and the long-term Airbnb comparison do not yet use scraped rental comps.

## Goal

Upgrade ingestion so the app has more credible market data:

- Scrape all configured sale categories by default.
- Add rental listing scraping for Sofia.
- Use a conservative, configurable per-category page cap by default.
- Support deeper or full crawls when requested.
- Prevent bounded crawls from globally deactivating unseen listings.
- Use rental comps for long-term rent estimates when enough similar active rentals exist.
- Fall back to the existing target-yield rent estimate when comps are sparse.

## Non-Goals

- Do not add scheduled scraping in this change.
- Do not add new listing sources beyond imot.bg.
- Do not build a full rental analytics page in the first implementation.
- Do not replace Airbnb short-term revenue assumptions with scraped short-term rental data.
- Do not remove the existing target-yield fallback.
- Do not change strategy routes or navigation structure except for small labels needed to explain data freshness.

## Recommended Approach

Add an explicit scrape plan instead of using `pages` to slice categories.

The scrape plan should describe work items using:

- `purpose`: `sale` or `rent`
- `category`: category identifier such as `dvustaen`, `tristaen`, `chetiristaen`, `mnogostaen`, or `kashta`
- `resultPage`: one-based result page number
- `url`: the generated imot.bg search URL

Default scrape behavior should:

- Include sale listings.
- Include rental listings.
- Scan every configured category for each included purpose.
- Cap each purpose/category pair at `maxPagesPerCategory = 5` unless overridden.
- Allow a full crawl mode for manual deep refreshes.

This gives the app materially better coverage while keeping the default run bounded and predictable.

## Scrape Scope And Inactive Listings

Inactive marking must become scope-aware.

A bounded scrape should not mark all unseen imot.bg listings inactive. It should only update inactivity for listing groups whose scope was actually scanned with enough confidence.

Rules:

- A completed full crawl can mark unseen listings inactive for every included purpose/category.
- A completed bounded crawl can mark unseen listings inactive only within the exact purpose/category/page scope that was scanned, or it can avoid inactive marking and rely on `last_seen_at` freshness.
- A failed or partially completed run must not mark unseen listings inactive for unscanned scopes.
- Sale and rental listings must never deactivate each other.

The first implementation should prefer conservative behavior: only mark inactive within completed scanned scopes and keep stale but unscanned records active until a full or relevant scoped crawl proves they disappeared.

## Data Model

Extend `properties` so sale and rental listings can share the ingestion pipeline.

Add columns to `properties`:

- `listing_purpose TEXT NOT NULL DEFAULT 'sale'`
- `category TEXT`

Add a `scraping_run_scopes` table to record the completed scope of each run:

```sql
CREATE TABLE IF NOT EXISTS scraping_run_scopes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  listing_purpose TEXT NOT NULL,
  category TEXT NOT NULL,
  pages_planned INTEGER NOT NULL,
  pages_scraped INTEGER NOT NULL,
  full_scope INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (run_id) REFERENCES scraping_runs(id) ON DELETE CASCADE
);
```

For sale listings, `price_eur` remains asking purchase price.

For rental listings, `price_eur` means monthly rent. UI and API labels should call it rent when `listing_purpose = 'rent'` to avoid ambiguity.

Shared fields should continue to be stored where available:

- external id
- source
- URL
- title
- neighborhood
- zone
- type
- condition
- area
- price per sqm
- floor and total floors
- rooms
- construction stage/year if found
- description
- image URL
- first seen, last seen, active state

Queries that feed acquisition strategy pages should filter to `listing_purpose = 'sale'`. Rental listings are supporting comps and should not appear as purchase candidates.

## Rental Comp Estimator

Add a rental estimate helper used by strategies that need long-term rent.

Estimator behavior:

1. Prefer active rental listings in the same neighborhood and same type or room count.
2. If fewer than 3 comps exist, try active rental listings in the same zone and same type or room count.
3. When the sale property has area and at least 3 selected comps also have area, estimate from median rent per sqm multiplied by the sale property area.
4. Otherwise, use median monthly rent from the selected comps.
5. If there are still fewer than 3 comps, fall back to the current target-gross-yield estimate.

The helper should return both the value and metadata:

```json
{
  "monthlyRent": 650,
  "source": "neighborhood_comps",
  "sampleSize": 5,
  "fallback": false
}
```

Allowed sources:

- `neighborhood_comps`
- `zone_comps`
- `target_yield_fallback`

## Strategy Behavior

Cash Flow should use the rental comp estimator for:

- `monthlyRent`
- monthly NOI
- gross yield
- net yield
- cap rate
- leveraged metrics

Airbnb should keep its short-term revenue model, but use the rental comp estimator for:

- `longTermMonthlyNOI`
- long-term comparison
- long-term leveraged cash flow

Strategies that do not depend on rent should remain unchanged except that their property queries should continue to use sale listings only.

If rental comps are unavailable, strategy output should remain stable by falling back to the current target-yield rent estimate.

## API

`POST /api/scraper/start` should accept optional settings:

```json
{
  "includeSales": true,
  "includeRentals": true,
  "maxPagesPerCategory": 5,
  "fullCrawl": false
}
```

Defaults:

- `includeSales: true`
- `includeRentals: true`
- `maxPagesPerCategory: 5`
- `fullCrawl: false`

`GET /api/scraper/status` should remain compatible with the current progress shape and add richer fields when available:

```json
{
  "status": "running",
  "progress": {
    "currentPage": 4,
    "totalPages": 50,
    "listingsProcessed": 92,
    "salePagesScraped": 3,
    "rentalPagesScraped": 1,
    "currentPurpose": "rent",
    "currentCategory": "dvustaen"
  }
}
```

Overview should report sale and rental inventory separately:

- active sale listings
- active rental comps
- last scrape status

Strategy responses that use rent should include rent-estimate metadata in their metrics so the UI can explain whether rent came from comps or fallback.

## UI

Keep the default scrape entry point simple.

The main button can continue to run the default conservative scrape. Add a compact scrape-options control near the button or in Settings with:

- default bounded crawl
- deeper bounded crawl
- full crawl
- include rentals toggle

Overview should distinguish:

- active sale listings
- active rental comps
- latest scrape status
- whether the latest run was partial or full

Cash Flow and Airbnb views should show a compact rent-source label or tooltip when rent-sensitive metrics are based on:

- neighborhood comps
- zone comps
- target-yield fallback

If the latest scrape was bounded, the UI should use wording such as `partial crawl` instead of implying the full market is fresh.

## Error Handling

- Per-listing detail-page failures should keep the run going and save the search-result data.
- Search-page failures should mark the run failed only when the page cannot be fetched after retries.
- Failed or incomplete runs should not deactivate unseen listings.
- Parser failures for individual listings should skip those listings and continue where practical.
- Rental comp estimation should never throw for sparse data; it should return the target-yield fallback.

## Testing

Backend tests:

- Search plan generation covers all sale and rental categories.
- Bounded crawl generates all configured categories up to the page cap.
- Full crawl supports deeper pagination without slicing categories.
- Sale listings and rental listings are stored with distinct `listing_purpose` values.
- Strategy property queries exclude rental listings.
- Bounded scrapes do not globally deactivate unseen listings.
- Scoped inactive marking does not let sale and rent records deactivate each other.
- Rental comp estimator chooses neighborhood comps when at least 3 exist.
- Rental comp estimator falls back to zone comps when neighborhood comps are sparse.
- Rental comp estimator falls back to target-yield when comps are sparse.
- Cash Flow and Airbnb use estimator output consistently.

Frontend tests:

- Scrape options submit expected request bodies.
- Overview displays separate sale and rental counts.
- Rent-sensitive strategy rows or details show rent source metadata.
- Existing loading, empty, and error states still render correctly.

Existing server and client tests should continue passing.

## Risks

imot.bg URL structure and pagination may differ by purpose or category. The implementation should keep URL generation isolated and covered by tests.

Rental comps can be noisy because listing quality varies and some rentals may be short-term, furnished, luxury, or incorrectly categorized. Median-based estimates and minimum sample sizes reduce but do not eliminate that risk.

Longer scrapes increase runtime and request volume. Conservative defaults, explicit full-crawl mode, delays, and retries keep the first version practical for local use.

## Acceptance Criteria

- Default scrape covers all configured sale categories and rental categories up to the default cap.
- The scraper no longer interprets `pages = 1` as "only the first category."
- Bounded scrapes do not incorrectly mark unrelated unseen listings inactive.
- Rental listings are persisted separately from sale purchase candidates.
- Overview distinguishes active sale listings from active rental comps.
- Cash Flow uses rental comps when at least 3 credible similar comps exist.
- Airbnb long-term comparison uses rental comps when at least 3 credible similar comps exist.
- Rent-sensitive metrics expose whether the estimate came from neighborhood comps, zone comps, or target-yield fallback.
- Focused backend tests and existing regression tests pass.
