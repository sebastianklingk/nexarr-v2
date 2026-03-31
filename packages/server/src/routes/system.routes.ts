import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { C } from '../cache/cache.js';
import os from 'node:os';

const router = Router();

// GET /api/system/health  – kein Auth (für Docker healthcheck)
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

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
  C.invalidate(req.params.key!);
  res.json({ ok: true });
});

// GET /api/system/status
router.get('/status', requireAuth, (_req: Request, res: Response) => {
  res.json({
    uptime:      process.uptime(),
    nodeVersion: process.version,
    platform:    process.platform,
    memory: {
      used:  process.memoryUsage().heapUsed,
      total: process.memoryUsage().heapTotal,
    },
    loadAvg: os.loadavg(),
    cache:   C.stats(),
  });
});

export default router;
