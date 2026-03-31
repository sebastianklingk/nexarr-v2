import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as prowlarrService from '../services/prowlarr.service.js';

const router = Router();

// GET /api/prowlarr/search?q=...&categories=2000,5000
router.get('/search', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string)?.trim();
    if (!q) { res.json([]); return; }

    const cats = req.query.categories
      ? String(req.query.categories).split(',').map(Number).filter(Boolean)
      : [];

    const results = await prowlarrService.search(q, cats);
    res.json(results);
  } catch (err) { next(err); }
});

// POST /api/prowlarr/grab  { guid, indexerId }
router.post('/grab', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { guid, indexerId } = req.body as { guid: string; indexerId: number };
    await prowlarrService.grab(guid, indexerId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/indexers', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await prowlarrService.getIndexers());
  } catch (err) { next(err); }
});

export default router;
