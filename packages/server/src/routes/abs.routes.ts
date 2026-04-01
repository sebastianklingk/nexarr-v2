import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as absService from '../services/abs.service.js';

const router = Router();

// Libraries
router.get('/libraries', requireAuth, async (_req, res, next) => {
  try { res.json(await absService.getLibraries()); } catch (e) { next(e); }
});

// Library-Items (paginiert)
router.get('/libraries/:libraryId/items', requireAuth, async (req, res, next) => {
  try {
    const libraryId = req.params.libraryId as string;
    const limit = Number(req.query.limit ?? 40);
    const page  = Number(req.query.page  ?? 0);
    res.json(await absService.getLibraryItems(libraryId, limit, page));
  } catch (e) { next(e); }
});

// Suche innerhalb einer Library
router.get('/libraries/:libraryId/search', requireAuth, async (req, res, next) => {
  try {
    const libraryId = req.params.libraryId as string;
    const q = (req.query.q as string ?? '').trim();
    if (!q) { res.json([]); return; }
    res.json(await absService.searchItems(libraryId, q));
  } catch (e) { next(e); }
});

// Single Item
router.get('/items/:itemId', requireAuth, async (req, res, next) => {
  try {
    const itemId = req.params.itemId as string;
    res.json(await absService.getItem(itemId));
  } catch (e) { next(e); }
});

// Cover-Proxy (leitet Cover-Bild von ABS weiter, mit Auth-Header)
router.get('/items/:itemId/cover', requireAuth, async (req, res, next) => {
  try {
    const itemId = req.params.itemId as string;
    const { env } = await import('../config/env.js');
    if (!env.ABS_URL || !env.ABS_TOKEN) { res.status(503).end(); return; }
    const axios = (await import('axios')).default;
    const upstream = await axios.get(
      `${env.ABS_URL}/api/items/${itemId}/cover`,
      {
        headers: { Authorization: `Bearer ${env.ABS_TOKEN}` },
        responseType: 'stream',
        timeout: 8000,
      }
    );
    res.setHeader('Content-Type', upstream.headers['content-type'] ?? 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    upstream.data.pipe(res);
  } catch {
    res.status(404).end();
  }
});

// Fortschritt
router.get('/items/:itemId/progress', requireAuth, async (req, res, next) => {
  try {
    const itemId = req.params.itemId as string;
    res.json(await absService.getProgress(itemId));
  } catch (e) { next(e); }
});

// Podcast-Episoden
router.get('/items/:itemId/episodes', requireAuth, async (req, res, next) => {
  try {
    const itemId = req.params.itemId as string;
    res.json(await absService.getPodcastEpisodes(itemId));
  } catch (e) { next(e); }
});

// Status/Ping
router.get('/status', requireAuth, async (_req, res, next) => {
  try { res.json(await absService.getStatus()); } catch (e) { next(e); }
});

export { router as absRouter };
