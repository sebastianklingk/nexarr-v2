import axios from 'axios';
import { env } from '../config/env.js';
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
): Promise<ProwlarrResult[]> {
  const params: Record<string, string> = {
    query,
    type: 'search',   // PFLICHT ab Prowlarr v2.3
  };
  if (categories.length > 0) {
    params['categories'] = categories.join(',');
  }
  const { data } = await client().get('/search', { params });
  return (data ?? []) as ProwlarrResult[];
}

export async function grab(guid: string, indexerId: number): Promise<void> {
  await client().post('/release', { guid, indexerId });
}

export async function getIndexers(): Promise<unknown[]> {
  const { data } = await client().get('/indexer');
  return data ?? [];
}
