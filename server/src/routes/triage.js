import { Router } from 'express';
import { upsertTriage } from '../db/dealTriage.js';
import { getPropertyById } from '../db/properties.js';
import { listDealTriageOpportunities } from '../triage/dealTriage.js';

export function createTriageRouter({ database } = {}) {
  const router = Router();

  router.get('/', (req, res) => {
    const result = listDealTriageOpportunities(
      {
        includeRejected: req.query.includeRejected,
        zone: req.query.zone,
        type: req.query.type,
        minPrice: req.query.minPrice,
        maxPrice: req.query.maxPrice,
        minArea: req.query.minArea,
        maxArea: req.query.maxArea,
        limit: req.query.limit
      },
      database
    );

    res.json(result);
  });

  router.put('/:propertyId', (req, res) => {
    const property = getPropertyById(req.params.propertyId, database);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    try {
      const triage = upsertTriage(
        property.id,
        {
          status: req.body.status,
          note: req.body.note,
          rejectedReason: req.body.rejectedReason
        },
        database
      );
      return res.json({ triage });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  });

  return router;
}
