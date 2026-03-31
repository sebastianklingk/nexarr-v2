<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useMoviesStore } from '../stores/movies.store.js';
import PosterCard from '../components/ui/PosterCard.vue';
import type { RadarrMovie } from '@nexarr/shared';

const router = useRouter();
const store  = useMoviesStore();

// ── Filter & Sort State ──────────────────────────────────────────────────────
const search   = ref('');
const filter   = ref<'all' | 'available' | 'missing'>('all');
const sortBy   = ref<'title' | 'year' | 'added' | 'rating'>('title');
const sortDir  = ref<'asc' | 'desc'>('asc');

// ── Computed ─────────────────────────────────────────────────────────────────
const filtered = computed(() => {
  let list: RadarrMovie[] = [...store.movies];

  // Suche
  if (search.value.trim()) {
    const q = search.value.toLowerCase();
    list = list.filter(m =>
      m.title.toLowerCase().includes(q) ||
      m.originalTitle?.toLowerCase().includes(q)
    );
  }

  // Status-Filter
  if (filter.value === 'available') list = list.filter(m => m.hasFile);
  if (filter.value === 'missing')   list = list.filter(m => !m.hasFile && m.monitored);

  // Sortierung
  list.sort((a, b) => {
    let cmp = 0;
    if (sortBy.value === 'title')  cmp = a.sortTitle.localeCompare(b.sortTitle);
    if (sortBy.value === 'year')   cmp = (a.year ?? 0) - (b.year ?? 0);
    if (sortBy.value === 'added')  cmp = a.added.localeCompare(b.added);
    if (sortBy.value === 'rating') cmp = (a.ratings?.tmdb?.value ?? 0) - (b.ratings?.tmdb?.value ?? 0);
    return sortDir.value === 'asc' ? cmp : -cmp;
  });

  return list;
});

// Proxy URL für Poster (Server proxied Radarr Images)
function posterUrl(movie: RadarrMovie): string | undefined {
  const poster = movie.images?.find(i => i.coverType === 'poster');
  if (!poster) return undefined;
  // Direkt Radarr-URL verwenden (CORS geht über Proxy)
  return poster.remoteUrl;
}

function openMovie(movie: RadarrMovie) {
  router.push(`/movies/${movie.id}`);
}

function toggleSort(field: typeof sortBy.value) {
  if (sortBy.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortBy.value = field;
    sortDir.value = 'asc';
  }
}

onMounted(() => store.fetchMovies());
</script>

<template>
  <div class="movies-view page-context" style="--context-color: var(--radarr)">

    <!-- Header -->
    <div class="view-header">
      <div class="header-left">
        <h1 class="view-title">
          <span class="title-bar" />
          Filme
          <span v-if="!store.isLoading" class="title-count">{{ store.stats.total }}</span>
        </h1>
        <div class="header-stats">
          <span class="stat-chip stat-available">{{ store.stats.available }} vorhanden</span>
          <span v-if="store.stats.missing > 0" class="stat-chip stat-missing">
            {{ store.stats.missing }} fehlen
          </span>
        </div>
      </div>

      <!-- Suche -->
      <div class="search-wrap">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          v-model="search"
          class="search-input"
          type="search"
          placeholder="Filme suchen…"
        />
      </div>
    </div>

    <!-- Toolbar -->
    <div class="toolbar">
      <!-- Status Filter -->
      <div class="filter-group">
        <button
          v-for="f in (['all', 'available', 'missing'] as const)"
          :key="f"
          :class="['filter-btn', { active: filter === f }]"
          @click="filter = f"
        >
          {{ f === 'all' ? 'Alle' : f === 'available' ? 'Vorhanden' : 'Fehlen' }}
        </button>
      </div>

      <!-- Sort -->
      <div class="sort-group">
        <button
          v-for="s in (['title', 'year', 'added', 'rating'] as const)"
          :key="s"
          :class="['sort-btn', { active: sortBy === s }]"
          @click="toggleSort(s)"
        >
          {{ s === 'title' ? 'Titel' : s === 'year' ? 'Jahr' : s === 'added' ? 'Hinzugefügt' : 'Bewertung' }}
          <span v-if="sortBy === s" class="sort-arrow">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
        </button>
      </div>

      <span class="results-count">{{ filtered.length }} Ergebnisse</span>
    </div>

    <!-- Error -->
    <div v-if="store.error" class="error-banner">
      {{ store.error }}
    </div>

    <!-- Skeleton loading -->
    <div v-if="store.isLoading" class="poster-grid">
      <div v-for="i in 24" :key="i" class="skeleton-card">
        <div class="skeleton skeleton-poster" />
        <div class="skeleton-info">
          <div class="skeleton skeleton-line" style="width: 80%" />
          <div class="skeleton skeleton-line" style="width: 40%; margin-top: 4px" />
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="!store.isLoading && filtered.length === 0" class="empty-state">
      <div class="empty-icon">🎬</div>
      <p class="empty-title">Keine Filme gefunden</p>
      <p class="empty-sub">
        {{ search ? `Keine Ergebnisse für „${search}"` : 'Radarr enthält noch keine Filme.' }}
      </p>
    </div>

    <!-- Grid -->
    <div v-else class="poster-grid">
      <PosterCard
        v-for="movie in filtered"
        :key="movie.id"
        :title="movie.title"
        :year="movie.year"
        :poster-url="posterUrl(movie)"
        :rating="movie.ratings?.tmdb?.value"
        :has-file="movie.hasFile"
        :monitored="movie.monitored"
        app-color="var(--radarr)"
        @click="openMovie(movie)"
      />
    </div>

  </div>
