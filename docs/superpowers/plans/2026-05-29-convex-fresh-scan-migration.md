# Convex Fresh Scan Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace local SQLite persistence with Convex-backed persistence while leaving existing data behind and populating Convex from the next fresh scrape.

**Architecture:** Keep the React client on the existing Express REST API. Keep Express as the scraper host and strategy calculation layer. Add Convex schema/functions, then convert `server/src/db/*` into async adapters that call Convex and return the row shapes the existing server code expects.

**Tech Stack:** Node.js ESM, Express, React/Vite, Convex JavaScript client/functions, `node:test`, existing scraper/parser utilities.

---

## File Structure

Create:

- `convex/schema.js`: Convex tables and indexes.
- `convex/properties.js`: property upsert/query/read/inactive mutations and queries.
- `convex/priceHistory.js`: price-history insert/list functions.
- `convex/scrapingRuns.js`: scrape run create/update/latest/history functions.
- `convex/scrapingRunScopes.js`: scrape scope create/complete/list functions.
- `convex/settings.js`: settings defaults, read, and update functions.
- `convex/dealTriage.js`: deal triage read/map/upsert functions.
- `convex/neighborhoodStats.js`: sale-only aggregate recompute/read functions.
- `server/src/convexClient.js`: singleton Convex HTTP client wrapper.
- `server/src/db/rowMapping.js`: camelCase Convex document to existing snake_case row mapping.
- `server/test/rowMapping.test.js`: pure mapping tests.
- `server/test/convexAdapters.test.js`: adapter tests using a fake Convex client.
- `docs/convex-fresh-scan-smoke-test.md`: manual smoke-test checklist.

Modify:

- `package.json`: add Convex scripts.
- `server/package.json`: add Convex dependency if dependency is installed per workspace.
- `server/src/db/properties.js`: replace SQLite implementation with async Convex adapter.
- `server/src/db/priceHistory.js`: replace SQLite implementation with async Convex adapter.
- `server/src/db/scrapingRuns.js`: replace SQLite implementation with async Convex adapter.
- `server/src/db/scrapingRunScopes.js`: replace SQLite implementation with async Convex adapter.
- `server/src/db/settings.js`: replace SQLite implementation with async Convex adapter.
- `server/src/db/dealTriage.js`: replace SQLite implementation with async Convex adapter.
- `server/src/db/neighborhoodStats.js`: replace SQLite implementation with async Convex adapter.
- `server/src/scraper/imotbg.js`: await all persistence calls.
- `server/src/strategies/*.js`: await DB-backed reads and analyzer calls.
- `server/src/routes/*.js`: make route handlers async and await persistence/strategy calls.
- `server/src/index.js`: initialize with Convex-backed adapters and remove direct production startup dependency on SQLite.
- `server/test/*.test.js`: await async persistence calls, or use the fake Convex client for adapter-level tests.

Do not import `data/realestate.db`. Do not build a SQLite-to-Convex migration script.

---

### Task 1: Add Convex Dependency And Scripts

**Files:**
- Modify: `package.json`
- Modify: `server/package.json`
- Commit: `chore: add convex dependency and scripts`

- [ ] **Step 1: Add the dependency**

Run:

```powershell
npm install convex --workspace server
```

Expected: `server/package.json` contains `"convex"` under dependencies and `package-lock.json` updates.

- [ ] **Step 2: Add root scripts**

Modify `package.json` scripts to include:

```json
{
  "scripts": {
    "convex:dev": "convex dev",
    "convex:deploy": "convex deploy"
  }
}
```

Keep the existing `dev`, `dev:server`, `dev:client`, `start`, `test`, and `build` scripts.

- [ ] **Step 3: Verify install metadata**

Run:

```powershell
npm ls convex --workspace server
```

Expected: command exits `0` and prints a `convex@...` entry under `@realestate/server`.

- [ ] **Step 4: Commit**

Run:

```powershell
git add package.json package-lock.json server/package.json
git commit -m "chore: add convex dependency and scripts"
```

---

### Task 2: Add Convex Schema

**Files:**
- Create: `convex/schema.js`
- Commit: `feat: add convex schema`

- [ ] **Step 1: Create schema**

Create `convex/schema.js`:

```js
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const optionalString = v.optional(v.string());
const optionalNumber = v.optional(v.number());

export default defineSchema({
  properties: defineTable({
    externalId: v.string(),
    source: v.string(),
    listingPurpose: v.string(),
    category: optionalString,
    url: optionalString,
    title: optionalString,
    neighborhood: optionalString,
    zone: optionalString,
    type: optionalString,
    condition: optionalString,
    priceEur: v.number(),
    priceBgn: optionalNumber,
    areaSqm: optionalNumber,
    pricePerSqm: optionalNumber,
    floor: optionalNumber,
    totalFloors: optionalNumber,
    rooms: optionalNumber,
    constructionYear: optionalNumber,
    constructionStage: optionalString,
    description: optionalString,
    imageUrl: optionalString,
    firstSeenAt: v.string(),
    lastSeenAt: v.string(),
    isActive: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string()
  })
    .index('by_external_id', ['externalId'])
    .index('by_active_purpose_updated', ['isActive', 'listingPurpose', 'updatedAt'])
    .index('by_active_purpose_category', ['isActive', 'listingPurpose', 'category'])
    .index('by_active_zone', ['isActive', 'zone'])
    .index('by_active_neighborhood', ['isActive', 'neighborhood'])
    .index('by_active_zone_price_per_sqm', ['isActive', 'zone', 'pricePerSqm']),

  priceHistory: defineTable({
    propertyId: v.id('properties'),
    priceEur: v.number(),
    priceBgn: optionalNumber,
    recordedAt: v.string()
  }).index('by_property_recorded_at', ['propertyId', 'recordedAt']),

  scrapingRuns: defineTable({
    status: v.string(),
    startedAt: v.string(),
    completedAt: optionalString,
    pagesTotal: v.number(),
    pagesScraped: v.number(),
    salePagesScraped: v.number(),
    rentalPagesScraped: v.number(),
    currentPurpose: optionalString,
    currentCategory: optionalString,
    crawlMode: v.string(),
    listingsFound: v.number(),
    listingsSaved: v.number(),
    errorMessage: optionalString
  }).index('by_started_at', ['startedAt']),

  scrapingRunScopes: defineTable({
    runId: v.id('scrapingRuns'),
    listingPurpose: v.string(),
    category: v.string(),
    pagesPlanned: v.number(),
    pagesScraped: v.number(),
    fullScope: v.boolean(),
    completed: v.boolean()
  })
    .index('by_run', ['runId'])
    .index('by_scope', ['listingPurpose', 'category']),

  settings: defineTable({
    general: v.object({
      city: v.string(),
      currency: v.string(),
      targetGrossYieldPct: v.number(),
      targetNetYieldPct: v.number(),
      rehabCostPerSqm: v.number(),
      transactionCostPct: v.number(),
      vacancyPct: v.number(),
      managementFeePct: v.number()
    }),
    airbnb: v.object({
      occupancyPct: v.number(),
      dailyRateEur: v.number(),
      operatingExpensePct: v.number()
    }),
    leverage: v.object({
      enabled: v.boolean(),
      mortgageRate: v.number(),
      loanTermYears: v.number(),
      downPaymentPct: v.number(),
      ltvPct: v.number(),
      originationFeePct: v.number(),
      annualInsuranceEur: v.number()
    }),
    flags: v.object({
      cocGreenPct: v.number(),
      cocYellowPct: v.number(),
      dscrMinimum: v.number(),
      rateStressPct: v.number()
    }),
    updatedAt: v.string()
  }),

  dealTriage: defineTable({
    propertyId: v.id('properties'),
    status: v.string(),
    note: v.string(),
    rejectedReason: v.string(),
    updatedAt: v.string()
  }).index('by_property', ['propertyId']),

  neighborhoodStats: defineTable({
    neighborhood: v.string(),
    zone: optionalString,
    propertyCount: v.number(),
    avgPriceEur: optionalNumber,
    avgPricePerSqm: optionalNumber,
    minPriceEur: optionalNumber,
    maxPriceEur: optionalNumber,
    avgAreaSqm: optionalNumber,
    updatedAt: v.string()
  }).index('by_zone_neighborhood', ['zone', 'neighborhood'])
});
```

