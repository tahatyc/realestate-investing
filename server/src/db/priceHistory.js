import { anyApi } from 'convex/server';

import { getConvexClient } from '../convexClient.js';
import { priceHistoryDocToRow } from './rowMapping.js';

export async function insertPriceHistory(entry, _database) {
  const doc = await getConvexClient().mutation(anyApi.priceHistory.insert, {
    propertyId: entry.propertyId,
    priceEur: entry.priceEur,
    priceBgn: entry.priceBgn ?? undefined,
    recordedAt: entry.recordedAt ?? undefined
  });
  return priceHistoryDocToRow(doc);
}

export async function getPriceHistoryByPropertyId(propertyId, _database) {
  const docs = await getConvexClient().query(anyApi.priceHistory.byProperty, { propertyId });
  return docs.map(priceHistoryDocToRow);
}
