import type {
  ArrQueueItem,
  QueueState,
  SabnzbdState,
  NormalizedSlot,
  DownloaderSummary,
} from '@nexarr/shared';
import { env } from '../config/env.js';
import * as radarrService from './radarr.service.js';
import * as sonarrService from './sonarr.service.js';
import * as lidarrService from './lidarr.service.js';
import * as sabnzbdService from './sabnzbd.service.js';
import * as transmissionService from './transmission.service.js';

// ── Raw Arr Queue Record ───────────────────────────────────────────────────────

interface RawArrRecord {
  id?: number;
  title?: string;
  size?: number;
  sizeleft?: number;
  status?: string;
  trackedDownloadState?: string;
  protocol?: string;
  indexer?: string;
  timeleft?: string;
  errorMessage?: string;
  // Extended fields
  downloadId?: string;
  downloadClient?: string;
  downloadClientName?: string;
  quality?: { quality?: { name?: string } };
  languages?: Array<{ id?: number; name?: string }>;
  customFormats?: Array<{ id?: number; name?: string }>;
  movieId?: number;
  seriesId?: number;
  artistId?: number;
  // Nested objects (wenn includeSeries/includeEpisode/includeMovie aktiv)
  movie?: { title?: string };
  series?: { title?: string };
  episode?: { title?: string; seasonNumber?: number; episodeNumber?: number };
  artist?: { artistName?: string };
  album?: { title?: string };
}

interface ArrQueueResponse {
  records?: RawArrRecord[];
  totalRecords?: number;
}

// ── Mapper: Raw Arr → ArrQueueItem ────────────────────────────────────────────

function mapArrQueue(
  raw: RawArrRecord[],
  app: 'radarr' | 'sonarr' | 'lidarr',
): ArrQueueItem[] {
  return raw.map((item) => {
    const size     = item.size ?? 0;
    const sizeleft = item.sizeleft ?? 0;
    const progress = size > 0
      ? Math.round(((size - sizeleft) / size) * 100)
      : 0;

    // Medien-Titel aus den nested Objects extrahieren
    let mediaTitle: string | undefined;
    let episodeLabel: string | undefined;

    if (app === 'radarr' && item.movie?.title) {
      mediaTitle = item.movie.title;
    } else if (app === 'sonarr') {
      if (item.series?.title) mediaTitle = item.series.title;
      if (item.episode) {
        const sn = item.episode.seasonNumber;
        const en = item.episode.episodeNumber;
        const epTitle = item.episode.title;
        if (sn !== undefined && en !== undefined) {
          episodeLabel = `S${String(sn).padStart(2,'0')}E${String(en).padStart(2,'0')}`;
          if (epTitle) episodeLabel += ` \u00b7 ${epTitle}`;
        }
      }
    } else if (app === 'lidarr') {
      if (item.artist?.artistName) mediaTitle = item.artist.artistName;
    }

    return {
      id:                   item.id ?? 0,
      title:                item.title ?? 'Unbekannt',
      size,
      sizeleft,
      progress,
      status:               item.status ?? 'unknown',
      trackedDownloadState: item.trackedDownloadState ?? '',
      protocol:             item.protocol ?? '',
      indexer:              item.indexer,
      timeleft:             item.timeleft,
      errorMessage:         item.errorMessage,
      app,
      // Extended
      downloadId:           item.downloadId,
      quality:              item.quality?.quality?.name,
      languages:            item.languages?.map(l => l.name).filter((n): n is string => !!n),
      customFormats:        item.customFormats?.map(cf => cf.name).filter((n): n is string => !!n),
      downloadClientName:   item.downloadClientName ?? item.downloadClient,
      mediaTitle,
      episodeLabel,
      movieId:              item.movieId,
      seriesId:             item.seriesId,
      artistId:             item.artistId,
    };
  });
}

// ── SABnzbd Normalisierung ────────────────────────────────────────────────────

function normalizeSabStatus(s: string): NormalizedSlot['status'] {
  const t = s.toLowerCase();
  if (t === 'downloading') return 'downloading';
  if (t === 'paused') return 'paused';
  if (t === 'completed') return 'completed';
  if (t === 'queued' || t === 'grabbing') return 'queued';
  if (t === 'failed') return 'error';
  return 'queued';
}

function normalizeSabnzbd(state: SabnzbdState): NormalizedSlot[] {
  return state.slots.map(slot => ({
    id:            `sabnzbd:${slot.nzo_id}`,
    nativeId:      slot.nzo_id,
    downloader:    'sabnzbd' as const,
    filename:      slot.filename,
    status:        normalizeSabStatus(slot.status),
    percentage:    slot.percentage,
    mbTotal:       slot.mbTotal,
    mbLeft:        slot.mbLeft,
    // SABnzbd gibt nur globale Speed – pro Slot nicht verfügbar
    speedMbs:      undefined,
    timeleft:      slot.timeleft || undefined,
    category:      slot.cat || undefined,
    priority:      slot.priority,
    encrypted:     !!(slot.password && slot.status.toLowerCase() === 'paused'),
    password:      slot.password || undefined,
    canPause:      true,
    canMoveToTop:  true,
    canSetPriority: true,
  }));
}

