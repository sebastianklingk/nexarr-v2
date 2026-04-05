import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useApi } from '../composables/useApi.js';
import type { LidarrArtist, LidarrAlbum } from '@nexarr/shared';

export const useMusicStore = defineStore('music', () => {
  const artists    = ref<LidarrArtist[]>([]);
  const albums     = ref<LidarrAlbum[]>([]);
  const isLoading  = ref(false);
  const error      = ref<string | null>(null);
  const lastFetch  = ref<number | null>(null);

  const { get } = useApi();

  // ── Getters ──────────────────────────────────────────────────────────────
  const artistById = computed(() =>
    (id: number) => artists.value.find(a => a.id === id)
  );

  const sortedArtists = computed(() =>
    [...artists.value].sort((a, b) => a.sortName.localeCompare(b.sortName))
  );

  const stats = computed(() => ({
    total:     artists.value.length,
    artists:   artists.value.length,
    albums:    albums.value.length,
    monitored: artists.value.filter(a => a.monitored).length,
  }));

  // ── Actions ──────────────────────────────────────────────────────────────
  async function fetchArtists(force = false): Promise<void> {
    if (!force && artists.value.length > 0 && lastFetch.value) {
      if (Date.now() - lastFetch.value < 5 * 60 * 1000) return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      artists.value = await get<LidarrArtist[]>('/api/lidarr/artists');
      lastFetch.value = Date.now();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Künstler konnten nicht geladen werden';
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchArtist(id: number): Promise<LidarrArtist | null> {
    const cached = artistById.value(id);
    if (cached) return cached;
    try {
      return await get<LidarrArtist>(`/api/lidarr/artists/${id}`);
    } catch {
      return null;
    }
  }

  async function fetchAlbums(): Promise<void> {
    if (albums.value.length > 0) return;
    try {
      albums.value = await get<LidarrAlbum[]>('/api/lidarr/albums');
    } catch {
      // Albums sind optional
    }
  }

  return {
    artists, albums, isLoading, error, lastFetch,
    artistById, sortedArtists, stats,
    fetchArtists, fetchArtist, fetchAlbums,
  };
});
