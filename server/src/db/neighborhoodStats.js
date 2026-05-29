import { anyApi } from 'convex/server';

import { getConvexClient } from '../convexClient.js';
import { neighborhoodStatDocToRow } from './rowMapping.js';

export async function recomputeNeighborhoodStats(_database) {
  const docs = await getConvexClient().mutation(anyApi.neighborhoodStats.recompute, {});
  return docs.map(neighborhoodStatDocToRow);
}

export async function getNeighborhoodStats(_database) {
  const docs = await getConvexClient().query(anyApi.neighborhoodStats.list, {});
  return docs.map(neighborhoodStatDocToRow);
}
