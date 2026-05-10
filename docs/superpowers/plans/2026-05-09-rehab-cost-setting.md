# Rehab Cost Setting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make rehab cost per square meter configurable from Settings and used by BRRRR and Fix & Flip.

**Architecture:** Add `rehabCostPerSqm` to the existing general settings contract, persist it in SQLite, and read it from strategy analyzers. Existing settings mutation and React Query invalidation already recalculate strategy results after save.

**Tech Stack:** Node.js, better-sqlite3, Express, React, React Query, node:test.

---

### Task 1: Settings Persistence

**Files:**
- Modify: `server/test/phase2.test.js`
- Modify: `server/src/db/schema.sql`
- Modify: `server/src/db/connection.js`
- Modify: `server/src/db/settings.js`

- [ ] Write failing tests for default `general.rehabCostPerSqm`, update persistence, and legacy DB migration.
- [ ] Run `npm.cmd test --workspace server -- --test-name-pattern rehab` and verify the new tests fail.
- [ ] Add `rehab_cost_per_sqm REAL NOT NULL DEFAULT 300` to the settings table.
- [ ] Add database initialization logic that checks `PRAGMA table_info(settings)` and runs `ALTER TABLE settings ADD COLUMN rehab_cost_per_sqm REAL NOT NULL DEFAULT 300` if missing.
- [ ] Map `rehab_cost_per_sqm` to `general.rehabCostPerSqm` in `toNested()` and `updateMap`.
- [ ] Re-run the focused server tests and verify they pass.

### Task 2: Strategy Calculations

**Files:**
- Modify: `server/test/phase4.test.js`
- Modify: `server/src/strategies/brrrr.js`
- Modify: `server/src/strategies/flipper.js`

- [ ] Write failing tests showing BRRRR and Fix & Flip use a custom `general.rehabCostPerSqm`.
- [ ] Run the focused strategy tests and verify they fail with the hard-coded `300` behavior.
- [ ] Replace `area * 300` with `area * Number(settings.general?.rehabCostPerSqm ?? 300)` in both strategy analyzers.
- [ ] Re-run the focused strategy tests and verify they pass.

### Task 3: Settings UI and Labels

**Files:**
- Modify: `client/src/lib/labels.test.js`
- Modify: `client/src/lib/labels.js`
- Modify: `client/src/pages/Settings.jsx`

- [ ] Write a failing label metadata test for `rehabCostPerSqm`.
- [ ] Add label metadata: label `Rehab cost per sqm`, description describing the renovation budget multiplier.
- [ ] Add a numeric field to General Assumptions bound to `form.general.rehabCostPerSqm`.
- [ ] Run the focused client label test and verify it passes.

### Task 4: Verification

**Files:**
- No source edits.

- [ ] Run `npm.cmd test --workspace server -- --run`.
- [ ] Run `npm.cmd test --workspace client -- --run`.
- [ ] Run `npm.cmd run build --workspace client`.
- [ ] Review `git diff --check` and `git status --short`.
