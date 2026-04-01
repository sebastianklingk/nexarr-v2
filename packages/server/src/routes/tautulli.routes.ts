import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as tautulliService from '../services/tautulli.service.js';

const router = Router();
const H = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

// ── Live / Dashboard ──────────────────────────────────────────────────────────

router.get('/activity', requireAuth, H(async (_req, res) => {
  res.json(await tautulliService.getActivity());
}));

router.get('/stats', requireAuth, H(async (_req, res) => {
  res.json(await tautulliService.getHomeStats());
}));

// History (für Dashboard-Widget)
// ?count=20 optional
router.get('/history', requireAuth, H(async (req, res) => {
  const count = Number(req.query.count) || 20;
  res.json(await tautulliService.getHistory(count));
}));

// ── Item-spezifische Endpunkte (für Detail-Views) ─────────────────────────────

// Play-History für einen Film (Suche via Titel + optionale tmdbId)
// GET /api/tautulli/movie-history?title=XYZ&tmdbId=123
router.get('/movie-history', requireAuth, H(async (req, res) => {
  const title  = (req.query.title as string)?.trim();
  const tmdbId = req.query.tmdbId ? Number(req.query.tmdbId) : undefined;
  if (!title) { res.status(400).json({ error: 'title required' }); return; }
  res.json(await tautulliService.getMovieHistory(title, tmdbId));
}));

// User-Statistiken für ein Plex-Item (via rating_key)
// GET /api/tautulli/user-stats?rating_key=12345
router.get('/user-stats', requireAuth, H(async (req, res) => {
  const ratingKey = (req.query.rating_key as string)?.trim();
  if (!ratingKey) { res.status(400).json({ error: 'rating_key required' }); return; }
  res.json(await tautulliService.getUserStatsForItem(ratingKey));
}));

// Plex-Metadata für ein Item
// GET /api/tautulli/metadata?rating_key=12345
router.get('/metadata', requireAuth, H(async (req, res) => {
  const ratingKey = (req.query.rating_key as string)?.trim();
  if (!ratingKey) { res.status(400).json({ error: 'rating_key required' }); return; }
  res.json(await tautulliService.getMetadata(ratingKey));
}));

// Rating Key für einen Film finden (für Client-seitigen Lookup)
// GET /api/tautulli/find-key?title=XYZ
router.get('/find-key', requireAuth, H(async (req, res) => {
  const title = (req.query.title as string)?.trim();
  if (!title) { res.status(400).json({ error: 'title required' }); return; }
  const key = await tautulliService.findMovieRatingKey(title);
  res.json({ rating_key: key });
}));

export default router;
