import axios from 'axios';
import { env } from '../config/env.js';
import { C } from '../cache/cache.js';
import { TTL } from '../config/constants.js';
import type { ProwlarrResult } from '@nexarr/shared';

function client() {
  if (!env.PROWLARR_URL || !env.PROWLARR_API_KEY) {
    throw Object.assign(new Error('Prowlarr nicht konfiguriert'), { status: 503 });
  }
  return axios.create({
    baseURL: `${env.PROWLARR_URL}/api/v1`,
    headers: { 'X-Api-Key': env.PROWLARR_API_KEY },
    timeout: 30_000,  // Suche kann länger dauern
  });
}

// categories: 2000=Filme, 5000=TV, 6000=Musik, leer=alles
export async function search(
  query: string,
  categories: number[] = [],
  limit = 100,
): Promise<ProwlarrResult[]> {
  const params: Record<string, string | number> = {
    query,
    type: 'search',   // PFLICHT ab Prowlarr v2.3
    limit,
  };
  if (categories.length > 0) {
    params['categories'] = categories.join(',');
  }
  const { data } = await client().get('/search', { params });
  return (data ?? []) as ProwlarrResult[];
}

export async function grab(body: Record<string, unknown>): Promise<unknown> {
  // Prowlarr erwartet POST /api/v1/search (nicht /release) für Grabs
  const { data } = await client().post('/search', body);
  return data;
}

export async function getIndexers(): Promise<unknown[]> {
  return C.fetch('prowlarr_indexers', async () => {
    const { data } = await client().get('/indexer');
    return data ?? [];
  }, TTL.LONG);
}

export async function getStats(): Promise<unknown> {
  return C.fetch('prowlarr_stats', async () => {
    const { data } = await client().get('/indexerstats');
    return data ?? {};
  }, TTL.STATS);
}

export async function getHistory(pageSize = 100): Promise<unknown> {
  return C.fetch(`prowlarr_history_${pageSize}`, async () => {
    const { data } = await client().get('/history', { params: { pageSize } });
    return data ?? {};
  }, TTL.HISTORY);
}

export async function getRss(categories: number[] = [], limit = 50): Promise<unknown[]> {
  // Prowlarr RSS: leer Query mit type=search liefert neueste Releases
  const params: Record<string, string | number> = {
    query: '',
    type: 'search',
    limit,
  };
  if (categories.length > 0) params['categories'] = categories.join(',');
  try {
    const { data } = await client().get('/search', { params, timeout: 15_000 });
    return (data ?? []) as unknown[];
  } catch {
    return [];
  }
}
