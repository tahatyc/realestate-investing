import { mutationGeneric as mutation, queryGeneric as query } from 'convex/server';
import { v } from 'convex/values';

const nullableString = v.union(v.string(), v.null());

const nowIso = () => new Date().toISOString();

const allowedStatuses = new Set(['running', 'completed', 'failed']);

const validateStatus = (status) => {
  if (!allowedStatuses.has(status)) {
    throw new Error(`Invalid scraping run status: ${status}`);
  }
  return status;
};

const buildPatch = (values) => {
  const patch = {};

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      patch[key] = value;
    }
  }

  return patch;
};

export const create = mutation({
  args: {
    status: v.optional(v.string()),
    startedAt: v.optional(v.string()),
    completedAt: v.optional(nullableString),
    pagesTotal: v.optional(v.number()),
    pagesScraped: v.optional(v.number()),
    salePagesScraped: v.optional(v.number()),
    rentalPagesScraped: v.optional(v.number()),
    currentPurpose: v.optional(nullableString),
    currentCategory: v.optional(nullableString),
    crawlMode: v.optional(v.string()),
    listingsFound: v.optional(v.number()),
    listingsSaved: v.optional(v.number()),
    errorMessage: v.optional(nullableString)
  },
  handler: async ({ db }, args) => {
    const status = validateStatus(args.status ?? 'running');
    const timestamp = nowIso();
    const id = await db.insert('scrapingRuns', {
      status,
      startedAt: args.startedAt ?? timestamp,
      completedAt: args.completedAt ?? (status === 'completed' || status === 'failed' ? timestamp : null),
      pagesTotal: args.pagesTotal ?? 0,
      pagesScraped: args.pagesScraped ?? 0,
      salePagesScraped: args.salePagesScraped ?? 0,
      rentalPagesScraped: args.rentalPagesScraped ?? 0,
      currentPurpose: args.currentPurpose ?? null,
      currentCategory: args.currentCategory ?? null,
      crawlMode: args.crawlMode ?? 'bounded',
      listingsFound: args.listingsFound ?? 0,
      listingsSaved: args.listingsSaved ?? 0,
      errorMessage: args.errorMessage ?? null
    });

    return await db.get(id);
  }
});

export const update = mutation({
  args: {
    id: v.id('scrapingRuns'),
    status: v.optional(v.string()),
    completedAt: v.optional(nullableString),
    pagesTotal: v.optional(v.number()),
    pagesScraped: v.optional(v.number()),
    salePagesScraped: v.optional(v.number()),
    rentalPagesScraped: v.optional(v.number()),
    currentPurpose: v.optional(nullableString),
    currentCategory: v.optional(nullableString),
    crawlMode: v.optional(v.string()),
    listingsFound: v.optional(v.number()),
    listingsSaved: v.optional(v.number()),
    errorMessage: v.optional(nullableString)
  },
  handler: async ({ db }, args) => {
    const { id, ...values } = args;
    const patch = buildPatch(values);

    if (patch.status !== undefined) {
      validateStatus(patch.status);
    }
    if ((patch.status === 'completed' || patch.status === 'failed') && patch.completedAt == null) {
      patch.completedAt = nowIso();
    }

    if (Object.keys(patch).length > 0) {
      await db.patch(id, patch);
    }

    return await db.get(id);
  }
});

export const latest = query({
  args: {},
  handler: async ({ db }) => {
    const rows = await db.query('scrapingRuns').withIndex('by_started_at').order('desc').take(1);
    return rows[0] ?? null;
  }
});

export const history = query({
  args: { limit: v.optional(v.number()) },
  handler: async ({ db }, { limit }) => {
    const safeLimit = Math.min(500, Math.max(0, Math.floor(limit ?? 25)));
    return await db.query('scrapingRuns').withIndex('by_started_at').order('desc').take(safeLimit);
  }
});
