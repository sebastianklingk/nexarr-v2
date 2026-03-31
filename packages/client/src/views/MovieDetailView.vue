<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMoviesStore } from '../stores/movies.store.js';
import { useApi } from '../composables/useApi.js';
import type { RadarrMovie, BazarrSubtitle, TMDBCredits, TMDBVideo } from '@nexarr/shared';

const route  = useRoute();
const router = useRouter();
const store  = useMoviesStore();

const movie        = ref<RadarrMovie | null>(null);
const isLoading    = ref(true);
const activeTab    = ref<'overview' | 'files' | 'subtitles'>('overview');

// Bazarr
const subtitles         = ref<{ available: BazarrSubtitle[]; missing: BazarrSubtitle[]; monitored: boolean } | null>(null);
const subtitlesLoading  = ref(false);
const searchingLang     = ref<string | null>(null);
const searchLangStatus  = ref<Record<string, 'ok' | 'error'>>({});

async function loadSubtitles() {
  if (!movie.value || subtitles.value !== null) return;
  subtitlesLoading.value = true;
  try {
    const res = await fetch(`/api/bazarr/movies/${movie.value.id}/subtitles`, { credentials: 'include' });
    if (res.status === 503) { subtitles.value = { available: [], missing: [], monitored: false }; return; }
    subtitles.value = await res.json();
  } catch { subtitles.value = { available: [], missing: [], monitored: false }; }
  finally  { subtitlesLoading.value = false; }
}

async function searchSubtitle(language: string) {
  if (!movie.value || searchingLang.value) return;
  searchingLang.value = language;
  try {
    const { post } = useApi();
    await post(`/api/bazarr/movies/${movie.value.id}/subtitles/search`, { language });
    searchLangStatus.value[language] = 'ok';
    subtitles.value = null; // force reload
    setTimeout(() => loadSubtitles(), 1500);
  } catch {
    searchLangStatus.value[language] = 'error';
  } finally {
    searchingLang.value = null;
    setTimeout(() => { delete searchLangStatus.value[language]; }, 3000);
  }
}

async function deleteSubtitle(language: string, path: string) {
  if (!movie.value) return;
  await fetch(`/api/bazarr/movies/${movie.value.id}/subtitles?language=${encodeURIComponent(language)}&path=${encodeURIComponent(path)}`, {
    method: 'DELETE', credentials: 'include',
  });
  subtitles.value = null;
  await loadSubtitles();
}

function flagEmoji(code2: string): string {
  // Sprach-Code → Flagge (Best-effort)
  const map: Record<string, string> = {
    de: '🇩🇪', en: '🇬🇧', fr: '🇫🇷', es: '🇪🇸', it: '🇮🇹',
    nl: '🇳🇱', pt: '🇵🇹', pl: '🇵🇱', ru: '🇷🇺', ja: '🇯🇵',
    ko: '🇰🇷', zh: '🇨🇳', ar: '🇸🇦', tr: '🇹🇷', sv: '🇸🇪',
    da: '🇩🇰', fi: '🇫🇮', nb: '🇳🇴', cs: '🇨🇿', hu: '🇭🇺',
  };
  return map[code2] ?? '🏳️';
}

const isSearching  = ref(false);
const searchStatus = ref<'idle' | 'ok' | 'error'>('idle');

// TMDB
const tmdbCredits  = ref<TMDBCredits | null>(null);
const tmdbTrailer  = ref<TMDBVideo | null>(null);
const tmdbLoading  = ref(false);

// Plex
const plexUrl = ref<string | null>(null);

async function loadPlex() {
  if (!movie.value) return;
  try {
    // Plex via IMDB-ID suchen (fallback: Titel)
    const id = movie.value.imdbId ?? '';
    if (!id) return;
    // Wir nutzen Plex' /search Endpoint nicht – nur Deep-Link via imdbId
    // Der Button zeigt auf plex.tv/search?query=<title>
    plexUrl.value = `https://app.plex.tv/desktop#!/search?query=${encodeURIComponent(movie.value.title)}`;
  } catch { /* optional */ }
}

