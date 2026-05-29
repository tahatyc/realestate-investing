import { mutationGeneric as mutation, queryGeneric as query } from 'convex/server';
import { v } from 'convex/values';

const nullableString = v.union(v.string(), v.null());
const nullableNumber = v.union(v.number(), v.null());
const optionalNullableString = v.optional(nullableString);
const optionalNullableNumber = v.optional(nullableNumber);

const nowIso = () => new Date().toISOString();

const pricePerSqmFor = (priceEur, areaSqm) => {
  if (typeof priceEur !== 'number' || typeof areaSqm !== 'number' || areaSqm <= 0) {
    return null;
  }

  return Math.round((priceEur / areaSqm) * 100) / 100;
};

const hasValue = (value) => value !== undefined && value !== null && value !== '';

const pickPatch = (args, fields) => {
  const patch = {};

  for (const field of fields) {
    if (args[field] !== undefined) {
      patch[field] = args[field];
    }
  }

  return patch;
};

const optionalPropertyFields = [
  'category',
  'url',
  'title',
  'neighborhood',
  'zone',
  'type',
  'condition',
  'priceBgn',
  'areaSqm',
  'floor',
  'totalFloors',
  'rooms',
  'constructionYear',
  'constructionStage',
  'description',
  'imageUrl'
];

const upsertArgs = {
  externalId: v.string(),
  source: optionalNullableString,
  listingPurpose: optionalNullableString,
  category: optionalNullableString,
  url: optionalNullableString,
  title: optionalNullableString,
  neighborhood: optionalNullableString,
  zone: optionalNullableString,
  type: optionalNullableString,
  condition: optionalNullableString,
  priceEur: v.number(),
  priceBgn: optionalNullableNumber,
  areaSqm: optionalNullableNumber,
  pricePerSqm: optionalNullableNumber,
  floor: optionalNullableNumber,
  totalFloors: optionalNullableNumber,
  rooms: optionalNullableNumber,
  constructionYear: optionalNullableNumber,
  constructionStage: optionalNullableString,
  description: optionalNullableString,
  imageUrl: optionalNullableString,
  firstSeenAt: v.optional(v.string()),
  lastSeenAt: v.optional(v.string()),
  createdAt: v.optional(v.string()),
  updatedAt: v.optional(v.string())
};

export const upsert = mutation({
  args: upsertArgs,
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('properties')
      .withIndex('by_external_id', (q) => q.eq('externalId', args.externalId))
      .first();

    const timestamp = nowIso();
    const source = args.source ?? 'imot.bg';
    const listingPurpose = args.listingPurpose ?? 'sale';
    const lastSeenAt = args.lastSeenAt ?? timestamp;
    const updatedAt = args.updatedAt ?? timestamp;
    const nextAreaSqm = args.areaSqm !== undefined ? args.areaSqm : existing?.areaSqm;
    const patch = {
      source,
      listingPurpose,
      priceEur: args.priceEur,
      pricePerSqm: args.pricePerSqm !== undefined ? args.pricePerSqm : pricePerSqmFor(args.priceEur, nextAreaSqm),
      lastSeenAt,
      updatedAt,
      isActive: true,
      ...pickPatch(args, optionalPropertyFields)
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return await ctx.db.get(existing._id);
    }

    const firstSeenAt = args.firstSeenAt ?? lastSeenAt;
    const createdAt = args.createdAt ?? updatedAt;
    const doc = {
      externalId: args.externalId,
      firstSeenAt,
      createdAt,
      ...patch
    };

    for (const field of optionalPropertyFields) {
      if (doc[field] === undefined) {
        doc[field] = null;
      }
    }

    const id = await ctx.db.insert('properties', doc);
    return await ctx.db.get(id);
  }
});

export const byExternalId = query({
  args: { externalId: v.string() },
  handler: async ({ db }, { externalId }) => {
    return await db
      .query('properties')
      .withIndex('by_external_id', (q) => q.eq('externalId', externalId))
      .first();
  }
});

export const byId = query({
  args: { id: v.id('properties') },
  handler: async ({ db }, { id }) => {
    return await db.get(id);
  }
});

