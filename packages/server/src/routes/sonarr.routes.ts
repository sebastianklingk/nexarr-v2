import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as sonarrService from '../services/sonarr.service.js';

const router = Router();

router.get('/series', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await sonarrService.getSeries());
  } catch (err) { next(err); }
});

router.get('/series/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await sonarrService.getSeriesById(Number(req.params.id)));
  } catch (err) { next(err); }
});

router.get('/series/:id/episodes', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await sonarrService.getEpisodes(Number(req.params.id)));
  } catch (err) { next(err); }
});

router.get('/queue', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await sonarrService.getQueue());
  } catch (err) { next(err); }
});

router.get('/lookup', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const term = (req.query.term as string)?.trim();
    if (!term) { res.json([]); return; }
    res.json(await sonarrService.lookup(term));
  } catch (err) { next(err); }
});

router.post('/series', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await sonarrService.addSeries(req.body as Record<string, unknown>));
  } catch (err) { next(err); }
});

router.post('/series/:id/search', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await sonarrService.triggerSearch(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
