# Label Tooltips Design

## Context

The client currently shows mostly readable labels, but strategy metric detail pages can fall back to raw camelCase keys when a metric is not listed in `metricLabels`. Some short labels such as `CoC`, `DSCR`, `ARV`, and `Breakeven` are also hard to interpret without domain context.

The goal is to make metric and settings labels more human-readable across the app and add concise tooltips that explain what each label means and why it is useful. This design covers the shared client-side label system only; backend API response shapes remain unchanged.

## Approved Approach

Use a central client-side metadata registry plus a reusable label component.

The registry will live at `client/src/lib/labels.js`. It will map known field and metric keys to a human label and optional description:

```js
{
  cocPct: {
    label: 'Cash-on-cash return',
    description: 'Annual cash flow divided by cash invested. Useful for comparing leveraged deals.'
  }
}
```

The registry will expose helper functions:

- `humanizeKey(key)`: converts unknown camelCase, snake_case, or kebab-case keys into readable fallback text.
- `getLabelMeta(key)`: returns known metadata when available, otherwise returns a fallback label and no description.

Unknown keys must never render as raw camelCase in user-facing metric lists.

## UI Component

Add a reusable `MetricLabel` component at `client/src/components/MetricLabel.jsx`.

Behavior:

- Render the readable label text.
- Render a small `Info` icon when a description exists.
- Show a styled tooltip on hover and keyboard focus.
- Keep the tooltip concise and explanatory.
- Omit the icon when no description exists.
- Support different visual contexts without duplicating logic: metric cards, settings fields, table headers, and detail metric lists.

The tooltip should be accessible by keyboard focus and should not interfere with existing table sorting. In sortable table headers, the header button can contain the label component so clicking the label still triggers the current sort behavior.

## Integration Scope

Apply the shared labels to these client surfaces:

- `PropertyDetail.jsx`: strategy `cashMetrics` and `leveragedMetrics` lists.
- `MetricCard.jsx`: summary cards and property cards.
- `PropertyTable.jsx`: strategy table headers.
- `Settings.jsx`: numeric settings field labels.

Initial metadata should cover:

- Strategy metrics currently listed in `client/src/lib/strategies.js` under `metricLabels`.
- Common leveraged metrics such as cash flow, cash-on-cash return, DSCR, break-even rate, effective LTV, and instant equity.
- Summary card labels such as active listings, mortgage rate, last scrape, health mode, price, area, price per square meter, condition, results, and health counts.
- Table labels such as health, score, property, price, area, net yield, cash flow, cash-on-cash return, and break-even rate.
- Settings labels for general assumptions, mortgage/leverage inputs, health thresholds, and Airbnb assumptions.

Existing strategy labels and backend data keys should remain stable. The metadata registry replaces display copy, not calculation behavior.

## Copy Guidelines

Labels should be clear rather than overly abbreviated where space allows. For example:

- `CoC` becomes `Cash-on-cash return`.
- `DSCR` may remain `DSCR` if paired with a tooltip that expands it.
- `Price/sqm` can become `Price per sqm`.
- `Breakeven` becomes `Break-even rate`.

Descriptions should answer two questions:

- What does this value mean?
- Why is it useful for judging an investment?

They should be one short sentence where possible.

## Error Handling

Missing metadata must be graceful:

- Use `humanizeKey` for the label.
- Do not render a tooltip icon.
- Do not throw if the key is nullish or unexpected.

This ensures new backend metrics remain visible even before custom metadata is added.

## Testing And Verification

Add focused tests for the shared helper functions:

- Known keys return the expected label and description.
- Unknown camelCase keys become readable fallback labels.
- snake_case and kebab-case fallbacks are readable.
- Nullish or empty keys do not crash.

Add a component-level test for the label component if the current client test setup can render React components cleanly without new tooling. If that is not practical, document the gap after implementation and verify the component through build output and focused manual inspection.

Run the client build after implementation to catch JSX, import, and Tailwind class issues.

## Out Of Scope

- Backend metric renaming.
- Changing calculations or strategy scoring.
- Rewriting charts, filters, or navigation copy beyond labels that already participate in the shared registry.
- Adding a large third-party tooltip dependency unless the existing stack already provides one.
