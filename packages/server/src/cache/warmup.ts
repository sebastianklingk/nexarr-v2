/**
 * Cache Warmup – wellenartige Vorab-Befüllung des In-Memory-Cache beim Start.
 *
 * Strategie:
 *   Statt alle APIs gleichzeitig zu feuern werden 4 Wellen mit kurzen Pausen dazwischen
 *   gestartet. So werden die wichtigsten Collections (MoviesView, SeriesView, MusicView)
 *   sofort vorgeladen, ohne die anderen Dienste zu überfluten.
 *
 *   Welle 1 (sofort)  → Radarr/Sonarr/Lidarr Collections          (häufigste Views)
 *   Welle 2 (+3s)     → Tautulli, Overseerr, SABnzbd, Gotify       (Dashboard)
 *   Welle 3 (+7s)     → RootFolders, QualityProfiles, Plex, ABS    (statische Metadaten)
 *   Welle 4 (+12s)    → TMDB Trending                               (externer Dienst, zuletzt)
 *
 * Refresh-Timer:
 *   Welle 1 + 2 alle 4 min (vor dem 5-min Collection-TTL)
 *   Welle 3 + 4 nie (TTL.LONG = 30 min reicht völlig)
 *
 * Fehlerverhalten:
 *   Jeder Task schlägt unabhängig fehl. Ein ausgefallener Dienst blockiert
 *   keinen anderen und kein Task bricht den Server-Start ab.
 */

import * as radarrService   from '../services/radarr.service.js';
import * as sonarrService   from '../services/sonarr.service.js';
import * as lidarrService   from '../services/lidarr.service.js';
import * as tautulliService from '../services/tautulli.service.js';
import * as overseerrService from '../services/overseerr.service.js';
import * as sabnzbdService  from '../services/sabnzbd.service.js';
import * as gotifyService   from '../services/gotify.service.js';
import * as plexService     from '../services/plex.service.js';
import * as absService      from '../services/abs.service.js';
import * as bazarrService   from '../services/bazarr.service.js';
import * as prowlarrService from '../services/prowlarr.service.js';
import * as tmdbService     from '../services/tmdb.service.js';
import { env } from '../config/env.js';

// ── Hilfsfunktionen ─────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

interface Task {
  name: string;
  enabled: () => boolean;
  fn: () => Promise<unknown>;
}

async function runWave(waveName: string, tasks: Task[]): Promise<void> {
  const active = tasks.filter(t => t.enabled());
  if (active.length === 0) return;

  const results = await Promise.allSettled(active.map(t => t.fn()));

  let ok = 0;
  const errors: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      ok++;
    } else {
      errors.push(`${active[i].name}: ${(r.reason as Error)?.message ?? String(r.reason)}`);
    }
  });

  const errStr = errors.length > 0 ? ` | ⚠ ${errors.join(', ')}` : '';
  console.log(`   ${waveName}: ✅ ${ok}/${active.length}${errStr}`);
}

// ── Wellen-Definitionen ──────────────────────────────────────────────────────

/** Welle 1: Hauptbibliotheken (sofort) */
const WAVE_1: Task[] = [
  {
    name: 'Radarr · Filme',
    enabled: () => Boolean(env.RADARR_URL && env.RADARR_API_KEY),
    fn: () => radarrService.getMovies(),
  },
  {
    name: 'Sonarr · Serien',
    enabled: () => Boolean(env.SONARR_URL && env.SONARR_API_KEY),
    fn: () => sonarrService.getSeries(),
  },
  {
    name: 'Lidarr · Künstler',
    enabled: () => Boolean(env.LIDARR_URL && env.LIDARR_API_KEY),
    fn: () => lidarrService.getArtists(),
  },
  {
    name: 'Lidarr · Alben',
    enabled: () => Boolean(env.LIDARR_URL && env.LIDARR_API_KEY),
    fn: () => lidarrService.getAlbums(),
  },
];

/** Welle 2: Dashboard-Daten (+3s) */
const WAVE_2: Task[] = [
  {
    name: 'Tautulli · Home-Stats',
    enabled: () => Boolean(env.TAUTULLI_URL && env.TAUTULLI_API_KEY),
    fn: () => tautulliService.getHomeStats(),
  },
  {
    name: 'Tautulli · History',
    enabled: () => Boolean(env.TAUTULLI_URL && env.TAUTULLI_API_KEY),
    fn: () => tautulliService.getHistory(20),
  },
  {
    name: 'Tautulli · Plays by Date',
    enabled: () => Boolean(env.TAUTULLI_URL && env.TAUTULLI_API_KEY),
    fn: () => tautulliService.getPlaysByDate(30),
  },
  {
    name: 'Overseerr · Pending Requests',
    enabled: () => Boolean(env.OVERSEERR_URL && env.OVERSEERR_API_KEY),
    fn: () => overseerrService.getRequests('pending'),
  },
  {
    name: 'Overseerr · Alle Requests',
    enabled: () => Boolean(env.OVERSEERR_URL && env.OVERSEERR_API_KEY),
    fn: () => overseerrService.getRequests('all'),
  },
  {
    name: 'SABnzbd · History',
    enabled: () => Boolean(env.SABNZBD_URL && env.SABNZBD_API_KEY),
    fn: () => sabnzbdService.getHistory(),
  },
  {
    name: 'Gotify · Nachrichten',
    enabled: () => Boolean(env.GOTIFY_URL && env.GOTIFY_TOKEN),
    fn: () => gotifyService.getMessages(40),
  },
  {
    name: 'Prowlarr · Stats',
    enabled: () => Boolean(env.PROWLARR_URL && env.PROWLARR_API_KEY),
    fn: () => prowlarrService.getStats(),
  },
  {
    name: 'Prowlarr · History',
    enabled: () => Boolean(env.PROWLARR_URL && env.PROWLARR_API_KEY),
    fn: () => prowlarrService.getHistory(100),
  },
];

