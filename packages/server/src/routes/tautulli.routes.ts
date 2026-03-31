import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as tautulliService from '../services/tautulli.service.js';

const router = Router();

router.get('/activity', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await tautulliService.getActivity());
  } catch (err) { next(err); }
});

router.get('/stats', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await tautulliService.getHomeStats());
  } catch (err) { next(err); }
});

router.get('/history', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await tautulliService.getHistory());
  } catch (err) { next(err); }
});

export default router;
