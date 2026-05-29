import { mutationGeneric as mutation, queryGeneric as query } from 'convex/server';

const nowIso = () => new Date().toISOString();

const average = (values) => {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) {
    return null;
  }

  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
};

const compareStats = (a, b) =>
  String(a.zone ?? '').localeCompare(String(b.zone ?? '')) || a.neighborhood.localeCompare(b.neighborhood);

export const recompute = mutation({
  args: {},
  handler: async ({ db }) => {
    const existing = await db.query('neighborhoodStats').collect();
    for (const row of existing) {
      await db.delete(row._id);
    }

    const properties = await db
      .query('properties')
      .withIndex('by_active_purpose_updated', (q) => q.eq('isActive', true).eq('listingPurpose', 'sale'))
      .collect();
    const groups = new Map();

    for (const property of properties) {
      if (!property.neighborhood) {
        continue;
      }

      const key = `${property.neighborhood}\u0000${property.zone ?? ''}`;
      const rows = groups.get(key) ?? [];
      rows.push(property);
      groups.set(key, rows);
    }

    const updatedAt = nowIso();
    const results = [];

    for (const [key, rows] of groups.entries()) {
      const [neighborhood, zoneValue] = key.split('\u0000');
      const prices = rows.map((row) => row.priceEur).filter(Number.isFinite);
      const areas = rows.map((row) => row.areaSqm).filter(Number.isFinite);
      const pricePerSqm = rows.map((row) => row.pricePerSqm).filter(Number.isFinite);
      const id = await db.insert('neighborhoodStats', {
        neighborhood,
        zone: zoneValue || null,
        propertyCount: rows.length,
        avgPriceEur: average(prices),
        avgPricePerSqm: average(pricePerSqm),
        minPriceEur: prices.length > 0 ? Math.min(...prices) : null,
        maxPriceEur: prices.length > 0 ? Math.max(...prices) : null,
        avgAreaSqm: average(areas),
        updatedAt
      });
      results.push(await db.get(id));
    }

    return results.sort(compareStats);
  }
});

export const list = query({
  args: {},
  handler: async ({ db }) => {
    const rows = await db.query('neighborhoodStats').collect();
    return rows.sort(compareStats);
  }
});
