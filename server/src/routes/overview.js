import { Router } from 'express';
import { getNeighborhoodStats, recomputeNeighborhoodStats } from '../db/neighborhoodStats.js';
import { getLatestScrapingRun } from '../db/scrapingRuns.js';
import { getSettings } from '../db/settings.js';
import { analyzeStrategy, strategyNames } from '../strategies/index.js';

export function createOverviewRouter({ database } = {}) {
  const router = Router();

  router.get('/', (_req, res) => {
    const settings = getSettings(database);
    const activeSaleListings = database
      .prepare("SELECT COUNT(*) AS count FROM properties WHERE is_active = 1 AND listing_purpose = 'sale'")
      .get().count;
    const activeRentalComps = database
      .prepare("SELECT COUNT(*) AS count FROM properties WHERE is_active = 1 AND listing_purpose = 'rent'")
      .get().count;
    const neighborhoods = getNeighborhoodStats(database);
    const strategies = {};

    for (const name of strategyNames()) {
      strategies[name] = analyzeStrategy(name, { database, settings, limit: 1 }).summary;
    }

    res.json({
      totalListings: activeSaleListings,
      activeSaleListings,
      activeRentalComps,
      lastScrape: getLatestScrapingRun(database),
      leverage: settings.leverage,
      strategies,
      neighborhoods: neighborhoods.length ? neighborhoods : recomputeNeighborhoodStats(database)
    });
  });

  return router;
}
