<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSeriesStore } from '../stores/series.store.js';
import { useApi } from '../composables/useApi.js';
import type { SonarrSeries, SonarrEpisode, SonarrSeason, TMDBCredits, TMDBVideo } from '@nexarr/shared';

const route  = useRoute();
const router = useRouter();
const store  = useSeriesStore();
const { post } = useApi();

const series      = ref<SonarrSeries | null>(null);
const episodes    = ref<SonarrEpisode[]>([]);
const isLoading   = ref(true);
const activeTab   = ref<'seasons' | 'overview'>('seasons');
const openSeasons = ref<Set<number>>(new Set([1]));
const overviewExpanded = ref(false);

// ── Actions ───────────────────────────────────────────────────────────────────
const isSearching  = ref(false);
const searchStatus = ref<'idle'|'ok'|'error'>('idle');

async function triggerSearch() {
  if (!series.value || isSearching.value) return;
  isSearching.value = true; searchStatus.value = 'idle';
  try { await post(`/api/sonarr/series/${series.value.id}/search`); searchStatus.value = 'ok'; }
  catch { searchStatus.value = 'error'; }
  finally { isSearching.value = false; setTimeout(() => { searchStatus.value = 'idle'; }, 3000); }
}

const seasonSearching = ref<number | null>(null);
const seasonSearchStatus = ref<Record<number, 'ok'|'error'>>({});

async function triggerSeasonSearch(seasonNumber: number) {
  if (!series.value || seasonSearching.value !== null) return;
  seasonSearching.value = seasonNumber;
  try {
    await post(`/api/sonarr/series/${series.value.id}/search`, { seasonNumber });
    seasonSearchStatus.value[seasonNumber] = 'ok';
  } catch { seasonSearchStatus.value[seasonNumber] = 'error'; }
  finally {
    seasonSearching.value = null;
    setTimeout(() => { delete seasonSearchStatus.value[seasonNumber]; }, 3000);
  }
}

// ── TMDB ──────────────────────────────────────────────────────────────────────
const tmdbCredits = ref<TMDBCredits | null>(null);
const tmdbTrailer = ref<TMDBVideo | null>(null);
const tmdbLoading = ref(false);