- [ ] **Step 2: Validate schema by generating Convex files**

Run:

```powershell
npx convex dev --once
```

Expected: command completes without schema errors and creates `convex/_generated`.

- [ ] **Step 3: Commit**

Run:

```powershell
git add convex/schema.js convex/_generated package-lock.json
git commit -m "feat: add convex schema"
```

---

### Task 3: Add Convex Property Functions

**Files:**
- Create: `convex/properties.js`
- Commit: `feat: add convex property functions`

- [ ] **Step 1: Create property functions**

Create `convex/properties.js`:

```js
import { v } from 'convex/values';
import { mutation, query } from './_generated/server.js';

const propertyArgs = {
  externalId: v.string(),
  source: v.optional(v.string()),
  listingPurpose: v.optional(v.string()),
  category: v.optional(v.string()),
  url: v.optional(v.string()),
  title: v.optional(v.string()),
  neighborhood: v.optional(v.string()),
  zone: v.optional(v.string()),
  type: v.optional(v.string()),
  condition: v.optional(v.string()),
  priceEur: v.number(),
  priceBgn: v.optional(v.number()),
  areaSqm: v.optional(v.number()),
  pricePerSqm: v.optional(v.number()),
  floor: v.optional(v.number()),
  totalFloors: v.optional(v.number()),
  rooms: v.optional(v.number()),
  constructionYear: v.optional(v.number()),
  constructionStage: v.optional(v.string()),
  description: v.optional(v.string()),
  imageUrl: v.optional(v.string())
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeProperty(args, existing) {
  const now = nowIso();
  const pricePerSqm = args.pricePerSqm ?? (args.areaSqm && args.priceEur ? args.priceEur / args.areaSqm : undefined);
  return {
    externalId: args.externalId,
    source: args.source ?? 'imot.bg',
    listingPurpose: args.listingPurpose ?? 'sale',
    category: args.category,
    url: args.url,
    title: args.title,
    neighborhood: args.neighborhood,
    zone: args.zone,
    type: args.type,
    condition: args.condition,
    priceEur: args.priceEur,
    priceBgn: args.priceBgn,
    areaSqm: args.areaSqm,
    pricePerSqm,
    floor: args.floor,
    totalFloors: args.totalFloors,
    rooms: args.rooms,
    constructionYear: args.constructionYear,
    constructionStage: args.constructionStage,
    description: args.description,
    imageUrl: args.imageUrl,
    firstSeenAt: existing?.firstSeenAt ?? now,
    lastSeenAt: now,
    isActive: true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
}

export const upsert = mutation({
  args: propertyArgs,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('properties')
      .withIndex('by_external_id', (q) => q.eq('externalId', args.externalId))
      .unique();
    const record = normalizeProperty(args, existing);
    if (existing) {
      await ctx.db.patch(existing._id, record);
      return await ctx.db.get(existing._id);
    }
    const id = await ctx.db.insert('properties', record);
    return await ctx.db.get(id);
  }
});

export const byExternalId = query({
  args: { externalId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('properties')
      .withIndex('by_external_id', (q) => q.eq('externalId', args.externalId))
      .unique();
  }
});

export const byId = query({
  args: { id: v.id('properties') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  }
});

export const list = query({
  args: {
    listingPurpose: v.optional(v.string()),
    includeAllPurposes: v.optional(v.boolean()),
    includeInactive: v.optional(v.boolean()),
    category: v.optional(v.string()),
    zone: v.optional(v.string()),
    type: v.optional(v.string()),
    condition: v.optional(v.string()),
    minPrice: v.optional(v.number()),
    maxPrice: v.optional(v.number()),
    minArea: v.optional(v.number()),
    maxArea: v.optional(v.number()),
    limit: v.optional(v.number()),
    offset: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 250);
    const offset = args.offset ?? 0;
    let rows = await ctx.db.query('properties').collect();
    rows = rows.filter((row) => {
      if (!args.includeInactive && !row.isActive) return false;
      if (args.includeAllPurposes !== true && row.listingPurpose !== (args.listingPurpose ?? 'sale')) return false;
      if (args.includeAllPurposes === true && args.listingPurpose && row.listingPurpose !== args.listingPurpose) return false;
      if (args.category && row.category !== args.category) return false;
      if (args.zone && row.zone !== args.zone) return false;
      if (args.type && row.type !== args.type) return false;
      if (args.condition && row.condition !== args.condition) return false;
      if (args.minPrice != null && row.priceEur < args.minPrice) return false;
      if (args.maxPrice != null && row.priceEur > args.maxPrice) return false;
      if (args.minArea != null && (row.areaSqm ?? 0) < args.minArea) return false;
      if (args.maxArea != null && (row.areaSqm ?? 0) > args.maxArea) return false;
      return true;
    });
    rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || String(b._id).localeCompare(String(a._id)));
    return rows.slice(offset, offset + limit);
  }
});

export const markInactive = mutation({
  args: { id: v.id('properties') },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) return false;
    await ctx.db.patch(args.id, { isActive: false, updatedAt: nowIso() });
    return true;
  }
});

export const markInactiveByScope = mutation({
  args: {
    listingPurpose: v.string(),
    category: v.string(),
    seenExternalIds: v.array(v.string())
  },
  handler: async (ctx, args) => {
    const seen = new Set(args.seenExternalIds);
    const rows = await ctx.db
      .query('properties')
      .withIndex('by_active_purpose_category', (q) =>
        q.eq('isActive', true).eq('listingPurpose', args.listingPurpose).eq('category', args.category)
      )
      .collect();
    let changed = 0;
    const updatedAt = nowIso();
    for (const row of rows) {
      if (row.source === 'imot.bg' && !seen.has(row.externalId)) {
        await ctx.db.patch(row._id, { isActive: false, updatedAt });
        changed += 1;
      }
    }
    return changed;
  }
});
```

- [ ] **Step 2: Validate Convex functions**

Run:

```powershell
npx convex dev --once
```

Expected: command completes without function validation errors.

- [ ] **Step 3: Commit**

Run:

```powershell
git add convex/properties.js convex/_generated
git commit -m "feat: add convex property functions"
```

---

### Task 4: Add Remaining Convex Functions

**Files:**
- Create: `convex/priceHistory.js`
- Create: `convex/scrapingRuns.js`
- Create: `convex/scrapingRunScopes.js`
- Create: `convex/settings.js`
- Create: `convex/dealTriage.js`
- Create: `convex/neighborhoodStats.js`
- Commit: `feat: add convex support functions`

- [ ] **Step 1: Add price history functions**

Create `convex/priceHistory.js`:

```js
import { v } from 'convex/values';
import { mutation, query } from './_generated/server.js';

function nowIso() {
  return new Date().toISOString();
}

export const insert = mutation({
  args: {
    propertyId: v.id('properties'),
    priceEur: v.number(),
    priceBgn: v.optional(v.number()),
    recordedAt: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('priceHistory', {
      propertyId: args.propertyId,
      priceEur: args.priceEur,
      priceBgn: args.priceBgn,
      recordedAt: args.recordedAt ?? nowIso()
    });
    return await ctx.db.get(id);
  }
});

export const byProperty = query({
  args: { propertyId: v.id('properties') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('priceHistory')
      .withIndex('by_property_recorded_at', (q) => q.eq('propertyId', args.propertyId))
      .collect();
  }
});
```

