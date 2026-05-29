import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const optionalString = v.optional(v.union(v.string(), v.null()));
const optionalNumber = v.optional(v.union(v.number(), v.null()));

export default defineSchema({
  properties: defineTable({
    externalId: v.string(),
    source: v.string(),
    listingPurpose: v.string(),
    category: optionalString,
    url: optionalString,
    title: optionalString,
    neighborhood: optionalString,
    zone: optionalString,
    type: optionalString,
    condition: optionalString,
    priceEur: v.number(),
    priceBgn: optionalNumber,
    areaSqm: optionalNumber,
    pricePerSqm: optionalNumber,
    floor: optionalNumber,
    totalFloors: optionalNumber,
    rooms: optionalNumber,
    constructionYear: optionalNumber,
    constructionStage: optionalString,
    description: optionalString,
    imageUrl: optionalString,
    firstSeenAt: v.string(),
    lastSeenAt: v.string(),
    isActive: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string()
  })
    .index('by_external_id', ['externalId'])
    .index('by_active_purpose_updated', ['isActive', 'listingPurpose', 'updatedAt'])
    .index('by_active_purpose_category', ['isActive', 'listingPurpose', 'category'])
    .index('by_active_zone', ['isActive', 'zone'])
    .index('by_active_neighborhood', ['isActive', 'neighborhood'])
    .index('by_active_zone_price_per_sqm', ['isActive', 'zone', 'pricePerSqm']),

  priceHistory: defineTable({
    propertyId: v.id('properties'),
    priceEur: v.number(),
    priceBgn: optionalNumber,
    recordedAt: v.string()
  }).index('by_property_recorded_at', ['propertyId', 'recordedAt']),

  scrapingRuns: defineTable({
    status: v.string(),
    startedAt: v.string(),
    completedAt: optionalString,
    pagesTotal: v.number(),
    pagesScraped: v.number(),
    salePagesScraped: v.number(),
    rentalPagesScraped: v.number(),
    currentPurpose: optionalString,
    currentCategory: optionalString,
    crawlMode: v.string(),
    listingsFound: v.number(),
    listingsSaved: v.number(),
    errorMessage: optionalString
  }).index('by_started_at', ['startedAt']),

  scrapingRunScopes: defineTable({
    runId: v.id('scrapingRuns'),
    listingPurpose: v.string(),
    category: v.string(),
    pagesPlanned: v.number(),
    pagesScraped: v.number(),
    fullScope: v.boolean(),
    completed: v.boolean()
  })
    .index('by_run', ['runId'])
    .index('by_scope', ['listingPurpose', 'category']),

  settings: defineTable({
    general: v.object({
      city: v.string(),
      currency: v.string(),
      targetGrossYieldPct: v.number(),
      targetNetYieldPct: v.number(),
      rehabCostPerSqm: v.number(),
      transactionCostPct: v.number(),
      vacancyPct: v.number(),
      managementFeePct: v.number()
    }),
    airbnb: v.object({
      occupancyPct: v.number(),
      dailyRateEur: v.number(),
      operatingExpensePct: v.number()
    }),
    leverage: v.object({
      enabled: v.boolean(),
      mortgageRate: v.number(),
      loanTermYears: v.number(),
      downPaymentPct: v.number(),
      ltvPct: v.number(),
      originationFeePct: v.number(),
      annualInsuranceEur: v.number()
    }),
    flags: v.object({
      cocGreenPct: v.number(),
      cocYellowPct: v.number(),
      dscrMinimum: v.number(),
      rateStressPct: v.number()
    }),
    updatedAt: v.string()
  }),

  dealTriage: defineTable({
    propertyId: v.id('properties'),
    status: v.string(),
    note: v.string(),
    rejectedReason: v.string(),
    updatedAt: v.string()
  }).index('by_property', ['propertyId']),

  neighborhoodStats: defineTable({
    neighborhood: v.string(),
    zone: optionalString,
    propertyCount: v.number(),
    avgPriceEur: optionalNumber,
    avgPricePerSqm: optionalNumber,
    minPriceEur: optionalNumber,
    maxPriceEur: optionalNumber,
    avgAreaSqm: optionalNumber,
    updatedAt: v.string()
  }).index('by_zone_neighborhood', ['zone', 'neighborhood'])
});
