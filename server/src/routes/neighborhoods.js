import { Router } from 'express';
import { getNeighborhoodStats, recomputeNeighborhoodStats } from '../db/neighborhoodStats.js';

export function createNeighborhoodsRouter({ database } = {}) {
  const router = Router();

  router.get('/', (_req, res) => {
    const neighborhoods = getNeighborhoodStats(database);
    if (!neighborhoods.length) {
      res.json({ neighborhoods: recomputeNeighborhoodStats(database) });
      return;
    }
    res.json({ neighborhoods });
  });

  return router;
}
