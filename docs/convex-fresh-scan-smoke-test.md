# Convex Fresh Scan Smoke Test

This app does not migrate `data/realestate.db` into Convex. Treat Convex as the source of truth for this migration path: a new Convex dev deployment starts empty, and the dataset is populated by a fresh imot.bg scrape.

No smoke-test step should import, copy, or read from `data/realestate.db`.

## Prerequisites

Run these from the repository root in PowerShell:

```powershell
npm install
npx convex dev
```

Keep `npx convex dev` running. Copy the Convex dev deployment URL it prints, then set it for the server process:

```powershell
$env:CONVEX_URL = "<convex dev url>"
```

## Start The App

Open two additional PowerShell terminals from the repository root.

Terminal 1:

```powershell
$env:CONVEX_URL = "<convex dev url>"
npm.cmd run dev:server
```

Terminal 2:

```powershell
npm.cmd run dev:client
```

Open the client at `http://localhost:5173`. The API server listens on `http://localhost:3001`, and Vite proxies `/api` to it.

## Run A Bounded Scrape

Use the UI on the overview page:

1. Leave the scrape mode as `Default crawl`.
2. Leave `Rentals` checked unless intentionally testing sale-only behavior.
3. Click `Run scrape`.

The default crawl sends a bounded request equivalent to:

```json
{
  "includeSales": true,
  "includeRentals": true,
  "maxPagesPerCategory": 5,
  "fullCrawl": false
}
```

PowerShell API equivalent:

```powershell
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/api/scraper/start" -ContentType "application/json" -Body '{"includeSales":true,"includeRentals":true,"maxPagesPerCategory":5,"fullCrawl":false}'
```

## Verify Scraper Run State

While the scrape is running:

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/scraper/status"
```

Expected:

- `status` moves from `running` to `completed`.
- `crawlMode` is `bounded`.
- `progress.currentPage`, `progress.totalPages`, `progress.salePagesScraped`, and `progress.rentalPagesScraped` reflect bounded progress.
- `listingsFound` and `listingsSaved` are greater than zero unless the source site returned no matching listings.

After completion:

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/scraper/history"
```

Expected:

- The latest run is present in `runs`.
- The latest run has `status` `completed`.
- Timestamps and saved listing counts match the status endpoint.

## Verify Overview Counts

Refresh `http://localhost:5173`.

Expected:

- Overview summary cards show non-zero active listing counts after a successful scrape.
- Strategy opportunity summaries render from Convex-populated data.
- Mortgage assumptions and leverage state render from Convex settings.

API check:

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/overview"
```

Confirm totals, strategy summaries, and the latest scrape metadata reflect the fresh scrape.

## Verify Strategy Pages

Open at least one strategy page, for example:

- `http://localhost:5173/strategy/brrrr`
- `http://localhost:5173/strategy/cash-flow`
- `http://localhost:5173/strategy/below-market`

Expected:

- The table lists scraped sale properties.
- Filters work without errors.
- When leverage is enabled, health badges and leveraged columns render.
- Toggling leverage updates the view and persists through refresh.

API check:

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/strategies/brrrr"
```

Confirm the response contains properties and strategy results computed from Convex data.

## Verify Property Detail And Price History

Open any property from a strategy table or property list.

Expected:

- The detail page loads using the Convex-backed property id.
- Property facts, strategy scores, cash metrics, leveraged metrics, flags, and rate sensitivity render.
- The price history section renders at least the fresh scrape observation.

API check:

```powershell
$overview = Invoke-RestMethod -Uri "http://localhost:3001/api/strategies/brrrr"
$propertyId = $overview.properties[0].id
Invoke-RestMethod -Uri "http://localhost:3001/api/properties/$propertyId"
```

Confirm `priceHistory` is present and includes the fresh scrape price.

## Verify Settings Persistence

Open `http://localhost:5173/settings`.

1. Change a low-risk setting, such as mortgage rate or leverage enabled.
2. Save settings.
3. Refresh the page.
4. Reopen overview and a strategy page.

Expected:

- The changed value survives refresh.
- Overview and strategy results use the new settings.
- Linked leverage fields, such as down payment and LTV, stay synchronized.

API check:

```powershell
$settings = Invoke-RestMethod -Uri "http://localhost:3001/api/settings"
$settings.settings
```

## Verify Deal Triage Persistence

Open `http://localhost:5173/deal-triage`.

1. Change a property's triage status.
2. Add or update its note or rejected reason if available for that status.
3. Refresh the page.
4. Reopen the same property in deal triage.

Expected:

- The triage status persists.
- Notes and rejected reasons persist.
- Filtering by triage status reflects the saved change.

API check:

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/triage"
```

Confirm the updated property triage data is returned from Convex-backed persistence.

## Automated Verification

Run these from the repository root with PowerShell-safe command names:

```powershell
npm.cmd test
npm.cmd run build
npx.cmd convex dev --once
```

`npx.cmd convex dev --once` validates Convex schema and functions when local permissions and Convex auth are available. In restricted environments it may fail before validation with an `EACCES` permission error; record the exact output in the smoke-test report.

## Pass Criteria

The smoke test passes when:

- Convex starts empty and is populated only by the fresh bounded scrape.
- Scraper status and history report the completed run.
- Overview, strategy pages, property detail, and price history render data from the fresh scrape.
- Settings changes persist and affect subsequent API/UI results.
- Deal triage changes persist across refresh.
- Automated verification commands are run and their exact pass/fail output is recorded.
