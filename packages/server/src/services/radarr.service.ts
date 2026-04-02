import axios from 'axios';
import { env } from '../config/env.js';
import { C } from '../cache/cache.js';
import { TTL } from '../config/constants.js';
import type { RadarrMovie } from '@nexarr/shared';

function client() {
  if (!env.RADARR_URL || !env.RADARR_API_KEY) {
    throw Object.assign(new Error('Radarr nicht konfiguriert'), { status: 503 });
  }
  return axios.create({
    baseURL: `${env.RADARR_URL}/api/v3`,
    headers: { 'X-Api-Key': env.RADARR_API_KEY },
    timeout: 10_000,
  });
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getMovies(): Promise<RadarrMovie[]> {
  return C.fetch('radarr_movies', async () => {
    const { data } = await client().get<RadarrMovie[]>('/movie');
    return data;
  }, TTL.COLLECTION);
}

export async function getMovie(id: number): Promise<RadarrMovie> {
  return C.fetch(`radarr_movie_${id}`, async () => {
    const { data } = await client().get<RadarrMovie>(`/movie/${id}`);
    return data;
  }, TTL.DETAIL);
}

export async function getRootFolders(): Promise<Array<{ id: number; path: string; freeSpace: number }>> {
  return C.fetch('radarr_rootfolders', async () => {
    const { data } = await client().get('/rootfolder');
    return data;
  }, TTL.LONG);
}

export async function getCalendar(start: string, end: string): Promise<unknown[]> {
  const key = `radarr_calendar_${start}_${end}`;
  return C.fetch(key, async () => {
    const { data } = await client().get('/calendar', { params: { start, end } });
    return data as unknown[];
  }, TTL.CALENDAR);
}

export async function getQueue(): Promise<unknown> {
  return C.fetch('radarr_queue', async () => {
    const { data } = await client().get('/queue', { params: { pageSize: 100 } });
    return data;
  }, TTL.QUEUE);
}

export async function getStatus(): Promise<unknown> {
  return C.fetch('radarr_status', async () => {
    const { data } = await client().get('/system/status');
    return data;
  }, TTL.LONG);
}

// Besetzung direkt aus Radarr (via movieMetadataId aus alternateTitles[0])
export async function getCredits(movieMetadataId: number): Promise<unknown[]> {
  return C.fetch(`radarr_credits_${movieMetadataId}`, async () => {
    const { data } = await client().get('/credit', {
      params: { movieMetadataId },
    });
    return data as unknown[];
  }, TTL.DETAIL);
}

// Releases für Interactive Search (kein Cache – immer live, kann 10-30s dauern)
export async function getReleases(movieId: number): Promise<unknown[]> {
  const { data } = await client().get('/release', {
    params: { movieId },
    timeout: 60_000, // Indexer-Suche kann dauern
  });
  return data as unknown[];
}

// ── Write / Actions ───────────────────────────────────────────────────────────

export async function updateMovie(id: number, body: RadarrMovie): Promise<RadarrMovie> {
  const { data } = await client().put<RadarrMovie>(`/movie/${id}`, body);
  C.invalidate(`radarr_movie_${id}`);
  C.invalidate('radarr_movies');
  return data;
}

export async function deleteMovie(id: number, deleteFiles = false): Promise<void> {
  await client().delete(`/movie/${id}`, {
    params: { deleteFiles, addImportExclusion: false },
  });
  C.invalidate(`radarr_movie_${id}`);
  C.invalidate('radarr_movies');
}

export async function sendCommand(body: Record<string, unknown>): Promise<unknown> {
  const { data } = await client().post('/command', body);
  return data;
}

export async function downloadRelease(body: { guid: string; indexerId: number }): Promise<unknown> {
  const { data } = await client().post('/release', body);
  return data;
}

export async function lookup(term: string): Promise<unknown[]> {
  const { data } = await client().get('/movie/lookup', { params: { term } });
  return data as unknown[];
}

export async function addMovie(body: Record<string, unknown>): Promise<unknown> {
  const { data } = await client().post('/movie', body);
  C.invalidate('radarr_movies');
  return data;
}

export async function triggerSearch(movieIds: number[]): Promise<void> {
  await client().post('/command', { name: 'MoviesSearch', movieIds });
}

export async function getQualityProfiles(): Promise<unknown[]> {
  return C.fetch('radarr_qualityprofiles', async () => {
    const { data } = await client().get('/qualityprofile');
    return data;
  }, TTL.LONG);
}

export async function getHealth(): Promise<unknown[]> {
  return C.fetch('radarr_health', async () => {
    const { data } = await client().get('/health');
    return data;
  }, TTL.STATS);
}

export async function testAllIndexers(): Promise<void> {
  await client().post('/indexer/testall');
}

export async function getMissingMovies(pageSize = 100): Promise<unknown> {
  return C.fetch(`radarr_missing_${pageSize}`, async () => {
    const { data } = await client().get('/wanted/missing', {
      params: { pageSize, monitored: true },
    });
    return data;
  }, TTL.HISTORY);
}

export async function getHistory(pageSize = 100): Promise<unknown> {
  return C.fetch(`radarr_history_${pageSize}`, async () => {
    const { data } = await client().get('/history', { params: { pageSize } });
    return data;
  }, TTL.HISTORY);
}
