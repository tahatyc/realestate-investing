# Convex Fresh Scan Migration Design

## Context

The app currently uses a local SQLite database through `server/src/db/*`. The Express server owns scraping, API routes, investment strategy calculations, settings, deal triage, price history, and neighborhood aggregates. The React client talks to Express through REST endpoints and does not directly know about SQLite.

The current database is not being migrated. Convex should become the new source of truth, and the dataset should be populated by a fresh scraper run.

Relevant current boundaries:

- `server/src/scraper/imotbg.js` orchestrates scan plans, fetch retries, listing parsing, detail parsing, price-history insertion, inactive marking, run progress, and neighborhood-stat recomputation.
- `server/src/db/*` contains the persistence operations used by routes, scraper code, and strategy helpers.
- Strategy code still expects mostly SQLite-shaped property rows with snake_case fields.
- The client API surface can stay stable during the first migration phase.

Convex documentation supports this approach: Node.js code can call Convex queries and mutations through the JavaScript client, schemas can validate table documents, and indexes are defined on tables for efficient query paths.

## Goal

Move active application persistence from local SQLite to Convex while keeping the next implementation focused and reversible.

The first Convex-backed version should:

- Add a Convex schema for the existing app data.
- Add Convex queries and mutations that mirror the current DB module operations.
- Keep Express as the scraper and REST API host.
- Let a new scan populate Convex from an empty dataset.
- Preserve the existing client REST API shape where practical.
- Preserve current investment strategy behavior except for async persistence calls.

## Non-Goals

- Do not import or migrate `data/realestate.db`.
- Do not build a one-off migration script for old SQLite data.
- Do not rewrite the React client to use Convex hooks in this phase.
- Do not move the imot.bg scraper into Convex actions in this phase.
- Do not add scheduled scraping.
- Do not redesign investment strategy formulas.
- Do not remove Express until Convex-backed behavior is proven.

## Recommended Approach

Use a phased migration.

Phase 1 should keep Express in place and replace the persistence boundary behind it. This minimizes client disruption and keeps the existing scraper orchestration in the environment where it already works.

The implementation should introduce:

- A root `convex/` directory with schema and generated API files.
- Convex function modules for properties, price history, scrape runs, scrape scopes, settings, deal triage, and neighborhood stats.
- A server-side Convex client wrapper in `server/src/convexClient.js`.
- Async DB adapter functions in `server/src/db/*` that expose the same conceptual operations as today but call Convex.
- Route, scraper, and strategy updates to `await` persistence operations.

SQLite can remain in the repository temporarily for tests or rollback, but production startup should use Convex when `CONVEX_URL` is configured.

## Architecture

Keep the first version as:

```text
React client -> Express REST API -> Convex client -> Convex functions -> Convex DB
                                -> imot.bg scraper
```

Express remains responsible for:

- REST API compatibility.
- Long-running scraper lifecycle.
- HTML fetching and parsing.
- In-memory active scrape guard.
- Strategy calculations.

Convex becomes responsible for:

- Durable property storage.
- Price history.
- Scrape run and scope status.
- Deal triage state.
- Settings.
- Queryable neighborhood aggregates.

This keeps the application working with its current mental model while moving the durable state out of the local machine.

## Data Model

Create Convex tables that map closely to the current SQLite tables.

### `properties`

Fields should preserve the existing API semantics:

- `externalId`
- `source`
- `listingPurpose`
- `category`
- `url`
- `title`
- `neighborhood`
- `zone`
- `type`
- `condition`
- `priceEur`
- `priceBgn`
- `areaSqm`
- `pricePerSqm`
- `floor`
- `totalFloors`
- `rooms`
- `constructionYear`
- `constructionStage`
- `description`
- `imageUrl`
- `firstSeenAt`
- `lastSeenAt`
- `isActive`
- `createdAt`
- `updatedAt`

Use `externalId` as the logical unique key. Convex does not need SQLite integer IDs, but the Express response layer should return a stable `id` field based on Convex `_id` so the client can continue to route to property detail pages.

Recommended indexes:

- `by_external_id`
- `by_active_purpose_updated`
- `by_active_purpose_category`
- `by_active_zone`
- `by_active_neighborhood`
- `by_active_zone_price_per_sqm`

### `priceHistory`

Fields:

- `propertyId`
- `priceEur`
- `priceBgn`
- `recordedAt`

`propertyId` should reference the Convex property document ID. Keep history for the new Convex lifecycle only; the first fresh scrape creates the initial observation for each listing.

Recommended index:

- `by_property_recorded_at`

### `scrapingRuns`

Fields:

- `status`
- `startedAt`
- `completedAt`
- `pagesTotal`
- `pagesScraped`
- `salePagesScraped`
- `rentalPagesScraped`
- `currentPurpose`
- `currentCategory`
- `crawlMode`
- `listingsFound`
- `listingsSaved`
- `errorMessage`

Recommended index:

- `by_started_at`

### `scrapingRunScopes`

Fields:

- `runId`
- `listingPurpose`
- `category`
- `pagesPlanned`
- `pagesScraped`
- `fullScope`
- `completed`

Recommended indexes:

- `by_run`
- `by_scope`

### `settings`

Use one settings document rather than relying on SQLite `id = 1`.

Fields should match the current nested response shape after conversion:

- General investment thresholds and transaction assumptions.
- Airbnb assumptions.
- Leverage assumptions.
- Flag thresholds.
- `updatedAt`