- [ ] **Step 2: Add scraping run functions**

Create `convex/scrapingRuns.js`:

```js
import { v } from 'convex/values';
import { mutation, query } from './_generated/server.js';

function nowIso() {
  return new Date().toISOString();
}

export const create = mutation({
  args: {
    status: v.optional(v.string()),
    pagesTotal: v.optional(v.number()),
    pagesScraped: v.optional(v.number()),
    salePagesScraped: v.optional(v.number()),
    rentalPagesScraped: v.optional(v.number()),
    currentPurpose: v.optional(v.string()),
    currentCategory: v.optional(v.string()),
    crawlMode: v.optional(v.string()),
    listingsFound: v.optional(v.number()),
    listingsSaved: v.optional(v.number()),
    errorMessage: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('scrapingRuns', {
      status: args.status ?? 'running',
      startedAt: nowIso(),
      completedAt: undefined,
      pagesTotal: args.pagesTotal ?? 0,
      pagesScraped: args.pagesScraped ?? 0,
      salePagesScraped: args.salePagesScraped ?? 0,
      rentalPagesScraped: args.rentalPagesScraped ?? 0,
      currentPurpose: args.currentPurpose,
      currentCategory: args.currentCategory,
      crawlMode: args.crawlMode ?? 'bounded',
      listingsFound: args.listingsFound ?? 0,
      listingsSaved: args.listingsSaved ?? 0,
      errorMessage: args.errorMessage
    });
    return await ctx.db.get(id);
  }
});

export const update = mutation({
  args: {
    id: v.id('scrapingRuns'),
    status: v.optional(v.string()),
    completedAt: v.optional(v.string()),
    pagesTotal: v.optional(v.number()),
    pagesScraped: v.optional(v.number()),
    salePagesScraped: v.optional(v.number()),
    rentalPagesScraped: v.optional(v.number()),
    currentPurpose: v.optional(v.union(v.string(), v.null())),
    currentCategory: v.optional(v.union(v.string(), v.null())),
    crawlMode: v.optional(v.string()),
    listingsFound: v.optional(v.number()),
    listingsSaved: v.optional(v.number()),
    errorMessage: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { id, ...values } = args;
    const patch = {};
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) {
        patch[key] = value === null ? undefined : value;
      }
    }
    if (values.status === 'completed' || values.status === 'failed') {
      patch.completedAt = values.completedAt ?? nowIso();
    }
    await ctx.db.patch(id, patch);
    return await ctx.db.get(id);
  }
});

export const latest = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('scrapingRuns').withIndex('by_started_at').order('desc').take(1);
    return rows[0] ?? null;
  }
});

export const history = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db.query('scrapingRuns').withIndex('by_started_at').order('desc').take(args.limit ?? 25);
  }
});
```

- [ ] **Step 3: Add scraping scope functions**

Create `convex/scrapingRunScopes.js`:

```js
import { v } from 'convex/values';
import { mutation, query } from './_generated/server.js';

export const create = mutation({
  args: {
    runId: v.id('scrapingRuns'),
    listingPurpose: v.string(),
    category: v.string(),
    pagesPlanned: v.number(),
    pagesScraped: v.optional(v.number()),
    fullScope: v.optional(v.boolean()),
    completed: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('scrapingRunScopes', {
      runId: args.runId,
      listingPurpose: args.listingPurpose,
      category: args.category,
      pagesPlanned: args.pagesPlanned,
      pagesScraped: args.pagesScraped ?? 0,
      fullScope: args.fullScope ?? false,
      completed: args.completed ?? false
    });
    return await ctx.db.get(id);
  }
});

export const complete = mutation({
  args: {
    id: v.id('scrapingRunScopes'),
    pagesScraped: v.optional(v.number()),
    completed: v.optional(v.boolean())
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      pagesScraped: args.pagesScraped ?? 0,
      completed: args.completed ?? false
    });
    return await ctx.db.get(args.id);
  }
});

export const completedByRun = query({
  args: { runId: v.id('scrapingRuns') },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('scrapingRunScopes')
      .withIndex('by_run', (q) => q.eq('runId', args.runId))
      .collect();
    return rows.filter((row) => row.completed);
  }
});
```

- [ ] **Step 4: Add settings functions**

Create `convex/settings.js`:

```js
import { v } from 'convex/values';
import { mutation, query } from './_generated/server.js';

export const defaultSettings = {
  general: {
    city: 'Sofia',
    currency: 'EUR',
    targetGrossYieldPct: 6,
    targetNetYieldPct: 4.5,
    rehabCostPerSqm: 300,
    transactionCostPct: 3,
    vacancyPct: 5,
    managementFeePct: 8
  },
  airbnb: {
    occupancyPct: 65,
    dailyRateEur: 65,
    operatingExpensePct: 30
  },
  leverage: {
    enabled: true,
    mortgageRate: 3.5,
    loanTermYears: 25,
    downPaymentPct: 20,
    ltvPct: 80,
    originationFeePct: 1,
    annualInsuranceEur: 250
  },
  flags: {
    cocGreenPct: 8,
    cocYellowPct: 4,
    dscrMinimum: 1.25,
    rateStressPct: 1
  }
};

const settingsPatch = v.object({
  general: v.optional(v.object({
    city: v.optional(v.string()),
    currency: v.optional(v.string()),
    targetGrossYieldPct: v.optional(v.number()),
    targetNetYieldPct: v.optional(v.number()),
    rehabCostPerSqm: v.optional(v.number()),
    transactionCostPct: v.optional(v.number()),
    vacancyPct: v.optional(v.number()),
    managementFeePct: v.optional(v.number())
  })),
  airbnb: v.optional(v.object({
    occupancyPct: v.optional(v.number()),
    dailyRateEur: v.optional(v.number()),
    operatingExpensePct: v.optional(v.number())
  })),
  leverage: v.optional(v.object({
    enabled: v.optional(v.boolean()),
    mortgageRate: v.optional(v.number()),
    loanTermYears: v.optional(v.number()),
    downPaymentPct: v.optional(v.number()),
    ltvPct: v.optional(v.number()),
    originationFeePct: v.optional(v.number()),
    annualInsuranceEur: v.optional(v.number())
  })),
  flags: v.optional(v.object({
    cocGreenPct: v.optional(v.number()),
    cocYellowPct: v.optional(v.number()),
    dscrMinimum: v.optional(v.number()),
    rateStressPct: v.optional(v.number())
  }))
});

function nowIso() {
  return new Date().toISOString();
}

function mergeSettings(base, patch) {
  const next = {
    general: { ...base.general, ...(patch.general ?? {}) },
    airbnb: { ...base.airbnb, ...(patch.airbnb ?? {}) },
    leverage: { ...base.leverage, ...(patch.leverage ?? {}) },
    flags: { ...base.flags, ...(patch.flags ?? {}) }
  };
  if (patch.leverage?.downPaymentPct != null && patch.leverage?.ltvPct == null) {
    next.leverage.ltvPct = 100 - Number(patch.leverage.downPaymentPct);
  }
  if (patch.leverage?.ltvPct != null && patch.leverage?.downPaymentPct == null) {
    next.leverage.downPaymentPct = 100 - Number(patch.leverage.ltvPct);
  }
  return next;
}

export const get = query({
  args: {},
  handler: async (ctx) => {
    const existing = (await ctx.db.query('settings').take(1))[0];
    return existing ?? { ...defaultSettings, updatedAt: nowIso() };
  }
});

export const update = mutation({
  args: { updates: settingsPatch },
  handler: async (ctx, args) => {
    const existing = (await ctx.db.query('settings').take(1))[0];
    const merged = mergeSettings(existing ?? defaultSettings, args.updates);
    const record = { ...merged, updatedAt: nowIso() };
    if (existing) {
      await ctx.db.patch(existing._id, record);
      return await ctx.db.get(existing._id);
    }
    const id = await ctx.db.insert('settings', record);
    return await ctx.db.get(id);
  }
});
```

