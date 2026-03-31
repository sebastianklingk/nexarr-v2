import axios from 'axios';
import { env } from '../config/env.js';
import { C } from '../cache/cache.js';
import { TTL } from '../config/constants.js';
import type { ABSLibrary, ABSLibraryItem, ABSProgress, ABSPodcastEpisode } from '@nexarr/shared';

function client() {
  if (!env.ABS_URL || !env.ABS_TOKEN) {
    throw Object.assign(new Error('Audiobookshelf nicht konfiguriert'), { status: 503 });
  }
  return axios.create({
    baseURL: env.ABS_URL,
    headers: { Authorization: `Bearer ${env.ABS_TOKEN}` },
    timeout: 15_000,
  });
}

// ── Libraries ──────────────────────────────────────────────────────────────

interface ABSLibrariesResponse { libraries: ABSLibrary[] }

export async function getLibraries(): Promise<ABSLibrary[]> {
  return C.fetch('abs_libraries', async () => {
  const { data } = await client().get<ABSLibrariesResponse>('/api/libraries');
  return data.libraries ?? [];
  }, TTL.LONG);
}

// ── Library Items ───────────────────────────────────────────────────────────

interface ABSItemsResponse {
  results: ABSLibraryItem[];
  total: number;
  limit: number;
  page: number;
}

export async function getLibraryItems(
  libraryId: string,
  limit = 40,
  page = 0
): Promise<{ items: ABSLibraryItem[]; total: number }> {
  const key = `abs_items_${libraryId}_${limit}_${page}`;
  return C.fetch(key, async () => {
    const { data } = await client().get<ABSItemsResponse>(
      `/api/libraries/${libraryId}/items`,
      { params: { limit, page, sort: 'addedAt', desc: 1 } }
    );
    return { items: data.results ?? [], total: data.total ?? 0 };
  }, TTL.COLLECTION);
}

// ── Single Item ─────────────────────────────────────────────────────────────

export async function getItem(itemId: string): Promise<ABSLibraryItem> {
  return C.fetch(`abs_item_${itemId}`, async () => {
    const { data } = await client().get<ABSLibraryItem>(`/api/items/${itemId}`);
    return data;
  }, TTL.DETAIL);
}

// ── Cover URL ───────────────────────────────────────────────────────────────

export function coverUrl(itemId: string): string {
  if (!env.ABS_URL) return '';
  return `${env.ABS_URL}/api/items/${itemId}/cover?token=${env.ABS_TOKEN}&width=200`;
}

// ── Progress ────────────────────────────────────────────────────────────────

interface ABSMeProgress { libraryItems?: ABSProgress[] }

export async function getProgress(itemId: string): Promise<ABSProgress | null> {
  return C.fetch(`abs_progress_${itemId}`, async () => {
    try {
      const { data } = await client().get<ABSProgress>(
        `/api/me/progress/${itemId}`
      );
      return data ?? null;
    } catch {
      return null;
    }
  }, TTL.DETAIL);
}

// ── Podcast Episodes ────────────────────────────────────────────────────────

interface ABSPodcastResponse { episodes: ABSPodcastEpisode[] }

export async function getPodcastEpisodes(itemId: string): Promise<ABSPodcastEpisode[]> {
  return C.fetch(`abs_episodes_${itemId}`, async () => {
    const { data } = await client().get<ABSPodcastResponse>(`/api/podcasts/${itemId}/episodes`);
    return (data.episodes ?? []).sort((a, b) => {
      // Neueste Episode zuerst
      return (b.pubDate ?? '') > (a.pubDate ?? '') ? 1 : -1;
    });
  }, TTL.COLLECTION);
}

// ── Search ──────────────────────────────────────────────────────────────────

interface ABSSearchResult { book?: ABSLibraryItem[]; podcast?: ABSLibraryItem[] }

export async function searchItems(libraryId: string, q: string): Promise<ABSLibraryItem[]> {
  const { data } = await client().get<{ results?: ABSLibraryItem[] }>(
    `/api/libraries/${libraryId}/search`,
    { params: { q, limit: 20 } }
  );
  return data.results ?? [];
}

export async function getStatus(): Promise<unknown> {
  return C.fetch('abs_status', async () => {
    const { data } = await client().get('/ping');
    return data;
  }, TTL.LONG);
}
