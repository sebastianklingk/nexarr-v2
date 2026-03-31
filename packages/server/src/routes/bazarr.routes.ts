import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as bazarrService from '../services/bazarr.service.js';

const router = Router();

// Untertitel für einen Film (nach Radarr-ID)
router.get('/movies/:radarrId/subtitles', requireAuth, async (req, res, next) => {
  try {
    const info = await bazarrService.getMovieSubtitles(Number(req.params.radarrId));
    res.json(info);
  } catch (e) { next(e); }
});

// Untertitel-Suche für einen Film anstoßen
router.post('/movies/:radarrId/subtitles/search', requireAuth, async (req, res, next) => {
  try {
    const { language } = req.body as { language: string };
    if (!language) { res.status(400).json({ error: 'language required' }); return; }
    await bazarrService.triggerMovieSubtitleSearch(Number(req.params.radarrId), language);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Untertitel eines Films löschen
router.delete('/movies/:radarrId/subtitles', requireAuth, async (req, res, next) => {
  try {
    const { language, path } = req.query as { language: string; path: string };
    if (!language || !path) { res.status(400).json({ error: 'language and path required' }); return; }
    await bazarrService.deleteMovieSubtitle(Number(req.params.radarrId), language, path);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/status', requireAuth, async (_req, res, next) => {
  try { res.json(await bazarrService.getStatus()); } catch (e) { next(e); }
});

export { router as bazarrRouter };
