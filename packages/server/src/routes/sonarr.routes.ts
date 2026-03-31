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

export default router;
