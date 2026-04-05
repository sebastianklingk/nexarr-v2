import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as sabnzbdService from '../services/sabnzbd.service.js';

const router = Router();
const H = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

router.get('/queue', requireAuth, H(async (_req, res) => {
  res.json(await sabnzbdService.getQueue());
}));

router.get('/history', requireAuth, H(async (_req, res) => {
  res.json(await sabnzbdService.getHistory());
}));

router.post('/pause', requireAuth, H(async (_req, res) => {
  await sabnzbdService.pause();
  res.json({ ok: true });
}));

router.post('/resume', requireAuth, H(async (_req, res) => {
  await sabnzbdService.resume();
  res.json({ ok: true });
}));

router.post('/speedlimit', requireAuth, H(async (req, res) => {
  const percent = Number(req.body?.percent ?? 100);
  await sabnzbdService.setSpeedLimit(percent);
  res.json({ ok: true });
}));

router.delete('/queue/:nzoId', requireAuth, H(async (req, res) => {
  await sabnzbdService.deleteItem(req.params.nzoId as string);
  res.json({ ok: true });
}));

router.post('/queue/:nzoId/pause', requireAuth, H(async (req, res) => {
  await sabnzbdService.pauseItem(req.params.nzoId as string);
  res.json({ ok: true });
}));

router.post('/queue/:nzoId/resume', requireAuth, H(async (req, res) => {
  await sabnzbdService.resumeItem(req.params.nzoId as string);
  res.json({ ok: true });
}));

// Priorität setzen (Force / High / Normal / Low)
router.post('/queue/:nzoId/priority', requireAuth, H(async (req, res) => {
  const priority = req.body?.priority as 'Force' | 'High' | 'Normal' | 'Low';
  if (!['Force', 'High', 'Normal', 'Low'].includes(priority)) {
    res.status(400).json({ error: 'priority must be Force|High|Normal|Low' });
    return;
  }
  await sabnzbdService.setPriority(req.params.nzoId as string, priority);
  res.json({ ok: true });
}));

// Job an Anfang der Queue verschieben
router.post('/queue/:nzoId/move-top', requireAuth, H(async (req, res) => {
  await sabnzbdService.moveToTop(req.params.nzoId as string);
  res.json({ ok: true });
}));

export default router;
