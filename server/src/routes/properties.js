import { Router } from 'express';
import { getPriceHistoryByPropertyId } from '../db/priceHistory.js';
import { getPropertyById, queryProperties } from '../db/properties.js';
import { getSettings } from '../db/settings.js';
import { analyzeProperty } from '../strategies/index.js';

export function createPropertiesRouter({ database } = {}) {
  const router = Router();

  router.get('/', (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 250);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const offset = (page - 1) * limit;
    const properties = queryProperties(
      {
        zone: req.query.zone,
        type: req.query.type,
        condition: req.query.condition,
        minPrice: req.query.minPrice,
        maxPrice: req.query.maxPrice,
        minArea: req.query.minArea,
        maxArea: req.query.maxArea,
        limit,
        offset
      },
      database
    );

    res.json({
      properties: properties.map(toPropertyResponse),
      pagination: { page, limit, total: properties.length }
    });
  });

  router.get('/:id', (req, res) => {
    const property = getPropertyById(req.params.id, database);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    const settings = getSettings(database);

    res.json({
      property: toPropertyResponse(property),
      priceHistory: getPriceHistoryByPropertyId(property.id, database),
      leverageSettings: settings.leverage,
      strategies: analyzeProperty(property, { database, settings })
    });
  });

  return router;
}

export function toPropertyResponse(property) {
  return {
    id: property.id,
    externalId: property.external_id,
    source: property.source,
    listingPurpose: property.listing_purpose,
    category: property.category,
    url: property.url,
    title: property.title,
    neighborhood: property.neighborhood,
    zone: property.zone,
    type: property.type,
    condition: property.condition,
    priceEur: property.price_eur,
    priceBgn: property.price_bgn,
    areaSqm: property.area_sqm,
    pricePerSqm: property.price_per_sqm,
    floor: property.floor,
    totalFloors: property.total_floors,
    rooms: property.rooms,
    constructionYear: property.construction_year,
    constructionStage: property.construction_stage,
    description: property.description,
    imageUrl: property.image_url,
    firstSeenAt: property.first_seen_at,
    lastSeenAt: property.last_seen_at,
    isActive: Boolean(property.is_active)
  };
}
