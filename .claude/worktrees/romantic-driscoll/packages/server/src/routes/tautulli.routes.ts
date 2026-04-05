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

router.get('/stats', requireAuth, H(async (req, res) => {
  const timeRange = Number(req.query.time_range) || 30;
  const statsCount = Number(req.query.stats_count) || 5;
  res.json(await tautulliService.getHomeStats(timeRange, statsCount));
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

// Plays per Tag (letzte N Tage) für Timeline-Chart
// GET /api/tautulli/plays-by-date?time_range=30
router.get('/plays-by-date', requireAuth, H(async (req, res) => {
  const timeRange = Number(req.query.time_range) || 30;
  res.json(await tautulliService.getPlaysByDate(timeRange));
}));

// Plex-Image Proxy (für Stream-Poster in StreamsView)
// GET /api/tautulli/plex-image?img=/library/metadata/12345/thumb&width=120&height=180
router.get('/plex-image', requireAuth, H(async (req, res) => {
  const img    = req.query.img as string;
  const width  = Number(req.query.width) || 200;
  const height = Number(req.query.height) || 300;
  if (!img) { res.status(400).json({ error: 'img required' }); return; }
  const imageData = await tautulliService.getPlexImage(img, width, height);
  if (!imageData) { res.status(404).end(); return; }
  res.set('Content-Type', 'image/jpeg');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(imageData);
}));

// ── Grafiken ───────────────────────────────────────────────────────────────────

router.get('/plays-by-dayofweek', requireAuth, H(async (req, res) => {
  const timeRange = Number(req.query.time_range) || 30;
  res.json(await tautulliService.getPlaysByDayOfWeek(timeRange));
}));

router.get('/plays-by-hourofday', requireAuth, H(async (req, res) => {
  const timeRange = Number(req.query.time_range) || 30;
  res.json(await tautulliService.getPlaysByHourOfDay(timeRange));
}));

router.get('/plays-by-top-platforms', requireAuth, H(async (req, res) => {
  const timeRange = Number(req.query.time_range) || 30;
  res.json(await tautulliService.getPlaysByTopPlatforms(timeRange));
}));

router.get('/plays-by-top-users', requireAuth, H(async (req, res) => {
  const timeRange = Number(req.query.time_range) || 30;
  res.json(await tautulliService.getPlaysByTopUsers(timeRange));
}));

router.get('/stream-type-by-top-platforms', requireAuth, H(async (req, res) => {
  const timeRange = Number(req.query.time_range) || 30;
  res.json(await tautulliService.getStreamTypeByTopPlatforms(timeRange));
}));

router.get('/stream-type-by-top-users', requireAuth, H(async (req, res) => {
  const timeRange = Number(req.query.time_range) || 30;
  res.json(await tautulliService.getStreamTypeByTopUsers(timeRange));
}));

// ── Bibliotheken ───────────────────────────────────────────────────────────────

router.get('/libraries-table', requireAuth, H(async (_req, res) => {
  res.json(await tautulliService.getLibrariesTable());
}));

// ── Erweiterte History (mit Filtern, Pagination, Suche) ─────────────────────

router.get('/history-filtered', requireAuth, H(async (req, res) => {
  res.json(await tautulliService.getHistoryFiltered({
    length:              Number(req.query.length) || 25,
    start:               Number(req.query.start) || 0,
    media_type:          (req.query.media_type as string) || undefined,
    transcode_decision:  (req.query.transcode_decision as string) || undefined,
    search:              (req.query.search as string) || undefined,
    order_column:        (req.query.order_column as string) || undefined,
    order_dir:           (req.query.order_dir as string) || undefined,
    user:                (req.query.user as string) || undefined,
  }));
}));

// ── User-Liste ───────────────────────────────────────────────────────────────

router.get('/users', requireAuth, H(async (_req, res) => {
  res.json(await tautulliService.getUsers());
}));

export default router;
