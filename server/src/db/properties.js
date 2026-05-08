import { getDb } from './connection.js';

const propertyColumns = [
  'external_id',
  'source',
  'url',
  'title',
  'neighborhood',
  'zone',
  'type',
  'condition',
  'price_eur',
  'price_bgn',
  'area_sqm',
  'price_per_sqm',
  'floor',
  'total_floors',
  'rooms',
  'construction_year',
  'construction_stage',
  'description',
  'image_url'
];

const columnMap = {
  externalId: 'external_id',
  priceEur: 'price_eur',
  priceBgn: 'price_bgn',
  areaSqm: 'area_sqm',
  pricePerSqm: 'price_per_sqm',
  totalFloors: 'total_floors',
  constructionYear: 'construction_year',
  constructionStage: 'construction_stage',
  imageUrl: 'image_url'
};

function toSnakeRecord(property) {
  const record = {};

  for (const [key, value] of Object.entries(property)) {
    const column = columnMap[key] || key;
    if (propertyColumns.includes(column)) {
      record[column] = value;
    }
  }

  if (!record.source) {
    record.source = 'imot.bg';
  }

  if (record.area_sqm && record.price_eur && !record.price_per_sqm) {
    record.price_per_sqm = record.price_eur / record.area_sqm;
  }

  return record;
}

function whereFromFilters(filters) {
  const clauses = ['is_active = @isActive'];
  const params = { isActive: filters.includeInactive ? 0 : 1 };

  if (filters.includeInactive === true) {
    clauses.length = 0;
  }
  if (filters.zone) {
    clauses.push('zone = @zone');
    params.zone = filters.zone;
  }
  if (filters.type) {
    clauses.push('type = @type');
    params.type = filters.type;
  }
  if (filters.condition) {
    clauses.push('condition = @condition');
    params.condition = filters.condition;
  }
  if (filters.minPrice != null) {
    clauses.push('price_eur >= @minPrice');
    params.minPrice = filters.minPrice;
  }
  if (filters.maxPrice != null) {
    clauses.push('price_eur <= @maxPrice');
    params.maxPrice = filters.maxPrice;
  }
  if (filters.minArea != null) {
    clauses.push('area_sqm >= @minArea');
    params.minArea = filters.minArea;
  }
  if (filters.maxArea != null) {
    clauses.push('area_sqm <= @maxArea');
    params.maxArea = filters.maxArea;
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
}

export function upsertProperty(property, database = getDb()) {
  const record = toSnakeRecord(property);

  if (!record.external_id) {
    throw new Error('externalId is required');
  }
  if (record.price_eur == null) {
    throw new Error('priceEur is required');
  }

  const columns = Object.keys(record);
  const placeholders = columns.map((column) => `@${column}`);
  const updates = columns
    .filter((column) => column !== 'external_id' && column !== 'first_seen_at')
    .map((column) => `${column} = excluded.${column}`)
    .concat(['last_seen_at = CURRENT_TIMESTAMP', 'updated_at = CURRENT_TIMESTAMP', 'is_active = 1']);

  database
    .prepare(
      `INSERT INTO properties (${columns.join(', ')})
       VALUES (${placeholders.join(', ')})
       ON CONFLICT(external_id) DO UPDATE SET ${updates.join(', ')}`
    )
    .run(record);

  return getPropertyByExternalId(record.external_id, database);
}

export function queryProperties(filters = {}, database = getDb()) {
  const { where, params } = whereFromFilters(filters);
  const limit = Math.min(Number(filters.limit) || 50, 250);
  const offset = Number(filters.offset) || 0;

  return database
    .prepare(
      `SELECT * FROM properties
       ${where}
       ORDER BY updated_at DESC, id DESC
       LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit, offset });
}

export function getPropertyById(id, database = getDb()) {
  return database.prepare('SELECT * FROM properties WHERE id = ?').get(id) || null;
}

export function getPropertyByExternalId(externalId, database = getDb()) {
  return database.prepare('SELECT * FROM properties WHERE external_id = ?').get(externalId) || null;
}

export function markInactive(id, database = getDb()) {
  const result = database
    .prepare('UPDATE properties SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(id);
  return result.changes > 0;
}