function sabDownloaderSummary(state: SabnzbdState): DownloaderSummary {
  return {
    type:         'sabnzbd',
    name:         'SABnzbd',
    cssVar:       '--sabnzbd',
    isAvailable:  true,
    paused:       state.paused,
    speedMbs:     state.speedMbs,
    totalMb:      state.mbTotal,
    leftMb:       state.mbLeft,
    slotCount:    state.slotCount,
  };
}

function transmissionDownloaderSummary(
  slots: NormalizedSlot[],
  stats: { speedMbs: number; totalMb: number; leftMb: number; paused: boolean },
): DownloaderSummary {
  return {
    type:         'transmission',
    name:         'Transmission',
    cssVar:       '--transmission',
    isAvailable:  true,
    paused:       stats.paused,
    speedMbs:     stats.speedMbs,
    totalMb:      stats.totalMb,
    leftMb:       stats.leftMb,
    slotCount:    slots.length,
  };
}

// ── Aggregated Queue ──────────────────────────────────────────────────────────

export async function getAggregatedQueue(): Promise<QueueState> {
  // Arr-Services immer abfragen
  const arrPromises = Promise.allSettled([
    radarrService.getQueue()  as Promise<ArrQueueResponse>,
    sonarrService.getQueue()  as Promise<ArrQueueResponse>,
    lidarrService.getQueue()  as Promise<ArrQueueResponse>,
  ]);

  // SABnzbd nur wenn konfiguriert
  const sabPromise = env.SABNZBD_URL
    ? sabnzbdService.getQueue() as Promise<SabnzbdState>
    : Promise.resolve(null);

  // Transmission nur wenn konfiguriert
  const transmissionPromise = env.TRANSMISSION_URL
    ? Promise.allSettled([
        transmissionService.getNormalizedSlots(),
        transmissionService.getGlobalStats(),
      ])
    : Promise.resolve(null);

  const [[radarrResult, sonarrResult, lidarrResult], sabResult, transmissionResult] =
    await Promise.all([arrPromises, sabPromise.catch(() => null), transmissionPromise]);

  // ── Arr Items ──────────────────────────────────────────────────────────────
  const arrItems: ArrQueueItem[] = [];

  if (radarrResult.status === 'fulfilled') {
    arrItems.push(...mapArrQueue(radarrResult.value.records ?? [], 'radarr'));
  }
  if (sonarrResult.status === 'fulfilled') {
    arrItems.push(...mapArrQueue(sonarrResult.value.records ?? [], 'sonarr'));
  }
  if (lidarrResult.status === 'fulfilled') {
    arrItems.push(...mapArrQueue(lidarrResult.value.records ?? [], 'lidarr'));
  }

  // ── SABnzbd ────────────────────────────────────────────────────────────────
  const sabnzbd: SabnzbdState | null = sabResult;
  const sabSlots: NormalizedSlot[] = sabnzbd ? normalizeSabnzbd(sabnzbd) : [];
  const sabSummary: DownloaderSummary | null = sabnzbd ? sabDownloaderSummary(sabnzbd) : null;

  // ── Transmission ───────────────────────────────────────────────────────────
  let transmissionSlots: NormalizedSlot[] = [];
  let transmissionSummary: DownloaderSummary | null = null;

  if (transmissionResult && Array.isArray(transmissionResult)) {
    const [slotsResult, statsResult] = transmissionResult as [
      PromiseSettledResult<NormalizedSlot[]>,
      PromiseSettledResult<{ speedMbs: number; totalMb: number; leftMb: number; paused: boolean }>,
    ];
    if (slotsResult.status === 'fulfilled') {
      transmissionSlots = slotsResult.value;
    }
    if (slotsResult.status === 'fulfilled' && statsResult.status === 'fulfilled') {
      transmissionSummary = transmissionDownloaderSummary(transmissionSlots, statsResult.value);
    }
  }

  // ── Aggregation ────────────────────────────────────────────────────────────
  const slots: NormalizedSlot[] = [...sabSlots, ...transmissionSlots];
  const downloaders: DownloaderSummary[] = [
    ...(sabSummary ? [sabSummary] : []),
    ...(transmissionSummary ? [transmissionSummary] : []),
  ];

  const totalCount = arrItems.length + slots.length;

  return {
    arrItems,
    sabnzbd,           // backward-compat für Dashboard-Widgets
    slots,
    downloaders,
    totalCount,
    updatedAt: Date.now(),
  };
}
