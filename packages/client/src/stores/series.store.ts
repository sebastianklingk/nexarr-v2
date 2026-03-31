import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useApi } from '../composables/useApi.js';
import type { SonarrSeries, SonarrEpisode } from '@nexarr/shared';

export const useSeriesStore = defineStore('series', () => {
  const series     = ref<SonarrSeries[]>([]);
  const episodes   = ref<Map<number, SonarrEpisode[]>>(new Map());
  const isLoading  = ref(false);
  const error      = ref<string | null>(null);
  const lastFetch  = ref<number | null>(null);

  const { get } = useApi();

  // ── Getters ──────────────────────────────────────────────────────────────
  const seriesById = computed(() =>
    (id: number) => series.value.find(s => s.id === id)
  );

  const sortedByTitle = computed(() =>
    [...series.value].sort((a, b) => a.sortTitle.localeCompare(b.sortTitle))
  );

  const stats = computed(() => ({
    total:      series.value.length,
    continuing: series.value.filter(s => s.status === 'continuing').length,
    ended:      series.value.filter(s => s.status === 'ended').length,
  }));

  // ── Actions ──────────────────────────────────────────────────────────────
  async function fetchSeries(force = false): Promise<void> {
    if (!force && series.value.length > 0 && lastFetch.value) {
      if (Date.now() - lastFetch.value < 5 * 60 * 1000) return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      series.value = await get<SonarrSeries[]>('/api/sonarr/series');
      lastFetch.value = Date.now();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Serien konnten nicht geladen werden';
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchSeriesById(id: number): Promise<SonarrSeries | null> {
    const cached = seriesById.value(id);
    if (cached) return cached;
    try {
      return await get<SonarrSeries>(`/api/sonarr/series/${id}`);
    } catch {
      return null;
    }
  }

  async function fetchEpisodes(seriesId: number): Promise<SonarrEpisode[]> {
    if (episodes.value.has(seriesId)) return episodes.value.get(seriesId)!;
    try {
      const data = await get<SonarrEpisode[]>(`/api/sonarr/series/${seriesId}/episodes`);
      episodes.value.set(seriesId, data);
      return data;
    } catch {
      return [];
    }
  }

  return {
    series, isLoading, error, lastFetch,
    seriesById, sortedByTitle, stats,
    fetchSeries, fetchSeriesById, fetchEpisodes,
  };
});