async function loadTmdb() {
  if (!series.value?.tvdbId || tmdbCredits.value !== null) return;
  tmdbLoading.value = true;
  try {
    const res = await fetch(`/api/tmdb/find/tvdb/${series.value.tvdbId}`, { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    tmdbCredits.value = data.credits ?? null;
    const vids: TMDBVideo[] = data.videos?.results ?? [];
    tmdbTrailer.value = vids.find(v => v.type === 'Trailer' && v.official)
      ?? vids.find(v => v.type === 'Trailer')
      ?? vids.find(v => v.type === 'Teaser')
      ?? null;
  } catch { /* optional */ }
  finally { tmdbLoading.value = false; }
}

// ── Computed ──────────────────────────────────────────────────────────────────
const seriesId  = computed(() => Number(route.params.id));
const fanartUrl = computed(() => series.value?.images?.find(i => i.coverType === 'fanart')?.remoteUrl);
const posterUrl = computed(() => series.value?.images?.find(i => i.coverType === 'poster')?.remoteUrl);
const plexUrl   = computed(() => series.value ? `https://app.plex.tv/desktop#!/search?query=${encodeURIComponent(series.value.title)}` : null);

// Stats – aus Season-Statistics aggregieren (zuverlässiger als episodeCount direkt)
const totalSeasons = computed(() => (series.value?.seasons ?? []).filter(s => s.seasonNumber > 0).length);
const totalEpisodes = computed(() => {
  const fromSeasons = (series.value?.seasons ?? []).reduce((s, season) => s + (season.statistics?.totalEpisodeCount ?? 0), 0);
  return fromSeasons || series.value?.episodeCount || 0;
});
const fileEpisodes = computed(() => {
  const fromSeasons = (series.value?.seasons ?? []).reduce((s, season) => s + (season.statistics?.episodeFileCount ?? 0), 0);
  return fromSeasons || series.value?.episodeFileCount || 0;
});
const completionPct = computed(() => totalEpisodes.value > 0 ? Math.round((fileEpisodes.value / totalEpisodes.value) * 100) : 0);
const totalSize     = computed(() => {
  const fromSeasons = (series.value?.seasons ?? []).reduce((s, season) => s + (season.statistics?.sizeOnDisk ?? 0), 0);
  return fromSeasons || series.value?.sizeOnDisk || 0;
});

const sortedSeasons = computed((): SonarrSeason[] => {
  if (!series.value) return [];
  return [...series.value.seasons]
    .filter(s => s.seasonNumber > 0)
    .sort((a, b) => b.seasonNumber - a.seasonNumber);
});

const episodesBySeason = computed(() => {
  const map = new Map<number, SonarrEpisode[]>();
  for (const ep of episodes.value) {
    if (!map.has(ep.seasonNumber)) map.set(ep.seasonNumber, []);
    map.get(ep.seasonNumber)!.push(ep);
  }
  for (const eps of map.values()) eps.sort((a, b) => a.episodeNumber - b.episodeNumber);
  return map;
});

function seasonProgress(s: SonarrSeason): number {
  const total = s.statistics?.totalEpisodeCount ?? 0;
  const has   = s.statistics?.episodeFileCount ?? 0;
  return total > 0 ? Math.round((has / total) * 100) : 0;
}

function toggleSeason(n: number) {
  if (openSeasons.value.has(n)) openSeasons.value.delete(n);
  else openSeasons.value.add(n);
}

// Helpers
function fmtDate(iso?: string): string {
  if (!iso) return ''; return new Date(iso).toLocaleDateString('de-DE');
}
function fmtBytes(b: number): string {
  if (!b) return ''; const g = b/1024/1024/1024;
  return g >= 1 ? `${g.toFixed(2)} GB` : `${(b/1024/1024).toFixed(0)} MB`;
}
function fmtRuntime(m?: number): string {
  if (!m) return ''; return `${m} min`;
}

onMounted(async () => {
  if (store.series.length === 0) await store.fetchSeries();
  series.value = await store.fetchSeriesById(seriesId.value);
  if (series.value) episodes.value = await store.fetchEpisodes(seriesId.value);
  isLoading.value = false;
  loadTmdb();
});
</script>

<template>
  <div class="detail-view">

    <!-- Loading -->
    <div v-if="isLoading" class="detail-loading">
      <div class="skeleton skeleton-hero" />
      <div class="detail-body">
        <div class="skeleton" style="height:36px;width:50%;border-radius:8px" />
        <div class="skeleton" style="height:18px;width:30%;border-radius:6px;margin-top:8px" />
      </div>
    </div>

    <div v-else-if="!series" class="empty-state">
      <p class="empty-title">Serie nicht gefunden</p>
      <button class="back-btn" @click="router.back()">← Zurück</button>
    </div>

    <template v-else>

      <!-- ── Hero ── -->
      <div class="hero" :style="fanartUrl ? `--fanart: url('${fanartUrl}')` : ''">
        <div class="hero-bg" />
        <div class="hero-gradient" />
        <div class="hero-content">

          <button class="back-btn" @click="router.back()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Serien
          </button>

          <div class="hero-main">
            <img v-if="posterUrl" :src="posterUrl" :alt="series.title" class="hero-poster" />
            <div v-else class="hero-poster hero-ph">{{ series.title[0] }}</div>

            <div class="hero-info">
              <div class="app-bar" />
              <h1 class="hero-title">{{ series.title }}</h1>

              <div class="hero-meta">
                <span v-if="series.year">{{ series.year }}</span>
                <span v-if="series.network" class="sep">·</span>
                <span v-if="series.network">{{ series.network }}</span>
                <span v-if="series.runtime" class="sep">·</span>
                <span v-if="series.runtime">{{ fmtRuntime(series.runtime) }}</span>
                <span v-if="series.genres?.length" class="sep">·</span>
                <span v-if="series.genres?.length">{{ series.genres.slice(0,3).join(', ') }}</span>
              </div>

              <!-- Rating -->
              <div class="hero-ratings">
                <div v-if="series.ratings?.value" class="r-chip r-imdb">
                  <span class="r-src">IMDb</span>
                  <span class="r-val">★ {{ series.ratings.value.toFixed(1) }}</span>
                  <span v-if="series.ratings.votes" class="r-votes">{{ (series.ratings.votes/1000).toFixed(0) }}k</span>
                </div>
              </div>

              <!-- Actions -->
              <div class="hero-actions">
                <a v-if="tmdbTrailer" :href="`https://www.youtube.com/watch?v=${tmdbTrailer.key}`" target="_blank" rel="noopener" class="act-btn act-trailer">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Trailer
                </a>
                <a v-if="plexUrl" :href="plexUrl" target="_blank" rel="noopener" class="act-btn act-plex">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8l7 4-7 4z"/></svg> In Plex
                </a>
                <button class="act-btn act-search"
                  :class="{ 'act-ok': searchStatus==='ok', 'act-err': searchStatus==='error' }"
                  :disabled="isSearching" @click="triggerSearch">
                  <svg v-if="isSearching" class="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  {{ isSearching ? 'Suche…' : searchStatus==='ok' ? 'Gestartet!' : 'Alle suchen' }}
                </button>
              </div>

              <!-- Badges -->
              <div class="hero-badges">
                <span :class="['badge', series.status==='continuing' ? 'badge-on' : 'badge-off']">
                  {{ series.status==='continuing' ? '● Laufend' : '■ Beendet' }}
                </span>
                <span v-if="!series.monitored" class="badge badge-unmon">Nicht überwacht</span>
                <span v-if="series.seriesType" class="badge badge-neu">{{ series.seriesType }}</span>
                <span v-if="series.imdbId" class="badge badge-neu">{{ series.imdbId }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Stats Bar ── -->
      <div class="stats-bar">
        <div class="stat-item">
          <span class="stat-num">{{ totalEpisodes.toLocaleString('de-DE') }}</span>
          <span class="stat-label">Episoden</span>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <span class="stat-num">{{ totalSeasons }}</span>
          <span class="stat-label">Staffeln</span>
        </div>
        <div class="stat-divider" />
        <div class="stat-item stat-pct">
          <span class="stat-num">{{ completionPct }}%</span>
          <span class="stat-label">Vollständigkeit</span>
          <div class="stat-bar-wrap">
            <div class="stat-bar" :style="{ width: completionPct+'%' }" :class="{ 'bar-full': completionPct===100 }" />
          </div>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <span class="stat-num">{{ fmtBytes(totalSize) }}</span>
          <span class="stat-label">Dateigröße</span>
        </div>
      </div>

      <!-- ── Genre Tags ── -->
      <div v-if="series.genres?.length" class="genre-bar">
        <span v-for="g in series.genres" :key="g" class="genre-tag">{{ g }}</span>
      </div>

      <!-- ── Tabs ── -->
      <div class="tabs-bar">
        <button v-for="tab in (['seasons','overview'] as const)" :key="tab"
          :class="['tab-btn', { active: activeTab===tab }]"
          @click="activeTab=tab; if(tab==='overview') loadTmdb()">
          {{ tab==='seasons' ? 'Staffeln & Episoden' : 'Übersicht & Cast' }}
        </button>
      </div>

      <!-- ── Tab: Staffeln ── -->
      <div v-if="activeTab==='seasons'" class="tab-content">
        <div class="seasons-list">
          <div v-for="season in sortedSeasons" :key="season.seasonNumber" class="season-block">

            <!-- Season Header -->
            <button class="season-header" @click="toggleSeason(season.seasonNumber)">
              <span class="season-chevron" :class="{ open: openSeasons.has(season.seasonNumber) }">›</span>

              <div class="season-title-wrap">
                <span class="season-label">Staffel {{ season.seasonNumber }}</span>
                <span class="season-ep-count">
                  {{ season.statistics?.episodeFileCount ?? 0 }}/{{ season.statistics?.totalEpisodeCount ?? 0 }} Ep.
                  <span v-if="season.statistics?.sizeOnDisk" class="season-size">· {{ fmtBytes(season.statistics.sizeOnDisk) }}</span>
                </span>
              </div>

              <!-- Progress -->
              <div class="season-prog-wrap">
                <div class="season-prog" :style="{ width: seasonProgress(season)+'%' }"
                  :class="{ 'prog-full': seasonProgress(season)===100 }" />
              </div>
              <span class="season-pct">{{ seasonProgress(season) }}%</span>

              <!-- Monitored Badge -->
              <span :class="['season-mon', season.monitored ? 'mon-on' : 'mon-off']">
                {{ season.monitored ? 'Überwacht' : 'Ignoriert' }}
              </span>

              <!-- Season Search Button -->
              <button class="season-search-btn"
                :class="{ 'ss-ok': seasonSearchStatus[season.seasonNumber]==='ok' }"
                :disabled="seasonSearching===season.seasonNumber"
                @click.stop="triggerSeasonSearch(season.seasonNumber)"
                :title="`Staffel ${season.seasonNumber} suchen`">
                <svg v-if="seasonSearching===season.seasonNumber" class="spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <svg v-else-if="seasonSearchStatus[season.seasonNumber]==='ok'" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </button>
            </button>

            <!-- Episodes List -->
            <div v-if="openSeasons.has(season.seasonNumber)" class="episodes-list">
              <div v-if="!episodesBySeason.get(season.seasonNumber)?.length" class="ep-loading">
                Keine Episoden geladen…
              </div>
              <div
                v-for="ep in episodesBySeason.get(season.seasonNumber)"
                :key="ep.id"
                :class="['ep-row', ep.hasFile ? 'ep-has' : ep.monitored ? 'ep-miss' : 'ep-unmon']"
              >
                <!-- Status Icon -->
                <span :class="['ep-status-icon', ep.hasFile ? 'ico-ok' : ep.monitored ? 'ico-miss' : 'ico-off']">
                  {{ ep.hasFile ? '✓' : ep.monitored ? '✗' : '○' }}
                </span>

                <!-- Ep Number -->
                <span class="ep-num">{{ String(ep.episodeNumber).padStart(2,'0') }}</span>

                <!-- Info -->
                <div class="ep-info">
                  <span class="ep-title">{{ ep.title }}</span>
                </div>

                <!-- Airdate -->
                <span v-if="ep.airDate" class="ep-date">{{ fmtDate(ep.airDate) }}</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- ── Tab: Übersicht ── -->
      <div v-if="activeTab==='overview'" class="tab-content">

        <!-- Overview -->
        <div v-if="series.overview" class="overview-wrap">
          <p class="overview-text" :class="{ collapsed: !overviewExpanded }">{{ series.overview }}</p>
          <button v-if="series.overview.length > 300" class="overview-toggle" @click="overviewExpanded = !overviewExpanded">
            {{ overviewExpanded ? 'Weniger anzeigen' : 'Mehr anzeigen' }}
          </button>
        </div>

        <!-- Details Grid -->
        <div class="details-grid">
          <div v-if="series.network" class="di"><span class="dl">Sender</span><span class="dv">{{ series.network }}</span></div>
          <div v-if="series.seriesType" class="di"><span class="dl">Typ</span><span class="dv">{{ series.seriesType }}</span></div>
          <div v-if="series.status" class="di"><span class="dl">Status</span><span class="dv">{{ series.status === 'continuing' ? 'Laufend' : 'Beendet' }}</span></div>
          <div v-if="series.runtime" class="di"><span class="dl">Laufzeit</span><span class="dv">{{ series.runtime }} min</span></div>
          <div v-if="series.added" class="di"><span class="dl">Hinzugefügt</span><span class="dv">{{ fmtDate(series.added) }}</span></div>
          <div v-if="series.imdbId" class="di"><span class="dl">IMDb</span><a :href="`https://www.imdb.com/title/${series.imdbId}`" target="_blank" rel="noopener" class="dlink">{{ series.imdbId }}</a></div>
          <div v-if="series.tvdbId" class="di"><span class="dl">TVDB</span><a :href="`https://www.thetvdb.com/?id=${series.tvdbId}`" target="_blank" rel="noopener" class="dlink">{{ series.tvdbId }}</a></div>
          <div v-if="series.path" class="di di-full"><span class="dl">Pfad</span><span class="dv dv-mono">{{ series.path }}</span></div>
        </div>

        <!-- Crew -->
        <div v-if="tmdbCredits?.crew.length" class="section-block">
          <h3 class="section-head">Crew</h3>
          <div class="crew-list">
            <div v-for="m in tmdbCredits.crew" :key="m.id+m.job" class="crew-row">
              <span class="crew-name">{{ m.name }}</span>
              <span class="crew-job">{{ m.job }}</span>
            </div>
          </div>
        </div>

        <!-- Cast -->
        <div v-if="tmdbCredits?.cast.length" class="section-block">
          <h3 class="section-head">Besetzung</h3>
          <div class="cast-grid">
            <div v-for="a in tmdbCredits.cast" :key="a.id" class="cast-card">
              <div class="cast-photo">
                <img v-if="a.profile_path" :src="`https://image.tmdb.org/t/p/w185${a.profile_path}`" :alt="a.name" loading="lazy" />
                <div v-else class="cast-ph">{{ a.name[0] }}</div>
              </div>
              <p class="cast-name">{{ a.name }}</p>
              <p class="cast-char">{{ a.character }}</p>
            </div>
          </div>
        </div>

        <div v-if="tmdbLoading" class="cast-grid">
          <div v-for="i in 8" :key="i" class="skeleton" style="aspect-ratio:2/3;border-radius:8px" />
        </div>
      </div>

    </template>
  </div>
</template>

<style scoped>
.detail-view { min-height: 100%; }

/* Hero */
.hero { position: relative; min-height: 420px; display: flex; flex-direction: column; justify-content: flex-end; }
.hero-bg { position: absolute; inset: 0; background-image: var(--fanart); background-size: cover; background-position: center top; z-index: 0; }
.hero-gradient { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(10,10,10,.15) 0%, rgba(10,10,10,.55) 45%, rgba(10,10,10,.97) 100%); z-index: 1; }
.hero-content { position: relative; z-index: 2; padding: var(--space-5) var(--space-6) var(--space-6); display: flex; flex-direction: column; gap: var(--space-4); }
.back-btn { display: inline-flex; align-items: center; gap: 5px; color: var(--text-tertiary); font-size: var(--text-sm); transition: color .15s; align-self: flex-start; }
.back-btn:hover { color: var(--text-primary); }
.hero-main { display: flex; gap: var(--space-6); align-items: flex-end; }
.hero-poster { width: 130px; min-width: 130px; aspect-ratio: 2/3; object-fit: cover; border-radius: var(--radius-lg); border: 1px solid rgba(255,255,255,.1); box-shadow: 0 12px 40px rgba(0,0,0,.6); flex-shrink: 0; }
.hero-ph { display: flex; align-items: center; justify-content: center; background: var(--bg-elevated); font-size: 52px; font-weight: 700; color: var(--text-muted); }
.hero-info { flex: 1; display: flex; flex-direction: column; gap: var(--space-3); padding-bottom: var(--space-1); }
.app-bar { width: 32px; height: 3px; background: var(--sonarr); border-radius: 2px; }
.hero-title { font-size: clamp(20px, 3vw, 32px); font-weight: 700; color: var(--text-primary); line-height: 1.2; margin: 0; }
.hero-meta { display: flex; align-items: center; gap: var(--space-2); color: var(--text-tertiary); font-size: var(--text-sm); flex-wrap: wrap; }
.sep { color: var(--text-muted); }

/* Ratings */
.hero-ratings { display: flex; gap: var(--space-2); }
.r-chip { display: flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: var(--radius-sm); font-size: var(--text-xs); font-weight: 600; border: 1px solid; }
.r-imdb { background: rgba(245,197,24,.1); border-color: rgba(245,197,24,.3); }
.r-src { color: var(--text-muted); font-weight: 400; }
.r-val { color: var(--text-primary); }
.r-votes { color: var(--text-muted); font-size: 10px; }

/* Actions */
.hero-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.act-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: 500; cursor: pointer; transition: all .15s; white-space: nowrap; }
.act-btn:disabled { opacity: .6; cursor: not-allowed; }
.act-trailer { background: rgba(255,0,0,.1); border: 1px solid rgba(255,0,0,.25); color: var(--text-secondary); text-decoration: none; }
.act-trailer:hover { background: rgba(255,0,0,.2); color: var(--text-primary); }
.act-plex { background: rgba(229,160,13,.1); border: 1px solid rgba(229,160,13,.25); color: var(--text-secondary); text-decoration: none; }
.act-plex:hover { background: rgba(229,160,13,.2); color: var(--text-primary); }
.act-search { background: rgba(53,197,244,.1); border: 1px solid rgba(53,197,244,.25); color: var(--text-secondary); }
.act-search:not(:disabled):hover { background: rgba(53,197,244,.2); color: var(--text-primary); }
.act-ok  { background: rgba(34,197,94,.15); border-color: rgba(34,197,94,.35) !important; }
.act-err { background: rgba(248,113,113,.15); border-color: rgba(248,113,113,.35) !important; }

/* Badges */
.hero-badges { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.badge { padding: 2px 10px; border-radius: 99px; font-size: var(--text-xs); font-weight: 500; }
.badge-on   { background: rgba(53,197,244,.12); color: var(--sonarr); border: 1px solid rgba(53,197,244,.25); }
.badge-off  { background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--bg-border); }
.badge-unmon { background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--bg-border); }
.badge-neu  { background: var(--bg-elevated); color: var(--text-tertiary); border: 1px solid var(--bg-border); }