- [ ] **Step 5: Add deal triage functions**

Create `convex/dealTriage.js`:

```js
import { v } from 'convex/values';
import { mutation, query } from './_generated/server.js';

const allowed = new Set(['new', 'watching', 'needs_call', 'visited', 'made_offer', 'rejected']);

function nowIso() {
  return new Date().toISOString();
}

function normalizeStatus(status) {
  const value = status ?? 'new';
  if (!allowed.has(value)) {
    throw new Error(`Invalid triage status: ${value}`);
  }
  return value;
}

export const byProperty = query({
  args: { propertyId: v.id('properties') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('dealTriage')
      .withIndex('by_property', (q) => q.eq('propertyId', args.propertyId))
      .unique();
  }
});

export const forProperties = query({
  args: { propertyIds: v.array(v.id('properties')) },
  handler: async (ctx, args) => {
    const result = [];
    for (const propertyId of args.propertyIds) {
      const row = await ctx.db
        .query('dealTriage')
        .withIndex('by_property', (q) => q.eq('propertyId', propertyId))
        .unique();
      if (row) result.push(row);
    }
    return result;
  }
});

export const upsert = mutation({
  args: {
    propertyId: v.id('properties'),
    status: v.optional(v.string()),
    note: v.optional(v.string()),
    rejectedReason: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('dealTriage')
      .withIndex('by_property', (q) => q.eq('propertyId', args.propertyId))
      .unique();
    const record = {
      propertyId: args.propertyId,
      status: normalizeStatus(args.status),
      note: args.note ?? '',
      rejectedReason: args.rejectedReason ?? '',
      updatedAt: nowIso()
    };
    if (existing) {
      await ctx.db.patch(existing._id, record);
      return await ctx.db.get(existing._id);
    }
    const id = await ctx.db.insert('dealTriage', record);
    return await ctx.db.get(id);
  }
});
```

- [ ] **Step 6: Add neighborhood stats functions**

Create `convex/neighborhoodStats.js`:

```js
import { mutation, query } from './_generated/server.js';

function nowIso() {
  return new Date().toISOString();
}

function average(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : undefined;
}

export const recompute = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query('neighborhoodStats').collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }

    const properties = await ctx.db
      .query('properties')
      .withIndex('by_active_purpose_updated', (q) => q.eq('isActive', true).eq('listingPurpose', 'sale'))
      .collect();
    const groups = new Map();
    for (const property of properties) {
      if (!property.neighborhood) continue;
      const key = `${property.neighborhood}\u0000${property.zone ?? ''}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(property);
    }

    const updatedAt = nowIso();
    const results = [];
    for (const [key, rows] of groups.entries()) {
      const [neighborhood, zoneValue] = key.split('\u0000');
      const prices = rows.map((row) => row.priceEur).filter(Number.isFinite);
      const areas = rows.map((row) => row.areaSqm).filter(Number.isFinite);
      const pricePerSqm = rows.map((row) => row.pricePerSqm).filter(Number.isFinite);
      const record = {
        neighborhood,
        zone: zoneValue || undefined,
        propertyCount: rows.length,
        avgPriceEur: average(prices),
        avgPricePerSqm: average(pricePerSqm),
        minPriceEur: prices.length ? Math.min(...prices) : undefined,
        maxPriceEur: prices.length ? Math.max(...prices) : undefined,
        avgAreaSqm: average(areas),
        updatedAt
      };
      const id = await ctx.db.insert('neighborhoodStats', record);
      results.push(await ctx.db.get(id));
    }
    results.sort((a, b) => String(a.zone ?? '').localeCompare(String(b.zone ?? '')) || a.neighborhood.localeCompare(b.neighborhood));
    return results;
  }
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('neighborhoodStats').collect();
    return rows.sort((a, b) => String(a.zone ?? '').localeCompare(String(b.zone ?? '')) || a.neighborhood.localeCompare(b.neighborhood));
  }
});
```

- [ ] **Step 7: Validate Convex functions**

Run:

```powershell
npx convex dev --once
```

Expected: command completes without function validation errors.

- [ ] **Step 8: Commit**

Run:

```powershell
git add convex/priceHistory.js convex/scrapingRuns.js convex/scrapingRunScopes.js convex/settings.js convex/dealTriage.js convex/neighborhoodStats.js convex/_generated
git commit -m "feat: add convex support functions"
```

---

### Task 5: Add Server Convex Client And Row Mapping

**Files:**
- Create: `server/src/convexClient.js`
- Create: `server/src/db/rowMapping.js`
- Create: `server/test/rowMapping.test.js`
- Commit: `feat: add convex row mapping`

- [ ] **Step 1: Add Convex client wrapper**

Create `server/src/convexClient.js`:

```js
import { ConvexHttpClient } from 'convex/browser';

let client = null;

export function createConvexClient(url = process.env.CONVEX_URL) {
  if (!url) {
    throw new Error('CONVEX_URL is required for Convex-backed persistence');
  }
  return new ConvexHttpClient(url);
}

export function getConvexClient() {
  if (!client) {
    client = createConvexClient();
  }
  return client;
}

export function setConvexClientForTests(testClient) {
  client = testClient;
}
```

- [ ] **Step 2: Add mapping helpers**

Create `server/src/db/rowMapping.js`:

```js
export function propertyDocToRow(doc) {
  if (!doc) return null;
  return {
    id: doc._id,
    external_id: doc.externalId,
    source: doc.source,
    listing_purpose: doc.listingPurpose,
    category: doc.category ?? null,
    url: doc.url ?? null,
    title: doc.title ?? null,
    neighborhood: doc.neighborhood ?? null,
    zone: doc.zone ?? null,
    type: doc.type ?? null,
    condition: doc.condition ?? null,
    price_eur: doc.priceEur,
    price_bgn: doc.priceBgn ?? null,
    area_sqm: doc.areaSqm ?? null,
    price_per_sqm: doc.pricePerSqm ?? null,
    floor: doc.floor ?? null,
    total_floors: doc.totalFloors ?? null,
    rooms: doc.rooms ?? null,
    construction_year: doc.constructionYear ?? null,
    construction_stage: doc.constructionStage ?? null,
    description: doc.description ?? null,
    image_url: doc.imageUrl ?? null,
    first_seen_at: doc.firstSeenAt,
    last_seen_at: doc.lastSeenAt,
    is_active: doc.isActive ? 1 : 0,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt
  };
}

export function priceHistoryDocToRow(doc) {
  if (!doc) return null;
  return {
    id: doc._id,
    property_id: doc.propertyId,
    price_eur: doc.priceEur,
    price_bgn: doc.priceBgn ?? null,
    recorded_at: doc.recordedAt
  };
}

export function scrapingRunDocToRow(doc) {
  if (!doc) return null;
  return {
    id: doc._id,
    status: doc.status,
    started_at: doc.startedAt,
    completed_at: doc.completedAt ?? null,
    pages_total: doc.pagesTotal,
    pages_scraped: doc.pagesScraped,
    sale_pages_scraped: doc.salePagesScraped,
    rental_pages_scraped: doc.rentalPagesScraped,
    current_purpose: doc.currentPurpose ?? null,
    current_category: doc.currentCategory ?? null,
    crawl_mode: doc.crawlMode,
    listings_found: doc.listingsFound,
    listings_saved: doc.listingsSaved,
    error_message: doc.errorMessage ?? null
  };
}

