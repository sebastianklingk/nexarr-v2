import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as sonarrService from '../services/sonarr.service.js';

const router = Router();
const H = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

// ── Read ──────────────────────────────────────────────────────────────────────

router.get('/series', requireAuth, H(async (_req, res) => {
  res.json(await sonarrService.getSeries());
}));

router.get('/series/:id', requireAuth, H(async (req, res) => {
  res.json(await sonarrService.getSeriesById(Number(req.params.id)));
}));

router.get('/series/:id/episodes', requireAuth, H(async (req, res) => {
  res.json(await sonarrService.getEpisodes(Number(req.params.id)));
}));

// Episode-Files mit MediaInfo (für Tech-Badges in SeriesDetailView)
router.get('/series/:id/episodefiles', requireAuth, H(async (req, res) => {
  res.json(await sonarrService.getEpisodeFiles(Number(req.params.id)));
}));

router.get('/queue', requireAuth, H(async (_req, res) => {
  res.json(await sonarrService.getQueue());
}));

router.get('/lookup', requireAuth, H(async (req, res) => {
  const term = (req.query.term as string)?.trim();
  if (!term) { res.json([]); return; }
  res.json(await sonarrService.lookup(term));
}));

router.get('/rootfolders', requireAuth, H(async (_req, res) => {
  res.json(await sonarrService.getRootFolders());
}));

// Interactive Search: Releases für eine Episode laden
router.get('/release', requireAuth, H(async (req, res) => {
  const episodeId = Number(req.query.episodeId);
  if (!episodeId) { res.status(400).json({ error: 'episodeId required' }); return; }
  res.json(await sonarrService.getEpisodeReleases(episodeId));
}));

// ── Write / Actions ───────────────────────────────────────────────────────────

router.post('/series', requireAuth, H(async (req, res) => {
  res.json(await sonarrService.addSeries(req.body as Record<string, unknown>));
}));

// Generischer Command-Endpoint (SeriesSearch, SeasonSearch, EpisodeSearch, RefreshSeries)
router.post('/command', requireAuth, H(async (req, res) => {
  res.json(await sonarrService.sendCommand(req.body as Record<string, unknown>));
}));

// Kurzform: Automatische Suche für eine Serie
router.post('/series/:id/search', requireAuth, H(async (req, res) => {
  await sonarrService.triggerSearch(Number(req.params.id));
  res.json({ ok: true });
}));

// Release herunterladen (Interactive Search)
router.post('/release', requireAuth, H(async (req, res) => {
  const { guid, indexerId } = req.body as { guid: string; indexerId: number };
  if (!guid || !indexerId) { res.status(400).json({ error: 'guid and indexerId required' }); return; }
  res.json(await sonarrService.downloadRelease({ guid, indexerId }));
}));

// Serie updaten (monitored-Toggle, etc.)
router.put('/series/:id', requireAuth, H(async (req, res) => {
  res.json(await sonarrService.updateSeries(Number(req.params.id), req.body));
}));

// Staffel-Überwachung togglen
router.put('/series/:id/season-monitor', requireAuth, H(async (req, res) => {
  const { seasonNumber, monitored } = req.body as { seasonNumber: number; monitored: boolean };
  if (seasonNumber === undefined || monitored === undefined) {
    res.status(400).json({ error: 'seasonNumber and monitored required' }); return;
  }
  res.json(await sonarrService.updateSeasonMonitor(Number(req.params.id), seasonNumber, monitored));
}));

// Episode updaten (monitored-Toggle)
router.put('/episode/:id', requireAuth, H(async (req, res) => {
  res.json(await sonarrService.updateEpisode(Number(req.params.id), req.body));
}));

// Serie löschen
router.delete('/series/:id', requireAuth, H(async (req, res) => {
  const deleteFiles = req.query.deleteFiles === 'true';
  await sonarrService.deleteSeries(Number(req.params.id), deleteFiles);
  res.json({ ok: true });
}));

// Episode-Datei löschen
router.delete('/episodefile/:id', requireAuth, H(async (req, res) => {
  await sonarrService.deleteEpisodeFile(Number(req.params.id));
  res.json({ ok: true });
}));

// Qualitätsprofile (für Discover Hinzufügen-Modal)
router.get('/qualityprofiles', requireAuth, H(async (_req, res) => {
  res.json(await sonarrService.getQualityProfiles());
}));

// Health-Status (für IndexerView)
router.get('/health', requireAuth, H(async (_req, res) => {
  res.json(await sonarrService.getHealth());
}));

// Alle Indexer testen (für IndexerView)
router.post('/indexer/testall', requireAuth, H(async (_req, res) => {
  await sonarrService.testAllIndexers();
  res.json({ ok: true });
}));

// Fehlende Episoden (für Downloads Fehlend-Tab)
router.get('/missing', requireAuth, H(async (req, res) => {
  const pageSize = Number(req.query.pageSize) || 100;
  res.json(await sonarrService.getMissingEpisodes(pageSize));
}));

// History (für Downloads History-Tab)
router.get('/history', requireAuth, H(async (req, res) => {
  const pageSize = Number(req.query.pageSize) || 100;
  res.json(await sonarrService.getHistory(pageSize));
}));

export default router;
