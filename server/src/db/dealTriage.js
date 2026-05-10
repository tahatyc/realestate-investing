import { getDb } from './connection.js';

export const ALLOWED_TRIAGE_STATUSES = [
  'new',
  'watching',
  'needs_call',
  'visited',
  'made_offer',
  'rejected'
];

const allowedStatusSet = new Set(ALLOWED_TRIAGE_STATUSES);

function toResponse(row) {
  if (!row) {
    return null;
  }

  return {
    propertyId: row.property_id,
    status: row.status,
    note: row.note ?? '',
    rejectedReason: row.rejected_reason ?? '',
    updatedAt: row.updated_at
  };
}

export function validateTriageStatus(status) {
  const normalized = status ?? 'new';
  if (!allowedStatusSet.has(normalized)) {
    throw new Error(`Invalid triage status: ${normalized}`);
  }
  return normalized;
}

export function defaultTriage(propertyId) {
  return {
    propertyId,
    status: 'new',
    note: '',
    rejectedReason: '',
    updatedAt: null
  };
}

export function getTriageByPropertyId(propertyId, database = getDb()) {
  const row = database.prepare('SELECT * FROM deal_triage WHERE property_id = ?').get(propertyId);
  return toResponse(row);
}

export function getTriageMap(propertyIds, database = getDb()) {
  if (!propertyIds.length) {
    return new Map();
  }

  const placeholders = propertyIds.map(() => '?').join(', ');
  const rows = database.prepare(`SELECT * FROM deal_triage WHERE property_id IN (${placeholders})`).all(...propertyIds);
  return new Map(rows.map((row) => [row.property_id, toResponse(row)]));
}

export function upsertTriage(propertyId, updates, database = getDb()) {
  const status = validateTriageStatus(updates.status);
  const note = updates.note ?? '';
  const rejectedReason = updates.rejectedReason ?? updates.rejected_reason ?? '';

  database
    .prepare(
      `INSERT INTO deal_triage (property_id, status, note, rejected_reason, updated_at)
       VALUES (@propertyId, @status, @note, @rejectedReason, CURRENT_TIMESTAMP)
       ON CONFLICT(property_id) DO UPDATE SET
         status = excluded.status,
         note = excluded.note,
         rejected_reason = excluded.rejected_reason,
         updated_at = CURRENT_TIMESTAMP`
    )
    .run({ propertyId, status, note, rejectedReason });

  return getTriageByPropertyId(propertyId, database);
}
