import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as sabnzbdService from '../services/sabnzbd.service.js';

const router = Router();

router.get('/queue', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const queue = await sabnzbdService.getQueue();
    res.json(queue);
  } catch (err) {
    next(err);
  }
});

router.get('/history', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const history = await sabnzbdService.getHistory();
    res.json(history);
  } catch (err) {
    next(err);
  }
});

router.post('/pause', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await sabnzbdService.pause();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/resume', requireAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await sabnzbdService.resume();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/speedlimit', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const percent = Number(req.body?.percent ?? 100);
    await sabnzbdService.setSpeedLimit(percent);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/queue/:nzoId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await sabnzbdService.deleteItem(req.params.nzoId as string);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