The settings query should return default settings when no document exists. The settings update mutation should upsert the single settings document so the first edit persists those defaults plus the requested changes.

### `dealTriage`

Fields:

- `propertyId`
- `status`
- `note`
- `rejectedReason`
- `updatedAt`

Recommended index:

- `by_property`

### `neighborhoodStats`

Store computed aggregate documents initially. The Convex-backed version should compute neighborhood stats from active sale listings only, because these stats feed acquisition market pricing and should not mix monthly rents with purchase prices.

Fields:

- `neighborhood`
- `zone`
- `propertyCount`
- `avgPriceEur`
- `avgPricePerSqm`
- `minPriceEur`
- `maxPriceEur`
- `avgAreaSqm`
- `updatedAt`

Recommended index:

- `by_zone_neighborhood`

Keeping these stored avoids broad aggregate scans on every overview request. Later, this can move to a scheduled or incremental Convex-side aggregate if needed.

## Fresh Scan Behavior

The first Convex-backed scan starts from empty Convex tables.

Rules:

- Do not read from SQLite during scan startup.
- Upsert properties by `externalId`.
- Insert price history when a listing is first seen or when price changes compared with the existing Convex property.
- Mark inactive only by completed scan scope, using the same conservative scope rules already implemented.
- Recompute neighborhood stats after a successful run.
- Mark the scrape run as failed with `errorMessage` when an unhandled scrape error occurs.

If a user starts the app before running a scan, API routes should return empty but valid responses. Empty states already exist in the UI and should continue to work.

## Adapter Strategy

The DB modules should become the compatibility boundary.

Examples:

- `upsertProperty(property)` calls a Convex mutation and returns a SQLite-shaped row object for existing strategy code.
- `queryProperties(filters)` calls a Convex query and maps documents to current row shape.
- `getPropertyById(id)` accepts the client-facing Convex ID.
- `insertPriceHistory(entry)` accepts the Convex property ID returned by `upsertProperty`.
- `getSettings()` returns the existing nested settings object.

This approach avoids rewriting all strategy code at once. The adapters can expose snake_case row objects to the existing server code while Convex stores camelCase documents internally.

All callers that touch persistence need to become async. This is the largest mechanical change:

- Express route handlers need `async` wrappers.
- Scraper calls need `await`.
- Strategy analyzers that read database-backed comps or averages need async variants.
- Tests need to await strategy and route operations.

## API Compatibility

Keep REST endpoints stable for the client:

- `GET /api/overview`
- `GET /api/properties`
- `GET /api/properties/:id`
- `GET /api/strategies/:strategy`
- `GET /api/triage`
- `PATCH /api/triage/:propertyId`
- `GET /api/settings`
- `PATCH /api/settings`
- `POST /api/scraper/start`
- `GET /api/scraper/status`
- `GET /api/scraper/history`

Response fields should remain camelCase where they already are camelCase. Internally, the server can map Convex documents to the existing response helpers.

Property IDs in API responses will become Convex document IDs. The client should treat them as opaque strings.

## Configuration

Add Convex configuration without hard-coding deployment details.

Expected environment variables:

- `CONVEX_URL`
Local development should document that `npx convex dev` creates and syncs the Convex backend. Server startup should fail clearly when Convex mode is selected but `CONVEX_URL` is missing.

## Testing

Add coverage at the persistence boundary before replacing behavior broadly.

Recommended test layers:

- Unit tests for row/document mapping helpers.
- Adapter tests with mocked Convex client calls for property upsert, filters, settings, scrape run updates, triage updates, and price history.
- Existing scraper tests adjusted to await async persistence operations.
- Existing route tests adjusted for async DB adapters.
- Existing strategy tests adjusted for async analyzers.

Because Convex integration tests require a running Convex deployment, the first implementation should not make the normal `npm test` suite depend on live Convex network access. Use mocks for routine tests and document a manual smoke test for a real Convex dev deployment.

Manual smoke test:

1. Start Convex dev deployment.
2. Start the Express server with `CONVEX_URL`.
3. Start the client.
4. Run a bounded scrape.
5. Confirm overview inventory counts, scraper status/history, strategy pages, property detail, settings, and deal triage work from Convex-populated data.

## Rollout

Implement in small steps:

1. Add Convex package, schema, and function modules.
2. Add the server Convex client wrapper.
3. Add adapter mapping helpers and tests.
4. Convert properties, price history, scrape runs, settings, triage, and neighborhood stats adapters.
5. Convert server callers to async.
6. Run the existing automated tests.
7. Run the Convex dev smoke test with a fresh scrape.

SQLite implementation details should be moved behind a clearly named legacy adapter only if needed for tests during the transition. The default server path should use Convex once `CONVEX_URL` is configured.

## Risks

- Async conversion touches many server files and tests.
- Convex query indexes must match the filters used by the app, or list endpoints may become inefficient.
- Current code sometimes assumes numeric SQLite IDs. These need to become opaque string IDs at the API boundary.
- Stored neighborhood aggregates can become stale if future writes bypass the recompute path.
- A failed first scan leaves Convex mostly empty, so status and error display must remain clear.

## Implementation Decisions

- Keep Convex functions grouped by feature/table: `properties`, `priceHistory`, `scrapingRuns`, `scrapingRunScopes`, `settings`, `dealTriage`, and `neighborhoodStats`.
- Treat SQLite as legacy after the Convex path lands. Preserve it only where tests or rollback need it during the transition.
- Return default settings from reads when no settings document exists, and persist settings on first update.
- Compute neighborhood stats from active sale listings only.
