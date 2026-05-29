import { mutationGeneric as mutation, queryGeneric as query } from 'convex/server';
import { v } from 'convex/values';

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
  handler: async ({ db }, args) => {
    const id = await db.insert('scrapingRunScopes', {
      runId: args.runId,
      listingPurpose: args.listingPurpose,
      category: args.category,
      pagesPlanned: args.pagesPlanned,
      pagesScraped: args.pagesScraped ?? 0,
      fullScope: args.fullScope ?? false,
      completed: args.completed ?? false
    });

    return await db.get(id);
  }
});

export const complete = mutation({
  args: {
    id: v.id('scrapingRunScopes'),
    pagesScraped: v.optional(v.number()),
    completed: v.optional(v.boolean())
  },
  handler: async ({ db }, { id, pagesScraped, completed }) => {
    await db.patch(id, {
      pagesScraped: pagesScraped ?? 0,
      completed: completed ?? true
    });

    return await db.get(id);
  }
});

export const completedByRun = query({
  args: { runId: v.id('scrapingRuns') },
  handler: async ({ db }, { runId }) => {
    const rows = await db
      .query('scrapingRunScopes')
      .withIndex('by_run', (q) => q.eq('runId', runId))
      .collect();

    return rows.filter((row) => row.completed);
  }
});
