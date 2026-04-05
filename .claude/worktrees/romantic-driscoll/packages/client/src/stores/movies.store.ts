import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useApi } from '../composables/useApi.js';
import type { RadarrMovie } from '@nexarr/shared';

export const useMoviesStore = defineStore('movies', () => {
  const movies     = ref<RadarrMovie[]>([]);
  const isLoading  = ref(false);
  const error      = ref<string | null>(null);
  const lastFetch  = ref<number | null>(null);

  const { get } = useApi();

  // ── Getters ──────────────────────────────────────────────────────────────
  const movieById = computed(() =>
    (id: number) => movies.value.find(m => m.id === id)
  );

  const sortedByTitle = computed(() =>
    [...movies.value].sort((a, b) => a.sortTitle.localeCompare(b.sortTitle))
  );

  const stats = computed(() => ({
    total:     movies.value.length,
    available: movies.value.filter(m => m.hasFile).length,
    missing:   movies.value.filter(m => !m.hasFile && m.monitored).length,
  }));

  // ── Actions ──────────────────────────────────────────────────────────────
  async function fetchMovies(force = false): Promise<void> {
    // Nicht neu laden wenn wir die Daten schon haben (< 5 min alt)
    if (!force && movies.value.length > 0 && lastFetch.value) {
      if (Date.now() - lastFetch.value < 5 * 60 * 1000) return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      movies.value = await get<RadarrMovie[]>('/api/radarr/movies');
      lastFetch.value = Date.now();
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Filme konnten nicht geladen werden';
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchMovie(id: number): Promise<RadarrMovie | null> {
    // Erst im Store nachschauen
    const cached = movieById.value(id);
    if (cached) return cached;

    try {
      return await get<RadarrMovie>(`/api/radarr/movies/${id}`);
    } catch {
      return null;
    }
  }

  return {
    movies, isLoading, error, lastFetch,
    movieById, sortedByTitle, stats,
    fetchMovies, fetchMovie,
  };
});
