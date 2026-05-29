import { Router } from 'express';
import { getNeighborhoodStats, recomputeNeighborhoodStats } from '../db/neighborhoodStats.js';
import { countProperties } from '../db/properties.js';
import { getLatestScrapingRun } from '../db/scrapingRuns.js';
import { getSettings } from '../db/settings.js';
import { analyzeStrategy, strategyNames } from '../strategies/index.js';

export function createOverviewRouter({ database } = {}) {
  const router = Router();

  router.get('/', asyncHandler(async (_req, res) => {
    const settings = await getSettings(database);
    const [activeSaleListings, activeRentalComps, neighborhoods, lastScrape] = await Promise.all([
      countProperties({ listingPurpose: 'sale' }, database),
      countProperties({ listingPurpose: 'rent' }, database),
      getNeighborhoodStats(database),
      getLatestScrapingRun(database)
    ]);
    const strategies = {};

    for (const name of strategyNames()) {
      strategies[name] = (await analyzeStrategy(name, { database, settings, limit: 1 })).summary;
    }

    res.json({
      totalListings: activeSaleListings,
      activeSaleListings,
      activeRentalComps,
      lastScrape,
      leverage: settings.leverage,
      strategies,
      neighborhoods: neighborhoods.length ? neighborhoods : await recomputeNeighborhoodStats(database)
    });
  }));

  return router;
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
