import axios from 'axios';
import { env } from '../config/env.js';
import { C } from '../cache/cache.js';
import { TTL } from '../config/constants.js';

function client() {
  if (!env.PLEX_URL || !env.PLEX_TOKEN) {
    throw Object.assign(new Error('Plex nicht konfiguriert'), { status: 503 });
  }
  return axios.create({
    baseURL: env.PLEX_URL,
    params:  { 'X-Plex-Token': env.PLEX_TOKEN },
    headers: { Accept: 'application/json' },
    timeout: 8_000,
  });
}

export interface PlexSession {
  key: string;
  title: string;
  grandparentTitle?: string;
  type: 'movie' | 'episode' | 'track';
  thumb?: string;
  grandparentThumb?: string;
  User?: { title: string };
  Player?: { title: string; platform: string };
  viewOffset?: number;
  duration?: number;
}

interface PlexSessionsResponse {
  MediaContainer: { Metadata?: PlexSession[]; size: number };
}

export async function getSessions(): Promise<PlexSession[]> {
  return C.fetch('plex_sessions', async () => {
    const { data } = await client().get<PlexSessionsResponse>('/status/sessions');
    return data.MediaContainer?.Metadata ?? [];
  }, TTL.QUEUE);
}

export interface PlexLibrary {
  key: string;
  title: string;
  type: 'movie' | 'show' | 'music';
  agent: string;
}

interface PlexLibraryResponse {
  MediaContainer: { Directory?: PlexLibrary[] };
}

export async function getLibraries(): Promise<PlexLibrary[]> {
  return C.fetch('plex_libraries', async () => {
    const { data } = await client().get<PlexLibraryResponse>('/library/sections');
    return data.MediaContainer?.Directory ?? [];
  }, TTL.LONG);
}

// Deep-Link für Plex Web erzeugen (öffnet direkt im Browser)
export function buildDeepLink(plexBaseUrl: string, key: string, token: string): string {
  const encoded = encodeURIComponent(`${plexBaseUrl}${key}`);
  return `https://app.plex.tv/desktop#!/server/redirect?key=${encoded}&X-Plex-Token=${token}`;
}

export async function getStatus(): Promise<unknown> {
  return C.fetch('plex_status', async () => {
    const { data } = await client().get('/');
    return data;
  }, TTL.LONG);
}
