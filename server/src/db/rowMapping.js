const nullIfMissing = (value) => value ?? null;
const idOf = (doc) => doc.id ?? doc._id ?? null;
const booleanInt = (value) => (value ? 1 : 0);

export function propertyDocToRow(doc) {
  if (doc == null) {
    return null;
  }

  return {
    id: idOf(doc),
    external_id: nullIfMissing(doc.externalId),
    source: nullIfMissing(doc.source),
    listing_purpose: nullIfMissing(doc.listingPurpose),
    category: nullIfMissing(doc.category),
    url: nullIfMissing(doc.url),
    title: nullIfMissing(doc.title),
    neighborhood: nullIfMissing(doc.neighborhood),
    zone: nullIfMissing(doc.zone),
    type: nullIfMissing(doc.type),
    condition: nullIfMissing(doc.condition),
    price_eur: nullIfMissing(doc.priceEur),
    price_bgn: nullIfMissing(doc.priceBgn),
    area_sqm: nullIfMissing(doc.areaSqm),
    price_per_sqm: nullIfMissing(doc.pricePerSqm),
    floor: nullIfMissing(doc.floor),
    total_floors: nullIfMissing(doc.totalFloors),
    rooms: nullIfMissing(doc.rooms),
    construction_year: nullIfMissing(doc.constructionYear),
    construction_stage: nullIfMissing(doc.constructionStage),
    description: nullIfMissing(doc.description),
    image_url: nullIfMissing(doc.imageUrl),
    first_seen_at: nullIfMissing(doc.firstSeenAt),
    last_seen_at: nullIfMissing(doc.lastSeenAt),
    is_active: booleanInt(doc.isActive),
    created_at: nullIfMissing(doc.createdAt),
    updated_at: nullIfMissing(doc.updatedAt)
  };
}

export function priceHistoryDocToRow(doc) {
  if (doc == null) {
    return null;
  }

  return {
    id: idOf(doc),
    property_id: nullIfMissing(doc.propertyId),
    price_eur: nullIfMissing(doc.priceEur),
    price_bgn: nullIfMissing(doc.priceBgn),
    recorded_at: nullIfMissing(doc.recordedAt)
  };
}

export function scrapingRunDocToRow(doc) {
  if (doc == null) {
    return null;
  }

  return {
    id: idOf(doc),
    status: nullIfMissing(doc.status),
    started_at: nullIfMissing(doc.startedAt),
    completed_at: nullIfMissing(doc.completedAt),
    pages_total: nullIfMissing(doc.pagesTotal),
    pages_scraped: nullIfMissing(doc.pagesScraped),
    sale_pages_scraped: nullIfMissing(doc.salePagesScraped),
    rental_pages_scraped: nullIfMissing(doc.rentalPagesScraped),
    current_purpose: nullIfMissing(doc.currentPurpose),
    current_category: nullIfMissing(doc.currentCategory),
    crawl_mode: nullIfMissing(doc.crawlMode),
    listings_found: nullIfMissing(doc.listingsFound),
    listings_saved: nullIfMissing(doc.listingsSaved),
    error_message: nullIfMissing(doc.errorMessage)
  };
}

export function scrapingRunScopeDocToRow(doc) {
  if (doc == null) {
    return null;
  }

  return {
    id: idOf(doc),
    run_id: nullIfMissing(doc.runId),
    listing_purpose: nullIfMissing(doc.listingPurpose),
    category: nullIfMissing(doc.category),
    pages_planned: nullIfMissing(doc.pagesPlanned),
    pages_scraped: nullIfMissing(doc.pagesScraped),
    full_scope: booleanInt(doc.fullScope),
    completed: booleanInt(doc.completed)
  };
}

export function triageDocToResponse(doc) {
  if (doc == null) {
    return null;
  }

  return {
    propertyId: nullIfMissing(doc.propertyId),
    status: nullIfMissing(doc.status),
    note: doc.note ?? '',
    rejectedReason: doc.rejectedReason ?? '',
    updatedAt: nullIfMissing(doc.updatedAt)
  };
}

export function neighborhoodStatDocToRow(doc) {
  if (doc == null) {
    return null;
  }

  return {
    id: idOf(doc),
    neighborhood: nullIfMissing(doc.neighborhood),
    zone: nullIfMissing(doc.zone),
    property_count: nullIfMissing(doc.propertyCount),
    avg_price_eur: nullIfMissing(doc.avgPriceEur),
    avg_price_per_sqm: nullIfMissing(doc.avgPricePerSqm),
    min_price_eur: nullIfMissing(doc.minPriceEur),
    max_price_eur: nullIfMissing(doc.maxPriceEur),
    avg_area_sqm: nullIfMissing(doc.avgAreaSqm),
    updated_at: nullIfMissing(doc.updatedAt)
  };
}
