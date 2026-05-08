import { insertPriceHistory } from '../db/priceHistory.js';
import { getPropertyByExternalId, markInactive, queryProperties, upsertProperty } from '../db/properties.js';
import { createScrapingRun, updateScrapingRun } from '../db/scrapingRuns.js';
import { recomputeNeighborhoodStats } from '../db/neighborhoodStats.js';
import { getDb } from '../db/connection.js';
import { decodeWindows1251 } from './encoding.js';
import { parseDetailPage, parseSearchResults } from './parser.js';

const DEFAULT_BASE_URL = 'https://www.imot.bg';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildSearchUrls({ pages = 1, baseUrl = DEFAULT_BASE_URL } = {}) {
  const categories = [
    '/obiavi/prodazhbi/grad-sofiya/dvustaen',
    '/obiavi/prodazhbi/grad-sofiya/tristaen',
    '/obiavi/prodazhbi/grad-sofiya/chetiristaen',
    '/obiavi/prodazhbi/grad-sofiya/mnogostaen',
    '/obiavi/prodazhbi/grad-sofiya/kashta'
  ];

  return categories.slice(0, pages).map((path) => new URL(path, baseUrl).toString());
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
  pages = 1,
  searchUrls = buildSearchUrls({ pages }),
  fetcher = defaultFetcher,
  delayMs = 750,
  retries = 2
} = {}) {
  const run = createScrapingRun({ pagesTotal: searchUrls.length }, database);
  const seenExternalIds = new Set();
  let listingsFound = 0;
  let listingsSaved = 0;
  let priceChanges = 0;

  try {
    for (const [index, searchUrl] of searchUrls.entries()) {
      const html = await withRetries(() => fetchHtml(fetcher, searchUrl), retries);
      const listings = parseSearchResults(html, DEFAULT_BASE_URL);
      listingsFound += listings.length;

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
          listingsSaved
        },
        database
      );
    }

    for (const property of queryProperties({ includeInactive: true, limit: 10000 }, database)) {
      if (property.source === 'imot.bg' && !seenExternalIds.has(property.external_id)) {
        markInactive(property.id, database);
      }
    }

    recomputeNeighborhoodStats(database);
    const completed = updateScrapingRun(
      run.id,
      { status: 'completed', listingsFound, listingsSaved, pagesScraped: searchUrls.length },
      database
    );

    return { ...completed, listingsFound, listingsSaved, priceChanges };
  } catch (error) {
    updateScrapingRun(run.id, { status: 'failed', errorMessage: error.message }, database);
    throw error;
  }
}
