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
    sessions:                   r?.sessions                   ?? [],
    stream_count_direct_play:   r?.stream_count_direct_play   ?? 0,
    stream_count_direct_stream: r?.stream_count_direct_stream ?? 0,
    stream_count_transcode:     r?.stream_count_transcode      ?? 0,
    total_bandwidth:            r?.total_bandwidth            ?? 0,
    lan_bandwidth:              r?.lan_bandwidth              ?? 0,
    wan_bandwidth:              r?.wan_bandwidth              ?? 0,
  };
}

export async function getHomeStats(): Promise<unknown> {
  return C.fetch('tautulli_home_stats', async () => {
    const { data } = await api('get_home_stats', { time_range: '30', stats_count: '5' });
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
