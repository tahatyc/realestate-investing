import { Router } from 'express';
import { getSettings, updateSettings } from '../db/settings.js';

export function createSettingsRouter({ database } = {}) {
  const router = Router();

  router.get('/', asyncHandler(async (_req, res) => {
    res.json({ settings: await getSettings(database) });
  }));

  router.put('/', asyncHandler(async (req, res) => {
    res.json({ settings: await updateSettings(req.body ?? {}, database) });
  }));

  return router;
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
