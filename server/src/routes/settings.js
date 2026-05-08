import { Router } from 'express';
import { getSettings, updateSettings } from '../db/settings.js';

export function createSettingsRouter({ database } = {}) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ settings: getSettings(database) });
  });

  router.put('/', (req, res) => {
    res.json({ settings: updateSettings(req.body ?? {}, database) });
  });

  return router;
}
