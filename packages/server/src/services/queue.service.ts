import type { ArrQueueItem, QueueState, SabnzbdState } from '@nexarr/shared';
import * as radarrService from './radarr.service.js';
import * as sonarrService from './sonarr.service.js';
import * as lidarrService from './lidarr.service.js';
import * as sabnzbdService from './sabnzbd.service.js';

// ── Raw Arr Queue Record (lose getippt, da externe API) ────────────────────────

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
    };
  });
}

// ── Aggregated Queue ──────────────────────────────────────────────────────────

export async function getAggregatedQueue(): Promise<QueueState> {
  const [radarrResult, sonarrResult, lidarrResult, sabnzbdResult] =
    await Promise.allSettled([
      radarrService.getQueue()  as Promise<ArrQueueResponse>,
      sonarrService.getQueue()  as Promise<ArrQueueResponse>,
      lidarrService.getQueue()  as Promise<ArrQueueResponse>,
      sabnzbdService.getQueue() as Promise<SabnzbdState>,
    ]);

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

  const sabnzbd: SabnzbdState | null =
    sabnzbdResult.status === 'fulfilled' ? sabnzbdResult.value : null;

  const totalCount =
    arrItems.length + (sabnzbd?.slotCount ?? 0);

  return { arrItems, sabnzbd, totalCount, updatedAt: Date.now() };
}
