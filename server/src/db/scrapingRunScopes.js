import { anyApi } from 'convex/server';

import { getConvexClient } from '../convexClient.js';
import { scrapingRunScopeDocToRow } from './rowMapping.js';

export async function createScrapingRunScope(values, _database) {
  const doc = await getConvexClient().mutation(anyApi.scrapingRunScopes.create, values);
  return scrapingRunScopeDocToRow(doc);
}

export async function completeScrapingRunScope(id, values = {}, _database) {
  const doc = await getConvexClient().mutation(anyApi.scrapingRunScopes.complete, { id, ...values });
  return scrapingRunScopeDocToRow(doc);
}

export async function getCompletedScrapingRunScopes(runId, _database) {
  const docs = await getConvexClient().query(anyApi.scrapingRunScopes.completedByRun, { runId });
  return docs.map(scrapingRunScopeDocToRow);
}
