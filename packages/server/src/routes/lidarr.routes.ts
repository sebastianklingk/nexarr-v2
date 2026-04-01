import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as lidarrService from '../services/lidarr.service.js';

const router = Router();
const H = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

// ── Read ──────────────────────────────────────────────────────────────────────

router.get('/artists', requireAuth, H(async (_req, res) => {
  res.json(await lidarrService.getArtists());
}));

router.get('/artists/:id', requireAuth, H(async (req, res) => {
  res.json(await lidarrService.getArtist(Number(req.params.id)));
}));

// Alle Alben (für MusicStore / Dashboard)
router.get('/albums', requireAuth, H(async (_req, res) => {
  res.json(await lidarrService.getAlbums());
}));

// Alben eines Artists (für ArtistDetailView)
router.get('/artists/:id/albums', requireAuth, H(async (req, res) => {
  res.json(await lidarrService.getAlbumsByArtist(Number(req.params.id)));
}));

// Tracks eines Albums – über albumId
router.get('/albums/:id/tracks', requireAuth, H(async (req, res) => {
  res.json(await lidarrService.getAlbumTracks(Number(req.params.id)));
}));

// Tracks über artistId+albumId (v1-kompatibel: GET /api/lidarr/tracks?artistId=X&albumId=Y)
router.get('/tracks', requireAuth, H(async (req, res) => {
  const albumId  = Number(req.query.albumId);
  if (!albumId) { res.status(400).json({ error: 'albumId required' }); return; }
  // artistId optional – wenn nicht angegeben, nur albumId nutzen
  const artistId = req.query.artistId ? Number(req.query.artistId) : undefined;
  if (artistId) {
    res.json(await lidarrService.getTracksByArtistAlbum(artistId, albumId));
  } else {
    res.json(await lidarrService.getAlbumTracks(albumId));
  }
}));

router.get('/queue', requireAuth, H(async (_req, res) => {
  res.json(await lidarrService.getQueue());
}));

// ── Write / Actions ───────────────────────────────────────────────────────────

// Generischer Command (ArtistSearch, AlbumSearch, RefreshArtist)
router.post('/command', requireAuth, H(async (req, res) => {
  res.json(await lidarrService.sendCommand(req.body as Record<string, unknown>));
}));

// Kurzform: Künstler-Suche
router.post('/artists/:id/search', requireAuth, H(async (req, res) => {
  await lidarrService.triggerSearch(Number(req.params.id));
  res.json({ ok: true });
}));

// Album updaten (monitored-Toggle)
router.put('/albums/:id', requireAuth, H(async (req, res) => {
  res.json(await lidarrService.updateAlbum(Number(req.params.id), req.body));
}));

// Künstler löschen
router.delete('/artists/:id', requireAuth, H(async (req, res) => {
  const deleteFiles = req.query.deleteFiles === 'true';
  await lidarrService.deleteArtist(Number(req.params.id), deleteFiles);
  res.json({ ok: true });
}));

export default router;
