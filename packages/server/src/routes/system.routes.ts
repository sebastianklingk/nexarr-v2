import { Router, type Request, type Response, type NextFunction } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { C } from '../cache/cache.js';
import { env } from '../config/env.js';
import axios from 'axios';
import os from 'node:os';

const router = Router();

// GET /api/system/health  – kein Auth (für Docker healthcheck)
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

// GET /api/system/cache
router.get('/cache', requireAuth, (_req: Request, res: Response) => {
  res.json(C.stats());
});

// DELETE /api/system/cache
router.delete('/cache', requireAuth, (_req: Request, res: Response) => {
  C.clear();
  res.json({ ok: true, message: 'Cache geleert' });
});

// DELETE /api/system/cache/:key
router.delete('/cache/:key', requireAuth, (req: Request, res: Response) => {
  C.invalidate(req.params.key as string);
  res.json({ ok: true });
});

// GET /api/system/status
router.get('/status', requireAuth, (_req: Request, res: Response) => {
  res.json({
    uptime:      process.uptime(),
    nodeVersion: process.version,
    platform:    process.platform,
    memory: {
      used:  process.memoryUsage().heapUsed,
      total: process.memoryUsage().heapTotal,
    },
    loadAvg: os.loadavg(),
    cache:   C.stats(),
  });
});

// GET /api/system/integrations – Status aller konfigurierten Integrationen
router.get('/integrations', requireAuth, async (_req: Request, res: Response) => {
  interface IntegrationDef {
    name: string;
    url: string | undefined;
    apiKey: string | undefined;
    testPath: string;
    headers?: Record<string, string>;
    params?: Record<string, string>;
  }

  const integrations: IntegrationDef[] = [
    { name: 'radarr',    url: env.RADARR_URL,    apiKey: env.RADARR_API_KEY,    testPath: '/api/v3/system/status',  headers: { 'X-Api-Key': env.RADARR_API_KEY ?? '' } },
    { name: 'sonarr',   url: env.SONARR_URL,    apiKey: env.SONARR_API_KEY,    testPath: '/api/v3/system/status',  headers: { 'X-Api-Key': env.SONARR_API_KEY ?? '' } },
    { name: 'lidarr',   url: env.LIDARR_URL,    apiKey: env.LIDARR_API_KEY,    testPath: '/api/v1/system/status',  headers: { 'X-Api-Key': env.LIDARR_API_KEY ?? '' } },
    { name: 'prowlarr', url: env.PROWLARR_URL,  apiKey: env.PROWLARR_API_KEY,  testPath: '/api/v1/system/status',  headers: { 'X-Api-Key': env.PROWLARR_API_KEY ?? '' } },
    { name: 'sabnzbd',  url: env.SABNZBD_URL,   apiKey: env.SABNZBD_API_KEY,   testPath: '/api',                   params: { output: 'json', apikey: env.SABNZBD_API_KEY ?? '', mode: 'version' } },
    { name: 'tautulli', url: env.TAUTULLI_URL,  apiKey: env.TAUTULLI_API_KEY,  testPath: '/api/v2',                params: { apikey: env.TAUTULLI_API_KEY ?? '', cmd: 'get_server_info' } },
    { name: 'overseerr',url: env.OVERSEERR_URL, apiKey: env.OVERSEERR_API_KEY, testPath: '/api/v1/status',         headers: { 'X-Api-Key': env.OVERSEERR_API_KEY ?? '' } },
    { name: 'bazarr',   url: env.BAZARR_URL,    apiKey: env.BAZARR_API_KEY,    testPath: '/api/system/status',     headers: { 'X-Api-Key': env.BAZARR_API_KEY ?? '' } },
    { name: 'gotify',   url: env.GOTIFY_URL,    apiKey: env.GOTIFY_TOKEN,      testPath: '/health',                headers: { 'X-Gotify-Key': env.GOTIFY_TOKEN ?? '' } },
    { name: 'plex',     url: env.PLEX_URL,      apiKey: env.PLEX_TOKEN,        testPath: '/',                      params: { 'X-Plex-Token': env.PLEX_TOKEN ?? '' } },
    { name: 'abs',      url: env.ABS_URL,       apiKey: env.ABS_TOKEN,         testPath: '/ping',                  headers: { Authorization: `Bearer ${env.ABS_TOKEN ?? ''}` } },
  ];

  const results = await Promise.all(
    integrations.map(async (i) => {
      if (!i.url || !i.apiKey) {
        return { name: i.name, status: 'unconfigured' as const, version: null, url: i.url ?? null };
      }
      try {
        const { data } = await axios.get(`${i.url}${i.testPath}`, {
          headers: i.headers,
          params:  i.params,
          timeout: 5_000,
        });
        // Verschiedene Version-Felder je nach Service
        const version =
          data?.version ??                          // Radarr/Sonarr/Lidarr/Prowlarr/Bazarr
          data?.response?.data?.version ??          // Tautulli
          data?.MediaContainer?.version ??          // Plex
          (data?.health ? 'OK' : null) ??           // Gotify
          (data?.success ? 'OK' : null) ??          // ABS
          null;
        return { name: i.name, status: 'online' as const, version, url: i.url };
      } catch {
        return { name: i.name, status: 'offline' as const, version: null, url: i.url };
      }
    })
  );

  res.json(results);
});

