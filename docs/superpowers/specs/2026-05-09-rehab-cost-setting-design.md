# Rehab Cost Setting Design

## Goal

Make the rehab cost per square meter configurable from Settings while preserving the current default of EUR 300 per sqm.

## Design

The setting will live in the existing `general` settings group as `rehabCostPerSqm`, backed by a `settings.rehab_cost_per_sqm` database column with default `300`. Database initialization will add the column to existing databases when it is missing.

BRRRR and Fix & Flip will calculate rehab cost as `area * settings.general.rehabCostPerSqm`, falling back to `300` if the setting is absent. The Settings page will show a numeric “Rehab cost per sqm” field under General Assumptions, using the existing settings save flow and query invalidation.

## Testing

Server tests will cover default persistence, settings updates, existing database migration, and strategy calculations with a custom rehab cost. Client label tests will cover the new settings label metadata.
