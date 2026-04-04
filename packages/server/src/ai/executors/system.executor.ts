import type { ToolResult } from '../executor.js';
import * as radarr from '../../services/radarr.service.js';
import * as sonarr from '../../services/sonarr.service.js';
import * as lidarr from '../../services/lidarr.service.js';
import * as tautulli from '../../services/tautulli.service.js';
import * as overseerr from '../../services/overseerr.service.js';
import * as prowlarr from '../../services/prowlarr.service.js';
import * as bazarr from '../../services/bazarr.service.js';
import * as abs from '../../services/abs.service.js';
import * as gotify from '../../services/gotify.service.js';
import * as plex from '../../services/plex.service.js';
import * as queue from '../../services/queue.service.js';

type Args = Record<string, unknown>;

// ── Stats ───────────────────────────────────────────────────────────────────

export async function handleStatsOverview(): Promise<ToolResult> {
  const [movies, series, artists, queueState, activity] = await Promise.allSettled([
    radarr.getMovies(),
    sonarr.getSeries(),
    lidarr.getArtists(),
    queue.getAggregatedQueue(),
    tautulli.getActivity(),
  ]);

  return {
    success: true,
    data: {
      library: {
        movies: movies.status === 'fulfilled' ? movies.value.length : 'nicht verfügbar',
        moviesWithFile: movies.status === 'fulfilled' ? movies.value.filter(m => m.hasFile).length : null,
        series: series.status === 'fulfilled' ? series.value.length : 'nicht verfügbar',
        artists: artists.status === 'fulfilled' ? artists.value.length : 'nicht verfügbar',
      },
      downloads: queueState.status === 'fulfilled' ? {
        activeSlots: queueState.value.slots.length,
        downloaders: queueState.value.downloaders.map(d => ({
          name: d.name,
          speedMbs: d.speedMbs ? +d.speedMbs.toFixed(1) : 0,
          slotCount: d.slotCount,
          paused: d.paused,
        })),
      } : 'nicht verfügbar',
      streams: activity.status === 'fulfilled'
        ? { active: (activity.value.sessions || []).length }
        : 'nicht verfügbar',
    },
  };
}

export async function handleSystemHealth(_args: Args): Promise<ToolResult> {
  const checks = await Promise.allSettled([
    radarr.getHealth().then(() => ({ service: 'radarr', status: 'ok' })),
    sonarr.getHealth().then(() => ({ service: 'sonarr', status: 'ok' })),
    plex.getStatus().then(() => ({ service: 'plex', status: 'ok' })),
    bazarr.getStatus().then(() => ({ service: 'bazarr', status: 'ok' })),
    abs.getStatus().then(() => ({ service: 'audiobookshelf', status: 'ok' })),
    gotify.getHealth().then(() => ({ service: 'gotify', status: 'ok' })),
    tautulli.getActivity().then(() => ({ service: 'tautulli', status: 'ok' })),
  ]);

  const results = checks.map((c, i) => {
    const names = ['radarr', 'sonarr', 'plex', 'bazarr', 'audiobookshelf', 'gotify', 'tautulli'];
    if (c.status === 'fulfilled') return c.value;
    return { service: names[i], status: 'error', error: c.reason instanceof Error ? c.reason.message : 'Nicht erreichbar' };
  });

  return { success: true, data: { services: results } };
}

// ── Overseerr ───────────────────────────────────────────────────────────────

export async function handleOverseerrRequests(): Promise<ToolResult> {
  const requests = await overseerr.getRequests('pending');
  return {
    success: true,
    data: requests.slice(0, 10).map(r => ({
      id: r.id,
      type: r.type,
      status: r.status,
      title: r.media?.title || 'Unbekannt',
      tmdbId: r.media?.tmdbId,
      requestedBy: r.requestedBy?.displayName || 'Unbekannt',
      createdAt: r.createdAt,
    })),
  };
}

export async function handleOverseerrApprove(args: Args): Promise<ToolResult> {
  await overseerr.approveRequest(Number(args.requestId));
  return { success: true, data: { requestId: args.requestId, action: 'approved' } };
}

export async function handleOverseerrDecline(args: Args): Promise<ToolResult> {
  await overseerr.declineRequest(Number(args.requestId));
  return { success: true, data: { requestId: args.requestId, action: 'declined' } };
}

// ── Prowlarr ────────────────────────────────────────────────────────────────

export async function handleProwlarrSearch(args: Args): Promise<ToolResult> {
  const query = String(args.query || '');
  const typeMap: Record<string, number[]> = {
    movie: [2000],
    tv: [5000],
    music: [6000],
  };
  const categories = typeMap[String(args.type || '')] || [];
  const results = await prowlarr.search(query, categories, 15);
  return {
    success: true,
    data: results.slice(0, 15).map(r => ({
      title: r.title,
      indexer: r.indexer,
      sizeGb: r.size ? +(r.size / 1e9).toFixed(2) : null,
      seeders: r.seeders,
      leechers: r.leechers,
      protocol: r.protocol,
      guid: r.guid,
      indexerId: r.indexerId,
    })),
  };
}

export async function handleProwlarrGrab(args: Args): Promise<ToolResult> {
  const guid = String(args.guid || '');
  const indexerId = Number(args.indexerId);
  if (!guid || !indexerId) return { success: false, error: 'guid und indexerId sind erforderlich' };
  await prowlarr.grab({ guid, indexerId });
  return { success: true, data: { guid, indexerId, action: 'grabbed' } };
}

