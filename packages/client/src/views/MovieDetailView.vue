<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMoviesStore } from '../stores/movies.store.js';
import { useApi } from '../composables/useApi.js';
import type { RadarrMovie } from '@nexarr/shared';

const route  = useRoute();
const router = useRouter();
const store  = useMoviesStore();

const movie        = ref<RadarrMovie | null>(null);
const isLoading    = ref(true);
const activeTab    = ref<'overview' | 'files'>('overview');
const isSearching  = ref(false);
const searchStatus = ref<'idle' | 'ok' | 'error'>('idle');

const { post } = useApi();

async function triggerSearch() {
  if (!movie.value || isSearching.value) return;
  isSearching.value = true;
  searchStatus.value = 'idle';
  try {
    await post(`/api/radarr/movies/${movie.value.id}/search`);
    searchStatus.value = 'ok';
  } catch {
    searchStatus.value = 'error';
  } finally {
    isSearching.value = false;
    setTimeout(() => { searchStatus.value = 'idle'; }, 3000);
  }
}

const movieId = computed(() => Number(route.params.id));

const fanartUrl = computed(() => {
  const img = movie.value?.images?.find(i => i.coverType === 'fanart');
  return img?.remoteUrl;
});

const posterUrl = computed(() => {
  const img = movie.value?.images?.find(i => i.coverType === 'poster');
  return img?.remoteUrl;
});

const imdbRating = computed(() => movie.value?.ratings?.imdb?.value?.toFixed(1));
const tmdbRating = computed(() => movie.value?.ratings?.tmdb?.value?.toFixed(1));

function formatRuntime(minutes?: number): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  const gb = bytes / 1024 / 1024 / 1024;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

onMounted(async () => {
  if (store.movies.length === 0) await store.fetchMovies();
  movie.value = await store.fetchMovie(movieId.value);
  isLoading.value = false;
});
</script>

