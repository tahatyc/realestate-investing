import { getDb } from './connection.js';

export function createScrapingRunScope(values, database = getDb()) {
  const result = database
    .prepare(
      `INSERT INTO scraping_run_scopes (
        run_id, listing_purpose, category, pages_planned, pages_scraped, full_scope, completed
       )
       VALUES (
        @runId, @listingPurpose, @category, @pagesPlanned, @pagesScraped, @fullScope, @completed
       )`
    )
    .run({
      runId: values.runId,
      listingPurpose: values.listingPurpose,
      category: values.category,
      pagesPlanned: values.pagesPlanned,
      pagesScraped: values.pagesScraped ?? 0,
      fullScope: values.fullScope ? 1 : 0,
      completed: values.completed ? 1 : 0
    });

  return database.prepare('SELECT * FROM scraping_run_scopes WHERE id = ?').get(result.lastInsertRowid);
}

export function completeScrapingRunScope(id, values = {}, database = getDb()) {
  database
    .prepare(
      `UPDATE scraping_run_scopes
       SET pages_scraped = @pagesScraped,
           completed = @completed
       WHERE id = @id`
    )
    .run({
      id,
      pagesScraped: values.pagesScraped ?? 0,
      completed: values.completed ? 1 : 0
    });

  return database.prepare('SELECT * FROM scraping_run_scopes WHERE id = ?').get(id) || null;
}

export function getCompletedScrapingRunScopes(runId, database = getDb()) {
  return database
    .prepare(
      `SELECT *
       FROM scraping_run_scopes
       WHERE run_id = @runId
         AND completed = 1
       ORDER BY id`
    )
    .all({ runId });
}
