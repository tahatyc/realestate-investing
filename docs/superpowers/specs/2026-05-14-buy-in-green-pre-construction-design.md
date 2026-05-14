# Buy in Green Pre-Construction Eligibility Design

## Context

The application currently has a `buy-in-green` strategy that estimates the upside from buying below a finished-market price and selling or valuing the property after completion. The existing implementation uses `construction_stage` only to choose a hold period: Act 14 uses 18 months, Act 15 uses 8 months, and every other listing falls back to 6 months.

That means already-built, finished, Act 14, Act 15, and unknown-stage properties can still appear in the Buy in Green strategy when the price math looks attractive. This does not match the intended investor workflow.

Buy in Green should mean true pre-construction exposure: buying before the building has reached Act 14, where the investor is accepting earlier development risk in exchange for a stronger discount.

## Goal

Make `buy-in-green` a strict pre-Act 14 strategy.

The strategy should surface only listings with clear pre-construction signals and should exclude listings that are Act 14, Act 15, Act 16, finished, already built, or ambiguous.

## Non-Goals

- Do not rename the route or strategy id. Keep `buy-in-green` stable for navigation and API consumers.
- Do not add manual user tagging in this change.
- Do not change the general strategy engine contract beyond using the existing `applicable: false` pattern.
- Do not add a configurable hold-period setting yet.
- Do not broaden the strategy into a generic new-construction discount strategy.

## Recommended Approach

Add a small eligibility detector for Buy in Green and call it before strategy calculations.

The detector should inspect:

- `property.construction_stage`
- `property.title`
- `property.description`
- `property.condition`

The detector should return eligible only when the listing has explicit pre-Act 14 language. Examples include:

- `на зелено`
- `в проект`
- `преди акт 14`
- `стартиращ строеж`
- `предстоящ строеж`
- equivalent Bulgarian wording that clearly means reservation-stage or pre-Act 14 construction

The detector should return ineligible when any hard exclusion appears:

- `construction_stage` is `act14`, `act15`, `act16`, or `finished`
- listing text mentions Act 14, Act 15, or Act 16
- listing text says the building is complete, finished, ready to move in, or already built
- there is no explicit pre-construction signal

Ambiguous listings should be excluded. False negatives are preferable to false positives for this strategy because noisy Buy in Green results waste review time and duplicate other strategy pages.

## Strategy Behavior

`server/src/strategies/buyInGreen.js` should check eligibility first.

If a property is not eligible, the analyzer should return a result with:

- `strategy: 'buy-in-green'`
- the normal property payload
- `applicable: false`
- empty or neutral metric objects
- `cashScore: null`
- `leveragedScore: null`

The existing strategy API already filters `result.applicable !== false`, so ineligible listings should disappear from `/api/strategies/buy-in-green`.

The property detail API should continue returning Buy in Green with `applicable: false` for ineligible properties so the analysis boundary is visible. The detail UI should render that state as not applicable and should not attempt to display empty metric lists as real calculations.

## Scoring and Assumptions

For eligible listings, keep the existing future-value and leverage formula structure:

- purchase price plus transaction costs as total investment
- finished-market price per sqm estimate
- future value from finished-market price times area
- potential profit and appreciation percentage
- leveraged profit after interest carry and origination fee

Because Act 14 and Act 15 are no longer eligible, the hold period should no longer depend on those stages. Use a single conservative default of 24 months for eligible pre-Act 14 candidates.

This value should be a code-level constant in the first implementation. A settings field can be added later if real usage shows the assumption needs frequent tuning.

## UI and Documentation

Keep the page label recognizable, but update explanatory copy anywhere it describes the strategy as broad new construction.

The intended wording should be closer to:

- `Buy in Green`
- `Pre-construction listings before Act 14`
- `Targets listings with explicit pre-construction signals such as на зелено or в проект`

The route remains `/strategy/buy-in-green`.

## Testing

Server tests should cover the eligibility boundary directly:

- a listing with `на зелено` is applicable
- a listing with `в проект` is applicable
- Act 14 is excluded
- Act 15 is excluded
- Act 16 is excluded
- finished or ready-to-move-in wording is excluded
- unknown-stage listings without a pre-construction signal are excluded

Strategy route tests should cover that excluded listings do not appear in `/api/strategies/buy-in-green`.

If property detail rendering needs a guard for non-applicable strategy results, client tests should cover that the detail page does not crash and clearly omits or marks the Buy in Green metrics as not applicable.

## Risks

The main risk is missing valid listings because Bulgarian broker wording varies. This is acceptable for the first version because the current failure mode is worse: already-built listings appear in a strategy where they do not belong.

The detector should be easy to expand with new phrases after reviewing real scrape data. New phrases should be added through tests so the boundary remains explicit.

## Acceptance Criteria

- Act 14, Act 15, Act 16, finished, and ambiguous listings no longer appear on the Buy in Green strategy page.
- Listings with clear pre-Act 14 language do appear and keep the existing Buy in Green financial calculations.
- Eligible Buy in Green listings use a 24-month hold period.
- The UI/docs describe Buy in Green as pre-construction before Act 14, not generic new construction.
- Focused server tests pass for eligibility and route filtering.
