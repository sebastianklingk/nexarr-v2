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

// TMDB-ID via TVDB-ID (für Sonarr-Serien) – inkl. Ratings, Credits, Videos
router.get('/find/tvdb/:tvdbId', requireAuth, async (req, res, next) => {
  try {
    const tmdbId = await tmdbService.findTmdbIdByTvdbId(Number(req.params.tvdbId));
    if (!tmdbId) { res.status(404).json({ error: 'Nicht gefunden' }); return; }
    // getTvDetails hat append_to_response=credits → ein API-Call für Details + Credits
    const [details, videos] = await Promise.all([
      tmdbService.getTvDetails(tmdbId),
      tmdbService.getSeriesVideos(tmdbId),
    ]);
    const d = details as any;
    res.json({
      tmdbId,
      credits:     d.credits ?? null,
      videos,
      // Ratings-Felder direkt auf Root-Level für einfachen Frontend-Zugriff
      vote_average: d.vote_average ?? null,
      vote_count:   d.vote_count   ?? null,
    });
  } catch (e) { next(e); }
});

// ── Discover / Trending ───────────────────────────────────────────────────

// GET /api/tmdb/trending?type=movie|tv&window=week|day
router.get('/trending', requireAuth, async (req, res, next) => {
  try {
    const type   = (req.query.type   as 'movie' | 'tv')   ?? 'movie';
    const window = (req.query.window as 'week'  | 'day')  ?? 'week';
    res.json(await tmdbService.getTrending(type, window));
  } catch (e) { next(e); }
});

// GET /api/tmdb/discover?type=movie|tv&genre=28&min_rating=6&min_votes=100&sort_by=popularity.desc
router.get('/discover', requireAuth, async (req, res, next) => {
  try {
    const type = (req.query.type as 'movie' | 'tv') ?? 'movie';
    res.json(await tmdbService.discover(type, {
      genre:      req.query.genre      as string | undefined,
      min_rating: req.query.min_rating ? Number(req.query.min_rating) : undefined,
      min_votes:  req.query.min_votes  ? Number(req.query.min_votes)  : undefined,
      sort_by:    req.query.sort_by    as string | undefined,
      page:       req.query.page       ? Number(req.query.page)       : undefined,
    }));
  } catch (e) { next(e); }
});

// GET /api/tmdb/movie/:tmdbId  – Vollständige Film-Details + Credits
router.get('/movie/:tmdbId', requireAuth, async (req, res, next) => {
  try {
    res.json(await tmdbService.getMovieDetails(Number(req.params.tmdbId)));
  } catch (e) { next(e); }
});

// GET /api/tmdb/movie/:tmdbId/similar
router.get('/movie/:tmdbId/similar', requireAuth, async (req, res, next) => {
  try {
    res.json(await tmdbService.getSimilarMovies(Number(req.params.tmdbId)));
  } catch (e) { next(e); }
});

// GET /api/tmdb/tv/:tmdbId  – Vollständige Serien-Details + Credits
router.get('/tv/:tmdbId', requireAuth, async (req, res, next) => {
  try {
    res.json(await tmdbService.getTvDetails(Number(req.params.tmdbId)));
  } catch (e) { next(e); }
});

// GET /api/tmdb/tv/:tmdbId/similar
router.get('/tv/:tmdbId/similar', requireAuth, async (req, res, next) => {
  try {
    res.json(await tmdbService.getSimilarTv(Number(req.params.tmdbId)));
  } catch (e) { next(e); }
});

export { router as tmdbRouter };
