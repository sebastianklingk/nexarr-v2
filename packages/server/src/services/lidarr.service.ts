import axios from 'axios';
import { env } from '../config/env.js';
import { C } from '../cache/cache.js';
import { TTL } from '../config/constants.js';
import type { LidarrArtist, LidarrAlbum } from '@nexarr/shared';

function client() {
  if (!env.LIDARR_URL || !env.LIDARR_API_KEY) {
    throw Object.assign(new Error('Lidarr nicht konfiguriert'), { status: 503 });
  }
  return axios.create({
    baseURL: `${env.LIDARR_URL}/api/v1`,
    headers: { 'X-Api-Key': env.LIDARR_API_KEY },
    timeout: 10_000,
  });
}

export async function getArtists(): Promise<LidarrArtist[]> {
  return C.fetch('lidarr_artists', async () => {
    const { data } = await client().get<LidarrArtist[]>('/artist');
    return data;
  }, TTL.COLLECTION);
}

export async function getArtist(id: number): Promise<LidarrArtist> {
  return C.fetch(`lidarr_artist_${id}`, async () => {
    const { data } = await client().get<LidarrArtist>(`/artist/${id}`);
    return data;
  }, TTL.DETAIL);
}

export async function getAlbums(): Promise<LidarrAlbum[]> {
  return C.fetch('lidarr_albums', async () => {
    const { data } = await client().get<LidarrAlbum[]>('/album');
    return data;
  }, TTL.COLLECTION);
}

export async function getQueue(): Promise<unknown> {
  return C.fetch('lidarr_queue', async () => {
    const { data } = await client().get('/queue', { params: { pageSize: 100 } });
    return data;
  }, TTL.QUEUE);
}

export async function triggerSearch(artistId: number): Promise<void> {
  await client().post('/command', { name: 'ArtistSearch', artistId });
}

export async function getCalendar(start: string, end: string): Promise<unknown[]> {
  const key = `lidarr_calendar_${start}_${end}`;
  return C.fetch(key, async () => {
    const { data } = await client().get('/calendar', { params: { start, end } });
    return data as unknown[];
  }, TTL.CALENDAR);
}
