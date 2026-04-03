import axios from 'axios';
import { env } from '../config/env.js';
import { C } from '../cache/cache.js';
import { TTL } from '../config/constants.js';
import type { TautulliActivity } from '@nexarr/shared';

function api(cmd: string, extra: Record<string, string | number> = {}) {
  if (!env.TAUTULLI_URL || !env.TAUTULLI_API_KEY) {
    throw Object.assign(new Error('Tautulli nicht konfiguriert'), { status: 503 });
  }
  return axios.get(`${env.TAUTULLI_URL}/api/v2`, {
    params: { apikey: env.TAUTULLI_API_KEY, cmd, ...extra },
    timeout: 8_000,
  });
}

// ── Live / Dashboard ──────────────────────────────────────────────────────────

export async function getActivity(): Promise<TautulliActivity> {
  const { data } = await api('get_activity');
  const r = data?.response?.data;
  return {
    stream_count:               r?.stream_count               ?? 0,
    sessions:                   (r?.sessions ?? []) as TautulliActivity['sessions'],
    stream_count_direct_play:   r?.stream_count_direct_play   ?? 0,
    stream_count_direct_stream: r?.stream_count_direct_stream ?? 0,
    stream_count_transcode:     r?.stream_count_transcode      ?? 0,
    total_bandwidth:            r?.total_bandwidth            ?? 0,
    lan_bandwidth:              r?.lan_bandwidth              ?? 0,
    wan_bandwidth:              r?.wan_bandwidth              ?? 0,
  };
}

export async function getHomeStats(timeRange = 30, statsCount = 5): Promise<unknown> {
  return C.fetch(`tautulli_home_stats_${timeRange}_${statsCount}`, async () => {
    const { data } = await api('get_home_stats', { time_range: String(timeRange), stats_count: String(statsCount) });
    return data?.response?.data ?? [];
  }, TTL.STATS);
}

export async function getHistory(length = 20): Promise<unknown> {
  return C.fetch(`tautulli_history_${length}`, async () => {
    const { data } = await api('get_history', { length: String(length) });
    return data?.response?.data ?? {};
  }, TTL.HISTORY);
}

// ── Item-spezifische History (für MovieDetailView Tautulli-Tab) ───────────────

export interface TautulliHistoryEntry {
  id:                number;
  date:              number;  // Unix-Timestamp
  started?:          number;
  stopped?:          number;
  friendly_name:     string;
  user_thumb?:       string;
  platform?:         string;
  product?:          string;
  player?:           string;
  location?:         string; // 'lan' | 'wan'
  transcode_decision?: string; // 'direct play' | 'copy' | 'transcode'
  paused_counter?:   number;
  watched_status?:   number; // 1 = watched
  percent_complete?: number;
  play_duration?:    number; // Sekunden
  rating_key?:       string;
}

// History für einen Film (Suche via Titel, then filter by tmdbId via metadata)
export async function getMovieHistory(title: string, tmdbId?: number): Promise<TautulliHistoryEntry[]> {
  const cacheKey = `tautulli_movie_history_${tmdbId ?? title.slice(0, 20)}`;
  return C.fetch(cacheKey, async () => {
    const { data } = await api('get_history', {
      length:         '100',
      media_type:     'movie',
      search:         title,
    });
    const rows: TautulliHistoryEntry[] = data?.response?.data?.data ?? [];

    // Wenn tmdbId vorhanden: Nur exakt passende Filme (verhindert falsche Treffer bei ähnlichen Titeln)
    // Tautulli hat kein direktes tmdbId-Filtering → wir nutzen Titel-Match als best-effort
    return rows;
  }, TTL.STATS);
}

// User-Statistiken für ein Plex-Item (via rating_key)
export interface TautulliUserStat {
  user_id:       number;
  friendly_name: string;
  user_thumb?:   string;
  total_plays:   number;
  last_play?:    number;
}

export async function getUserStatsForItem(ratingKey: string): Promise<TautulliUserStat[]> {
  return C.fetch(`tautulli_user_stats_${ratingKey}`, async () => {
    const { data } = await api('get_item_user_stats', { rating_key: ratingKey });
    return data?.response?.data ?? [];
  }, TTL.STATS);
}

// Plex-Metadata für ein Item (rating_key Lookup via Titel)
export async function getMetadata(ratingKey: string): Promise<unknown> {
  return C.fetch(`tautulli_metadata_${ratingKey}`, async () => {
    const { data } = await api('get_metadata', { rating_key: ratingKey });
    return data?.response?.data ?? null;
  }, TTL.DETAIL);
}

// Plays per Tag für Timeline-Chart
export interface PlaysByDay { date: string; movies: number; tv: number; music: number }
export async function getPlaysByDate(timeRange = 30): Promise<PlaysByDay[]> {
  return C.fetch(`tautulli_plays_by_date_${timeRange}`, async () => {
    const { data } = await api('get_plays_by_date', { time_range: String(timeRange) });
    const r = data?.response?.data;
    // Tautulli liefert: { categories: ['2026-03-01', ...], series: [{name, data: [n,n,...]}, ...] }
    const categories: string[] = r?.categories ?? [];
    const series: Array<{ name: string; data: number[] }> = r?.series ?? [];
    const moviesData = series.find(s => s.name === 'Movies')?.data ?? [];
    const tvData     = series.find(s => s.name === 'TV')?.data ?? [];
    const musicData  = series.find(s => s.name === 'Music')?.data ?? [];
    return categories.map((date, i) => ({
      date,
      movies: moviesData[i] ?? 0,
      tv:     tvData[i]     ?? 0,
      music:  musicData[i]  ?? 0,
    }));
  }, TTL.STATS);
}

