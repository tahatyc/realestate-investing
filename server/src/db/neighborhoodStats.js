import { getDb } from './connection.js';

export function recomputeNeighborhoodStats(database = getDb()) {
  const transaction = database.transaction(() => {
    database.prepare('DELETE FROM neighborhood_stats').run();
    database
      .prepare(
        `INSERT INTO neighborhood_stats (
          neighborhood,
          zone,
          property_count,
          avg_price_eur,
          avg_price_per_sqm,
          min_price_eur,
          max_price_eur,
          avg_area_sqm
        )
        SELECT
          neighborhood,
          zone,
          COUNT(*),
          AVG(price_eur),
          AVG(price_per_sqm),
          MIN(price_eur),
          MAX(price_eur),
          AVG(area_sqm)
        FROM properties
        WHERE is_active = 1 AND neighborhood IS NOT NULL
        GROUP BY neighborhood, zone`
      )
      .run();
  });

  transaction();
  return getNeighborhoodStats(database);
}

export function getNeighborhoodStats(database = getDb()) {
  return database
    .prepare(
      `SELECT * FROM neighborhood_stats
       ORDER BY zone IS NULL, zone ASC, neighborhood ASC`
    )
    .all();
}