</template>

<style scoped>
.movies-view {
  padding: var(--space-6);
  min-height: 100%;
}

/* Header */
.view-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
  flex-wrap: wrap;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.view-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-primary);
}

.title-bar {
  display: inline-block;
  width: 3px;
  height: 1.2em;
  background: var(--context-color);
  border-radius: 2px;
  flex-shrink: 0;
}

.title-count {
  font-size: var(--text-base);
  font-weight: 400;
  color: var(--text-muted);
}

.header-stats {
  display: flex;
  gap: var(--space-2);
}

.stat-chip {
  font-size: var(--text-xs);
  padding: 2px 8px;
  border-radius: 99px;
  font-weight: 500;
}

.stat-available {
  background: rgba(34, 197, 94, 0.12);
  color: var(--status-success);
  border: 1px solid rgba(34, 197, 94, 0.25);
}

.stat-missing {
  background: rgba(248, 113, 113, 0.12);
  color: var(--status-error);
  border: 1px solid rgba(248, 113, 113, 0.25);
}

/* Search */
.search-wrap {
  position: relative;
  flex-shrink: 0;
}

.search-icon {
  position: absolute;
  left: var(--space-3);
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  pointer-events: none;
}

.search-input {
  width: 260px;
  padding: var(--space-2) var(--space-3) var(--space-2) 36px;
  background: var(--bg-elevated);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: var(--text-sm);
  outline: none;
  transition: border-color 0.15s ease;
}

.search-input:focus {
  border-color: var(--radarr);
}

/* Toolbar */
.toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
  flex-wrap: wrap;
}

.filter-group,
.sort-group {
  display: flex;
  gap: 2px;
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: 2px;
  border: 1px solid var(--bg-border);
}

.filter-btn,
.sort-btn {
  padding: var(--space-1) var(--space-3);
  border-radius: calc(var(--radius-md) - 2px);
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  transition: background 0.15s ease, color 0.15s ease;
  white-space: nowrap;
}

.filter-btn:hover,
.sort-btn:hover {
  color: var(--text-secondary);
}

.filter-btn.active,
.sort-btn.active {
  background: var(--bg-overlay);
  color: var(--text-primary);
}

.sort-arrow {
  margin-left: 2px;
  opacity: 0.7;
}

.results-count {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-left: auto;
}

/* Error */
.error-banner {
  padding: var(--space-4);
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.3);
  border-radius: var(--radius-md);
  color: var(--status-error);
  margin-bottom: var(--space-5);
  font-size: var(--text-sm);
}

/* Grid */
.poster-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: var(--space-3);
}

/* Skeleton */
.skeleton-card {
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
}

.skeleton-poster {
  aspect-ratio: 2 / 3;
  width: 100%;
}

.skeleton-info {
  padding: var(--space-2);
}

.skeleton-line {
  height: 12px;
  border-radius: 4px;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-4);
  gap: var(--space-3);
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  line-height: 1;
}

.empty-title {
  font-size: var(--text-lg);
  color: var(--text-secondary);
  font-weight: 600;
}

.empty-sub {
  color: var(--text-muted);
  font-size: var(--text-sm);
}
</style>
