import { insertPriceHistory } from '../db/priceHistory.js';
import { getPropertyByExternalId, markInactiveByScope, upsertProperty } from '../db/properties.js';
import { createScrapingRun, updateScrapingRun } from '../db/scrapingRuns.js';
import { completeScrapingRunScope, createScrapingRunScope } from '../db/scrapingRunScopes.js';
import { recomputeNeighborhoodStats } from '../db/neighborhoodStats.js';
import { getDb } from '../db/connection.js';
import { decodeWindows1251 } from './encoding.js';
import { parseDetailPage, parseSearchResults } from './parser.js';
import { buildSearchPlan, normalizeScrapeOptions } from './searchPlan.js';

const DEFAULT_BASE_URL = 'https://www.imot.bg';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildSearchUrls({ pages = 1, baseUrl = DEFAULT_BASE_URL } = {}) {
  return buildSearchPlan({ pages, baseUrl, includeRentals: false, maxPagesPerCategory: pages }).map((item) => item.url);
}

async function defaultFetcher(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'realestate-investing-local/0.1 (+local analysis)',
      accept: 'text/html,application/xhtml+xml'
    }
  });

  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} for ${url}`);
  }

  return { body: decodeWindows1251(await response.arrayBuffer()) };
}

async function fetchHtml(fetcher, url) {
  const result = await fetcher(url);
  if (typeof result === 'string') {
    return result;
  }
  if (result?.body != null) {
    return typeof result.body === 'string' ? result.body : decodeWindows1251(result.body);
  }
  return decodeWindows1251(result);
}

async function withRetries(fn, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(100 * (attempt + 1));
      }
    }
  }
  throw lastError;
}

function mergeDetail(property, detail) {
  return {
    ...property,
    constructionYear: detail.constructionYear ?? property.constructionYear,
    constructionStage: detail.constructionStage ?? property.constructionStage,
    description: detail.description || property.description,
    condition: detail.condition !== 'unknown' ? detail.condition : property.condition
  };
}

export async function runScrape({
  database = getDb(),
  pages,
  searchUrls,
  searchPlan,
  fetcher = defaultFetcher,
  delayMs = 750,
  retries = 2,
  ...options
} = {}) {
  const normalizedOptions = normalizeScrapeOptions({ ...options, maxPagesPerCategory: options.maxPagesPerCategory ?? pages });
  const plan =
    searchPlan ??
    (searchUrls
      ? searchUrls.map((url, index) => ({
          purpose: 'sale',
          category: `legacy-${index + 1}`,
          resultPage: 1,
          url,
          fullScope: true
        }))
      : buildSearchPlan(normalizedOptions));
  const run = createScrapingRun(
    {
      pagesTotal: plan.length,
      crawlMode: normalizedOptions.fullCrawl ? 'full' : 'bounded'
    },
    database
  );
  const seenByScope = new Map();
  const scopeRows = new Map();
  let listingsFound = 0;
  let listingsSaved = 0;
  let priceChanges = 0;
  let salePagesScraped = 0;
  let rentalPagesScraped = 0;

  for (const item of plan) {
    const key = `${item.purpose}:${item.category}`;
    if (!scopeRows.has(key)) {
      const pagesPlanned = plan.filter((entry) => entry.purpose === item.purpose && entry.category === item.category).length;
      scopeRows.set(
        key,
        createScrapingRunScope(
          {
            runId: run.id,
            listingPurpose: item.purpose,
            category: item.category,
            pagesPlanned,
            fullScope: item.fullScope
          },
          database
        )
      );
      seenByScope.set(key, new Set());
    }
  }

  try {
    for (const [index, item] of plan.entries()) {
      const html = await withRetries(() => fetchHtml(fetcher, item.url), retries);
      const listings = parseSearchResults(html, DEFAULT_BASE_URL, {
        listingPurpose: item.purpose,
        category: item.category
      });
      listingsFound += listings.length;

      if (item.purpose === 'sale') {
        salePagesScraped += 1;
      } else if (item.purpose === 'rent') {
        rentalPagesScraped += 1;
      }

      const scopeKey = `${item.purpose}:${item.category}`;
      const seenExternalIds = seenByScope.get(scopeKey);

      for (const listing of listings) {
        seenExternalIds.add(listing.externalId);
        const existing = getPropertyByExternalId(listing.externalId, database);
        let propertyData = listing;

        if (listing.url) {
          try {
            const detailHtml = await withRetries(() => fetchHtml(fetcher, listing.url), retries);
            propertyData = mergeDetail(listing, parseDetailPage(detailHtml));
          } catch {
            propertyData = listing;
          }
        }

        const saved = upsertProperty(propertyData, database);
        listingsSaved += 1;

        if (!existing || Number(existing.price_eur) !== Number(saved.price_eur)) {
          insertPriceHistory(
            { propertyId: saved.id, priceEur: saved.price_eur, priceBgn: saved.price_bgn },
            database
          );
          if (existing) {
            priceChanges += 1;
          }
        }

        if (delayMs > 0) {
          await sleep(delayMs);
        }
      }

      updateScrapingRun(
        run.id,
        {
          pagesScraped: index + 1,
          listingsFound,
          listingsSaved,
          salePagesScraped,
          rentalPagesScraped,
          currentPurpose: item.purpose,
          currentCategory: item.category
        },
        database
      );
    }

    for (const [key, scope] of scopeRows.entries()) {
      const [listingPurpose, category] = key.split(':');
      const planned = plan.filter((item) => item.purpose === listingPurpose && item.category === category).length;
      completeScrapingRunScope(scope.id, { pagesScraped: planned, completed: true }, database);
      if (scope.full_scope) {
        markInactiveByScope(
          {
            listingPurpose,
            category,
            seenExternalIds: seenByScope.get(key)
          },
          database
        );
      }
    }

    recomputeNeighborhoodStats(database);
    const completed = updateScrapingRun(
      run.id,
      {
        status: 'completed',
        listingsFound,
        listingsSaved,
        pagesScraped: plan.length,
        salePagesScraped,
        rentalPagesScraped,
        currentPurpose: null,
        currentCategory: null
      },
      database
    );

    return { ...completed, listingsFound, listingsSaved, priceChanges };
  } catch (error) {
    updateScrapingRun(run.id, { status: 'failed', errorMessage: error.message }, database);
    throw error;
  }
}
