import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as bazarrService from '../services/bazarr.service.js';

const router = Router();
const H = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

// ── Movie Subtitles ───────────────────────────────────────────────────────────

// Vollständiges Objekt (audio_language, sceneName, provider, filesize, etc.)
router.get('/movies/:radarrId/subtitles/full', requireAuth, H(async (req, res) => {
  const result = await bazarrService.getMovieSubtitlesFull(Number(req.params.radarrId));
  if (!result) { res.status(404).json({ error: 'Film nicht in Bazarr gefunden' }); return; }
  res.json(result);
}));

// Vereinfachtes Objekt (Rückwärtskompatibilität)
router.get('/movies/:radarrId/subtitles', requireAuth, H(async (req, res) => {
  res.json(await bazarrService.getMovieSubtitles(Number(req.params.radarrId)));
}));

// Untertitel-Suche für einzelne Sprache (bestehend)
router.post('/movies/:radarrId/subtitles/search', requireAuth, H(async (req, res) => {
  const { language } = req.body as { language?: string };
  if (language) {
    await bazarrService.triggerMovieSubtitleSearch(Number(req.params.radarrId), language);
  } else {
    // Ohne Sprache = Gesamtsuche
    await bazarrService.searchMovieSubtitles(Number(req.params.radarrId));
  }
  res.json({ ok: true });
}));

// Untertitel löschen
router.delete('/movies/:radarrId/subtitles', requireAuth, H(async (req, res) => {
  const { language, path } = req.query as { language: string; path: string };
  if (!language || !path) { res.status(400).json({ error: 'language and path required' }); return; }
  await bazarrService.deleteMovieSubtitle(Number(req.params.radarrId), language, path);
  res.json({ ok: true });
}));

// ── Episode Subtitles ─────────────────────────────────────────────────────────

// Alle Episode-Untertitel einer Serie (parallel beim Serien-Detail geladen)
router.get('/series/:sonarrSeriesId/episodes', requireAuth, H(async (req, res) => {
  res.json(await bazarrService.getEpisodeSubtitlesBySeries(Number(req.params.sonarrSeriesId)));
}));

// Untertitel-Suche für einzelne Episode
router.post('/episodes/:episodeId/subtitles/search', requireAuth, H(async (req, res) => {
  await bazarrService.searchEpisodeSubtitles(Number(req.params.episodeId));
  res.json({ ok: true });
}));

// Episode-Untertitel löschen
router.delete('/episodes/:episodeId/subtitles', requireAuth, H(async (req, res) => {
  const { language, path } = req.query as { language: string; path: string };
  if (!language || !path) { res.status(400).json({ error: 'language and path required' }); return; }
  await bazarrService.deleteEpisodeSubtitle(Number(req.params.episodeId), language, path);
  res.json({ ok: true });
}));

// ── System ────────────────────────────────────────────────────────────────────

router.get('/status', requireAuth, H(async (_req, res) => {
  res.json(await bazarrService.getStatus());
}));

export { router as bazarrRouter };
