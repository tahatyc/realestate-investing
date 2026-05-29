import { anyApi } from 'convex/server';

import { getConvexClient } from '../convexClient.js';
import { scrapingRunDocToRow } from './rowMapping.js';

export async function createScrapingRun(values = {}, _database) {
  const doc = await getConvexClient().mutation(anyApi.scrapingRuns.create, values);
  return scrapingRunDocToRow(doc);
}

export async function updateScrapingRun(id, values = {}, _database) {
  const doc = await getConvexClient().mutation(anyApi.scrapingRuns.update, { id, ...values });
  return scrapingRunDocToRow(doc);
}

export async function getLatestScrapingRun(_database) {
  const doc = await getConvexClient().query(anyApi.scrapingRuns.latest, {});
  return scrapingRunDocToRow(doc);
}

export async function listScrapingRuns(limit = 25, _database) {
  const docs = await getConvexClient().query(anyApi.scrapingRuns.history, { limit });
  return docs.map(scrapingRunDocToRow);
}
