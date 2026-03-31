import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { C } from '../cache/cache.js';

const router = Router();

// GET /api/system/cache
router.get('/cache', requireAuth, (_req: Request, res: Response) => {
  res.json(C.stats());
});

// DELETE /api/system/cache
router.delete('/cache', requireAuth, (_req: Request, res: Response) => {
  C.clear();
  res.json({ ok: true, message: 'Cache geleert' });
});

// DELETE /api/system/cache/:key
router.delete('/cache/:key', requireAuth, (req: Request, res: Response) => {
  C.invalidate(req.params.key);
  res.json({ ok: true });
});

// GET /api/system/health
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

export default router;