export function scrapingRunScopeDocToRow(doc) {
  if (!doc) return null;
  return {
    id: doc._id,
    run_id: doc.runId,
    listing_purpose: doc.listingPurpose,
    category: doc.category,
    pages_planned: doc.pagesPlanned,
    pages_scraped: doc.pagesScraped,
    full_scope: doc.fullScope ? 1 : 0,
    completed: doc.completed ? 1 : 0
  };
}

export function triageDocToResponse(doc) {
  if (!doc) return null;
  return {
    propertyId: doc.propertyId,
    status: doc.status,
    note: doc.note ?? '',
    rejectedReason: doc.rejectedReason ?? '',
    updatedAt: doc.updatedAt
  };
}

export function neighborhoodStatDocToRow(doc) {
  if (!doc) return null;
  return {
    id: doc._id,
    neighborhood: doc.neighborhood,
    zone: doc.zone ?? null,
    property_count: doc.propertyCount,
    avg_price_eur: doc.avgPriceEur ?? null,
    avg_price_per_sqm: doc.avgPricePerSqm ?? null,
    min_price_eur: doc.minPriceEur ?? null,
    max_price_eur: doc.maxPriceEur ?? null,
    avg_area_sqm: doc.avgAreaSqm ?? null,
    updated_at: doc.updatedAt
  };
}
```

- [ ] **Step 3: Add mapping tests**

Create `server/test/rowMapping.test.js`:

```js
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  neighborhoodStatDocToRow,
  priceHistoryDocToRow,
  propertyDocToRow,
  scrapingRunDocToRow,
  scrapingRunScopeDocToRow,
  triageDocToResponse
} from '../src/db/rowMapping.js';

describe('Convex row mapping', () => {
  test('maps property documents to existing row shape', () => {
    const row = propertyDocToRow({
      _id: 'prop1',
      externalId: 'imot-1',
      source: 'imot.bg',
      listingPurpose: 'sale',
      category: 'dvustaen',
      priceEur: 100000,
      pricePerSqm: 1250,
      isActive: true,
      firstSeenAt: '2026-05-29T00:00:00.000Z',
      lastSeenAt: '2026-05-29T00:00:00.000Z',
      createdAt: '2026-05-29T00:00:00.000Z',
      updatedAt: '2026-05-29T00:00:00.000Z'
    });

    assert.equal(row.id, 'prop1');
    assert.equal(row.external_id, 'imot-1');
    assert.equal(row.listing_purpose, 'sale');
    assert.equal(row.price_eur, 100000);
    assert.equal(row.is_active, 1);
  });

  test('maps support documents to existing response shapes', () => {
    assert.equal(priceHistoryDocToRow({ _id: 'h1', propertyId: 'p1', priceEur: 1, recordedAt: 'r' }).property_id, 'p1');
    assert.equal(scrapingRunDocToRow({ _id: 'r1', status: 'running', startedAt: 's', pagesTotal: 1, pagesScraped: 0, salePagesScraped: 0, rentalPagesScraped: 0, crawlMode: 'bounded', listingsFound: 0, listingsSaved: 0 }).pages_total, 1);
    assert.equal(scrapingRunScopeDocToRow({ _id: 's1', runId: 'r1', listingPurpose: 'sale', category: 'dvustaen', pagesPlanned: 1, pagesScraped: 1, fullScope: true, completed: true }).full_scope, 1);
    assert.equal(triageDocToResponse({ propertyId: 'p1', status: 'new', note: '', rejectedReason: '', updatedAt: 'u' }).propertyId, 'p1');
    assert.equal(neighborhoodStatDocToRow({ _id: 'n1', neighborhood: 'Mladost', propertyCount: 2, updatedAt: 'u' }).property_count, 2);
  });
});
```

- [ ] **Step 4: Run mapping tests**

Run:

```powershell
npm run test --workspace server -- rowMapping.test.js
```

Expected: row mapping tests pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add server/src/convexClient.js server/src/db/rowMapping.js server/test/rowMapping.test.js
git commit -m "feat: add convex row mapping"
```

---

### Task 6: Convert DB Modules To Async Convex Adapters

**Files:**
- Modify: `server/src/db/properties.js`
- Modify: `server/src/db/priceHistory.js`
- Modify: `server/src/db/scrapingRuns.js`
- Modify: `server/src/db/scrapingRunScopes.js`
- Modify: `server/src/db/settings.js`
- Modify: `server/src/db/dealTriage.js`
- Modify: `server/src/db/neighborhoodStats.js`
- Create: `server/test/convexAdapters.test.js`
- Commit: `feat: convert db modules to convex adapters`

- [ ] **Step 1: Add fake-client adapter tests**

Create `server/test/convexAdapters.test.js`:

```js
import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { anyApi } from 'convex/server';
import { setConvexClientForTests } from '../src/convexClient.js';
import { upsertProperty, getPropertyByExternalId } from '../src/db/properties.js';
import { insertPriceHistory, getPriceHistoryByPropertyId } from '../src/db/priceHistory.js';
import { createScrapingRun, updateScrapingRun } from '../src/db/scrapingRuns.js';
import { getSettings, updateSettings } from '../src/db/settings.js';

function fakeClient() {
  const calls = [];
  return {
    calls,
    async mutation(fn, args) {
      calls.push({ type: 'mutation', fn: String(fn), args });
      if (fn === anyApi.properties.upsert) return { _id: 'p1', externalId: args.externalId, source: 'imot.bg', listingPurpose: 'sale', priceEur: args.priceEur, isActive: true, firstSeenAt: 't', lastSeenAt: 't', createdAt: 't', updatedAt: 't' };
      if (fn === anyApi.priceHistory.insert) return { _id: 'h1', propertyId: args.propertyId, priceEur: args.priceEur, recordedAt: 't' };
      if (fn === anyApi.scrapingRuns.create) return { _id: 'r1', status: 'running', startedAt: 't', pagesTotal: args.pagesTotal, pagesScraped: 0, salePagesScraped: 0, rentalPagesScraped: 0, crawlMode: 'bounded', listingsFound: 0, listingsSaved: 0 };
      if (fn === anyApi.scrapingRuns.update) return { _id: args.id, status: args.status, startedAt: 't', completedAt: 't', pagesTotal: 1, pagesScraped: args.pagesScraped, salePagesScraped: 0, rentalPagesScraped: 0, crawlMode: 'bounded', listingsFound: 0, listingsSaved: 0 };
      if (fn === anyApi.settings.update) return { ...args.updates, updatedAt: 't' };
      return null;
    },
    async query(fn, args) {
      calls.push({ type: 'query', fn: String(fn), args });
      if (fn === anyApi.properties.byExternalId) return { _id: 'p1', externalId: args.externalId, source: 'imot.bg', listingPurpose: 'sale', priceEur: 100000, isActive: true, firstSeenAt: 't', lastSeenAt: 't', createdAt: 't', updatedAt: 't' };
      if (fn === anyApi.priceHistory.byProperty) return [{ _id: 'h1', propertyId: args.propertyId, priceEur: 100000, recordedAt: 't' }];
      if (fn === anyApi.settings.get) return { general: { city: 'Sofia' }, airbnb: {}, leverage: { enabled: true }, flags: {}, updatedAt: 't' };
      return null;
    }
  };
}

afterEach(() => {
  setConvexClientForTests(null);
});

describe('Convex DB adapters', () => {
  test('properties adapter returns SQLite-shaped rows', async () => {
    setConvexClientForTests(fakeClient());
    const property = await upsertProperty({ externalId: 'imot-1', priceEur: 100000 });
    assert.equal(property.id, 'p1');
    assert.equal(property.external_id, 'imot-1');
    assert.equal(property.price_eur, 100000);

    const same = await getPropertyByExternalId('imot-1');
    assert.equal(same.external_id, 'imot-1');
  });

  test('support adapters call matching Convex functions', async () => {
    setConvexClientForTests(fakeClient());
    const history = await insertPriceHistory({ propertyId: 'p1', priceEur: 100000 });
    assert.equal(history.property_id, 'p1');
    assert.equal((await getPriceHistoryByPropertyId('p1')).length, 1);

    const run = await createScrapingRun({ pagesTotal: 1 });
    assert.equal(run.pages_total, 1);
    const completed = await updateScrapingRun(run.id, { status: 'completed', pagesScraped: 1 });
    assert.equal(completed.status, 'completed');

    const settings = await getSettings();
    assert.equal(settings.general.city, 'Sofia');
    const updated = await updateSettings({ general: { city: 'Sofia' } });
    assert.equal(updated.general.city, 'Sofia');
  });
});
```