<template>
  <div class="detail-view">

    <!-- Loading -->
    <div v-if="isLoading" class="detail-loading">
      <div class="skeleton skeleton-hero" />
      <div class="detail-body">
        <div class="skeleton skeleton-title" />
        <div class="skeleton skeleton-meta" />
        <div class="skeleton skeleton-overview" />
      </div>
    </div>

    <!-- Not Found -->
    <div v-else-if="!movie" class="empty-state">
      <p class="empty-title">Film nicht gefunden</p>
      <button class="back-btn" @click="router.back()">← Zurück</button>
    </div>

    <!-- Content -->
    <template v-else>

      <!-- Hero -->
      <div class="hero" :style="fanartUrl ? `--fanart: url('${fanartUrl}')` : ''">
        <div class="hero-bg" />
        <div class="hero-gradient" />

        <div class="hero-content">
          <!-- Back -->
          <button class="back-btn hero-back" @click="router.back()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Filme
          </button>

          <div class="hero-main">
            <!-- Poster -->
            <img v-if="posterUrl" :src="posterUrl" :alt="movie.title" class="hero-poster" />
            <div v-else class="hero-poster hero-poster--placeholder">
              {{ movie.title[0] }}
            </div>

            <!-- Info -->
            <div class="hero-info">
              <div class="hero-app-indicator" />

              <h1 class="hero-title">{{ movie.title }}</h1>

              <div class="hero-meta">
                <span v-if="movie.year" class="meta-item">{{ movie.year }}</span>
                <span class="meta-sep">·</span>
                <span v-if="movie.runtime" class="meta-item">{{ formatRuntime(movie.runtime) }}</span>
                <span v-if="movie.genres?.length" class="meta-sep">·</span>
                <span v-if="movie.genres?.length" class="meta-item">{{ movie.genres.slice(0, 3).join(', ') }}</span>
              </div>

              <!-- Ratings -->
              <div class="hero-ratings">
                <div v-if="tmdbRating" class="rating-chip rating-tmdb">
                  <span class="rating-label">TMDB</span>
                  <span class="rating-value">{{ tmdbRating }}</span>
                </div>
                <div v-if="imdbRating" class="rating-chip rating-imdb">
                  <span class="rating-label">IMDb</span>
                  <span class="rating-value">{{ imdbRating }}</span>
                </div>
              </div>

              <!-- Actions -->
              <div class="hero-actions">
                <button
                  class="action-btn action-search"
                  :class="{ loading: isSearching, success: searchStatus === 'ok', error: searchStatus === 'error' }"
                  :disabled="isSearching"
                  @click="triggerSearch"
                >
                  <svg v-if="isSearching" class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  <svg v-else-if="searchStatus === 'ok'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <svg v-else-if="searchStatus === 'error'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <span>{{ isSearching ? 'Suche läuft…' : searchStatus === 'ok' ? 'Gestartet!' : searchStatus === 'error' ? 'Fehler' : 'Jetzt suchen' }}</span>
                </button>
              </div>

              <!-- Status Badges -->
              <div class="hero-badges">
                <span :class="['status-badge', movie.hasFile ? 'badge-ok' : 'badge-missing']">
                  {{ movie.hasFile ? '✓ Vorhanden' : '✗ Fehlt' }}
                </span>
                <span v-if="!movie.monitored" class="status-badge badge-unmonitored">
                  Nicht überwacht
                </span>
                <span v-if="movie.movieFile" class="status-badge badge-quality">
                  {{ movie.movieFile.quality?.quality?.name }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs-bar">
        <button
          v-for="tab in (['overview', 'files'] as const)"
          :key="tab"
          :class="['tab-btn', { active: activeTab === tab }]"
          @click="activeTab = tab"
        >
          {{ tab === 'overview' ? 'Übersicht' : 'Datei' }}
        </button>
      </div>

      <!-- Tab: Übersicht -->
      <div v-if="activeTab === 'overview'" class="tab-content">
        <p v-if="movie.overview" class="overview-text">{{ movie.overview }}</p>
        <p v-else class="no-overview">Keine Beschreibung verfügbar.</p>

        <div class="details-grid">
          <div v-if="movie.inCinemas" class="detail-item">
            <span class="detail-label">Kinostart</span>
            <span class="detail-value">{{ new Date(movie.inCinemas).toLocaleDateString('de-DE') }}</span>
          </div>
          <div v-if="movie.digitalRelease" class="detail-item">
            <span class="detail-label">Digital</span>
            <span class="detail-value">{{ new Date(movie.digitalRelease).toLocaleDateString('de-DE') }}</span>
          </div>
          <div v-if="movie.imdbId" class="detail-item">
            <span class="detail-label">IMDb</span>
            <a
              :href="`https://www.imdb.com/title/${movie.imdbId}`"
              target="_blank"
              rel="noopener"
              class="detail-link"
            >{{ movie.imdbId }}</a>
          </div>
        </div>
      </div>

      <!-- Tab: Datei -->
      <div v-if="activeTab === 'files'" class="tab-content">
        <div v-if="movie.movieFile" class="file-info">
          <div class="file-badges">
            <span class="file-badge">{{ movie.movieFile.quality?.quality?.name }}</span>
            <span v-if="movie.movieFile.mediaInfo?.videoCodec" class="file-badge">
              {{ movie.movieFile.mediaInfo.videoCodec }}
            </span>
            <span v-if="movie.movieFile.mediaInfo?.audioCodec" class="file-badge">
              {{ movie.movieFile.mediaInfo.audioCodec }}
            </span>
            <span v-if="movie.movieFile.mediaInfo?.audioChannels" class="file-badge">
              {{ movie.movieFile.mediaInfo.audioChannels }}ch
            </span>
          </div>
          <p class="file-size">{{ formatBytes(movie.movieFile.size) }}</p>
        </div>
        <div v-else class="empty-state-inline">
          <p>Keine Datei vorhanden.</p>
        </div>
      </div>

    </template>
  </div>
</template>

<style scoped>
.detail-view {
  min-height: 100%;
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */
.hero {
  position: relative;
  min-height: 420px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.hero-bg {
  position: absolute;
  inset: 0;
  background-image: var(--fanart);
  background-size: cover;
  background-position: center top;
  z-index: 0;
}

.hero-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(10, 10, 10, 0.2) 0%,
    rgba(10, 10, 10, 0.6) 50%,
    rgba(10, 10, 10, 0.97) 100%
  );
  z-index: 1;
}

.hero-content {
  position: relative;
  z-index: 2;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--text-tertiary);
  font-size: var(--text-sm);
  transition: color 0.15s ease;
  align-self: flex-start;
}

.back-btn:hover { color: var(--text-primary); }

.hero-main {
  display: flex;
  gap: var(--space-6);
  align-items: flex-end;
}

.hero-poster {
  width: 120px;
  min-width: 120px;
  aspect-ratio: 2 / 3;
  object-fit: cover;
  border-radius: var(--radius-md);
  border: 1px solid var(--bg-border);
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  flex-shrink: 0;
}

.hero-poster--placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elevated);
  font-size: 48px;
  font-weight: 700;
  color: var(--text-muted);
}

