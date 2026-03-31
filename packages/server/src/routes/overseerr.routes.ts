import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as overseerrService from '../services/overseerr.service.js';

const router = Router();

router.get('/requests', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = (req.query.filter as string) ?? 'pending';
    res.json(await overseerrService.getRequests(filter));
  } catch (err) { next(err); }
});

router.post('/requests/:id/approve', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await overseerrService.approveRequest(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/requests/:id/decline', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await overseerrService.declineRequest(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.delete('/requests/:id', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await overseerrService.deleteRequest(Number(req.params.id));
    res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
