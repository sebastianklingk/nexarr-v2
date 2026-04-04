import type { ToolResult } from '../executor.js';
import * as radarr from '../../services/radarr.service.js';
import * as sonarr from '../../services/sonarr.service.js';
import * as tautulli from '../../services/tautulli.service.js';
import * as tmdb from '../../services/tmdb.service.js';
import * as plex from '../../services/plex.service.js';
import { env } from '../../config/env.js';

type Args = Record<string, unknown>;

// ── Calendar ────────────────────────────────────────────────────────────────

export async function handleCalendarUpcoming(args: Args): Promise<ToolResult> {
  const days = Number(args.days) || 7;
  const start = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

  const [movies, episodes] = await Promise.allSettled([
    radarr.getCalendar(start, end),
    sonarr.getCalendar(start, end),
  ]);

  const movieItems = movies.status === 'fulfilled'
    ? (movies.value as Array<Record<string, unknown>>).slice(0, 10).map(m => ({
        type: 'movie',
        title: m.title,
        year: m.year,
        date: m.inCinemas || m.digitalRelease || m.physicalRelease,
      }))
    : [];

  const episodeItems = episodes.status === 'fulfilled'
    ? (episodes.value as Array<Record<string, unknown>>).slice(0, 15).map(e => ({
        type: 'episode',
        series: (e.series as Record<string, unknown>)?.title ?? e.title,
        season: e.seasonNumber,
        episode: e.episodeNumber,
        title: e.title,
        airDate: e.airDateUtc,
      }))
    : [];

  return {
    success: true,
    data: { days, movies: movieItems, episodes: episodeItems },
  };
}

export async function handleCalendarToday(_args: Args): Promise<ToolResult> {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const [movies, episodes] = await Promise.allSettled([
    radarr.getCalendar(today, tomorrow),
    sonarr.getCalendar(today, tomorrow),
  ]);

  const movieItems = movies.status === 'fulfilled'
    ? (movies.value as Array<Record<string, unknown>>).map(m => ({
        type: 'movie',
        title: m.title,
        year: m.year,
      }))
    : [];

  const episodeItems = episodes.status === 'fulfilled'
    ? (episodes.value as Array<Record<string, unknown>>).map(e => ({
        type: 'episode',
        series: (e.series as Record<string, unknown>)?.title ?? e.title,
        season: e.seasonNumber,
        episode: e.episodeNumber,
        title: e.title,
      }))
    : [];

  return {
    success: true,
    data: { date: today, movies: movieItems, episodes: episodeItems },
  };
}

// ── Streams ─────────────────────────────────────────────────────────────────

export async function handleStreamsActive(): Promise<ToolResult> {
  const activity = await tautulli.getActivity();
  const sessions = activity.sessions || [];
  return {
    success: true,
    data: {
      streamCount: sessions.length,
      streams: sessions.slice(0, 10).map(s => ({
        user: s.friendly_name || s.user,
        title: s.full_title || s.title,
        mediaType: s.media_type,
        state: s.state,
        quality: s.video_full_resolution,
        decision: s.transcode_decision,
        player: s.player,
        platform: s.platform,
        progress: s.progress_percent,
      })),
    },
  };
}

export async function handleStreamsHistory(args: Args): Promise<ToolResult> {
  const count = Number(args.count) || 10;
  const history = await tautulli.getHistory(count) as Record<string, unknown>;
  const data = (history as Record<string, unknown>).data as Record<string, unknown> | undefined;
  const entries = Array.isArray(data) ? data : (data as Record<string, unknown>)?.data;
  return {
    success: true,
    data: {
      entries: (Array.isArray(entries) ? entries : []).slice(0, count).map((e: Record<string, unknown>) => ({
        user: e.friendly_name,
        title: e.full_title,
        date: e.date,
        duration: e.duration,
        mediaType: e.media_type,
        decision: e.transcode_decision,
      })),
    },
  };
}

// ── Plex ────────────────────────────────────────────────────────────────────

export async function handlePlexLibraries(_args: Args): Promise<ToolResult> {
  const libraries = await plex.getLibraries();
  return {
    success: true,
    data: libraries.map(l => ({
      key: l.key,
      title: l.title,
      type: l.type,
    })),
  };
}

export async function handlePlexDeeplink(args: Args): Promise<ToolResult> {
  const key = String(args.key || '');
  if (!key) return { success: false, error: 'key ist erforderlich (z.B. /library/metadata/12345)' };
  const url = plex.buildDeepLink(env.PLEX_URL || '', key, env.PLEX_TOKEN || '');
  return { success: true, data: { url } };
}

export async function handlePlexStatus(_args: Args): Promise<ToolResult> {
  const status = await plex.getStatus() as Record<string, unknown>;
  const mc = status.MediaContainer as Record<string, unknown> | undefined;
  return {
    success: true,
    data: {
      version: mc?.version,
      platform: mc?.platform,
      platformVersion: mc?.platformVersion,
      friendlyName: mc?.friendlyName,
    },
  };
}

// ── Discover ────────────────────────────────────────────────────────────────

export async function handleDiscoverTrending(args: Args): Promise<ToolResult> {
  const type = (args.type === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv';
  const results = await tmdb.getTrending(type, 'week');
  return {
    success: true,
    data: (results as Array<Record<string, unknown>>).slice(0, 10).map(m => ({
      title: m.title || m.name,
      year: (String(m.release_date || m.first_air_date || '')).slice(0, 4),
      overview: typeof m.overview === 'string' ? m.overview.slice(0, 150) : '',
      rating: m.vote_average,
      tmdbId: m.id,
      mediaType: m.media_type || type,
    })),
  };
}

export async function handleDiscoverByGenre(args: Args): Promise<ToolResult> {
  const type = (args.type === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv';
  const params: { genre?: string; min_rating?: number; sort_by?: string } = {};
  if (args.genre) params.genre = String(args.genre);
  if (args.minRating) params.min_rating = Number(args.minRating);
  if (args.sortBy) params.sort_by = String(args.sortBy);

  const results = await tmdb.discover(type, params);
  return {
    success: true,
    data: (results as Array<Record<string, unknown>>).slice(0, 10).map(m => ({
      title: m.title || m.name,
      year: (String(m.release_date || m.first_air_date || '')).slice(0, 4),
      overview: typeof m.overview === 'string' ? m.overview.slice(0, 150) : '',
      rating: m.vote_average,
      tmdbId: m.id,
    })),
  };
}

export async function handleDiscoverSimilar(args: Args): Promise<ToolResult> {
  const tmdbId = Number(args.tmdbId);
  if (!tmdbId) return { success: false, error: 'tmdbId ist erforderlich' };

  const type = (args.type === 'tv' ? 'tv' : 'movie') as 'movie' | 'tv';
  const results = type === 'movie'
    ? await tmdb.getSimilarMovies(tmdbId)
    : await tmdb.getSimilarTv(tmdbId);

  return {
    success: true,
    data: (results as Array<Record<string, unknown>>).slice(0, 10).map(m => ({
      title: m.title || m.name,
      year: (String(m.release_date || m.first_air_date || '')).slice(0, 4),
      overview: typeof m.overview === 'string' ? m.overview.slice(0, 150) : '',
      rating: m.vote_average,
      tmdbId: m.id,
    })),
  };
}
