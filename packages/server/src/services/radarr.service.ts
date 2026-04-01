import axios from 'axios';
import { env } from '../config/env.js';
import { C, } from '../cache/cache.js';
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

export async function getQueue(): Promise<unknown> {
  return C.fetch('radarr_queue', async () => {
    const { data } = await client().get('/queue', { params: { pageSize: 100 } });
    return data;
  }, TTL.QUEUE);
}

export async function getCalendar(start: string, end: string): Promise<unknown[]> {
  const key = `radarr_calendar_${start}_${end}`;
  return C.fetch(key, async () => {
    const { data } = await client().get('/calendar', { params: { start, end } });
    return data as unknown[];
  }, TTL.CALENDAR);
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

export async function getRootFolders(): Promise<Array<{ id: number; path: string; freeSpace: number }>> {
  return C.fetch('radarr_rootfolders', async () => {
    const { data } = await client().get('/rootfolder');
    return data;
  }, TTL.LONG);
}

export async function getStatus(): Promise<unknown> {
  return C.fetch('radarr_status', async () => {
    const { data } = await client().get('/system/status');
    return data;
  }, TTL.LONG);
}