// Rating Key für einen Film anhand des Titels finden
export async function findMovieRatingKey(title: string): Promise<string | null> {
  try {
    const { data } = await api('get_history', {
      length:     '5',
      media_type: 'movie',
      search:     title,
    });
    const rows = data?.response?.data?.data ?? [];
    return rows[0]?.rating_key ?? null;
  } catch {
    return null;
  }
}

// ── Grafiken-Daten ────────────────────────────────────────────────────────────

export async function getPlaysByDayOfWeek(timeRange = 30): Promise<unknown> {
  return C.fetch(`tautulli_plays_dayofweek_${timeRange}`, async () => {
    const { data } = await api('get_plays_by_dayofweek', { time_range: String(timeRange) });
    return data?.response?.data ?? {};
  }, TTL.STATS);
}

export async function getPlaysByHourOfDay(timeRange = 30): Promise<unknown> {
  return C.fetch(`tautulli_plays_hourofday_${timeRange}`, async () => {
    const { data } = await api('get_plays_by_hourofday', { time_range: String(timeRange) });
    return data?.response?.data ?? {};
  }, TTL.STATS);
}

export async function getPlaysByTopPlatforms(timeRange = 30): Promise<unknown> {
  return C.fetch(`tautulli_plays_top_platforms_${timeRange}`, async () => {
    const { data } = await api('get_plays_by_top_10_platforms', { time_range: String(timeRange) });
    return data?.response?.data ?? {};
  }, TTL.STATS);
}

export async function getPlaysByTopUsers(timeRange = 30): Promise<unknown> {
  return C.fetch(`tautulli_plays_top_users_${timeRange}`, async () => {
    const { data } = await api('get_plays_by_top_10_users', { time_range: String(timeRange) });
    return data?.response?.data ?? {};
  }, TTL.STATS);
}

export async function getStreamTypeByTopPlatforms(timeRange = 30): Promise<unknown> {
  return C.fetch(`tautulli_streamtype_platforms_${timeRange}`, async () => {
    const { data } = await api('get_stream_type_by_top_10_platforms', { time_range: String(timeRange) });
    return data?.response?.data ?? {};
  }, TTL.STATS);
}

export async function getStreamTypeByTopUsers(timeRange = 30): Promise<unknown> {
  return C.fetch(`tautulli_streamtype_users_${timeRange}`, async () => {
    const { data } = await api('get_stream_type_by_top_10_users', { time_range: String(timeRange) });
    return data?.response?.data ?? {};
  }, TTL.STATS);
}

// ── Bibliotheken ──────────────────────────────────────────────────────────────

export async function getLibrariesTable(): Promise<unknown> {
  return C.fetch('tautulli_libraries_table', async () => {
    const { data } = await api('get_libraries_table', { length: '50' });
    return data?.response?.data ?? {};
  }, TTL.COLLECTION);
}

// ── Erweiterte History (mit Filtern) ──────────────────────────────────────────

export async function getHistoryFiltered(params: {
  length?: number;
  start?: number;
  media_type?: string;
  transcode_decision?: string;
  search?: string;
  order_column?: string;
  order_dir?: string;
  user?: string;
}): Promise<unknown> {
  const p: Record<string, string | number> = {
    length: String(params.length ?? 25),
    start:  String(params.start ?? 0),
  };
  if (params.media_type)          p.media_type = params.media_type;
  if (params.transcode_decision)  p.transcode_decision = params.transcode_decision;
  if (params.search)              p.search = params.search;
  if (params.order_column)        p.order_column = params.order_column;
  if (params.order_dir)           p.order_dir = params.order_dir;
  if (params.user)                p.user = params.user;
  // Kein Cache – dynamische Abfrage
  const { data } = await api('get_history', p);
  return data?.response?.data ?? {};
}

// ── User-Liste ────────────────────────────────────────────────────────────────

export async function getUsers(): Promise<unknown> {
  return C.fetch('tautulli_users', async () => {
    const { data } = await api('get_users');
    return data?.response?.data ?? [];
  }, TTL.COLLECTION);
}

// Plex-Image Proxy (für StreamsView Poster)
export async function getPlexImage(img: string, width: number, height: number): Promise<Buffer | null> {
  if (!env.TAUTULLI_URL || !env.TAUTULLI_API_KEY) return null;
  try {
    const { data } = await axios.get(`${env.TAUTULLI_URL}/api/v2`, {
      params: {
        apikey: env.TAUTULLI_API_KEY,
        cmd: 'pms_image_proxy',
        img,
        width: String(width),
        height: String(height),
        fallback: 'poster',
      },
      responseType: 'arraybuffer',
      timeout: 8_000,
    });
    return Buffer.from(data);
  } catch {
    return null;
  }
}