.hero-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-bottom: var(--space-2);
}

.hero-app-indicator {
  width: 32px;
  height: 3px;
  background: var(--radarr);
  border-radius: 2px;
}

.hero-title {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
  max-width: 700px;
}

.hero-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text-tertiary);
  font-size: var(--text-sm);
  flex-wrap: wrap;
}

.meta-sep { color: var(--text-muted); }

.hero-ratings {
  display: flex;
  gap: var(--space-2);
}

.rating-chip {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: 3px 10px;
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 600;
}

.rating-tmdb { background: rgba(1, 180, 228, 0.15); border: 1px solid rgba(1, 180, 228, 0.3); }
.rating-imdb { background: rgba(245, 197, 24, 0.15); border: 1px solid rgba(245, 197, 24, 0.3); }

.rating-label { color: var(--text-muted); font-weight: 400; }
.rating-value { color: var(--text-primary); }

.hero-badges {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.status-badge {
  padding: 2px 10px;
  border-radius: 99px;
  font-size: var(--text-xs);
  font-weight: 500;
}

.badge-ok       { background: rgba(34,197,94,0.12); color: var(--status-success); border: 1px solid rgba(34,197,94,0.25); }
.badge-missing  { background: rgba(248,113,113,0.12); color: var(--status-error); border: 1px solid rgba(248,113,113,0.25); }
.badge-unmonitored { background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--bg-border); }
.badge-quality  { background: rgba(244,165,74,0.12); color: var(--radarr); border: 1px solid rgba(244,165,74,0.25); }

/* ── Actions ─────────────────────────────────────────────────────────────── */
.hero-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 6px 14px;
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 500;
  transition: background 0.15s ease, opacity 0.15s ease;
  cursor: pointer;
}

.action-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.action-search {
  background: rgba(244, 165, 74, 0.15);
  border: 1px solid rgba(244, 165, 74, 0.35);
  color: var(--text-secondary);
}
.action-search:not(:disabled):hover {
  background: rgba(244, 165, 74, 0.25);
  border-color: rgba(244, 165, 74, 0.55);
  color: var(--text-primary);
}
.action-search.success {
  background: rgba(34,197,94,0.15);
  border-color: rgba(34,197,94,0.35);
}
.action-search.error {
  background: rgba(248,113,113,0.15);
  border-color: rgba(248,113,113,0.35);
}

@keyframes spin { to { transform: rotate(360deg); } }
.spin-icon { animation: spin 0.8s linear infinite; }

/* ── Tabs ──────────────────────────────────────────────────────────────────── */
.tabs-bar {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--bg-border);
  padding: 0 var(--space-6);
}

.tab-btn {
  padding: var(--space-3) var(--space-5);
  font-size: var(--text-sm);
  color: var(--text-muted);
  border-bottom: 2px solid transparent;
  transition: color 0.15s ease, border-color 0.15s ease;
  margin-bottom: -1px;
}

.tab-btn:hover { color: var(--text-secondary); }
.tab-btn.active {
  color: var(--text-primary);
  border-bottom-color: var(--radarr);
}

/* ── Tab Content ──────────────────────────────────────────────────────────── */
.tab-content {
  padding: var(--space-6);
  max-width: 800px;
}

.overview-text {
  color: var(--text-tertiary);
  line-height: 1.7;
  font-size: var(--text-base);
  margin-bottom: var(--space-6);
}

.no-overview {
  color: var(--text-muted);
  font-style: italic;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-4);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.detail-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.detail-value { font-size: var(--text-sm); color: var(--text-secondary); }
.detail-link  { font-size: var(--text-sm); color: var(--tmdb); text-decoration: underline; }

/* File Info */
.file-badges {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.file-badge {
  padding: 3px 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  color: var(--text-secondary);
  font-weight: 500;
}

.file-size {
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.empty-state-inline {
  color: var(--text-muted);
  font-size: var(--text-sm);
}

/* Loading Skeletons */
.detail-loading { display: flex; flex-direction: column; }
.skeleton-hero   { height: 420px; width: 100%; border-radius: 0; }
.detail-body     { padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-3); }
.skeleton-title  { height: 36px; width: 50%; border-radius: var(--radius-md); }
.skeleton-meta   { height: 18px; width: 30%; border-radius: var(--radius-md); }
.skeleton-overview { height: 80px; width: 100%; border-radius: var(--radius-md); }

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  gap: var(--space-4);
}

.empty-title {
  font-size: var(--text-lg);
  color: var(--text-secondary);
  font-weight: 600;
}
</style>
