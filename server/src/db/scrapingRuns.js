import { getDb } from './connection.js';

export function createScrapingRun(values = {}, database = getDb()) {
  const result = database
    .prepare(
      `INSERT INTO scraping_runs (
        status, pages_total, pages_scraped, listings_found, listings_saved, error_message
       )
       VALUES (
        @status, @pagesTotal, @pagesScraped, @listingsFound, @listingsSaved, @errorMessage
       )`
    )
    .run({
      status: values.status ?? 'running',
      pagesTotal: values.pagesTotal ?? 0,
      pagesScraped: values.pagesScraped ?? 0,
      listingsFound: values.listingsFound ?? 0,
      listingsSaved: values.listingsSaved ?? 0,
      errorMessage: values.errorMessage ?? null
    });

  return database.prepare('SELECT * FROM scraping_runs WHERE id = ?').get(result.lastInsertRowid);
}

export function updateScrapingRun(id, values = {}, database = getDb()) {
  const allowed = {
    status: 'status',
    completedAt: 'completed_at',
    pagesTotal: 'pages_total',
    pagesScraped: 'pages_scraped',
    listingsFound: 'listings_found',
    listingsSaved: 'listings_saved',
    errorMessage: 'error_message'
  };

  const updates = [];
  const params = { id };

  for (const [key, column] of Object.entries(allowed)) {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      updates.push(`${column} = @${key}`);
      params[key] = values[key];
    }
  }

  if (values.status === 'completed' || values.status === 'failed') {
    updates.push('completed_at = COALESCE(@completedAt, CURRENT_TIMESTAMP)');
    params.completedAt = values.completedAt ?? null;
  }

  if (!updates.length) {
    return database.prepare('SELECT * FROM scraping_runs WHERE id = ?').get(id) || null;
  }

  database.prepare(`UPDATE scraping_runs SET ${updates.join(', ')} WHERE id = @id`).run(params);
  return database.prepare('SELECT * FROM scraping_runs WHERE id = ?').get(id) || null;
}

export function getLatestScrapingRun(database = getDb()) {
  return (
    database
      .prepare('SELECT * FROM scraping_runs ORDER BY started_at DESC, id DESC LIMIT 1')
      .get() || null
  );
}
