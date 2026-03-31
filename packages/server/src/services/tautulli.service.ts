import axios from 'axios';
import { env } from '../config/env.js';
import { C } from '../cache/cache.js';
import { TTL } from '../config/constants.js';
import type { TautulliActivity } from '@nexarr/shared';

function api(cmd: string, extra: Record<string, string> = {}) {
  if (!env.TAUTULLI_URL || !env.TAUTULLI_API_KEY) {
    throw Object.assign(new Error('Tautulli nicht konfiguriert'), { status: 503 });
  }
  return axios.get(`${env.TAUTULLI_URL}/api/v2`, {
    params: { apikey: env.TAUTULLI_API_KEY, cmd, ...extra },
    timeout: 8_000,
  });
}

export async function getActivity(): Promise<TautulliActivity> {
  // Kein Cache – live Daten (wird direkt von Socket.io gepusht)
  const { data } = await api('get_activity');
  const r = data?.response?.data;
  return {
    stream_count:               r?.stream_count        ?? 0,
    sessions:                   r?.sessions            ?? [],
    stream_count_direct_play:   r?.stream_count_direct_play   ?? 0,
    stream_count_direct_stream: r?.stream_count_direct_stream ?? 0,
    stream_count_transcode:     r?.stream_count_transcode      ?? 0,
    total_bandwidth:            r?.total_bandwidth     ?? 0,
    lan_bandwidth:              r?.lan_bandwidth       ?? 0,
    wan_bandwidth:              r?.wan_bandwidth       ?? 0,
  };
}

export async function getHomeStats(): Promise<unknown> {
  return C.fetch('tautulli_home_stats', async () => {
    const { data } = await api('get_home_stats', { time_range: '30', stats_count: '5' });
    return data?.response?.data ?? [];
  }, TTL.STATS);
}

export async function getHistory(): Promise<unknown> {
  return C.fetch('tautulli_history', async () => {
    const { data } = await api('get_history', { length: '20' });
    return data?.response?.data ?? {};
  }, TTL.HISTORY);
}