/* ── Stats Bar ── */
.stats-bar {
  display: flex; align-items: center; gap: 0;
  background: var(--bg-surface); border-bottom: 1px solid var(--bg-border);
  padding: var(--space-4) var(--space-6);
}
.stat-item { display: flex; flex-direction: column; gap: 2px; padding: 0 var(--space-5); flex: 1; }
.stat-item:first-child { padding-left: 0; }
.stat-num  { font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.stat-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .06em; }
.stat-pct  { flex: 2; }
.stat-bar-wrap { height: 4px; background: var(--bg-elevated); border-radius: 2px; overflow: hidden; margin-top: 4px; max-width: 200px; }
.stat-bar { height: 100%; background: var(--sonarr); border-radius: 2px; transition: width .3s ease; }
.bar-full { background: var(--status-success); }
.stat-divider { width: 1px; height: 40px; background: var(--bg-border); flex-shrink: 0; }

/* Genre Bar */
.genre-bar { display: flex; gap: var(--space-2); flex-wrap: wrap; padding: var(--space-3) var(--space-6); border-bottom: 1px solid var(--bg-border); background: var(--bg-surface); }
.genre-tag { font-size: 11px; padding: 3px 10px; background: var(--bg-elevated); border: 1px solid var(--bg-border); border-radius: 99px; color: var(--text-muted); }