- [ ] **Step 2: Replace properties adapter**

Replace `server/src/db/properties.js` with:

```js
import { anyApi } from 'convex/server';
import { getConvexClient } from '../convexClient.js';
import { propertyDocToRow } from './rowMapping.js';

const columnMap = {
  externalId: 'externalId',
  listingPurpose: 'listingPurpose',
  priceEur: 'priceEur',
  priceBgn: 'priceBgn',
  areaSqm: 'areaSqm',
  pricePerSqm: 'pricePerSqm',
  totalFloors: 'totalFloors',
  constructionYear: 'constructionYear',
  constructionStage: 'constructionStage',
  imageUrl: 'imageUrl'
};

function toConvexProperty(property) {
  const record = {};
  for (const [key, value] of Object.entries(property)) {
    const mapped = columnMap[key] ?? key;
    if (value !== undefined) record[mapped] = value;
  }
  if (!record.externalId) throw new Error('externalId is required');
  if (record.priceEur == null) throw new Error('priceEur is required');
  return record;
}

function normalizeNumber(value) {
  return value == null || value === '' ? undefined : Number(value);
}

function normalizeFilters(filters) {
  return {
    ...filters,
    includeAllPurposes: filters.includeAllPurposes === true,
    includeInactive: filters.includeInactive === true,
    minPrice: normalizeNumber(filters.minPrice),
    maxPrice: normalizeNumber(filters.maxPrice),
    minArea: normalizeNumber(filters.minArea),
    maxArea: normalizeNumber(filters.maxArea),
    limit: filters.limit == null ? undefined : Number(filters.limit),
    offset: filters.offset == null ? undefined : Number(filters.offset)
  };
}

export async function upsertProperty(property) {
  const doc = await getConvexClient().mutation(anyApi.properties.upsert, toConvexProperty(property));
  return propertyDocToRow(doc);
}

export async function queryProperties(filters = {}) {
  const docs = await getConvexClient().query(anyApi.properties.list, normalizeFilters(filters));
  return docs.map(propertyDocToRow);
}

export async function getPropertyById(id) {
  const doc = await getConvexClient().query(anyApi.properties.byId, { id });
  return propertyDocToRow(doc);
}

export async function getPropertyByExternalId(externalId) {
  const doc = await getConvexClient().query(anyApi.properties.byExternalId, { externalId });
  return propertyDocToRow(doc);
}

export async function markInactive(id) {
  return await getConvexClient().mutation(anyApi.properties.markInactive, { id });
}

export async function markInactiveByScope({ listingPurpose, category, seenExternalIds = [] }) {
  return await getConvexClient().mutation(anyApi.properties.markInactiveByScope, {
    listingPurpose,
    category,
    seenExternalIds: [...seenExternalIds].filter(Boolean)
  });
}
```

- [ ] **Step 3: Replace support adapters**

Replace each support module with the same adapter pattern:

`server/src/db/priceHistory.js`:

```js
import { anyApi } from 'convex/server';
import { getConvexClient } from '../convexClient.js';
import { priceHistoryDocToRow } from './rowMapping.js';

export async function insertPriceHistory(entry) {
  const doc = await getConvexClient().mutation(anyApi.priceHistory.insert, {
    propertyId: entry.propertyId,
    priceEur: entry.priceEur,
    priceBgn: entry.priceBgn ?? undefined,
    recordedAt: entry.recordedAt ?? undefined
  });
  return priceHistoryDocToRow(doc);
}

export async function getPriceHistoryByPropertyId(propertyId) {
  const docs = await getConvexClient().query(anyApi.priceHistory.byProperty, { propertyId });
  return docs.map(priceHistoryDocToRow);
}
```

`server/src/db/scrapingRuns.js`:

```js
import { anyApi } from 'convex/server';
import { getConvexClient } from '../convexClient.js';
import { scrapingRunDocToRow } from './rowMapping.js';

export async function createScrapingRun(values = {}) {
  const doc = await getConvexClient().mutation(anyApi.scrapingRuns.create, values);
  return scrapingRunDocToRow(doc);
}

export async function updateScrapingRun(id, values = {}) {
  const doc = await getConvexClient().mutation(anyApi.scrapingRuns.update, { id, ...values });
  return scrapingRunDocToRow(doc);
}

export async function getLatestScrapingRun() {
  const doc = await getConvexClient().query(anyApi.scrapingRuns.latest, {});
  return scrapingRunDocToRow(doc);
}

export async function listScrapingRuns(limit = 25) {
  const docs = await getConvexClient().query(anyApi.scrapingRuns.history, { limit });
  return docs.map(scrapingRunDocToRow);
}
```

`server/src/db/scrapingRunScopes.js`:

```js
import { anyApi } from 'convex/server';
import { getConvexClient } from '../convexClient.js';
import { scrapingRunScopeDocToRow } from './rowMapping.js';

export async function createScrapingRunScope(values) {
  const doc = await getConvexClient().mutation(anyApi.scrapingRunScopes.create, values);
  return scrapingRunScopeDocToRow(doc);
}

export async function completeScrapingRunScope(id, values = {}) {
  const doc = await getConvexClient().mutation(anyApi.scrapingRunScopes.complete, { id, ...values });
  return scrapingRunScopeDocToRow(doc);
}

export async function getCompletedScrapingRunScopes(runId) {
  const docs = await getConvexClient().query(anyApi.scrapingRunScopes.completedByRun, { runId });
  return docs.map(scrapingRunScopeDocToRow);
}
```

`server/src/db/settings.js`:

```js
import { anyApi } from 'convex/server';
import { getConvexClient } from '../convexClient.js';

export async function getSettings() {
  return await getConvexClient().query(anyApi.settings.get, {});
}

export async function updateSettings(updates) {
  return await getConvexClient().mutation(anyApi.settings.update, { updates });
}
```

`server/src/db/dealTriage.js`:

```js
import { anyApi } from 'convex/server';
import { getConvexClient } from '../convexClient.js';
import { triageDocToResponse } from './rowMapping.js';

export const ALLOWED_TRIAGE_STATUSES = ['new', 'watching', 'needs_call', 'visited', 'made_offer', 'rejected'];
const allowedStatusSet = new Set(ALLOWED_TRIAGE_STATUSES);

export function validateTriageStatus(status) {
  const normalized = status ?? 'new';
  if (!allowedStatusSet.has(normalized)) {
    throw new Error(`Invalid triage status: ${normalized}`);
  }
  return normalized;
}

export function defaultTriage(propertyId) {
  return { propertyId, status: 'new', note: '', rejectedReason: '', updatedAt: null };
}

export async function getTriageByPropertyId(propertyId) {
  const doc = await getConvexClient().query(anyApi.dealTriage.byProperty, { propertyId });
  return triageDocToResponse(doc);
}

export async function getTriageMap(propertyIds) {
  if (!propertyIds.length) return new Map();
  const docs = await getConvexClient().query(anyApi.dealTriage.forProperties, { propertyIds });
  return new Map(docs.map((doc) => [doc.propertyId, triageDocToResponse(doc)]));
}

export async function upsertTriage(propertyId, updates) {
  const doc = await getConvexClient().mutation(anyApi.dealTriage.upsert, {
    propertyId,
    status: validateTriageStatus(updates.status),
    note: updates.note ?? '',
    rejectedReason: updates.rejectedReason ?? updates.rejected_reason ?? ''
  });
  return triageDocToResponse(doc);
}
```

