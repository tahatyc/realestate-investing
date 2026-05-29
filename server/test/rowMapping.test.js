import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  createConvexClient,
  getConvexClient,
  setConvexClientForTests
} from '../src/convexClient.js';
import {
  neighborhoodStatDocToRow,
  priceHistoryDocToRow,
  propertyDocToRow,
  scrapingRunDocToRow,
  scrapingRunScopeDocToRow,
  triageDocToResponse
} from '../src/db/rowMapping.js';

describe('Convex client wrapper', () => {
  test('throws a clear error when no Convex URL is configured', () => {
    const previousUrl = process.env.CONVEX_URL;
    delete process.env.CONVEX_URL;

    try {
      assert.throws(
        () => createConvexClient(),
        /CONVEX_URL is required to create the Convex HTTP client/
      );
    } finally {
      if (previousUrl === undefined) {
        delete process.env.CONVEX_URL;
      } else {
        process.env.CONVEX_URL = previousUrl;
      }
    }
  });

  test('uses an injectable singleton client for tests', () => {
    const fakeClient = { query: async () => 'ok' };
    setConvexClientForTests(fakeClient);

    try {
      assert.equal(getConvexClient(), fakeClient);
    } finally {
      setConvexClientForTests(null);
    }
  });
});

describe('Convex row mapping', () => {
  test('maps property documents to SQLite-shaped rows', () => {
    assert.deepEqual(
      propertyDocToRow({
        _id: 'property-id',
        externalId: 'ext-1',
        source: 'imot.bg',
        listingPurpose: 'sale',
        category: 'dvustaen',
        url: 'https://example.test/listing',
        title: 'Sunny flat',
        neighborhood: 'Mladost 1',
        zone: 'Mladost',
        type: 'brick',
        condition: 'renovated',
        priceEur: 120000,
        priceBgn: 234699.6,
        areaSqm: 80,
        pricePerSqm: 1500,
        floor: 3,
        totalFloors: 8,
        rooms: 2,
        constructionYear: 2008,
        constructionStage: 'Act 16',
        description: undefined,
        imageUrl: null,
        firstSeenAt: '2026-05-01T10:00:00.000Z',
        lastSeenAt: '2026-05-02T10:00:00.000Z',
        isActive: false,
        createdAt: '2026-05-01T10:00:00.000Z',
        updatedAt: '2026-05-03T10:00:00.000Z'
      }),
      {
        id: 'property-id',
        external_id: 'ext-1',
        source: 'imot.bg',
        listing_purpose: 'sale',
        category: 'dvustaen',
        url: 'https://example.test/listing',
        title: 'Sunny flat',
        neighborhood: 'Mladost 1',
        zone: 'Mladost',
        type: 'brick',
        condition: 'renovated',
        price_eur: 120000,
        price_bgn: 234699.6,
        area_sqm: 80,
        price_per_sqm: 1500,
        floor: 3,
        total_floors: 8,
        rooms: 2,
        construction_year: 2008,
        construction_stage: 'Act 16',
        description: null,
        image_url: null,
        first_seen_at: '2026-05-01T10:00:00.000Z',
        last_seen_at: '2026-05-02T10:00:00.000Z',
        is_active: 0,
        created_at: '2026-05-01T10:00:00.000Z',
        updated_at: '2026-05-03T10:00:00.000Z'
      }
    );
  });

  test('maps related documents to SQLite-shaped rows', () => {
    assert.deepEqual(
      priceHistoryDocToRow({
        _id: 'price-id',
        propertyId: 'property-id',
        priceEur: 100000,
        priceBgn: undefined,
        recordedAt: '2026-05-04T10:00:00.000Z'
      }),
      {
        id: 'price-id',
        property_id: 'property-id',
        price_eur: 100000,
        price_bgn: null,
        recorded_at: '2026-05-04T10:00:00.000Z'
      }
    );

    assert.deepEqual(
      scrapingRunDocToRow({
        _id: 'run-id',
        status: 'completed',
        startedAt: '2026-05-04T09:00:00.000Z',
        completedAt: undefined,
        pagesTotal: 12,
        pagesScraped: 10,
        salePagesScraped: 8,
        rentalPagesScraped: 2,
        currentPurpose: null,
        currentCategory: undefined,
        crawlMode: 'bounded',
        listingsFound: 42,
        listingsSaved: 40,
        errorMessage: undefined
      }),
      {
        id: 'run-id',
        status: 'completed',
        started_at: '2026-05-04T09:00:00.000Z',
        completed_at: null,
        pages_total: 12,
        pages_scraped: 10,
        sale_pages_scraped: 8,
        rental_pages_scraped: 2,
        current_purpose: null,
        current_category: null,
        crawl_mode: 'bounded',
        listings_found: 42,
        listings_saved: 40,
        error_message: null
      }
    );

    assert.deepEqual(
      scrapingRunScopeDocToRow({
        _id: 'scope-id',
        runId: 'run-id',
        listingPurpose: 'sale',
        category: 'tristaen',
        pagesPlanned: 5,
        pagesScraped: 4,
        fullScope: true,
        completed: false
      }),
      {
        id: 'scope-id',
        run_id: 'run-id',
        listing_purpose: 'sale',
        category: 'tristaen',
        pages_planned: 5,
        pages_scraped: 4,
        full_scope: 1,
        completed: 0
      }
    );
  });

  test('maps API helper response shapes', () => {
    assert.deepEqual(
      triageDocToResponse({
        propertyId: 'property-id',
        status: 'watching',
        note: undefined,
        rejectedReason: null,
        updatedAt: '2026-05-05T10:00:00.000Z'
      }),
      {
        propertyId: 'property-id',
        status: 'watching',
        note: '',
        rejectedReason: '',
        updatedAt: '2026-05-05T10:00:00.000Z'
      }
    );

    assert.deepEqual(
      neighborhoodStatDocToRow({
        _id: 'stat-id',
        neighborhood: 'Mladost 1',
        zone: undefined,
        propertyCount: 3,
        avgPriceEur: 110000,
        avgPricePerSqm: 1500,
        minPriceEur: null,
        maxPriceEur: 120000,
        avgAreaSqm: undefined,
        updatedAt: '2026-05-06T10:00:00.000Z'
      }),
      {
        id: 'stat-id',
        neighborhood: 'Mladost 1',
        zone: null,
        property_count: 3,
        avg_price_eur: 110000,
        avg_price_per_sqm: 1500,
        min_price_eur: null,
        max_price_eur: 120000,
        avg_area_sqm: null,
        updated_at: '2026-05-06T10:00:00.000Z'
      }
    );
  });

  test('returns null for nullish documents', () => {
    assert.equal(propertyDocToRow(null), null);
    assert.equal(priceHistoryDocToRow(undefined), null);
    assert.equal(scrapingRunDocToRow(null), null);
    assert.equal(scrapingRunScopeDocToRow(undefined), null);
    assert.equal(triageDocToResponse(null), null);
    assert.equal(neighborhoodStatDocToRow(undefined), null);
  });
});
