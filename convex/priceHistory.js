import { mutationGeneric as mutation, queryGeneric as query } from 'convex/server';
import { v } from 'convex/values';

const nullableNumber = v.union(v.number(), v.null());

const nowIso = () => new Date().toISOString();

export const insert = mutation({
  args: {
    propertyId: v.id('properties'),
    priceEur: v.number(),
    priceBgn: v.optional(nullableNumber),
    recordedAt: v.optional(v.string())
  },
  handler: async ({ db }, args) => {
    const id = await db.insert('priceHistory', {
      propertyId: args.propertyId,
      priceEur: args.priceEur,
      priceBgn: args.priceBgn ?? null,
      recordedAt: args.recordedAt ?? nowIso()
    });

    return await db.get(id);
  }
});

export const byProperty = query({
  args: { propertyId: v.id('properties') },
  handler: async ({ db }, { propertyId }) => {
    return await db
      .query('priceHistory')
      .withIndex('by_property_recorded_at', (q) => q.eq('propertyId', propertyId))
      .collect();
  }
});