/* Tabs */
.tabs-bar { display: flex; border-bottom: 1px solid var(--bg-border); padding: 0 var(--space-6); background: var(--bg-surface); position: sticky; top: 0; z-index: 10; }
.tab-btn { padding: var(--space-3) var(--space-5); font-size: var(--text-sm); color: var(--text-muted); border-bottom: 2px solid transparent; transition: color .15s, border-color .15s; margin-bottom: -1px; cursor: pointer; }
.tab-btn:hover { color: var(--text-secondary); }
.tab-btn.active { color: var(--text-primary); border-bottom-color: var(--sonarr); }

/* Tab Content */
.tab-content { padding: var(--space-5) var(--space-6); }

/* Seasons */
.seasons-list { display: flex; flex-direction: column; gap: var(--space-2); }

.season-block {
  border: 1px solid var(--bg-border); border-radius: var(--radius-lg); overflow: hidden;
  background: var(--bg-surface);
}

.season-header {
  width: 100%; display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  cursor: pointer; transition: background .15s;
}
.season-header:hover { background: var(--bg-elevated); }

.season-chevron {
  font-size: 18px; color: var(--text-muted); transition: transform .2s; line-height: 1; flex-shrink: 0;
}
.season-chevron.open { transform: rotate(90deg); }

.season-title-wrap { flex: 1; display: flex; flex-direction: column; gap: 1px; text-align: left; }
.season-label { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); }
.season-ep-count { font-size: 10px; color: var(--text-muted); }
.season-size { color: var(--text-muted); }