const propertyFilterArgs = {
  listingPurpose: v.optional(v.string()),
  includeAllPurposes: v.optional(v.boolean()),
  includeInactive: v.optional(v.boolean()),
  category: optionalNullableString,
  neighborhood: optionalNullableString,
  zone: optionalNullableString,
  type: optionalNullableString,
  condition: optionalNullableString,
  minPrice: optionalNullableNumber,
  maxPrice: optionalNullableNumber,
  minArea: optionalNullableNumber,
  maxArea: optionalNullableNumber
};

async function collectFilteredProperties(db, args) {
  const includeInactive = args.includeInactive === true;
  const includeAllPurposes = args.includeAllPurposes === true;
  const purposeFilter = hasValue(args.listingPurpose) ? args.listingPurpose : includeAllPurposes ? null : 'sale';
  const usePurpose = purposeFilter !== null;
  const useCategory = hasValue(args.category);

  let queryBuilder;

  if (!includeInactive && usePurpose && useCategory) {
    queryBuilder = db
      .query('properties')
      .withIndex('by_active_purpose_category', (q) =>
        q.eq('isActive', true).eq('listingPurpose', purposeFilter).eq('category', args.category)
      );
  } else if (!includeInactive && usePurpose) {
    queryBuilder = db
      .query('properties')
      .withIndex('by_active_purpose_updated', (q) =>
        q.eq('isActive', true).eq('listingPurpose', purposeFilter)
      )
      .order('desc');
  } else {
    queryBuilder = db.query('properties');
  }

  const docs = await queryBuilder.collect();
  return docs.filter((doc) => {
    if (!includeInactive && doc.isActive !== true) return false;
    if (usePurpose && doc.listingPurpose !== purposeFilter) return false;
    if (useCategory && doc.category !== args.category) return false;
    if (hasValue(args.neighborhood) && doc.neighborhood !== args.neighborhood) return false;
    if (hasValue(args.zone) && doc.zone !== args.zone) return false;
    if (hasValue(args.type) && doc.type !== args.type) return false;
    if (hasValue(args.condition) && doc.condition !== args.condition) return false;
    if (args.minPrice != null && doc.priceEur < args.minPrice) return false;
    if (args.maxPrice != null && doc.priceEur > args.maxPrice) return false;
    if (args.minArea != null && (doc.areaSqm == null || doc.areaSqm < args.minArea)) return false;
    if (args.maxArea != null && (doc.areaSqm == null || doc.areaSqm > args.maxArea)) return false;
    return true;
  });
}

export const list = query({
  args: {
    ...propertyFilterArgs,
    limit: v.optional(v.number()),
    offset: v.optional(v.number())
  },
  handler: async ({ db }, args) => {
    const offset = Math.max(0, Math.floor(args.offset ?? 0));
    const limit = Math.min(10000, Math.max(0, Math.floor(args.limit ?? 100)));
    const filtered = await collectFilteredProperties(db, args);

    filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

    return filtered.slice(offset, offset + limit);
  }
});

export const count = query({
  args: propertyFilterArgs,
  handler: async ({ db }, args) => {
    return (await collectFilteredProperties(db, args)).length;
  }
});

export const markInactive = mutation({
  args: { id: v.id('properties') },
  handler: async ({ db }, { id }) => {
    const existing = await db.get(id);
    if (!existing || existing.isActive === false) {
      return false;
    }

    const timestamp = nowIso();
    await db.patch(id, {
      isActive: false,
      updatedAt: timestamp
    });

    return true;
  }
});

export const markInactiveByScope = mutation({
  args: {
    listingPurpose: v.string(),
    category: v.string(),
    seenExternalIds: v.array(v.string())
  },
  handler: async ({ db }, { listingPurpose, category, seenExternalIds }) => {
    const seen = new Set(seenExternalIds);
    const timestamp = nowIso();
    const docs = await db
      .query('properties')
      .withIndex('by_active_purpose_category', (q) =>
        q.eq('isActive', true).eq('listingPurpose', listingPurpose).eq('category', category)
      )
      .collect();

    let count = 0;

    for (const doc of docs) {
      if (doc.source !== 'imot.bg' || seen.has(doc.externalId)) {
        continue;
      }

      await db.patch(doc._id, {
        isActive: false,
        updatedAt: timestamp
      });
      count += 1;
    }

    return count;
  }
});
