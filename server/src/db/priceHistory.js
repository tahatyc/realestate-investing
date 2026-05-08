import { getDb } from './connection.js';

export function insertPriceHistory(entry, database = getDb()) {
  const result = database
    .prepare(
      `INSERT INTO price_history (property_id, price_eur, price_bgn, recorded_at)
       VALUES (@propertyId, @priceEur, @priceBgn, COALESCE(@recordedAt, CURRENT_TIMESTAMP))`
    )
    .run({
      propertyId: entry.propertyId,
      priceEur: entry.priceEur,
      priceBgn: entry.priceBgn ?? null,
      recordedAt: entry.recordedAt ?? null
    });

  return database.prepare('SELECT * FROM price_history WHERE id = ?').get(result.lastInsertRowid);
}

export function getPriceHistoryByPropertyId(propertyId, database = getDb()) {
  return database
    .prepare('SELECT * FROM price_history WHERE property_id = ? ORDER BY recorded_at ASC, id ASC')
    .all(propertyId);
}
