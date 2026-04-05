import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as transmissionService from '../services/transmission.service.js';

const router = Router();
const H = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

// ── Queue ─────────────────────────────────────────────────────────────────────

router.get('/queue', requireAuth, H(async (_req, res) => {
  res.json(await transmissionService.getTorrents());
}));

// ── Global Controls ───────────────────────────────────────────────────────────

router.post('/pause', requireAuth, H(async (_req, res) => {
  await transmissionService.pauseAll();
  res.json({ ok: true });
}));

router.post('/resume', requireAuth, H(async (_req, res) => {
  await transmissionService.resumeAll();
  res.json({ ok: true });
}));

// ── Per-Torrent Actions ───────────────────────────────────────────────────────

router.post('/torrent/:hash/pause', requireAuth, H(async (req, res) => {
  await transmissionService.pauseTorrent(req.params['hash'] as string);
  res.json({ ok: true });
}));

router.post('/torrent/:hash/resume', requireAuth, H(async (req, res) => {
  await transmissionService.resumeTorrent(req.params['hash'] as string);
  res.json({ ok: true });
}));

/**
 * DELETE /api/transmission/torrent/:hash
 * Query: ?deleteFiles=true (optional, löscht lokale Dateien)
 */
router.delete('/torrent/:hash', requireAuth, H(async (req, res) => {
  const deleteFiles = req.query.deleteFiles === 'true';
  await transmissionService.deleteTorrent(req.params['hash'] as string, deleteFiles);
  res.json({ ok: true });
}));

export default router;