// GET /api/system/integrations/:name – Einzelne Integration testen
router.get('/integrations/:name', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  const name = req.params.name as string;

  const defs: Record<string, { url: string | undefined; apiKey: string | undefined; testPath: string; headers?: Record<string, string>; params?: Record<string, string> }> = {
    radarr:    { url: env.RADARR_URL,    apiKey: env.RADARR_API_KEY,    testPath: '/api/v3/system/status', headers: { 'X-Api-Key': env.RADARR_API_KEY ?? '' } },
    sonarr:    { url: env.SONARR_URL,    apiKey: env.SONARR_API_KEY,    testPath: '/api/v3/system/status', headers: { 'X-Api-Key': env.SONARR_API_KEY ?? '' } },
    lidarr:    { url: env.LIDARR_URL,    apiKey: env.LIDARR_API_KEY,    testPath: '/api/v1/system/status', headers: { 'X-Api-Key': env.LIDARR_API_KEY ?? '' } },
    prowlarr:  { url: env.PROWLARR_URL,  apiKey: env.PROWLARR_API_KEY,  testPath: '/api/v1/system/status', headers: { 'X-Api-Key': env.PROWLARR_API_KEY ?? '' } },
    sabnzbd:   { url: env.SABNZBD_URL,   apiKey: env.SABNZBD_API_KEY,   testPath: '/api', params: { output: 'json', apikey: env.SABNZBD_API_KEY ?? '', mode: 'version' } },
    tautulli:  { url: env.TAUTULLI_URL,  apiKey: env.TAUTULLI_API_KEY,  testPath: '/api/v2', params: { apikey: env.TAUTULLI_API_KEY ?? '', cmd: 'get_server_info' } },
    overseerr: { url: env.OVERSEERR_URL, apiKey: env.OVERSEERR_API_KEY, testPath: '/api/v1/status', headers: { 'X-Api-Key': env.OVERSEERR_API_KEY ?? '' } },
    bazarr:    { url: env.BAZARR_URL,    apiKey: env.BAZARR_API_KEY,    testPath: '/api/system/status', headers: { 'X-Api-Key': env.BAZARR_API_KEY ?? '' } },
    gotify:    { url: env.GOTIFY_URL,    apiKey: env.GOTIFY_TOKEN,      testPath: '/health', headers: { 'X-Gotify-Key': env.GOTIFY_TOKEN ?? '' } },
    plex:      { url: env.PLEX_URL,      apiKey: env.PLEX_TOKEN,        testPath: '/', params: { 'X-Plex-Token': env.PLEX_TOKEN ?? '' } },
    abs:       { url: env.ABS_URL,       apiKey: env.ABS_TOKEN,         testPath: '/ping', headers: { Authorization: `Bearer ${env.ABS_TOKEN ?? ''}` } },
  };

  const def = defs[name];
  if (!def) { res.status(404).json({ error: 'Unknown integration' }); return; }
  if (!def.url || !def.apiKey) {
    res.json({ name, status: 'unconfigured', version: null, url: def.url ?? null });
    return;
  }

  try {
    const { data } = await axios.get(`${def.url}${def.testPath}`, {
      headers: def.headers,
      params:  def.params,
      timeout: 5_000,
    });
    const version =
      data?.version ??
      data?.response?.data?.version ??
      data?.MediaContainer?.version ??
      (data?.health ? 'OK' : null) ??
      (data?.success ? 'OK' : null) ??
      null;
    res.json({ name, status: 'online', version, url: def.url });
  } catch {
    res.json({ name, status: 'offline', version: null, url: def.url });
  }
});

export default router;
