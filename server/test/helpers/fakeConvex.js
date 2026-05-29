import { getFunctionName } from 'convex/server';

import { setConvexClientForTests } from '../../src/convexClient.js';

const timestamp = '2026-05-29T10:00:00.000Z';

export const defaultSettings = {
  general: {
    city: 'Sofia',
    currency: 'EUR',
    targetGrossYieldPct: 6,
    targetNetYieldPct: 4.5,
    rehabCostPerSqm: 300,
    transactionCostPct: 3,
    vacancyPct: 5,
    managementFeePct: 8
  },
  airbnb: {
    occupancyPct: 65,
    dailyRateEur: 65,
    operatingExpensePct: 30
  },
  leverage: {
    enabled: true,
    mortgageRate: 3.5,
    loanTermYears: 25,
    downPaymentPct: 20,
    ltvPct: 80,
    originationFeePct: 1,
    annualInsuranceEur: 250
  },
  flags: {
    cocGreenPct: 8,
    cocYellowPct: 4,
    dscrMinimum: 1.25,
    rateStressPct: 1
  },
  updatedAt: timestamp
};

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function mergeSettings(settings, updates) {
  const next = clone(settings);
  for (const [group, values] of Object.entries(updates ?? {})) {
    next[group] = { ...(next[group] ?? {}), ...(values ?? {}) };
  }
  if (updates?.leverage?.downPaymentPct != null && updates.leverage.ltvPct == null) {
    next.leverage.ltvPct = 100 - Number(updates.leverage.downPaymentPct);
  }
  if (updates?.leverage?.ltvPct != null && updates.leverage.downPaymentPct == null) {
    next.leverage.downPaymentPct = 100 - Number(updates.leverage.ltvPct);
  }
  next.updatedAt = timestamp;
  return next;
}

function matchesFilters(property, filters = {}) {
  if (filters.includeInactive !== true && !property.isActive) {
    return false;
  }
  if (filters.includeAllPurposes !== true) {
    const purpose = filters.listingPurpose ?? 'sale';
    if (property.listingPurpose !== purpose) {
      return false;
    }
  } else if (filters.listingPurpose && property.listingPurpose !== filters.listingPurpose) {
    return false;
  }

  for (const field of ['category', 'neighborhood', 'zone', 'type', 'condition']) {
    if (filters[field] && property[field] !== filters[field]) {
      return false;
    }
  }
  if (filters.minPrice != null && property.priceEur < Number(filters.minPrice)) return false;
  if (filters.maxPrice != null && property.priceEur > Number(filters.maxPrice)) return false;
  if (filters.minArea != null && property.areaSqm < Number(filters.minArea)) return false;
  if (filters.maxArea != null && property.areaSqm > Number(filters.maxArea)) return false;
  return true;
}

function isMalformedFakePropertyId(id) {
  return id == null || /^[0-9]+$/.test(String(id));
}

