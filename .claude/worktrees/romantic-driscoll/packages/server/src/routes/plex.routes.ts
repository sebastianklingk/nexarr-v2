import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as plexService from '../services/plex.service.js';
import { env } from '../config/env.js';

const router = Router();

router.get('/sessions', requireAuth, async (_req, res, next) => {
  try { res.json(await plexService.getSessions()); } catch (e) { next(e); }
});

router.get('/libraries', requireAuth, async (_req, res, next) => {
  try { res.json(await plexService.getLibraries()); } catch (e) { next(e); }
});

// Gibt den konfigurierten Plex-Deep-Link zurück (Token bleibt serverseitig)
router.get('/deeplink', requireAuth, async (req, res, next) => {
  try {
    if (!env.PLEX_URL || !env.PLEX_TOKEN) {
      res.status(503).json({ error: 'Plex nicht konfiguriert' });
      return;
    }
    const key = req.query.key as string;
    if (!key) { res.status(400).json({ error: 'key required' }); return; }
    const url = plexService.buildDeepLink(env.PLEX_URL, key, env.PLEX_TOKEN);
    res.json({ url });
  } catch (e) { next(e); }
});

router.get('/status', requireAuth, async (_req, res, next) => {
  try { res.json(await plexService.getStatus()); } catch (e) { next(e); }
});

export { router as plexRouter };
