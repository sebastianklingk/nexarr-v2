<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSeriesStore } from '../stores/series.store.js';
import { useApi } from '../composables/useApi.js';
import type { SonarrSeries, SonarrEpisode, SonarrSeason, TMDBCredits, TMDBVideo } from '@nexarr/shared';

const route  = useRoute();
const router = useRouter();
const store  = useSeriesStore();

const series       = ref<SonarrSeries | null>(null);
const episodes     = ref<SonarrEpisode[]>([]);
const isLoading    = ref(true);
const activeTab    = ref<'seasons' | 'overview'>('seasons');
const openSeasons  = ref<Set<number>>(new Set([1]));
const isSearching  = ref(false);
const searchStatus = ref<'idle' | 'ok' | 'error'>('idle');

// TMDB
const tmdbCredits = ref<TMDBCredits | null>(null);
const tmdbTrailer = ref<TMDBVideo | null>(null);
const tmdbLoading = ref(false);

// Plex
const plexUrl = ref<string | null>(null);

function loadPlex() {
  if (!series.value) return;
  plexUrl.value = `https://app.plex.tv/desktop#!/search?query=${encodeURIComponent(series.value.title)}`;
}

async function loadTmdb() {
  if (!series.value?.tvdbId || tmdbCredits.value !== null) return;
  tmdbLoading.value = true;
  try {
    const res = await fetch(`/api/tmdb/find/tvdb/${series.value.tvdbId}`, { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    tmdbCredits.value = data.credits ?? null;
    const vids: TMDBVideo[] = data.videos?.results ?? [];
    tmdbTrailer.value =
      vids.find(v => v.type === 'Trailer' && v.official) ??
      vids.find(v => v.type === 'Trailer') ??
      vids.find(v => v.type === 'Teaser') ??
      null;
  } catch { /* optional */ }
  finally { tmdbLoading.value = false; }
}

const { post } = useApi();

async function triggerSearch() {
  if (!series.value || isSearching.value) return;
  isSearching.value = true;
  searchStatus.value = 'idle';
  try {
    await post(`/api/sonarr/series/${series.value.id}/search`);
    searchStatus.value = 'ok';
  } catch {
    searchStatus.value = 'error';
  } finally {
    isSearching.value = false;
    setTimeout(() => { searchStatus.value = 'idle'; }, 3000);
  }
}

const seriesId = computed(() => Number(route.params.id));

const fanartUrl = computed(() => series.value?.images?.find(i => i.coverType === 'fanart')?.remoteUrl);
const posterUrl = computed(() => series.value?.images?.find(i => i.coverType === 'poster')?.remoteUrl);

// Episoden nach Staffel gruppieren
const episodesBySeason = computed(() => {
  const map = new Map<number, SonarrEpisode[]>();
  for (const ep of episodes.value) {
    if (!map.has(ep.seasonNumber)) map.set(ep.seasonNumber, []);
    map.get(ep.seasonNumber)!.push(ep);
  }
  // Innerhalb jeder Staffel nach Episodennummer sortieren
  for (const [, eps] of map) {
    eps.sort((a, b) => a.episodeNumber - b.episodeNumber);
  }
  return map;
});

const sortedSeasons = computed(() => {
  if (!series.value) return [];
  return [...series.value.seasons]
    .filter(s => s.seasonNumber > 0)
    .sort((a, b) => b.seasonNumber - a.seasonNumber); // neueste zuerst
});

function toggleSeason(n: number) {
  if (openSeasons.value.has(n)) openSeasons.value.delete(n);
  else openSeasons.value.add(n);
}

function seasonProgress(season: SonarrSeason): number {
  const total = season.statistics?.totalEpisodeCount ?? 0;
  const has   = season.statistics?.episodeFileCount ?? 0;
  return total > 0 ? Math.round((has / total) * 100) : 0;
}

function airDate(dateStr?: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

onMounted(async () => {
  if (store.series.length === 0) await store.fetchSeries();
  series.value = await store.fetchSeriesById(seriesId.value);
  if (series.value) {
    episodes.value = await store.fetchEpisodes(seriesId.value);
  }
  isLoading.value = false;
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
      </div>
    </div>

    <div v-else-if="!series" class="empty-state">
      <p class="empty-title">Serie nicht gefunden</p>
      <button class="back-btn" @click="router.back()">← Zurück</button>
    </div>

    <template v-else>

      <!-- Hero -->
      <div class="hero" :style="fanartUrl ? `--fanart: url('${fanartUrl}')` : ''">
        <div class="hero-bg" />
        <div class="hero-gradient" />
        <div class="hero-content">
          <button class="back-btn" @click="router.back()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Serien
          </button>
          <div class="hero-main">
            <img v-if="posterUrl" :src="posterUrl" :alt="series.title" class="hero-poster" />
            <div v-else class="hero-poster hero-poster--placeholder">{{ series.title[0] }}</div>
            <div class="hero-info">
              <div class="hero-app-indicator" />
              <h1 class="hero-title">{{ series.title }}</h1>
              <div class="hero-meta">
                <span v-if="series.year" class="meta-item">{{ series.year }}</span>
                <span class="meta-sep">·</span>
                <span class="meta-item">{{ series.network }}</span>
                <span class="meta-sep">·</span>
                <span class="meta-item">{{ series.runtime }}min</span>
                <span v-if="series.genres?.length" class="meta-sep">·</span>
                <span v-if="series.genres?.length" class="meta-item">{{ series.genres.slice(0,3).join(', ') }}</span>
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

              <div class="hero-badges">
                <span :class="['status-badge', series.status === 'continuing' ? 'badge-continuing' : 'badge-ended']">
                  {{ series.status === 'continuing' ? '● Laufend' : '■ Beendet' }}
                </span>
                <span v-if="series.episodeCount" class="status-badge badge-neutral">
                  {{ series.episodeCount }} Episoden
                </span>
                <span v-if="series.ratings?.value" class="status-badge badge-rating">
                  ★ {{ series.ratings.value.toFixed(1) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs-bar">
        <button v-for="tab in (['seasons','overview'] as const)" :key="tab"
          :class="['tab-btn', { active: activeTab === tab }]"
          @click="activeTab = tab; if (tab === 'overview') loadTmdb()">
          {{ tab === 'seasons' ? 'Staffeln' : 'Übersicht' }}
        </button>
      </div>

      <!-- Tab: Staffeln -->
      <div v-if="activeTab === 'seasons'" class="tab-content">
        <div class="seasons-list">
          <div v-for="season in sortedSeasons" :key="season.seasonNumber" class="season-block">

            <!-- Season Header -->
            <button class="season-header" @click="toggleSeason(season.seasonNumber)">
              <div class="season-header-left">
                <span class="season-chevron" :class="{ open: openSeasons.has(season.seasonNumber) }">›</span>
                <span class="season-title">Staffel {{ season.seasonNumber }}</span>
                <span class="season-count">
                  {{ season.statistics?.episodeFileCount ?? 0 }} /
                  {{ season.statistics?.totalEpisodeCount ?? 0 }}
                </span>
              </div>
              <!-- Progress Bar -->
              <div class="season-progress-wrap">
                <div class="season-progress-bar"
                  :style="`width: ${seasonProgress(season)}%`"
                  :class="{ complete: seasonProgress(season) === 100 }"
                />
              </div>
            </button>

            <!-- Episodes Accordion -->
            <div v-if="openSeasons.has(season.seasonNumber)" class="episodes-list">
              <template v-if="episodesBySeason.get(season.seasonNumber)?.length">
                <div
                  v-for="ep in episodesBySeason.get(season.seasonNumber)"
                  :key="ep.id"
                  :class="['episode-row', { 'has-file': ep.hasFile, 'missing': !ep.hasFile && ep.monitored }]"
                >
                  <span class="ep-number">{{ String(ep.episodeNumber).padStart(2, '0') }}</span>
                  <div class="ep-info">
                    <span class="ep-title">{{ ep.title }}</span>
                    <span v-if="ep.airDate" class="ep-date">{{ airDate(ep.airDate) }}</span>
                  </div>
                  <span :class="['ep-status', ep.hasFile ? 'ep-ok' : 'ep-missing']">
                    {{ ep.hasFile ? '✓' : '✗' }}
                  </span>
                </div>
              </template>
              <p v-else class="ep-loading">Episoden werden geladen…</p>
            </div>

          </div>
        </div>
      </div>

      <!-- Tab: Übersicht -->
      <div v-if="activeTab === 'overview'" class="tab-content">
        <p v-if="series.overview" class="overview-text">{{ series.overview }}</p>
        <p v-else class="no-overview">Keine Beschreibung verfügbar.</p>
        <div class="details-grid" style="margin-top: var(--space-6)">
          <div v-if="series.network" class="detail-item">
            <span class="detail-label">Sender</span>
            <span class="detail-value">{{ series.network }}</span>
          </div>
          <div v-if="series.seriesType" class="detail-item">
            <span class="detail-label">Typ</span>
            <span class="detail-value">{{ series.seriesType }}</span>
          </div>
          <div v-if="series.imdbId" class="detail-item">
            <span class="detail-label">IMDb</span>
            <a :href="`https://www.imdb.com/title/${series.imdbId}`" target="_blank" rel="noopener" class="detail-link">{{ series.imdbId }}</a>
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
                <img v-if="actor.profile_path" :src="`https://image.tmdb.org/t/p/w185${actor.profile_path}`" :alt="actor.name" loading="lazy" />
                <div v-else class="cast-photo-placeholder">{{ actor.name[0] }}</div>
              </div>
              <p class="cast-name">{{ actor.name }}</p>
              <p class="cast-character">{{ actor.character }}</p>
            </div>
          </div>
        </div>

        <div v-if="tmdbLoading" class="cast-loading">
          <div v-for="i in 6" :key="i" class="skeleton cast-skeleton" />
        </div>
      </div>

    </template>
  </div>
</template>

<style scoped>
.detail-view { min-height: 100%; }

/* Hero – identisch zu MovieDetailView */
.hero { position: relative; min-height: 420px; display: flex; flex-direction: column; justify-content: flex-end; }
.hero-bg { position: absolute; inset: 0; background-image: var(--fanart); background-size: cover; background-position: center top; z-index: 0; }
.hero-gradient { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(10,10,10,.2) 0%, rgba(10,10,10,.6) 50%, rgba(10,10,10,.97) 100%); z-index: 1; }
.hero-content { position: relative; z-index: 2; padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-4); }
.back-btn { display: inline-flex; align-items: center; gap: var(--space-1); color: var(--text-tertiary); font-size: var(--text-sm); transition: color .15s ease; align-self: flex-start; }
.back-btn:hover { color: var(--text-primary); }
.hero-main { display: flex; gap: var(--space-6); align-items: flex-end; }
.hero-poster { width: 120px; min-width: 120px; aspect-ratio: 2/3; object-fit: cover; border-radius: var(--radius-md); border: 1px solid var(--bg-border); box-shadow: 0 8px 32px rgba(0,0,0,.5); flex-shrink: 0; }
.hero-poster--placeholder { display: flex; align-items: center; justify-content: center; background: var(--bg-elevated); font-size: 48px; font-weight: 700; color: var(--text-muted); }
.hero-info { display: flex; flex-direction: column; gap: var(--space-3); padding-bottom: var(--space-2); }
.hero-app-indicator { width: 32px; height: 3px; background: var(--sonarr); border-radius: 2px; }
.hero-title { font-size: var(--text-2xl); font-weight: 700; color: var(--text-primary); line-height: 1.2; max-width: 700px; }
.hero-meta { display: flex; align-items: center; gap: var(--space-2); color: var(--text-tertiary); font-size: var(--text-sm); flex-wrap: wrap; }
.meta-sep { color: var(--text-muted); }
.hero-badges { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.status-badge { padding: 2px 10px; border-radius: 99px; font-size: var(--text-xs); font-weight: 500; }
.badge-continuing { background: rgba(53,197,244,.12); color: var(--sonarr); border: 1px solid rgba(53,197,244,.25); }
.badge-ended   { background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--bg-border); }
.badge-neutral { background: var(--bg-elevated); color: var(--text-tertiary); border: 1px solid var(--bg-border); }
.badge-rating  { background: rgba(245,197,24,.12); color: var(--sabnzbd); border: 1px solid rgba(245,197,24,.25); }

/* Actions */
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
  background: rgba(53, 197, 244, 0.12);
  border: 1px solid rgba(53, 197, 244, 0.3);
  color: var(--text-secondary);
}
.action-search:not(:disabled):hover {
  background: rgba(53, 197, 244, 0.22);
  border-color: rgba(53, 197, 244, 0.5);
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

/* Tabs */
.tabs-bar { display: flex; border-bottom: 1px solid var(--bg-border); padding: 0 var(--space-6); }
.tab-btn { padding: var(--space-3) var(--space-5); font-size: var(--text-sm); color: var(--text-muted); border-bottom: 2px solid transparent; transition: color .15s ease, border-color .15s ease; margin-bottom: -1px; }
.tab-btn:hover { color: var(--text-secondary); }
.tab-btn.active { color: var(--text-primary); border-bottom-color: var(--sonarr); }

.tab-content { padding: var(--space-6); }

/* Seasons */
.seasons-list { display: flex; flex-direction: column; gap: var(--space-2); max-width: 800px; }

.season-block { border: 1px solid var(--bg-border); border-radius: var(--radius-lg); overflow: hidden; }

.season-header {
  width: 100%; display: flex; align-items: center; gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-surface);
  transition: background .15s ease;
  cursor: pointer;
}
.season-header:hover { background: var(--bg-elevated); }

.season-header-left { display: flex; align-items: center; gap: var(--space-3); flex: 1; }

.season-chevron {
  font-size: 18px; color: var(--text-muted);
  transition: transform .2s var(--ease-standard);
  line-height: 1;
}
.season-chevron.open { transform: rotate(90deg); }

.season-title { font-size: var(--text-base); font-weight: 600; color: var(--text-secondary); }
.season-count { font-size: var(--text-xs); color: var(--text-muted); }

.season-progress-wrap {
  width: 120px; height: 4px; background: var(--bg-border);
  border-radius: 2px; overflow: hidden; flex-shrink: 0;
}
.season-progress-bar {
  height: 100%; background: var(--sonarr); border-radius: 2px;
  transition: width .3s ease;
}
.season-progress-bar.complete { background: var(--status-success); }

/* Episodes */
.episodes-list { border-top: 1px solid var(--bg-border); }

.episode-row {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--bg-border);
  transition: background .12s ease;
}
.episode-row:last-child { border-bottom: none; }
.episode-row:hover { background: var(--bg-elevated); }

.ep-number { font-size: var(--text-xs); color: var(--text-muted); min-width: 24px; font-variant-numeric: tabular-nums; }
.ep-info   { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.ep-title  { font-size: var(--text-sm); color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ep-date   { font-size: var(--text-xs); color: var(--text-muted); }
.ep-status { font-size: var(--text-xs); font-weight: 600; flex-shrink: 0; }
.ep-ok     { color: var(--status-success); }
.ep-missing { color: var(--status-error); }

.ep-loading { padding: var(--space-4); color: var(--text-muted); font-size: var(--text-sm); text-align: center; }

/* Cast & Crew */
.cast-heading { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); border-left: 3px solid var(--tmdb); padding-left: var(--space-3); margin-bottom: var(--space-4); }
.crew-section { margin-top: var(--space-6); }
.crew-list { display: flex; flex-direction: column; gap: var(--space-2); }
.crew-item { display: flex; align-items: baseline; gap: var(--space-3); }
.crew-name { font-size: var(--text-sm); color: var(--text-secondary); font-weight: 500; min-width: 160px; }
.crew-job  { font-size: var(--text-xs); color: var(--text-muted); }
.cast-section { margin-top: var(--space-6); }
.cast-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: var(--space-3); }
.cast-card { display: flex; flex-direction: column; gap: var(--space-1); }
.cast-photo { aspect-ratio: 2/3; border-radius: var(--radius-md); overflow: hidden; background: var(--bg-elevated); border: 1px solid var(--bg-border); margin-bottom: var(--space-1); }
.cast-photo img { width: 100%; height: 100%; object-fit: cover; }
.cast-photo-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; color: var(--text-muted); }
.cast-name { font-size: var(--text-xs); color: var(--text-secondary); font-weight: 600; line-height: 1.3; }
.cast-character { font-size: var(--text-xs); color: var(--text-muted); line-height: 1.3; }
.cast-loading { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: var(--space-3); margin-top: var(--space-6); }
.cast-skeleton { aspect-ratio: 2/3; border-radius: var(--radius-md); }

/* Overview tab */
.overview-text { color: var(--text-tertiary); line-height: 1.7; font-size: var(--text-base); }
.no-overview   { color: var(--text-muted); font-style: italic; }
.details-grid  { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--space-4); }
.detail-item   { display: flex; flex-direction: column; gap: 4px; }
.detail-label  { font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: .05em; }
.detail-value  { font-size: var(--text-sm); color: var(--text-secondary); }
.detail-link   { font-size: var(--text-sm); color: var(--tmdb); text-decoration: underline; }

/* Loading */
.detail-loading { display: flex; flex-direction: column; }
.skeleton-hero  { height: 420px; width: 100%; border-radius: 0; }
.detail-body    { padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-3); }
.skeleton-title { height: 36px; width: 50%; border-radius: var(--radius-md); }
.skeleton-meta  { height: 18px; width: 30%; border-radius: var(--radius-md); }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: var(--space-4); }
.empty-title { font-size: var(--text-lg); color: var(--text-secondary); font-weight: 600; }
</style>