/** Welle 3: Statische Metadaten – ändern sich selten, lange TTL (+7s) */
const WAVE_3: Task[] = [
  {
    name: 'Radarr · Root-Folders',
    enabled: () => Boolean(env.RADARR_URL && env.RADARR_API_KEY),
    fn: () => radarrService.getRootFolders(),
  },
  {
    name: 'Radarr · Quality-Profile',
    enabled: () => Boolean(env.RADARR_URL && env.RADARR_API_KEY),
    fn: () => radarrService.getQualityProfiles(),
  },
  {
    name: 'Sonarr · Root-Folders',
    enabled: () => Boolean(env.SONARR_URL && env.SONARR_API_KEY),
    fn: () => sonarrService.getRootFolders(),
  },
  {
    name: 'Sonarr · Quality-Profile',
    enabled: () => Boolean(env.SONARR_URL && env.SONARR_API_KEY),
    fn: () => sonarrService.getQualityProfiles(),
  },
  {
    name: 'Prowlarr · Indexer',
    enabled: () => Boolean(env.PROWLARR_URL && env.PROWLARR_API_KEY),
    fn: () => prowlarrService.getIndexers(),
  },
  {
    name: 'Plex · Libraries',
    enabled: () => Boolean(env.PLEX_URL && env.PLEX_TOKEN),
    fn: () => plexService.getLibraries(),
  },
  {
    name: 'ABS · Libraries',
    enabled: () => Boolean(env.ABS_URL && env.ABS_TOKEN),
    fn: () => absService.getLibraries(),
  },
  {
    name: 'Bazarr · Status',
    enabled: () => Boolean(env.BAZARR_URL && env.BAZARR_API_KEY),
    fn: () => bazarrService.getStatus(),
  },
  {
    name: 'Gotify · Health',
    enabled: () => Boolean(env.GOTIFY_URL && env.GOTIFY_TOKEN),
    fn: () => gotifyService.getHealth(),
  },
  {
    name: 'Plex · Status',
    enabled: () => Boolean(env.PLEX_URL && env.PLEX_TOKEN),
    fn: () => plexService.getStatus(),
  },
];

/** Welle 4: Externe Dienste – TMDB ist Rate-Limit-sensitiv (+12s) */
const WAVE_4: Task[] = [
  {
    name: 'TMDB · Trending Filme',
    enabled: () => Boolean(env.TMDB_API_KEY),
    fn: () => tmdbService.getTrending('movie', 'week'),
  },
  {
    name: 'TMDB · Trending TV',
    enabled: () => Boolean(env.TMDB_API_KEY),
    fn: () => tmdbService.getTrending('tv', 'week'),
  },
];

// ── Öffentliche API ──────────────────────────────────────────────────────────

/**
 * Führt alle 4 Wellen sequenziell mit Pausen durch.
 * Wird beim Server-Start und vom Refresh-Timer für Welle 1+2 genutzt.
 */
export async function warmCache(wavesToRun: 1 | 2 | 3 | 4 = 4): Promise<void> {
  const totalActive = [...WAVE_1, ...WAVE_2, ...WAVE_3, ...WAVE_4]
    .filter(t => t.enabled()).length;

  if (totalActive === 0) {
    console.log('⚠️  Cache-Warming: Keine Integrationen konfiguriert.');
    return;
  }

  console.log('🔥 Cache-Warming gestartet...');
  const start = Date.now();

  // Welle 1 – sofort
  await runWave('Welle 1 · Bibliotheken', WAVE_1);

  if (wavesToRun >= 2) {
    await delay(3_000);
    await runWave('Welle 2 · Dashboard', WAVE_2);
  }

  if (wavesToRun >= 3) {
    await delay(4_000); // 7s nach Start
    await runWave('Welle 3 · Metadaten', WAVE_3);
  }

  if (wavesToRun >= 4) {
    await delay(5_000); // 12s nach Start
    await runWave('Welle 4 · TMDB', WAVE_4);
  }

  console.log(`🔥 Cache-Warming fertig in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

/**
 * Startet den periodischen Refresh-Timer.
 * Refresht nur Welle 1 + 2 alle 4 Minuten (Collections + Dashboard).
 * Welle 3 + 4 haben lange TTLs (LONG = 30min) und brauchen keinen häufigen Refresh.
 */
export function startCacheRefreshTimer(): void {
  const INTERVAL_MS = 4 * 60 * 1000; // 4 Minuten

  setInterval(async () => {
    console.log('🔄 Cache-Refresh (Welle 1+2)...');
    try {
      await runWave('Welle 1 · Bibliotheken', WAVE_1);
      await delay(2_000);
      await runWave('Welle 2 · Dashboard', WAVE_2);
    } catch (err) {
      console.warn('Cache-Refresh Fehler:', (err as Error)?.message ?? err);
    }
  }, INTERVAL_MS);

  console.log(`⏱️  Cache-Refresh-Timer: alle ${INTERVAL_MS / 60_000} min (Welle 1+2)`);
}
