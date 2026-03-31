<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useMoviesStore } from '../stores/movies.store.js';
import { useSeriesStore } from '../stores/series.store.js';
import { useMusicStore }  from '../stores/music.store.js';
import type { RadarrMovie, SonarrSeries, LidarrArtist } from '@nexarr/shared';

const router = useRouter();
const movies = useMoviesStore();
const series = useSeriesStore();
const music  = useMusicStore();

const query    = ref('');
const filter   = ref<'all' | 'movies' | 'series' | 'music'>('all');
const inputRef = ref<HTMLInputElement | null>(null);

onMounted(async () => {
  inputRef.value?.focus();
  await Promise.allSettled([
    movies.fetchMovies(),
    series.fetchSeries(),
    music.fetchArtists(),
  ]);
});

// ── Search Results ────────────────────────────────────────────────────────────

const q = computed(() => query.value.trim().toLowerCase());

const movieResults = computed<RadarrMovie[]>(() => {
  if (!q.value || filter.value === 'series' || filter.value === 'music') return [];
  return movies.movies
    .filter(m =>
      m.title.toLowerCase().includes(q.value) ||
      m.originalTitle?.toLowerCase().includes(q.value) ||
      String(m.year).includes(q.value)
    )
    .slice(0, 20);
});

const seriesResults = computed<SonarrSeries[]>(() => {
  if (!q.value || filter.value === 'movies' || filter.value === 'music') return [];
  return series.series
    .filter(s =>
      s.title.toLowerCase().includes(q.value) ||
      s.network?.toLowerCase().includes(q.value) ||
      String(s.year).includes(q.value)
    )
    .slice(0, 20);
});

const artistResults = computed<LidarrArtist[]>(() => {
  if (!q.value || filter.value === 'movies' || filter.value === 'series') return [];
  return music.artists
    .filter(a =>
      a.artistName.toLowerCase().includes(q.value) ||
      a.genres?.some(g => g.toLowerCase().includes(q.value))
    )
    .slice(0, 20);
});

const totalCount = computed(() =>
  movieResults.value.length + seriesResults.value.length + artistResults.value.length
);

const isLoading = computed(() => movies.isLoading || series.isLoading || music.isLoading);

// ── Helpers ───────────────────────────────────────────────────────────────────

function posterUrl(images: Array<{ coverType: string; remoteUrl: string }>): string | undefined {
  return images?.find(i => i.coverType === 'poster')?.remoteUrl;
}

