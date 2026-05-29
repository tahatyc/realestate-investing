import express from 'express';
import cors from 'cors';
import { pathToFileURL } from 'node:url';
import { getDb, initializeDatabase } from './db/connection.js';
import { createNeighborhoodsRouter } from './routes/neighborhoods.js';
import { createOverviewRouter } from './routes/overview.js';
import { createPropertiesRouter } from './routes/properties.js';
import { createScraperRouter } from './routes/scraper.js';
import { createSettingsRouter } from './routes/settings.js';
import { createStrategiesRouter } from './routes/strategies.js';
import { createTriageRouter } from './routes/triage.js';

export function createApp({ database, scraper } = {}) {
  const app = express();
  const activeDatabase = database ?? getDb();

  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/scraper', createScraperRouter({ database: activeDatabase, scraper }));
  app.use('/api/strategies', createStrategiesRouter({ database: activeDatabase }));
  app.use('/api/properties', createPropertiesRouter({ database: activeDatabase }));
  app.use('/api/triage', createTriageRouter({ database: activeDatabase }));
  app.use('/api/neighborhoods', createNeighborhoodsRouter({ database: activeDatabase }));
  app.use('/api/settings', createSettingsRouter({ database: activeDatabase }));
  app.use('/api/overview', createOverviewRouter({ database: activeDatabase }));

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  });

  return app;
}

export const app = createApp();

const port = process.env.PORT || 3001;

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const database = initializeDatabase();
  const serverApp = createApp({ database });
  serverApp.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
}