// ── Bazarr (Untertitel) ─────────────────────────────────────────────────────

export async function handleSubtitlesMovieStatus(args: Args): Promise<ToolResult> {
  const radarrId = Number(args.radarrId);
  if (!radarrId) return { success: false, error: 'radarrId ist erforderlich' };
  const result = await bazarr.getMovieSubtitlesFull(radarrId);
  if (!result) return { success: true, data: { radarrId, subtitles: [] } };
  return {
    success: true,
    data: {
      radarrId,
      title: result.title,
      subtitles: result.subtitles?.map(s => ({
        language: s.name ?? s.code2,
        path: s.path,
        forced: s.forced,
        hi: s.hi,
      })) ?? [],
      missing: result.missing_subtitles?.map(s => ({
        language: s.name ?? s.code2,
      })) ?? [],
    },
  };
}

export async function handleSubtitlesSeriesStatus(args: Args): Promise<ToolResult> {
  const sonarrSeriesId = Number(args.sonarrSeriesId);
  if (!sonarrSeriesId) return { success: false, error: 'sonarrSeriesId ist erforderlich' };
  const episodes = await bazarr.getEpisodeSubtitlesBySeries(sonarrSeriesId);
  const compact = episodes.slice(0, 30).map(e => ({
    episodeId: e.sonarrEpisodeId,
    title: e.title,
    subtitles: e.subtitles?.length ?? 0,
    missing: e.missing_subtitles?.length ?? 0,
  }));
  return { success: true, data: { sonarrSeriesId, episodes: compact } };
}

export async function handleSubtitlesSearch(args: Args): Promise<ToolResult> {
  const type = String(args.type || 'movie');
  if (type === 'movie') {
    const radarrId = Number(args.radarrId);
    if (!radarrId) return { success: false, error: 'radarrId ist erforderlich' };
    await bazarr.searchMovieSubtitles(radarrId);
    return { success: true, data: { type: 'movie', radarrId, action: 'search_started' } };
  } else {
    const episodeId = Number(args.episodeId);
    if (!episodeId) return { success: false, error: 'episodeId ist erforderlich' };
    await bazarr.searchEpisodeSubtitles(episodeId);
    return { success: true, data: { type: 'episode', episodeId, action: 'search_started' } };
  }
}

// ── Audiobookshelf ──────────────────────────────────────────────────────────

export async function handleAudiobooksSearch(args: Args): Promise<ToolResult> {
  const query = String(args.query || '');
  const libraryId = String(args.libraryId || '');
  if (!query) return { success: false, error: 'query ist erforderlich' };

  let searchLibraryId = libraryId;
  if (!searchLibraryId) {
    const libs = await abs.getLibraries();
    if (libs.length) searchLibraryId = libs[0].id;
    else return { success: false, error: 'Keine ABS-Bibliotheken gefunden' };
  }

  const results = await abs.searchItems(searchLibraryId, query);
  return {
    success: true,
    data: results.slice(0, 10).map(item => {
      const meta = item.media?.metadata;
      return {
        id: item.id,
        title: meta?.title ?? 'Unbekannt',
        author: meta && 'authorName' in meta ? meta.authorName : undefined,
        duration: item.media?.duration,
      };
    }),
  };
}

export async function handleAudiobooksDetails(args: Args): Promise<ToolResult> {
  const itemId = String(args.itemId || '');
  if (!itemId) return { success: false, error: 'itemId ist erforderlich' };

  const [item, progress] = await Promise.allSettled([
    abs.getItem(itemId),
    abs.getProgress(itemId),
  ]);

  const i = item.status === 'fulfilled' ? item.value : null;
  const p = progress.status === 'fulfilled' ? progress.value : null;

  if (!i) return { success: false, error: 'Item nicht gefunden' };

  const meta = i.media?.metadata;
  return {
    success: true,
    data: {
      id: i.id,
      title: meta?.title,
      author: meta && 'authorName' in meta ? meta.authorName : undefined,
      narrator: meta && 'narratorName' in meta ? meta.narratorName : undefined,
      duration: i.media?.duration,
      progress: p ? {
        currentTime: p.currentTime,
        progress: p.progress,
        isFinished: p.isFinished,
      } : null,
    },
  };
}

export async function handleAudiobooksLibraries(_args: Args): Promise<ToolResult> {
  const libs = await abs.getLibraries();
  return {
    success: true,
    data: libs.map(l => ({
      id: l.id,
      name: l.name,
      mediaType: l.mediaType,
    })),
  };
}

// ── Gotify ──────────────────────────────────────────────────────────────────

export async function handleNotificationsList(args: Args): Promise<ToolResult> {
  const limit = Number(args.limit) || 20;
  const messages = await gotify.getMessages(limit);
  return {
    success: true,
    data: messages.slice(0, limit).map(m => ({
      id: m.id,
      title: m.title,
      message: m.message,
      priority: m.priority,
      date: m.date,
    })),
  };
}

export async function handleNotificationsClear(args: Args): Promise<ToolResult> {
  const id = args.id ? Number(args.id) : undefined;
  if (id) {
    await gotify.deleteMessage(id);
    return { success: true, data: { id, action: 'deleted' } };
  }
  await gotify.deleteAllMessages();
  return { success: true, data: { action: 'all_deleted' } };
}