`server/src/db/neighborhoodStats.js`:

```js
import { anyApi } from 'convex/server';
import { getConvexClient } from '../convexClient.js';
import { neighborhoodStatDocToRow } from './rowMapping.js';

export async function recomputeNeighborhoodStats() {
  const docs = await getConvexClient().mutation(anyApi.neighborhoodStats.recompute, {});
  return docs.map(neighborhoodStatDocToRow);
}

export async function getNeighborhoodStats() {
  const docs = await getConvexClient().query(anyApi.neighborhoodStats.list, {});
  return docs.map(neighborhoodStatDocToRow);
}
```

- [ ] **Step 4: Run adapter tests**

Run:

```powershell
npm run test --workspace server -- convexAdapters.test.js rowMapping.test.js
```

Expected: adapter and mapping tests pass without a live Convex deployment.

- [ ] **Step 5: Commit**

Run:

```powershell
git add server/src/db server/src/convexClient.js server/test/convexAdapters.test.js
git commit -m "feat: convert db modules to convex adapters"
```

---

### Task 7: Convert Scraper And Routes To Async Persistence

**Files:**
- Modify: `server/src/scraper/imotbg.js`
- Modify: `server/src/routes/scraper.js`
- Modify: `server/src/routes/properties.js`
- Modify: `server/src/routes/strategies.js`
- Modify: `server/src/routes/overview.js`
- Modify: `server/src/routes/neighborhoods.js`
- Modify: `server/src/routes/settings.js`
- Modify: `server/src/routes/triage.js`
- Commit: `refactor: await convex persistence in server routes`

- [ ] **Step 1: Update scraper calls**

In `server/src/scraper/imotbg.js`, every DB operation becomes awaited. The critical changes are:

```js
const run = await createScrapingRun({ pagesTotal: plan.length, crawlMode: normalizedOptions.fullCrawl ? 'full' : 'bounded' });
```

```js
const scope = await createScrapingRunScope({
  runId: run.id,
  listingPurpose: item.purpose,
  category: item.category,
  pagesPlanned,
  fullScope: item.fullScope
});
```

```js
const existing = await getPropertyByExternalId(listing.externalId);
const saved = await upsertProperty(propertyData);
```

```js
await insertPriceHistory({ propertyId: saved.id, priceEur: saved.price_eur, priceBgn: saved.price_bgn });
```

```js
await updateScrapingRun(run.id, {
  pagesScraped: index + 1,
  listingsFound,
  listingsSaved,
  salePagesScraped,
  rentalPagesScraped,
  currentPurpose: item.purpose,
  currentCategory: item.category
});
```

```js
await completeScrapingRunScope(scope.id, { pagesScraped: planned, completed: true });
await markInactiveByScope({ listingPurpose, category, seenExternalIds: seenByScope.get(key) });
```

```js
await recomputeNeighborhoodStats();
const completed = await updateScrapingRun(run.id, {
  status: 'completed',
  listingsFound,
  listingsSaved,
  pagesScraped: plan.length,
  salePagesScraped,
  rentalPagesScraped,
  currentPurpose: null,
  currentCategory: null
});
```

Remove `database` passing from new Convex-backed calls, but leave the `database` parameter in `runScrape()` temporarily so test call sites can be converted gradually.

- [ ] **Step 2: Update route handlers with async wrappers**

Use this pattern in each router:

```js
router.get('/', async (req, res, next) => {
  try {
    const result = await someAsyncOperation();
    res.json(result);
  } catch (error) {
    next(error);
  }
});
```

For `server/src/routes/scraper.js`, replace the direct SQL history read with:

```js
import { getLatestScrapingRun, listScrapingRuns } from '../db/scrapingRuns.js';
```

```js
router.get('/history', async (_req, res, next) => {
  try {
    const runs = (await listScrapingRuns(25)).map(toRunResponse);
    res.json({ runs });
  } catch (error) {
    next(error);
  }
});
```

For `server/src/routes/properties.js`, await property, settings, history, and strategy calls:

```js
const properties = await queryProperties({ zone: req.query.zone, limit, offset });
```

```js
const [settings, priceHistory, strategies] = await Promise.all([
  getSettings(),
  getPriceHistoryByPropertyId(property.id),
  analyzeProperty(property, { settings })
]);
```

- [ ] **Step 3: Add Express error middleware**

In `server/src/index.js`, after all routes, add:

```js
app.use((error, _req, res, _next) => {
  res.status(500).json({ error: error.message });
});
```

- [ ] **Step 4: Run focused syntax check**

Run:

```powershell
npm run test --workspace server -- convexAdapters.test.js rowMapping.test.js
```

Expected: tests still pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add server/src/scraper/imotbg.js server/src/routes server/src/index.js
git commit -m "refactor: await convex persistence in server routes"
```

---

### Task 8: Convert Strategy Layer To Async

**Files:**
- Modify: `server/src/strategies/index.js`
- Modify: `server/src/strategies/shared.js`
- Modify: `server/src/strategies/rentalComps.js`
- Modify: `server/src/strategies/belowMarket.js`
- Modify: `server/src/strategies/buyInGreen.js`
- Modify: `server/src/strategies/brrrr.js`
- Modify: `server/src/strategies/cashFlow.js`
- Modify: `server/src/strategies/airbnb.js`
- Modify: `server/src/strategies/flipper.js`
- Modify: `server/src/triage/dealTriage.js`
- Commit: `refactor: make strategy analysis async`

- [ ] **Step 1: Make DB-backed shared helpers async**

In `server/src/strategies/shared.js`, change:

```js
export async function averagePricePerSqm(property) {
  const comps = await queryProperties({
    includeAllPurposes: false,
    listingPurpose: 'sale',
    zone: property.zone,
    includeInactive: false,
    limit: 10000
  });
  const values = comps
    .filter((comp) => comp.external_id !== property.external_id)
    .map((comp) => Number(comp.price_per_sqm))
    .filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Number(property.price_per_sqm || 0);
}
```

Import `queryProperties` at the top:

```js
import { queryProperties } from '../db/properties.js';
```

- [ ] **Step 2: Make rental comp helper async**

In `server/src/strategies/rentalComps.js`, replace direct SQL with `queryProperties()`:

```js
async function rentalComps(property, scope) {
  const filters = {
    listingPurpose: 'rent',
    includeInactive: false,
    limit: 10000
  };
  if (scope === 'neighborhood') filters.neighborhood = property.neighborhood;
  if (scope === 'zone') filters.zone = property.zone;
  const rows = await queryProperties(filters);
  return rows.filter((row) => {
    if (property.rooms != null) return row.rooms === property.rooms;
    if (property.type) return row.type === property.type;
    return true;
  });
}

