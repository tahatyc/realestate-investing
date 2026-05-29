import { Router } from 'express';
import { getNeighborhoodStats, recomputeNeighborhoodStats } from '../db/neighborhoodStats.js';

export function createNeighborhoodsRouter({ database } = {}) {
  const router = Router();

  router.get('/', asyncHandler(async (_req, res) => {
    const neighborhoods = await getNeighborhoodStats(database);
    if (!neighborhoods.length) {
      res.json({ neighborhoods: await recomputeNeighborhoodStats(database) });
      return;
    }
    res.json({ neighborhoods });
  }));

  return router;
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
