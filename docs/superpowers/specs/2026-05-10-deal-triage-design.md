# Deal Triage Design

## Context

The application already scrapes Sofia listings, calculates strategy-specific investment metrics, tracks price history, and shows strategy pages for Buy in Green, BRRRR, Fix & Flip, Cash Flow, Airbnb, and Below Market opportunities. The next useful layer is not another isolated formula. It is a daily workflow that turns those calculations into a short list of listings worth inspecting.

## Goal

Add a Deal Triage feature that helps the investor quickly answer:

- Which active listings deserve attention today?
- Why is each listing interesting?
- What decision has already been made about it?

The feature should surface ranked opportunities across existing strategies and persist only the investor's triage decisions: status, note, and optional rejection reason.

## Non-Goals

- No email, browser, or push alerts in the first version.
- No configurable master-score weights in the first version.
- No replacement of existing strategy pages.
- No automated purchase recommendation. The feature ranks candidates for review, not final decisions.

## Product Behavior

Add a new page called **Deal Triage**. It shows a ranked inbox of active sale listings that have at least one meaningful investment signal.

Each listing should show:

- Property title or neighborhood, price, area, price per sqm, and property type.
- Best matching strategy: Below Market, Cash Flow, Flip, BRRRR, Buy in Green, or Airbnb.
- A compact list of reasons the listing is interesting, such as:
  - `15% below neighborhood average`
  - `Price dropped EUR 8,000`
  - `Green health in Cash Flow`
  - `Positive cash flow after rate stress`
  - `Flip ROI above target`
- Current triage status.
- Editable note.
- Link to property detail.
- Link to the original listing when available.

The page hides rejected listings by default so the inbox remains focused. A simple filter may expose rejected listings when needed.

Allowed statuses:

- `new`
- `watching`
- `needs_call`
- `visited`
- `made_offer`
- `rejected`

## Architecture

Deal Triage should be a thin module over the existing property and strategy systems.

The backend computes opportunity ranking on demand by loading active property records that are acquisition candidates, evaluating existing strategy analyzers, and deriving a ranked triage response. The only persisted triage state is the human decision attached to a property.

This keeps the feature flexible. If strategy formulas, mortgage settings, or thresholds change, triage rankings update automatically without a migration or stale stored scores.

## Data Model

Add a `deal_triage` table:

```sql
CREATE TABLE IF NOT EXISTS deal_triage (
  property_id INTEGER PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'new',
  note TEXT,
  rejected_reason TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);
```

Validation rules:

- `property_id` must reference an existing property.
- `status` must be one of the allowed statuses.
- `note` and `rejected_reason` are optional strings.
- `rejected_reason` is only meaningful when `status = 'rejected'`, but the API does not need to require it.

## API

Add a triage route mounted under `/api/triage`.

### `GET /api/triage`

Returns ranked triage opportunities.

Supported query parameters:

- `includeRejected`: accepts `true` or `1`; defaults to false.
- `zone`, `type`, `minPrice`, `maxPrice`, `minArea`, and `maxArea`: use the same meaning as existing property filters.
- `limit`: defaults to 50 and should cap at 250.

Response shape:

```json
{
  "opportunities": [
    {
      "property": {},
      "triage": {
        "status": "new",
        "note": "",
        "rejectedReason": "",
        "updatedAt": null
      },
      "bestStrategy": "below-market",
      "bestScore": 18.2,
      "rankScore": 82.5,
      "health": "green",
      "signals": [
        {
          "type": "discount",
          "label": "15% below neighborhood average",
          "severity": "positive"
        }
      ]
    }
  ],
  "summary": {
    "total": 20,
    "hiddenRejected": 3
  }
}
```

### `PUT /api/triage/:propertyId`

Updates triage state for one property.

Request body:

```json
{
  "status": "watching",
  "note": "Call broker about Act 16 timing",
  "rejectedReason": ""
}
```

Response body should return the saved triage object.

Invalid statuses should return `400`. Missing properties should return `404`.

## Ranking And Signals

The first version should use explainable heuristics, not a configurable black-box score.

For each active sale property:

1. Evaluate all existing strategies with current settings.
2. Ignore strategy results where `applicable === false`.
3. Pick `bestStrategy` from the highest effective strategy score after decoration.
4. Derive human-readable signals from strategy metrics and flags.
5. Compute `rankScore`.
6. Include entries with `rankScore > 0`, plus any entry that already has a non-new triage status.

Initial rank score inputs:

- Reward green health.
- Reward below-market discount.
- Reward price drops when price history supports them.
- Reward positive leveraged monthly cash flow.
- Reward high cash ROI or leveraged ROI.
- Reward instant equity and refinance viability flags.
- Penalize red health.
- Penalize negative cash flow.

Signal examples:

- Discount: `X% below neighborhood average`.
- Price history: `Price dropped EUR X`.
- Cash flow: `Positive monthly cash flow`.
- Stress: `Still positive after rate stress`.
- Flip: `Flip ROI above target`.
- BRRRR: `Refinance covers most of investment`.
- Risk: `Negative cash flow` or `Low DSCR`.

If strategy analysis throws for a single property, the triage service should skip that property and continue building the response.

## Frontend

Add:

- `client/src/pages/DealTriage.jsx`
- API hooks in `client/src/api/client.js`:
  - `useDealTriage(filters)`
  - `useUpdateDealTriage()`
- Route `/triage`.
- Sidebar/navigation item `Deal Triage`.

The page should use a dense operational layout:

- Top controls: `includeRejected` toggle, property filters, and count summary.
- Main content: ranked table or compact list.
- Per row: property basics, best strategy, health badge, signals, status selector, note field, and links.

Reuse existing UI utilities and components where practical:

- `HealthBadge`
- `StatusViews`
- existing formatters
- existing API client patterns
- table/list styling from strategy pages

## Error Handling

- Loading and top-level request errors use the existing status components.
- A failed update should keep the row visible and show inline error text or the existing mutation error pattern.
- A missing property during update returns `404`.
- A per-property strategy calculation error should not break the entire triage page.
- Empty state: `No triage candidates yet. Run a fresh scrape or adjust filters.`

## Testing

Backend tests:

- `deal_triage` defaults are applied.
- Valid status/note updates are persisted.
- Invalid status returns `400`.
- Missing property returns `404`.
- Ranking orders stronger candidates above weaker candidates.
- Signal generation produces expected labels for discount, price drop, positive cash flow, and risk flags.
- Rejected listings are hidden by default and included when requested.

Frontend tests:

- Deal Triage page renders loaded opportunities.
- Status update calls the API and refreshes triage data.
- Rejected listings are hidden or shown according to the filter behavior.
- Empty, loading, and error states render correctly.

Build and existing tests should continue passing.

## Implementation Boundaries

This feature should not refactor strategy formulas unless a small change is needed to expose an already-computed metric for signal generation. It should not introduce external services or scheduled jobs. The first version should optimize for a clear daily review workflow over configurable scoring depth.