.season-prog-wrap { width: 120px; height: 3px; background: var(--bg-border); border-radius: 2px; overflow: hidden; flex-shrink: 0; }
.season-prog { height: 100%; background: var(--sonarr); border-radius: 2px; transition: width .3s; }
.prog-full { background: var(--status-success); }
.season-pct { font-size: 11px; color: var(--text-muted); min-width: 32px; text-align: right; flex-shrink: 0; }

.season-mon { font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 99px; flex-shrink: 0; }
.mon-on { background: rgba(53,197,244,.1); color: var(--sonarr); border: 1px solid rgba(53,197,244,.25); }
.mon-off { background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--bg-border); }

.season-search-btn {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: var(--radius-sm);
  background: var(--bg-elevated); border: 1px solid var(--bg-border);
  color: var(--text-muted); cursor: pointer; transition: all .15s; flex-shrink: 0;
}
.season-search-btn:hover:not(:disabled) { background: var(--bg-overlay); color: var(--sonarr); border-color: rgba(53,197,244,.35); }
.season-search-btn:disabled { opacity: .6; cursor: not-allowed; }
.ss-ok { background: rgba(34,197,94,.12); border-color: rgba(34,197,94,.3); color: #22c55e; }

/* Episodes */
.episodes-list { border-top: 1px solid var(--bg-border); }
.ep-loading { padding: var(--space-4); color: var(--text-muted); font-size: var(--text-sm); text-align: center; }

.ep-row {
  display: flex; align-items: center; gap: var(--space-3);
  padding: 7px var(--space-4);
  border-bottom: 1px solid rgba(255,255,255,.03);
  transition: background .12s;
}
.ep-row:last-child { border-bottom: none; }
.ep-row:hover { background: var(--bg-elevated); }

.ep-status-icon { font-size: 11px; font-weight: 700; flex-shrink: 0; width: 14px; text-align: center; }
.ico-ok   { color: var(--status-success); }
.ico-miss { color: var(--status-error); }
.ico-off  { color: var(--text-muted); }

.ep-num  { font-size: 11px; color: var(--text-muted); min-width: 22px; font-variant-numeric: tabular-nums; flex-shrink: 0; }
.ep-info { flex: 1; min-width: 0; }
.ep-title { font-size: var(--text-sm); color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ep-date { font-size: 10px; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }

/* Overview Tab */
.overview-wrap { margin-bottom: var(--space-6); }
.overview-text { color: var(--text-tertiary); line-height: 1.75; font-size: var(--text-base); margin: 0; }
.overview-text.collapsed { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.overview-toggle { color: var(--sonarr); font-size: var(--text-sm); cursor: pointer; margin-top: var(--space-2); background: none; border: none; padding: 0; }

/* Details Grid */
.details-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6); }
.di { display: flex; flex-direction: column; gap: 3px; }
.di-full { grid-column: 1/-1; }
.dl { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .06em; }
.dv { font-size: var(--text-sm); color: var(--text-secondary); }
.dv-mono { font-family: monospace; font-size: var(--text-xs); word-break: break-all; }
.dlink { font-size: var(--text-sm); color: var(--tmdb); text-decoration: underline; }

/* Section Block */
.section-block { margin-top: var(--space-6); }
.section-head { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); border-left: 3px solid var(--tmdb); padding-left: var(--space-3); margin-bottom: var(--space-4); }

