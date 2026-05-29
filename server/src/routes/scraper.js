import { Router } from 'express';
import { getDb } from '../db/connection.js';
import { getLatestScrapingRun, listScrapingRuns } from '../db/scrapingRuns.js';
import { runScrape } from '../scraper/imotbg.js';

export function createScraperRouter({ database = getDb(), scraper = { start: () => runScrape({ database }) } } = {}) {
  const router = Router();
  let activeRun = null;

  router.post('/start', asyncHandler(async (req, res) => {
    if (activeRun) {
      return res.status(409).json({ status: 'running', message: 'Scrape already running' });
    }

    activeRun = Promise.resolve()
      .then(() => scraper.start(req.body ?? {}))
      .catch((error) => {
        console.error('Scrape failed:', error);
      })
      .finally(() => {
        activeRun = null;
      });

    res.status(202).json({ status: 'running', message: 'Scraping started' });
  }));

  router.get('/status', asyncHandler(async (_req, res) => {
    const run = await getLatestScrapingRun(database);
    if (!run) {
      return res.json({ status: 'idle', progress: null });
    }
    return res.json(toRunResponse(run));
  }));

  router.get('/history', asyncHandler(async (_req, res) => {
    const runs = (await listScrapingRuns(25, database)).map(toRunResponse);
    res.json({ runs });
  }));

  return router;
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function toRunResponse(run) {
  return {
    id: run.id,
    runId: run.id,
    status: run.status,
    startedAt: run.started_at,
    completedAt: run.completed_at,
    listingsFound: run.listings_found,
    listingsSaved: run.listings_saved,
    crawlMode: run.crawl_mode ?? 'bounded',
    progress: {
      currentPage: run.pages_scraped,
      totalPages: run.pages_total,
      listingsProcessed: run.listings_saved,
      salePagesScraped: run.sale_pages_scraped ?? 0,
      rentalPagesScraped: run.rental_pages_scraped ?? 0,
      currentPurpose: run.current_purpose,
      currentCategory: run.current_category
    },
    errorMessage: run.error_message
  };
}
