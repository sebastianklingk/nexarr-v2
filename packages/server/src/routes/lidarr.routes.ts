import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as lidarrService from '../services/lidarr.service.js';

const router = Router();

router.get('/artists', requireAuth, async (_req, res, next) => {
  try { res.json(await lidarrService.getArtists()); } catch (e) { next(e); }
});

router.get('/artists/:id', requireAuth, async (req, res, next) => {
  try { res.json(await lidarrService.getArtist(Number(req.params.id))); } catch (e) { next(e); }
});

router.get('/albums', requireAuth, async (_req, res, next) => {
  try { res.json(await lidarrService.getAlbums()); } catch (e) { next(e); }
});

router.get('/queue', requireAuth, async (_req, res, next) => {
  try { res.json(await lidarrService.getQueue()); } catch (e) { next(e); }
});

router.get('/albums/:id/tracks', requireAuth, async (req, res, next) => {
  try { res.json(await lidarrService.getAlbumTracks(Number(req.params.id))); } catch (e) { next(e); }
});

router.post('/artists/:id/search', requireAuth, async (req, res, next) => {
  try {
    await lidarrService.triggerSearch(Number(req.params.id));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
