import { anyApi } from 'convex/server';

import { getConvexClient } from '../convexClient.js';

export async function getSettings(_database) {
  return await getConvexClient().query(anyApi.settings.get, {});
}

export async function updateSettings(updates, _database) {
  return await getConvexClient().mutation(anyApi.settings.update, { updates });
}
