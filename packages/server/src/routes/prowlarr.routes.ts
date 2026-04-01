import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as prowlarrService from '../services/prowlarr.service.js';

const router = Router();

// GET /api/prowlarr/search?q=...&categories=2000,5000
router.get('/search', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string)?.trim() ?? '';
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

// Beide Formen unterstützen (mit und ohne 's')
router.get('/indexers', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json(await prowlarrService.getIndexers()); } catch (err) { next(err); }
});
router.get('/indexer', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json(await prowlarrService.getIndexers()); } catch (err) { next(err); }
});

// GET /api/prowlarr/stats
router.get('/stats', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try { res.json(await prowlarrService.getStats()); } catch (err) { next(err); }
});

// GET /api/prowlarr/history?pageSize=100
router.get('/history', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pageSize = Number(req.query.pageSize) || 100;
    res.json(await prowlarrService.getHistory(pageSize));
  } catch (err) { next(err); }
});

// GET /api/prowlarr/rss?categories=5000&limit=50
router.get('/rss', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cats = req.query.categories
      ? String(req.query.categories).split(',').map(Number).filter(Boolean)
      : [];
    const limit = Number(req.query.limit) || 50;
    res.json(await prowlarrService.getRss(cats, limit));
  } catch (err) { next(err); }
});

export default router;