/* Crew */
.crew-list { display: flex; flex-direction: column; gap: var(--space-2); }
.crew-row { display: flex; align-items: baseline; gap: var(--space-3); }
.crew-name { font-size: var(--text-sm); color: var(--text-secondary); font-weight: 500; min-width: 160px; }
.crew-job { font-size: var(--text-xs); color: var(--text-muted); }

/* Cast */
.cast-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(85px, 1fr)); gap: var(--space-3); }
.cast-card { display: flex; flex-direction: column; gap: 3px; }
.cast-photo { aspect-ratio: 2/3; border-radius: var(--radius-md); overflow: hidden; background: var(--bg-elevated); border: 1px solid var(--bg-border); }
.cast-photo img { width: 100%; height: 100%; object-fit: cover; }
.cast-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; color: var(--text-muted); }
.cast-name { font-size: 10px; color: var(--text-secondary); font-weight: 600; line-height: 1.3; }
.cast-char { font-size: 10px; color: var(--text-muted); line-height: 1.3; }

/* Misc */
.detail-loading { display: flex; flex-direction: column; }
.skeleton-hero { height: 420px; width: 100%; border-radius: 0; }
.detail-body { padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-3); }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: var(--space-4); }
.empty-title { font-size: var(--text-lg); color: var(--text-secondary); font-weight: 600; }

@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin .8s linear infinite; }
</style>
