import { anyApi } from 'convex/server';

import { getConvexClient } from '../convexClient.js';
import { propertyDocToRow } from './rowMapping.js';

const propertyFieldMap = {
  external_id: 'externalId',
  listing_purpose: 'listingPurpose',
  price_eur: 'priceEur',
  price_bgn: 'priceBgn',
  area_sqm: 'areaSqm',
  price_per_sqm: 'pricePerSqm',
  total_floors: 'totalFloors',
  construction_year: 'constructionYear',
  construction_stage: 'constructionStage',
  image_url: 'imageUrl',
  first_seen_at: 'firstSeenAt',
  last_seen_at: 'lastSeenAt',
  created_at: 'createdAt',
  updated_at: 'updatedAt'
};

const propertyFields = new Set([
  'externalId',
  'source',
  'listingPurpose',
  'category',
  'url',
  'title',
  'neighborhood',
  'zone',
  'type',
  'condition',
  'priceEur',
  'priceBgn',
  'areaSqm',
  'pricePerSqm',
  'floor',
  'totalFloors',
  'rooms',
  'constructionYear',
  'constructionStage',
  'description',
  'imageUrl',
  'firstSeenAt',
  'lastSeenAt',
  'createdAt',
  'updatedAt'
]);

function normalizeProperty(property) {
  const record = {};

  for (const [key, value] of Object.entries(property)) {
    const field = propertyFieldMap[key] || key;
    if (propertyFields.has(field)) {
      record[field] = value;
    }
  }

  if (!record.source) {
    record.source = 'imot.bg';
  }
  if (!record.listingPurpose) {
    record.listingPurpose = 'sale';
  }
  if (record.areaSqm && record.priceEur && record.pricePerSqm == null) {
    record.pricePerSqm = record.priceEur / record.areaSqm;
  }

  return record;
}

function normalizeLimit(limit) {
  return Math.min(Number(limit) || 50, 250);
}

function normalizeOffset(offset) {
  return Number(offset) || 0;
}

function normalizeFilters(filters) {
  return {
    includeInactive: filters.includeInactive === true ? true : undefined,
    includeAllPurposes: filters.includeAllPurposes === true ? true : undefined,
    listingPurpose: filters.listingPurpose,
    category: filters.category,
    neighborhood: filters.neighborhood,
    zone: filters.zone,
    type: filters.type,
    condition: filters.condition,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    minArea: filters.minArea,
    maxArea: filters.maxArea,
    limit: normalizeLimit(filters.limit),
    offset: normalizeOffset(filters.offset)
  };
}

export async function upsertProperty(property, _database) {
  const record = normalizeProperty(property);

  if (!record.externalId) {
    throw new Error('externalId is required');
  }
  if (record.priceEur == null) {
    throw new Error('priceEur is required');
  }

  const doc = await getConvexClient().mutation(anyApi.properties.upsert, record);
  return propertyDocToRow(doc);
}

export async function queryProperties(filters = {}, _database) {
  const docs = await getConvexClient().query(anyApi.properties.list, normalizeFilters(filters));
  return docs.map(propertyDocToRow);
}

export async function getPropertyById(id, _database) {
  const doc = await getConvexClient().query(anyApi.properties.byId, { id });
  return propertyDocToRow(doc);
}

export async function getPropertyByExternalId(externalId, _database) {
  const doc = await getConvexClient().query(anyApi.properties.byExternalId, { externalId });
  return propertyDocToRow(doc);
}

export async function markInactive(id, _database) {
  return await getConvexClient().mutation(anyApi.properties.markInactive, { id });
}

export async function markInactiveByScope({ listingPurpose, category, seenExternalIds = [] }, _database) {
  if (!listingPurpose || !category) {
    throw new Error('listingPurpose and category are required for scoped inactive marking');
  }

  return await getConvexClient().mutation(anyApi.properties.markInactiveByScope, {
    listingPurpose,
    category,
    seenExternalIds: [...seenExternalIds].filter(Boolean)
  });
}