function highlight(text: string): string {
  if (!q.value) return text;
  const re = new RegExp(`(${q.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(re, '<mark>$1</mark>');
}

function openMovie(m: RadarrMovie)   { router.push(`/movies/${m.id}`); }
function openSeries(s: SonarrSeries) { router.push(`/series/${s.id}`); }
function openArtist(a: LidarrArtist) { router.push(`/music/${a.id}`); }
</script>

<template>
  <div class="search-view page-context" style="--context-color: var(--text-tertiary)">

    <!-- Search Bar -->
    <div class="search-hero">
      <div class="search-box">
        <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          ref="inputRef"
          v-model="query"
          class="search-input"
          type="search"
          placeholder="Filme, Serien, Künstler durchsuchen…"
          autocomplete="off"
          spellcheck="false"
        />
        <button v-if="query" class="search-clear" @click="query = ''">✕</button>
      </div>

      <!-- Filters -->
      <div class="filter-row">
        <button
          v-for="f in (['all', 'movies', 'series', 'music'] as const)"
          :key="f"
          :class="['filter-btn', { active: filter === f }]"
          @click="filter = f"
        >
          <span v-if="f === 'all'">Alle</span>
          <span v-else-if="f === 'movies'">🎬 Filme</span>
          <span v-else-if="f === 'series'">📺 Serien</span>
          <span v-else>🎵 Musik</span>
        </button>
        <span v-if="query && !isLoading" class="result-count">
          {{ totalCount }} Ergebnis{{ totalCount !== 1 ? 'se' : '' }}
        </span>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-hint">Bibliothek wird geladen…</div>

    <!-- Empty Query -->
    <div v-else-if="!query" class="start-hint">
      <div class="hint-icon">🔍</div>
      <p>Tippe um in {{ movies.stats.total + series.stats.total + music.stats.total }} Einträgen zu suchen</p>
    </div>

    <!-- No Results -->
    <div v-else-if="totalCount === 0" class="empty-state">
      <div class="empty-icon">😶</div>
      <p class="empty-title">Keine Ergebnisse für „{{ query }}"</p>
      <p class="empty-sub">Versuche einen anderen Suchbegriff oder ändere den Filter.</p>
    </div>

    <!-- Results -->
    <div v-else class="results">

      <!-- Filme -->
      <section v-if="movieResults.length > 0" class="result-section">
        <h2 class="section-title" style="--sec-color: var(--radarr)">
          <span class="sec-dot" />
          Filme
          <span class="sec-count">{{ movieResults.length }}</span>
        </h2>
        <div class="result-list">
          <button
            v-for="m in movieResults"
            :key="m.id"
            class="result-item"
            style="--item-color: var(--radarr)"
            @click="openMovie(m)"
          >
            <img
              v-if="posterUrl(m.images)"
              :src="posterUrl(m.images)"
              :alt="m.title"
              class="result-thumb"
            />
            <div v-else class="result-thumb result-thumb--placeholder">🎬</div>
            <div class="result-info">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <p class="result-title" v-html="highlight(m.title)" />
              <p class="result-meta">{{ m.year }} · {{ m.genres?.slice(0,2).join(', ') }}</p>
            </div>
            <span :class="['result-status', m.hasFile ? 'status-ok' : 'status-miss']">
              {{ m.hasFile ? '✓' : '○' }}
            </span>
          </button>
        </div>
      </section>

      <!-- Serien -->
      <section v-if="seriesResults.length > 0" class="result-section">
        <h2 class="section-title" style="--sec-color: var(--sonarr)">
          <span class="sec-dot" />
          Serien
          <span class="sec-count">{{ seriesResults.length }}</span>
        </h2>
        <div class="result-list">
          <button
            v-for="s in seriesResults"
            :key="s.id"
            class="result-item"
            style="--item-color: var(--sonarr)"
            @click="openSeries(s)"
          >
            <img
              v-if="posterUrl(s.images)"
              :src="posterUrl(s.images)"
              :alt="s.title"
              class="result-thumb"
            />
            <div v-else class="result-thumb result-thumb--placeholder">📺</div>
            <div class="result-info">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <p class="result-title" v-html="highlight(s.title)" />
              <p class="result-meta">{{ s.year }} · {{ s.network }} · {{ s.seasons?.length }} Staffeln</p>
            </div>
            <span :class="['result-status', s.status === 'continuing' ? 'status-ok' : 'status-miss']">
              {{ s.status === 'continuing' ? '▶' : '■' }}
            </span>
          </button>
        </div>
      </section>

      <!-- Musik -->
      <section v-if="artistResults.length > 0" class="result-section">
        <h2 class="section-title" style="--sec-color: var(--lidarr)">
          <span class="sec-dot" />
          Künstler
          <span class="sec-count">{{ artistResults.length }}</span>
        </h2>
        <div class="result-list">
          <button
            v-for="a in artistResults"
            :key="a.id"
            class="result-item"
            style="--item-color: var(--lidarr)"
            @click="openArtist(a)"
          >
            <img
              v-if="posterUrl(a.images)"
              :src="posterUrl(a.images)"
              :alt="a.artistName"
              class="result-thumb result-thumb--round"
            />
            <div v-else class="result-thumb result-thumb--placeholder result-thumb--round">🎵</div>
            <div class="result-info">
              <!-- eslint-disable-next-line vue/no-v-html -->
              <p class="result-title" v-html="highlight(a.artistName)" />
              <p class="result-meta">{{ a.genres?.slice(0,3).join(', ') || 'Musik' }}</p>
            </div>
            <span :class="['result-status', a.monitored ? 'status-ok' : 'status-miss']">
              {{ a.monitored ? '✓' : '○' }}
            </span>
          </button>
        </div>
      </section>

    </div>
  </div>
</template>

<style scoped>
.search-view {
  padding: var(--space-6);
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* ── Search Hero ── */
.search-hero {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.search-box {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: var(--space-4);
  color: var(--text-muted);
  pointer-events: none;
  flex-shrink: 0;
}

.search-input {
  width: 100%;
  padding: var(--space-3) var(--space-4) var(--space-3) 48px;
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: var(--text-lg);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.search-input:focus {
  border-color: var(--text-muted);
  box-shadow: 0 0 0 3px rgba(255,255,255,0.04);
}

.search-clear {
  position: absolute;
  right: var(--space-4);
  color: var(--text-muted);
  font-size: var(--text-sm);
  transition: color 0.15s ease;
}
.search-clear:hover { color: var(--text-secondary); }

/* Filters */
.filter-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.filter-btn {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  color: var(--text-tertiary);
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  cursor: pointer;
}
.filter-btn:hover { color: var(--text-secondary); background: var(--bg-elevated); }
.filter-btn.active {
  background: var(--bg-overlay);
  color: var(--text-primary);
  border-color: var(--text-muted);
}

.result-count {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin-left: auto;
}

/* ── Hints ── */
.loading-hint {
  font-size: var(--text-sm);
  color: var(--text-muted);
  text-align: center;
  padding: var(--space-8) 0;
}

.start-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-10) 0;
  color: var(--text-muted);
  font-size: var(--text-sm);
  text-align: center;
}
.hint-icon { font-size: 40px; }

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-10) 0;
  text-align: center;
}
.empty-icon  { font-size: 40px; }
.empty-title { font-size: var(--text-lg); color: var(--text-secondary); font-weight: 600; margin: 0; }
.empty-sub   { color: var(--text-muted); font-size: var(--text-sm); margin: 0; }

/* ── Results ── */
.results {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.result-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.section-title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0;
}

.sec-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--sec-color);
  flex-shrink: 0;
}

.sec-count {
  font-weight: 400;
  color: var(--text-muted);
}

/* Result List */
.result-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.result-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-left: 2px solid transparent;
  border-radius: var(--radius-md);
  text-align: left;
  cursor: pointer;
  transition: background 0.1s ease, border-left-color 0.1s ease;
  width: 100%;
}

.result-item:hover {
  background: var(--bg-elevated);
  border-left-color: var(--item-color);
}

.result-thumb {
  width: 36px;
  height: 54px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  background: var(--bg-elevated);
}

.result-thumb--round {
  border-radius: 50%;
  width: 40px;
  height: 40px;
}

.result-thumb--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  border: 1px solid var(--bg-border);
}

.result-info {
  flex: 1;
  min-width: 0;
}

.result-title {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: 500;
  margin: 0 0 2px 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-title :deep(mark) {
  background: rgba(255, 255, 255, 0.15);
  color: var(--text-primary);
  border-radius: 2px;
  padding: 0 1px;
}

.result-meta {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-status {
  font-size: var(--text-sm);
  font-weight: 600;
  flex-shrink: 0;
}

.status-ok   { color: var(--status-success); }
.status-miss { color: var(--text-muted); }
</style>
