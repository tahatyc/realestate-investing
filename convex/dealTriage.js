import { mutationGeneric as mutation, queryGeneric as query } from 'convex/server';
import { v } from 'convex/values';

const ALLOWED_TRIAGE_STATUSES = [
  'new',
  'watching',
  'needs_call',
  'visited',
  'made_offer',
  'rejected'
];

const allowedStatusSet = new Set(ALLOWED_TRIAGE_STATUSES);

const nowIso = () => new Date().toISOString();

const normalizeStatus = (status) => {
  const normalized = status ?? 'new';
  if (!allowedStatusSet.has(normalized)) {
    throw new Error(`Invalid triage status: ${normalized}`);
  }

  return normalized;
};

export const byProperty = query({
  args: { propertyId: v.id('properties') },
  handler: async ({ db }, { propertyId }) => {
    return await db
      .query('dealTriage')
      .withIndex('by_property', (q) => q.eq('propertyId', propertyId))
      .unique();
  }
});

export const forProperties = query({
  args: { propertyIds: v.array(v.id('properties')) },
  handler: async ({ db }, { propertyIds }) => {
    if (propertyIds.length === 0) {
      return [];
    }

    const result = [];
    for (const propertyId of propertyIds) {
      const row = await db
        .query('dealTriage')
        .withIndex('by_property', (q) => q.eq('propertyId', propertyId))
        .first();
      if (row) {
        result.push(row);
      }
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
  handler: async ({ db }, args) => {
    const existing = await db
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
      await db.patch(existing._id, record);
      return await db.get(existing._id);
    }

    const id = await db.insert('dealTriage', record);
    return await db.get(id);
  }
});
