import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as tmdbService from '../services/tmdb.service.js';

const router = Router();

// Film Credits (Cast + Crew) via TMDB-ID
router.get('/movie/:tmdbId/credits', requireAuth, async (req, res, next) => {
  try {
    res.json(await tmdbService.getMovieCredits(Number(req.params.tmdbId)));
  } catch (e) { next(e); }
});

// Film Videos (Trailer) via TMDB-ID
router.get('/movie/:tmdbId/videos', requireAuth, async (req, res, next) => {
  try {
    res.json(await tmdbService.getMovieVideos(Number(req.params.tmdbId)));
  } catch (e) { next(e); }
});

// Serien Credits via TMDB-ID
router.get('/tv/:tmdbId/credits', requireAuth, async (req, res, next) => {
  try {
    res.json(await tmdbService.getSeriesCredits(Number(req.params.tmdbId)));
  } catch (e) { next(e); }
});

// Serien Videos via TMDB-ID
router.get('/tv/:tmdbId/videos', requireAuth, async (req, res, next) => {
  try {
    res.json(await tmdbService.getSeriesVideos(Number(req.params.tmdbId)));
  } catch (e) { next(e); }
});

// TMDB-ID via TVDB-ID (für Sonarr-Serien)
router.get('/find/tvdb/:tvdbId', requireAuth, async (req, res, next) => {
  try {
    const tmdbId = await tmdbService.findTmdbIdByTvdbId(Number(req.params.tvdbId));
    if (!tmdbId) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
    const [credits, videos] = await Promise.all([
      tmdbService.getSeriesCredits(tmdbId),
      tmdbService.getSeriesVideos(tmdbId),
    ]);
    res.json({ tmdbId, credits, videos });
  } catch (e) { next(e); }
});

export { router as tmdbRouter };