async function loadTmdb() {
  if (!movie.value?.tmdbId || tmdbCredits.value !== null) return;
  tmdbLoading.value = true;
  try {
    const [creditsRes, videosRes] = await Promise.all([
      fetch(`/api/tmdb/movie/${movie.value.tmdbId}/credits`, { credentials: 'include' }),
      fetch(`/api/tmdb/movie/${movie.value.tmdbId}/videos`,  { credentials: 'include' }),
    ]);
    if (creditsRes.ok) tmdbCredits.value = await creditsRes.json();
    if (videosRes.ok) {
      const vdata = await videosRes.json();
      // Offiziellen Trailer bevorzugen, dann ersten Trailer, dann ersten Teaser
      tmdbTrailer.value =
        vdata.results.find((v: TMDBVideo) => v.type === 'Trailer' && v.official) ??
        vdata.results.find((v: TMDBVideo) => v.type === 'Trailer') ??
        vdata.results.find((v: TMDBVideo) => v.type === 'Teaser') ??
        null;
    }
  } catch { /* TMDB optional – kein Fehler anzeigen */ }
  finally { tmdbLoading.value = false; }
}

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
  // TMDB + Plex im Hintergrund laden
  loadTmdb();
  loadPlex();
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
                <a
                  v-if="tmdbTrailer"
                  :href="`https://www.youtube.com/watch?v=${tmdbTrailer.key}`"
                  target="_blank"
                  rel="noopener"
                  class="action-btn action-trailer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  Trailer
                </a>
                <a
                  v-if="plexUrl"
                  :href="plexUrl"
                  target="_blank"
                  rel="noopener"
                  class="action-btn action-plex"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8l7 4-7 4z"/></svg>
                  In Plex öffnen
                </a>
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
          v-for="tab in (['overview', 'files', 'subtitles'] as const)"
          :key="tab"
          :class="['tab-btn', { active: activeTab === tab }]"
          @click="activeTab = tab; if (tab === 'subtitles') loadSubtitles(); if (tab === 'overview') loadTmdb()"
        >
          {{ tab === 'overview' ? 'Übersicht' : tab === 'files' ? 'Datei' : 'Untertitel' }}
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
            <a :href="`https://www.imdb.com/title/${movie.imdbId}`" target="_blank" rel="noopener" class="detail-link">{{ movie.imdbId }}</a>
          </div>
        </div>

        <!-- Crew -->
        <div v-if="tmdbCredits?.crew.length" class="crew-section">
          <h3 class="cast-heading">Crew</h3>
          <div class="crew-list">
            <div v-for="m in tmdbCredits.crew" :key="m.id + m.job" class="crew-item">
              <span class="crew-name">{{ m.name }}</span>
              <span class="crew-job">{{ m.job }}</span>
            </div>
          </div>
        </div>

        <!-- Cast -->
        <div v-if="tmdbCredits?.cast.length" class="cast-section">
          <h3 class="cast-heading">Besetzung</h3>
          <div class="cast-grid">
            <div v-for="actor in tmdbCredits.cast" :key="actor.id" class="cast-card">
              <div class="cast-photo">
                <img
                  v-if="actor.profile_path"
                  :src="`https://image.tmdb.org/t/p/w185${actor.profile_path}`"
                  :alt="actor.name"
                  loading="lazy"
                />
                <div v-else class="cast-photo-placeholder">{{ actor.name[0] }}</div>
              </div>
              <p class="cast-name">{{ actor.name }}</p>
              <p class="cast-character">{{ actor.character }}</p>
            </div>
          </div>
        </div>

        <!-- TMDB Loading -->
        <div v-if="tmdbLoading" class="cast-loading">
          <div v-for="i in 6" :key="i" class="skeleton cast-skeleton" />
        </div>
      </div>

      <!-- Tab: Untertitel -->
      <div v-if="activeTab === 'subtitles'" class="tab-content">
        <div v-if="subtitlesLoading" class="subs-loading">
          <div class="skeleton" style="height:24px;width:60%;border-radius:6px" />
          <div class="skeleton" style="height:24px;width:40%;border-radius:6px;margin-top:8px" />
        </div>
        <template v-else-if="subtitles">
          <!-- Vorhandene Untertitel -->
          <div class="subs-section">
            <h3 class="subs-title">Vorhanden</h3>
            <div v-if="subtitles.available.length" class="subs-list">
              <div v-for="sub in subtitles.available" :key="sub.code2 + (sub.forced ? '-forced' : '')" class="sub-row">
                <span class="sub-flag">{{ flagEmoji(sub.code2) }}</span>
                <span class="sub-name">{{ sub.name }}</span>
                <span v-if="sub.forced" class="sub-badge">Forced</span>
                <span v-if="sub.hi" class="sub-badge">HI</span>
                <span v-if="sub.format" class="sub-format">.{{ sub.format }}</span>
                <button v-if="sub.path" class="sub-delete-btn" title="Löschen" @click="deleteSubtitle(sub.code2, sub.path!)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </div>
            </div>
            <p v-else class="subs-empty">Keine Untertitel vorhanden</p>
          </div>

          <!-- Fehlende Untertitel -->
          <div v-if="subtitles.missing.length" class="subs-section subs-section--missing">
            <h3 class="subs-title subs-title--missing">Fehlend</h3>
            <div class="subs-list">
              <div v-for="sub in subtitles.missing" :key="'miss-' + sub.code2" class="sub-row">
                <span class="sub-flag">{{ flagEmoji(sub.code2) }}</span>
                <span class="sub-name">{{ sub.name }}</span>
                <span v-if="sub.forced" class="sub-badge">Forced</span>
                <span v-if="sub.hi" class="sub-badge">HI</span>
                <button
                  class="sub-search-btn"
                  :disabled="searchingLang === sub.code2"
                  :class="{ 'sub-search-btn--ok': searchLangStatus[sub.code2] === 'ok', 'sub-search-btn--error': searchLangStatus[sub.code2] === 'error' }"
                  @click="searchSubtitle(sub.code2)"
                >
                  <svg v-if="searchingLang === sub.code2" class="spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  {{ searchingLang === sub.code2 ? 'Suche…' : searchLangStatus[sub.code2] === 'ok' ? 'Gestartet!' : 'Suchen' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Nicht überwacht -->
          <p v-if="!subtitles.monitored" class="subs-unmonitored">⚠️ Film ist in Bazarr nicht überwacht</p>
          <!-- Nicht konfiguriert -->
          <p v-if="!subtitles.available.length && !subtitles.missing.length && !subtitlesLoading" class="subs-empty">
            Bazarr nicht konfiguriert oder Film unbekannt
          </p>
        </template>
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

