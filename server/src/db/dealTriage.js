import { anyApi } from 'convex/server';

import { getConvexClient } from '../convexClient.js';
import { triageDocToResponse } from './rowMapping.js';

export const ALLOWED_TRIAGE_STATUSES = [
  'new',
  'watching',
  'needs_call',
  'visited',
  'made_offer',
  'rejected'
];

const allowedStatusSet = new Set(ALLOWED_TRIAGE_STATUSES);

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

export async function getTriageByPropertyId(propertyId, _database) {
  const doc = await getConvexClient().query(anyApi.dealTriage.byProperty, { propertyId });
  return triageDocToResponse(doc);
}

export async function getTriageMap(propertyIds, _database) {
  if (!propertyIds.length) {
    return new Map();
  }

  const docs = await getConvexClient().query(anyApi.dealTriage.forProperties, { propertyIds });
  return new Map(docs.map((doc) => [doc.propertyId, triageDocToResponse(doc)]));
}

export async function upsertTriage(propertyId, updates, _database) {
  const doc = await getConvexClient().mutation(anyApi.dealTriage.upsert, {
    propertyId,
    status: validateTriageStatus(updates.status),
    note: updates.note ?? '',
    rejectedReason: updates.rejectedReason ?? updates.rejected_reason ?? ''
  });
  return triageDocToResponse(doc);
}