export async function estimateMonthlyRentFromComps(property, { settings }) {
  const neighborhoodComps = await rentalComps(property, 'neighborhood');
  if (neighborhoodComps.length >= MIN_SAMPLE_SIZE) {
    return estimateFromSelectedComps(property, neighborhoodComps, 'neighborhood_comps');
  }
  const zoneComps = await rentalComps(property, 'zone');
  if (zoneComps.length >= MIN_SAMPLE_SIZE) {
    return estimateFromSelectedComps(property, zoneComps, 'zone_comps');
  }
  return {
    monthlyRent: estimatedMonthlyRentFallback(property, settings),
    source: 'target_yield_fallback',
    sampleSize: 0,
    fallback: true
  };
}
```

Also extend `queryProperties` filter support for `neighborhood` in `convex/properties.js` and `server/src/db/properties.js`.

- [ ] **Step 3: Await analyzers**

In each strategy file that calls `averagePricePerSqm()` or `estimateMonthlyRentFromComps()`, make `analyze` async and await the helper:

```js
export async function analyze(property, { settings }) {
  const marketPricePerSqm = await averagePricePerSqm(property);
  // existing formula continues here
}
```

For cash-flow and Airbnb:

```js
const rentEstimate = await estimateMonthlyRentFromComps(property, { settings });
```

- [ ] **Step 4: Update strategy index**

In `server/src/strategies/index.js`, make `analyzeProperty()` and `analyzeStrategy()` async:

```js
export async function analyzeProperty(property, { settings = await getSettings() } = {}) {
  const results = {};
  for (const [name, analyzer] of Object.entries(strategyMap)) {
    results[name] = decorateResult(await analyzer(property, { settings }), settings);
  }
  return results;
}
```

```js
export async function analyzeStrategy(name, options = {}) {
  const analyzer = strategyMap[name];
  if (!analyzer) throw new Error(`Unknown strategy: ${name}`);
  const settings = options.settings ?? await getSettings();
  const properties = await queryProperties({ ...options.filters, listingPurpose: 'sale', limit: 10000 });
  const results = [];
  for (const property of properties) {
    results.push(decorateResult(await analyzer(property, { settings }), settings));
  }
  // keep existing sorting, filtering, pagination, and summary logic
}
```

- [ ] **Step 5: Update triage analysis**

In `server/src/triage/dealTriage.js`, await `getSettings()`, `queryProperties()`, `getTriageMap()`, and `bestOpportunityForProperty()`:

```js
export async function listDealTriageOpportunities(options = {}) {
  const settings = await getSettings();
  const properties = await queryProperties({ ...options.filters, listingPurpose: 'sale', limit: 10000 });
  const triageMap = await getTriageMap(properties.map((property) => property.id));
  // keep existing filtering and response shape
}
```

- [ ] **Step 6: Run strategy tests and fix await call sites**

Run:

```powershell
npm run test --workspace server -- phase4.test.js rentalComps.test.js dealTriage.test.js
```

Expected initially: failures at un-awaited call sites. Fix tests by adding `await` to calls such as `analyzeProperty(...)`, `analyzeStrategy(...)`, and `listDealTriageOpportunities(...)`.

- [ ] **Step 7: Commit**

Run:

```powershell
git add server/src/strategies server/src/triage server/test
git commit -m "refactor: make strategy analysis async"
```

---

### Task 9: Update Tests For Convex Boundary Without Live Convex

**Files:**
- Modify: `server/test/phase2.test.js`
- Modify: `server/test/phase3.test.js`
- Modify: `server/test/phase4.test.js`
- Modify: `server/test/rentalComps.test.js`
- Modify: `server/test/dealTriage.test.js`
- Commit: `test: update server tests for convex adapters`

- [ ] **Step 1: Split old SQLite tests**

Keep pure utility tests in existing files. Move SQLite-specific tests that call `createDatabase(':memory:')` into a `describe('legacy sqlite adapter')` block only if the SQLite adapter still exists. If the SQLite adapter is removed, delete tests that assert SQLite migrations and replace them with adapter tests against the fake Convex client.

- [ ] **Step 2: Add async awaits**

For each server test file, update persistence calls from:

```js
const property = upsertProperty({ externalId: 'imot-1', priceEur: 100000 }, db);
```

to:

```js
const property = await upsertProperty({ externalId: 'imot-1', priceEur: 100000 });
```

Update assertions that pass `db` into persistence functions by removing that argument.

- [ ] **Step 3: Use fake Convex client in route/scraper tests**

At the top of route/scraper tests that need persistence, import:

```js
import { setConvexClientForTests } from '../src/convexClient.js';
```

Before each test, set an in-memory fake client that implements `query()` and `mutation()` for the functions exercised by that test. After each test, call:

```js
setConvexClientForTests(null);
```

- [ ] **Step 4: Run full server tests**

Run:

```powershell
npm run test --workspace server
```

Expected: all server tests pass without requiring `CONVEX_URL`.

- [ ] **Step 5: Commit**

Run:

```powershell
git add server/test
git commit -m "test: update server tests for convex adapters"
```

---

### Task 10: Add Smoke Test Documentation And Run Verification

**Files:**
- Create: `docs/convex-fresh-scan-smoke-test.md`
- Commit: `docs: add convex fresh scan smoke test`

- [ ] **Step 1: Add smoke-test document**

Create `docs/convex-fresh-scan-smoke-test.md`:

```md
# Convex Fresh Scan Smoke Test

This app does not migrate `data/realestate.db` into Convex. Convex starts empty and is populated by a fresh scrape.

## Prerequisites

- Run `npm install`.
- Run `npx convex dev` and keep it running.
- Set `CONVEX_URL` to the Convex dev deployment URL printed by Convex.

## Steps

1. Start the server:

   ```powershell
   $env:CONVEX_URL="<convex dev url>"
   npm run dev:server
   ```

2. Start the client:

   ```powershell
   npm run dev:client
   ```

3. Open the Vite URL in the browser.
4. Confirm Overview loads with empty-state data before scraping.
5. Start a bounded scrape from the UI.
6. Confirm `/api/scraper/status` moves from `running` to `completed`.
7. Confirm `/api/scraper/history` returns the completed run.
8. Confirm Overview shows active sale listings and rental comps separately.
9. Confirm a strategy page returns properties from Convex data.
10. Open a property detail page and confirm price history and strategy results render.
11. Change one Settings value and confirm it persists after page reload.
12. Change one Deal Triage status and confirm it persists after page reload.

## Expected Result

The app works from Convex-populated data only. No step reads from or imports `data/realestate.db`.
```

- [ ] **Step 2: Run automated verification**

Run:

```powershell
npm test
```

Expected: server and client test suites pass.

- [ ] **Step 3: Build client**

Run:

```powershell
npm run build
```

Expected: Vite build completes successfully.

- [ ] **Step 4: Run Convex validation**

Run:

```powershell
npx convex dev --once
```

Expected: Convex schema and functions validate.

- [ ] **Step 5: Commit**

Run:

```powershell
git add docs/convex-fresh-scan-smoke-test.md
git commit -m "docs: add convex fresh scan smoke test"
```

---

### Task 11: Manual Fresh Scan Verification

**Files:**
- No code files.
- Commit: no commit unless verification finds and fixes a defect.

- [ ] **Step 1: Start Convex**

Run:

```powershell
npx convex dev
```

Expected: Convex prints the dev deployment URL and watches `convex/`.

- [ ] **Step 2: Start the app**

In a second terminal:

```powershell
$env:CONVEX_URL="<convex dev url>"
npm run dev
```

Expected: Express starts on port `3001`; Vite starts on its configured dev URL.

- [ ] **Step 3: Run fresh scan**

Open the client in the browser and run the default scrape.

Expected:

- Scraper status changes to `running`.
- Scraper status eventually changes to `completed`.
- Convex dashboard shows documents in `properties`, `priceHistory`, `scrapingRuns`, `scrapingRunScopes`, and `neighborhoodStats`.

- [ ] **Step 4: Verify user workflows**

Check:

- Overview shows sale listing count and rental comp count.
- A strategy page lists sale properties.
- Property detail opens using a Convex document ID.
- Price history exists for a freshly scraped listing.
- Settings save and survive reload.
- Deal triage status save and survive reload.

- [ ] **Step 5: Record result in final response**

If manual verification passes, report the exact commands run and the successful workflows. If manual verification is blocked because Convex auth or network access is unavailable, report that blocker and the automated tests that did pass.
