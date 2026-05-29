import { Router } from 'express';
import { analyzeStrategy, strategyNames } from '../strategies/index.js';

export function createStrategiesRouter({ database } = {}) {
  const router = Router();

  router.get('/:name', asyncHandler(async (req, res) => {
    try {
      const name = req.params.name;
      if (!strategyNames().includes(name)) {
        return res.status(404).json({ error: 'Unknown strategy' });
      }

      const result = await analyzeStrategy(name, {
        database,
        limit: req.query.limit,
        offset: req.query.offset,
        health: req.query.health,
        filters: {
          zone: req.query.zone,
          type: req.query.type,
          condition: req.query.condition,
          minPrice: req.query.minPrice,
          maxPrice: req.query.maxPrice,
          minArea: req.query.minArea,
          maxArea: req.query.maxArea
        }
      });

      res.json({
        strategy: result.strategy,
        summary: result.summary,
        pagination: result.pagination,
        properties: result.results
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }));

  return router;
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