.action-trailer {
  background: rgba(255, 0, 0, 0.1);
  border: 1px solid rgba(255, 0, 0, 0.25);
  color: var(--text-secondary);
  text-decoration: none;
}
.action-trailer:hover {
  background: rgba(255, 0, 0, 0.2);
  border-color: rgba(255, 0, 0, 0.45);
  color: var(--text-primary);
}

.action-plex {
  background: rgba(229, 160, 13, 0.1);
  border: 1px solid rgba(229, 160, 13, 0.25);
  color: var(--text-secondary);
  text-decoration: none;
}
.action-plex:hover {
  background: rgba(229, 160, 13, 0.2);
  border-color: rgba(229, 160, 13, 0.45);
  color: var(--text-primary);
}

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

/* ── Cast & Crew ───────────────────────────────────────────────── */
.cast-heading {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
  border-left: 3px solid var(--tmdb);
  padding-left: var(--space-3);
  margin-bottom: var(--space-4);
}

.crew-section { margin-top: var(--space-6); }
.crew-list { display: flex; flex-direction: column; gap: var(--space-2); }
.crew-item { display: flex; align-items: baseline; gap: var(--space-3); }
.crew-name { font-size: var(--text-sm); color: var(--text-secondary); font-weight: 500; min-width: 160px; }
.crew-job  { font-size: var(--text-xs); color: var(--text-muted); }

.cast-section { margin-top: var(--space-6); }
.cast-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: var(--space-3);
}
.cast-card { display: flex; flex-direction: column; gap: var(--space-1); }
.cast-photo {
  aspect-ratio: 2/3;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-elevated);
  border: 1px solid var(--bg-border);
  margin-bottom: var(--space-1);
}
.cast-photo img { width: 100%; height: 100%; object-fit: cover; }
.cast-photo-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; font-weight: 700; color: var(--text-muted);
}
.cast-name { font-size: var(--text-xs); color: var(--text-secondary); font-weight: 600; line-height: 1.3; }
.cast-character { font-size: var(--text-xs); color: var(--text-muted); line-height: 1.3; }

.cast-loading {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: var(--space-3);
  margin-top: var(--space-6);
}
.cast-skeleton { aspect-ratio: 2/3; border-radius: var(--radius-md); }

/* ── Subtitles ──────────────────────────────────────────────────────── */
.subs-loading { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-4) 0; }

.subs-section { margin-bottom: var(--space-6); }
.subs-section--missing { border-top: 1px solid var(--bg-border); padding-top: var(--space-4); }

.subs-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
  border-left: 3px solid var(--bazarr);
  padding-left: var(--space-3);
  margin-bottom: var(--space-3);
}
.subs-title--missing { border-left-color: var(--status-warning, #f59e0b); }

.subs-list { display: flex; flex-direction: column; gap: var(--space-2); }

.sub-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-md);
}

.sub-flag { font-size: 16px; flex-shrink: 0; }
.sub-name { font-size: var(--text-sm); color: var(--text-secondary); font-weight: 500; flex: 1; }
.sub-format { font-size: var(--text-xs); color: var(--text-muted); font-family: monospace; }

.sub-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  background: rgba(167,139,250,.15);
  color: var(--bazarr);
  border: 1px solid rgba(167,139,250,.25);
  border-radius: 99px;
}

.sub-delete-btn {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  transition: color .15s ease;
  flex-shrink: 0;
}
.sub-delete-btn:hover { color: #ef4444; }

.sub-search-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: 3px 10px;
  font-size: var(--text-xs);
  font-weight: 500;
  background: rgba(167,139,250,.1);
  border: 1px solid rgba(167,139,250,.25);
  color: var(--bazarr);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all .15s ease;
  flex-shrink: 0;
}
.sub-search-btn:hover:not(:disabled) { background: rgba(167,139,250,.2); border-color: rgba(167,139,250,.45); }
.sub-search-btn:disabled { opacity: .6; cursor: not-allowed; }
.sub-search-btn--ok    { background: rgba(34,197,94,.12); border-color: rgba(34,197,94,.3); color: var(--status-success); }
.sub-search-btn--error { background: rgba(239,68,68,.12); border-color: rgba(239,68,68,.3); color: #ef4444; }

.subs-empty { color: var(--text-muted); font-size: var(--text-sm); font-style: italic; }
.subs-unmonitored { color: #f59e0b; font-size: var(--text-sm); margin-top: var(--space-4); }

@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin .8s linear infinite; display: inline-block; }
</style>
