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

// ── Read ──────────────────────────────────────────────────────────────────────

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

// Alle Alben (für Dashboard / MusicView)
export async function getAlbums(): Promise<LidarrAlbum[]> {
  return C.fetch('lidarr_albums', async () => {
    const { data } = await client().get<LidarrAlbum[]>('/album');
    return data;
  }, TTL.COLLECTION);
}

// Alben eines bestimmten Artists (für ArtistDetailView)
export async function getAlbumsByArtist(artistId: number): Promise<LidarrAlbum[]> {
  return C.fetch(`lidarr_albums_artist_${artistId}`, async () => {
    const { data } = await client().get<LidarrAlbum[]>('/album', {
      params: { artistId, includeAllArtistAlbums: false },
    });
    return data;
  }, TTL.DETAIL);
}

// Tracks eines Albums – albumId allein reicht für Lidarr
export async function getAlbumTracks(albumId: number): Promise<unknown[]> {
  return C.fetch(`lidarr_tracks_${albumId}`, async () => {
    const { data } = await client().get('/track', { params: { albumId } });
    return data as unknown[];
  }, TTL.DETAIL);
}

// Tracks über artistId+albumId (v1-kompatibel)
export async function getTracksByArtistAlbum(artistId: number, albumId: number): Promise<unknown[]> {
  return C.fetch(`lidarr_tracks_${artistId}_${albumId}`, async () => {
    const { data } = await client().get('/track', { params: { artistId, albumId } });
    return data as unknown[];
  }, TTL.DETAIL);
}

export async function getQueue(): Promise<unknown> {
  return C.fetch('lidarr_queue', async () => {
    const { data } = await client().get('/queue', {
      params: { pageSize: 500, includeUnknownArtistItems: true },
    });
    return data;
  }, TTL.QUEUE);
}

export async function getCalendar(start: string, end: string): Promise<unknown[]> {
  const key = `lidarr_calendar_${start}_${end}`;
  return C.fetch(key, async () => {
    const { data } = await client().get('/calendar', { params: { start, end } });
    return data as unknown[];
  }, TTL.CALENDAR);
}

// ── Write / Actions ───────────────────────────────────────────────────────────

export async function updateAlbum(id: number, body: LidarrAlbum): Promise<LidarrAlbum> {
  const { data } = await client().put<LidarrAlbum>(`/album/${id}`, body);
  // Artist-Alben-Cache invalidieren
  if (body.artistId) C.invalidate(`lidarr_albums_artist_${body.artistId}`);
  C.invalidate('lidarr_albums');
  return data;
}

export async function deleteArtist(id: number, deleteFiles = false): Promise<void> {
  await client().delete(`/artist/${id}`, {
    params: { deleteFiles, addImportExclusion: false },
  });
  C.invalidate(`lidarr_artist_${id}`);
  C.invalidate('lidarr_artists');
  C.invalidate('lidarr_albums');
  C.invalidatePattern('lidarr_albums_artist_');
}

export async function sendCommand(body: Record<string, unknown>): Promise<unknown> {
  const { data } = await client().post('/command', body);
  return data;
}

export async function triggerSearch(artistId: number): Promise<void> {
  await client().post('/command', { name: 'ArtistSearch', artistId });
}

export async function getMissingAlbums(pageSize = 100): Promise<unknown> {
  return C.fetch(`lidarr_missing_${pageSize}`, async () => {
    const { data } = await client().get('/wanted/missing', { params: { pageSize } });
    return data;
  }, TTL.HISTORY);
}

export async function getHistory(pageSize = 50): Promise<unknown> {
  return C.fetch(`lidarr_history_${pageSize}`, async () => {
    const { data } = await client().get('/history', { params: { pageSize } });
    return data;
  }, TTL.HISTORY);
}
