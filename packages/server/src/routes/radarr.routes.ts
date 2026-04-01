import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as radarrService from '../services/radarr.service.js';

const router = Router();
const H = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

// ── Read ──────────────────────────────────────────────────────────────────────

router.get('/movies', requireAuth, H(async (_req, res) => {
  res.json(await radarrService.getMovies());
}));

router.get('/movies/:id', requireAuth, H(async (req, res) => {
  res.json(await radarrService.getMovie(Number(req.params.id)));
}));

router.get('/queue', requireAuth, H(async (_req, res) => {
  res.json(await radarrService.getQueue());
}));

router.get('/lookup', requireAuth, H(async (req, res) => {
  const term = (req.query.term as string)?.trim();
  if (!term) { res.json([]); return; }
  res.json(await radarrService.lookup(term));
}));

router.get('/rootfolders', requireAuth, H(async (_req, res) => {
  res.json(await radarrService.getRootFolders());
}));

router.get('/status', requireAuth, H(async (_req, res) => {
  res.json(await radarrService.getStatus());
}));

// Besetzung (für MovieDetailView-Fallback wenn TMDB nicht verfügbar)
router.get('/credits/:metaId', requireAuth, H(async (req, res) => {
  res.json(await radarrService.getCredits(Number(req.params.metaId)));
}));

// Interactive Search: Releases für einen Film laden
router.get('/release', requireAuth, H(async (req, res) => {
  const movieId = Number(req.query.movieId);
  if (!movieId) { res.status(400).json({ error: 'movieId required' }); return; }
  res.json(await radarrService.getReleases(movieId));
}));

// ── Write / Actions ───────────────────────────────────────────────────────────

router.post('/movies', requireAuth, H(async (req, res) => {
  res.json(await radarrService.addMovie(req.body as Record<string, unknown>));
}));

// Generischer Command-Endpoint (MoviesSearch, RescanMovie, etc.)
router.post('/command', requireAuth, H(async (req, res) => {
  res.json(await radarrService.sendCommand(req.body as Record<string, unknown>));
}));

// Kurzform: Automatische Suche für einen Film
router.post('/movies/:id/search', requireAuth, H(async (req, res) => {
  await radarrService.triggerSearch([Number(req.params.id)]);
  res.json({ ok: true });
}));

// Release herunterladen (Interactive Search)
router.post('/release', requireAuth, H(async (req, res) => {
  const { guid, indexerId } = req.body as { guid: string; indexerId: number };
  if (!guid || !indexerId) { res.status(400).json({ error: 'guid and indexerId required' }); return; }
  res.json(await radarrService.downloadRelease({ guid, indexerId }));
}));

// monitored-Toggle + sonstige Updates
router.put('/movies/:id', requireAuth, H(async (req, res) => {
  res.json(await radarrService.updateMovie(Number(req.params.id), req.body));
}));

// Film löschen
router.delete('/movies/:id', requireAuth, H(async (req, res) => {
  const deleteFiles = req.query.deleteFiles === 'true';
  await radarrService.deleteMovie(Number(req.params.id), deleteFiles);
  res.json({ ok: true });
}));

export default router;
