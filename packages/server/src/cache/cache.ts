import { TTL } from '../config/constants.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  fetchedAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

/**
 * Cache Backbone v2
 *
 * Nutzung:
 *   const movies = await C.fetch('radarr_movies', () => radarrService.getMovies(), TTL.COLLECTION);
 */
export const C = {
  TTL,

  async fetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = TTL.COLLECTION
  ): Promise<T> {
    const entry = store.get(key) as CacheEntry<T> | undefined;

    if (entry && Date.now() < entry.expiresAt) {
      return entry.data;
    }

    const data = await fetcher();
    store.set(key, { data, expiresAt: Date.now() + ttl, fetchedAt: Date.now() });
    return data;
  },

  get<T>(key: string): T | undefined {
    const entry = store.get(key) as CacheEntry<T> | undefined;
    if (!entry || Date.now() >= entry.expiresAt) return undefined;
    return entry.data;
  },

  set<T>(key: string, data: T, ttl: number = TTL.COLLECTION): void {
    store.set(key, { data, expiresAt: Date.now() + ttl, fetchedAt: Date.now() });
  },

  invalidate(key: string): void {
    store.delete(key);
  },

  invalidatePattern(pattern: string): void {
    for (const key of store.keys()) {
      if (key.includes(pattern)) store.delete(key);
    }
  },

  clear(): void {
    store.clear();
  },

  stats() {
    const now = Date.now();
    let active = 0;
    let stale = 0;
    for (const entry of store.values()) {
      if (now < entry.expiresAt) active++;
      else stale++;
    }
    return { total: store.size, active, stale };
  },
};