function throwMalformedPropertyId(id) {
  const error = new Error(`Value does not match validator v.id("properties"): ${id}`);
  error.code = 'ConvexValidationError';
  throw error;
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function createFakeConvexClient(initialState = {}) {
  const state = {
    properties: clone(initialState.properties ?? []),
    priceHistory: clone(initialState.priceHistory ?? []),
    scrapingRuns: clone(initialState.scrapingRuns ?? []),
    scrapingRunScopes: clone(initialState.scrapingRunScopes ?? []),
    neighborhoodStats: clone(initialState.neighborhoodStats ?? []),
    dealTriage: clone(initialState.dealTriage ?? []),
    settings: mergeSettings(defaultSettings, initialState.settings ?? {}),
    nextPropertyId: 1,
    nextHistoryId: 1,
    nextRunId: 1,
    nextScopeId: 1,
    nextStatId: 1
  };

  for (const property of state.properties) {
    const numeric = Number(String(property._id ?? property.id ?? '').replace('property-', ''));
    if (Number.isFinite(numeric)) state.nextPropertyId = Math.max(state.nextPropertyId, numeric + 1);
  }

  function upsertProperty(args) {
    const existing = state.properties.find((property) => property.externalId === args.externalId);
    const pricePerSqm = args.pricePerSqm ?? (args.areaSqm && args.priceEur ? args.priceEur / args.areaSqm : undefined);
    const values = {
      source: 'imot.bg',
      listingPurpose: 'sale',
      isActive: true,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...args,
      pricePerSqm
    };

    if (existing) {
      Object.assign(existing, values, {
        _id: existing._id,
        firstSeenAt: existing.firstSeenAt,
        createdAt: existing.createdAt,
        isActive: true,
        lastSeenAt: timestamp,
        updatedAt: timestamp
      });
      return clone(existing);
    }

    const created = { _id: `property-${state.nextPropertyId++}`, ...values };
    state.properties.push(created);
    return clone(created);
  }

  function listProperties(args) {
    return state.properties
      .filter((property) => matchesFilters(property, args))
      .sort((left, right) => String(right.updatedAt ?? '').localeCompare(String(left.updatedAt ?? '')))
      .slice(args.offset ?? 0, (args.offset ?? 0) + (args.limit ?? 50))
      .map(clone);
  }

  function recomputeStats() {
    const groups = new Map();
    for (const property of state.properties.filter((item) => item.isActive && item.listingPurpose === 'sale' && item.neighborhood)) {
      const group = groups.get(property.neighborhood) ?? [];
      group.push(property);
      groups.set(property.neighborhood, group);
    }
    state.neighborhoodStats = [...groups.entries()].map(([neighborhood, properties], index) => ({
      _id: `stat-${index + 1}`,
      neighborhood,
      zone: properties[0].zone ?? null,
      propertyCount: properties.length,
      avgPriceEur: average(properties.map((property) => property.priceEur)),
      avgPricePerSqm: average(properties.map((property) => property.pricePerSqm ?? property.priceEur / property.areaSqm)),
      minPriceEur: Math.min(...properties.map((property) => property.priceEur)),
      maxPriceEur: Math.max(...properties.map((property) => property.priceEur)),
      avgAreaSqm: average(properties.map((property) => property.areaSqm).filter(Number.isFinite)),
      updatedAt: timestamp
    }));
    return state.neighborhoodStats.map(clone);
  }

  function mutationByName(name, args = {}) {
    switch (name) {
      case 'properties:upsert':
        return upsertProperty(args);
      case 'properties:markInactive': {
        const property = state.properties.find((item) => item._id === args.id || item.id === args.id);
        if (!property) return false;
        property.isActive = false;
        property.updatedAt = timestamp;
        return true;
      }
      case 'properties:markInactiveByScope': {
        const seen = new Set(args.seenExternalIds ?? []);
        let count = 0;
        for (const property of state.properties) {
          if (
            property.isActive &&
            property.listingPurpose === args.listingPurpose &&
            property.category === args.category &&
            !seen.has(property.externalId)
          ) {
            property.isActive = false;
            property.updatedAt = timestamp;
            count += 1;
          }
        }
        return count;
      }
      case 'priceHistory:insert': {
        const entry = {
          _id: `price-${state.nextHistoryId++}`,
          propertyId: args.propertyId,
          priceEur: args.priceEur,
          priceBgn: args.priceBgn ?? null,
          recordedAt: args.recordedAt ?? timestamp
        };
        state.priceHistory.push(entry);
        return clone(entry);
      }
      case 'scrapingRuns:create': {
        const run = {
          _id: `run-${state.nextRunId++}`,
          status: 'running',
          startedAt: timestamp,
          completedAt: null,
          pagesTotal: args.pagesTotal ?? 0,
          pagesScraped: 0,
          salePagesScraped: 0,
          rentalPagesScraped: 0,
          currentPurpose: null,
          currentCategory: null,
          crawlMode: args.crawlMode ?? 'bounded',
          listingsFound: 0,
          listingsSaved: 0,
          errorMessage: null,
          ...args
        };
        state.scrapingRuns.push(run);
        return clone(run);
      }
      case 'scrapingRuns:update': {
        const run = state.scrapingRuns.find((item) => item._id === args.id || item.id === args.id);
        if (!run) return null;
        Object.assign(run, args);
        delete run.id;
        if (args.status === 'completed' || args.status === 'failed') {
          run.completedAt = args.completedAt ?? timestamp;
        }
        return clone(run);
      }
      case 'scrapingRunScopes:create': {
        const scope = {
          _id: `scope-${state.nextScopeId++}`,
          pagesScraped: 0,
          fullScope: false,
          completed: false,
          ...args
        };
        state.scrapingRunScopes.push(scope);
        return clone(scope);
      }
      case 'scrapingRunScopes:complete': {
        const scope = state.scrapingRunScopes.find((item) => item._id === args.id || item.id === args.id);
        if (!scope) return null;
        Object.assign(scope, args, { completed: args.completed ?? true });
        delete scope.id;
        return clone(scope);
      }
      case 'neighborhoodStats:recompute':
        return recomputeStats();
      case 'settings:update':
        state.settings = mergeSettings(state.settings, args.updates);
        return clone(state.settings);
      case 'dealTriage:upsert': {
        const existing = state.dealTriage.find((item) => item.propertyId === args.propertyId);
        const values = {
          propertyId: args.propertyId,
          status: args.status ?? 'new',
          note: args.note ?? '',
          rejectedReason: args.rejectedReason ?? '',
          updatedAt: timestamp
        };
        if (existing) {
          Object.assign(existing, values);
          return clone(existing);
        }
        state.dealTriage.push(values);
        return clone(values);
      }
      default:
        throw new Error(`Unhandled fake Convex mutation: ${name}`);
    }
  }

  function queryByName(name, args = {}) {
    switch (name) {
      case 'properties:list':
        return listProperties(args);
      case 'properties:count':
        return state.properties.filter((property) => matchesFilters(property, args)).length;
      case 'properties:byId':
        if (isMalformedFakePropertyId(args.id)) throwMalformedPropertyId(args.id);
        return clone(state.properties.find((property) => property._id === args.id || property.id === args.id) ?? null);
      case 'properties:byExternalId':
        return clone(state.properties.find((property) => property.externalId === args.externalId) ?? null);
      case 'priceHistory:byProperty':
        return state.priceHistory.filter((entry) => entry.propertyId === args.propertyId).map(clone);
      case 'scrapingRuns:latest':
        return clone(state.scrapingRuns.at(-1) ?? null);
      case 'scrapingRuns:history':
        return state.scrapingRuns.slice(-(args.limit ?? 25)).reverse().map(clone);
      case 'scrapingRunScopes:completedByRun':
        return state.scrapingRunScopes
          .filter((scope) => scope.runId === args.runId && scope.completed)
          .map(clone);
      case 'neighborhoodStats:list':
        return state.neighborhoodStats.map(clone);
      case 'settings:get':
        return clone(state.settings);
      case 'dealTriage:byProperty':
        if (isMalformedFakePropertyId(args.propertyId)) throwMalformedPropertyId(args.propertyId);
        return clone(state.dealTriage.find((item) => item.propertyId === args.propertyId) ?? null);
      case 'dealTriage:forProperties': {
        if ((args.propertyIds ?? []).some(isMalformedFakePropertyId)) {
          throwMalformedPropertyId((args.propertyIds ?? []).find(isMalformedFakePropertyId));
        }
        const ids = new Set(args.propertyIds ?? []);
        return state.dealTriage.filter((item) => ids.has(item.propertyId)).map(clone);
      }
      default:
        throw new Error(`Unhandled fake Convex query: ${name}`);
    }
  }

  return {
    state,
    query: async (fn, args) => queryByName(getFunctionName(fn), args),
    mutation: async (fn, args) => mutationByName(getFunctionName(fn), args)
  };
}

export function installFakeConvex(initialState) {
  const client = createFakeConvexClient(initialState);
  setConvexClientForTests(client);
  return client;
}
