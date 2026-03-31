<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useMoviesStore } from '../stores/movies.store.js';
import { useSeriesStore } from '../stores/series.store.js';
import { useMusicStore }  from '../stores/music.store.js';
import { useApi } from '../composables/useApi.js';
import type { RadarrMovie, SonarrSeries, LidarrArtist, ProwlarrResult } from '@nexarr/shared';

const router = useRouter();
const movies = useMoviesStore();
const series = useSeriesStore();
const music  = useMusicStore();
const { get, post } = useApi();

// ── Tabs ──────────────────────────────────────────────────────────────────────

const activeTab = ref<'local' | 'prowlarr'>('local');
const query     = ref('');
const inputRef  = ref<HTMLInputElement | null>(null);

onMounted(async () => {
  inputRef.value?.focus();
  await Promise.allSettled([
    movies.fetchMovies(),
    series.fetchSeries(),
    music.fetchArtists(),
  ]);
});

// ── Local Search ──────────────────────────────────────────────────────────────

const localFilter = ref<'all' | 'movies' | 'series' | 'music'>('all');
const q = computed(() => query.value.trim().toLowerCase());

const movieResults = computed<RadarrMovie[]>(() => {
  if (!q.value || localFilter.value === 'series' || localFilter.value === 'music') return [];
  return movies.movies
    .filter(m => m.title.toLowerCase().includes(q.value) || m.originalTitle?.toLowerCase().includes(q.value) || String(m.year).includes(q.value))
    .slice(0, 20);
});

const seriesResults = computed<SonarrSeries[]>(() => {
  if (!q.value || localFilter.value === 'movies' || localFilter.value === 'music') return [];
  return series.series
    .filter(s => s.title.toLowerCase().includes(q.value) || s.network?.toLowerCase().includes(q.value))
    .slice(0, 20);
});

const artistResults = computed<LidarrArtist[]>(() => {
  if (!q.value || localFilter.value === 'movies' || localFilter.value === 'series') return [];
  return music.artists
    .filter(a => a.artistName.toLowerCase().includes(q.value))
    .slice(0, 20);
});

const localTotal = computed(() => movieResults.value.length + seriesResults.value.length + artistResults.value.length);

function posterUrl(images: Array<{ coverType: string; remoteUrl: string }>): string | undefined {
  return images?.find(i => i.coverType === 'poster')?.remoteUrl;
}

function highlight(text: string): string {
  if (!q.value) return text;
  const re = new RegExp(`(${q.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(re, '<mark>$1</mark>');
}

// ── Prowlarr Search ───────────────────────────────────────────────────────────

const prowlarrResults   = ref<ProwlarrResult[]>([]);
const prowlarrLoading   = ref(false);
const prowlarrError     = ref<string | null>(null);
const prowlarrCategory  = ref<'all' | 'movies' | 'series'>('all');
const grabbingId        = ref<string | null>(null);
const grabSuccess       = ref<string | null>(null);

let prowlarrDebounce: ReturnType<typeof setTimeout> | null = null;

function onQueryChange() {
  if (activeTab.value === 'prowlarr') {
    if (prowlarrDebounce) clearTimeout(prowlarrDebounce);
    prowlarrDebounce = setTimeout(doProwlarrSearch, 600);
  }
}

async function doProwlarrSearch() {
  const term = query.value.trim();
  if (!term || term.length < 2) { prowlarrResults.value = []; return; }

  prowlarrLoading.value = true;
  prowlarrError.value = null;

  try {
    const cats: number[] = prowlarrCategory.value === 'movies' ? [2000]
                         : prowlarrCategory.value === 'series' ? [5000] : [];
    const catParam = cats.length > 0 ? `&categories=${cats.join(',')}` : '';
    prowlarrResults.value = await get<ProwlarrResult[]>(
      `/api/prowlarr/search?q=${encodeURIComponent(term)}${catParam}`
    );
  } catch (e) {
    prowlarrError.value = e instanceof Error ? e.message : 'Suche fehlgeschlagen';
    prowlarrResults.value = [];
  } finally {
    prowlarrLoading.value = false;
  }
}

async function grabRelease(result: ProwlarrResult) {
  grabbingId.value = result.guid;
  try {
    await post('/api/prowlarr/grab', { guid: result.guid, indexerId: result.indexerId });
    grabSuccess.value = result.guid;
    setTimeout(() => { grabSuccess.value = null; }, 3000);
  } catch (e) {
    prowlarrError.value = e instanceof Error ? e.message : 'Download fehlgeschlagen';
  } finally {
    grabbingId.value = null;
  }
}

function fmtSize(bytes: number): string {
  if (!bytes) return '?';
  const gb = bytes / 1024 / 1024 / 1024;
  const mb = bytes / 1024 / 1024;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${mb.toFixed(0)} MB`;
}

function fmtDate(dateStr?: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function openMovie(m: RadarrMovie)   { router.push(`/movies/${m.id}`); }
function openSeries(s: SonarrSeries) { router.push(`/series/${s.id}`); }
function openArtist(a: LidarrArtist) { router.push(`/music/${a.id}`); }

function switchTab(tab: 'local' | 'prowlarr') {
  activeTab.value = tab;
  if (tab === 'prowlarr' && query.value.trim().length >= 2) doProwlarrSearch();
}
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
          placeholder="Suchen…"
          autocomplete="off"
          @input="onQueryChange"
        />
        <button v-if="query" class="search-clear" @click="query = ''; prowlarrResults = []">✕</button>
      </div>

      <!-- Tab Toggle -->
      <div class="tab-row">
        <button :class="['tab-btn', { active: activeTab === 'local' }]" @click="switchTab('local')">
          📚 Bibliothek
        </button>
        <button :class="['tab-btn', { active: activeTab === 'prowlarr' }]" @click="switchTab('prowlarr')">
          🔍 Prowlarr
        </button>
      </div>
    </div>

    <!-- ── LOCAL TAB ── -->
    <template v-if="activeTab === 'local'">
      <div class="filter-row">
        <button v-for="f in (['all','movies','series','music'] as const)" :key="f"
          :class="['filter-btn', { active: localFilter === f }]" @click="localFilter = f">
          {{ f === 'all' ? 'Alle' : f === 'movies' ? '🎬 Filme' : f === 'series' ? '📺 Serien' : '🎵 Musik' }}
        </button>
        <span v-if="q && !movies.isLoading" class="result-count">{{ localTotal }} Treffer</span>
      </div>

      <div v-if="movies.isLoading" class="loading-hint">Bibliothek wird geladen…</div>
      <div v-else-if="!q" class="start-hint">
        <div class="hint-icon">📚</div>
        <p>Durchsuche {{ movies.stats.total + series.stats.total + music.stats.total }} Einträge</p>
      </div>
      <div v-else-if="localTotal === 0" class="empty-state">
        <div class="empty-icon">😶</div>
        <p class="empty-title">Nichts gefunden für „{{ query }}"</p>
      </div>

      <div v-else class="results">
        <!-- Filme -->
        <section v-if="movieResults.length > 0" class="result-section">
          <h2 class="section-title" style="--sec-color: var(--radarr)">
            <span class="sec-dot" />Filme<span class="sec-count">{{ movieResults.length }}</span>
          </h2>
          <div class="result-list">
            <button v-for="m in movieResults" :key="m.id"
              class="result-item" style="--item-color: var(--radarr)" @click="openMovie(m)">
              <img v-if="posterUrl(m.images)" :src="posterUrl(m.images)" :alt="m.title" class="result-thumb" />
              <div v-else class="result-thumb result-thumb--placeholder">🎬</div>
              <div class="result-info">
                <p class="result-title" v-html="highlight(m.title)" />
                <p class="result-meta">{{ m.year }} · {{ m.genres?.slice(0,2).join(', ') }}</p>
              </div>
              <span :class="['result-status', m.hasFile ? 'status-ok' : 'status-miss']">{{ m.hasFile ? '✓' : '○' }}</span>
            </button>
          </div>
        </section>

        <!-- Serien -->
        <section v-if="seriesResults.length > 0" class="result-section">
          <h2 class="section-title" style="--sec-color: var(--sonarr)">
            <span class="sec-dot" />Serien<span class="sec-count">{{ seriesResults.length }}</span>
          </h2>
          <div class="result-list">
            <button v-for="s in seriesResults" :key="s.id"
              class="result-item" style="--item-color: var(--sonarr)" @click="openSeries(s)">
              <img v-if="posterUrl(s.images)" :src="posterUrl(s.images)" :alt="s.title" class="result-thumb" />
              <div v-else class="result-thumb result-thumb--placeholder">📺</div>
              <div class="result-info">
                <p class="result-title" v-html="highlight(s.title)" />
                <p class="result-meta">{{ s.year }} · {{ s.network }}</p>
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
            <span class="sec-dot" />Künstler<span class="sec-count">{{ artistResults.length }}</span>
          </h2>
          <div class="result-list">
            <button v-for="a in artistResults" :key="a.id"
              class="result-item" style="--item-color: var(--lidarr)" @click="openArtist(a)">
              <img v-if="posterUrl(a.images)" :src="posterUrl(a.images)" :alt="a.artistName" class="result-thumb result-thumb--round" />
              <div v-else class="result-thumb result-thumb--placeholder result-thumb--round">🎵</div>
              <div class="result-info">
                <p class="result-title" v-html="highlight(a.artistName)" />
                <p class="result-meta">{{ a.genres?.slice(0,3).join(', ') || 'Musik' }}</p>
              </div>
              <span :class="['result-status', a.monitored ? 'status-ok' : 'status-miss']">{{ a.monitored ? '✓' : '○' }}</span>
            </button>
          </div>
        </section>
      </div>
    </template>

    <!-- ── PROWLARR TAB ── -->
    <template v-else>
      <div class="filter-row">
        <button v-for="c in (['all','movies','series'] as const)" :key="c"
          :class="['filter-btn', { active: prowlarrCategory === c }]"
          @click="prowlarrCategory = c; doProwlarrSearch()">
          {{ c === 'all' ? 'Alle' : c === 'movies' ? '🎬 Filme' : '📺 Serien' }}
        </button>
        <span v-if="prowlarrResults.length > 0 && !prowlarrLoading" class="result-count">
          {{ prowlarrResults.length }} Treffer
        </span>
      </div>

      <div v-if="prowlarrError" class="error-banner">{{ prowlarrError }}</div>

      <div v-if="!query.trim()" class="start-hint">
        <div class="hint-icon">🔍</div>
        <p>Suche über alle Prowlarr-Indexer</p>
      </div>

      <div v-else-if="prowlarrLoading" class="prowlarr-skeleton">
        <div v-for="i in 8" :key="i" class="prowlarr-skel-row">
          <div class="skeleton skel-title" />
          <div class="skeleton skel-meta" />
        </div>
      </div>

      <div v-else-if="!prowlarrLoading && prowlarrResults.length === 0 && query.trim().length >= 2" class="empty-state">
        <div class="empty-icon">📭</div>
        <p class="empty-title">Keine Ergebnisse</p>
      </div>

      <div v-else-if="prowlarrResults.length > 0" class="prowlarr-results">
        <div
          v-for="result in prowlarrResults"
          :key="result.guid"
          class="prowlarr-row"
        >
          <div class="prowlarr-info">
            <p class="prowlarr-title">{{ result.title }}</p>
            <div class="prowlarr-meta">
              <span class="meta-indexer">{{ result.indexer }}</span>
              <span class="meta-size">{{ fmtSize(result.size) }}</span>
              <span v-if="result.seeders !== undefined" :class="['meta-seeds', result.seeders > 0 ? 'seeds-ok' : 'seeds-none']">
                ▲{{ result.seeders }}
              </span>
              <span class="meta-protocol">{{ result.protocol }}</span>
              <span v-if="result.publishDate" class="meta-date">{{ fmtDate(result.publishDate) }}</span>
            </div>
          </div>
          <button
            :class="['grab-btn', { 'grab-success': grabSuccess === result.guid }]"
            :disabled="grabbingId === result.guid"
            @click="grabRelease(result)"
          >
            <span v-if="grabSuccess === result.guid">✓</span>
            <span v-else-if="grabbingId === result.guid">…</span>
            <span v-else>⬇</span>
          </button>
        </div>
      </div>
    </template>

  </div>
</template>

<style scoped>
.search-view {
  padding: var(--space-6);
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* Search Box */
.search-hero { display: flex; flex-direction: column; gap: var(--space-3); }

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
  transition: border-color 0.15s ease;
}
.search-input:focus { border-color: var(--text-muted); }

.search-clear {
  position: absolute;
  right: var(--space-4);
  color: var(--text-muted);
  font-size: var(--text-sm);
}
.search-clear:hover { color: var(--text-secondary); }

/* Tabs */
.tab-row {
  display: flex;
  gap: 2px;
  background: var(--bg-elevated);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-md);
  padding: 2px;
  width: fit-content;
}

.tab-btn {
  padding: var(--space-1) var(--space-4);
  border-radius: calc(var(--radius-md) - 2px);
  font-size: var(--text-sm);
  color: var(--text-muted);
  transition: background 0.15s, color 0.15s;
  cursor: pointer;
}
.tab-btn.active { background: var(--bg-overlay); color: var(--text-primary); }

/* Filters */
.filter-row { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }

.filter-btn {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.filter-btn:hover { background: var(--bg-elevated); color: var(--text-secondary); }
.filter-btn.active { background: var(--bg-overlay); color: var(--text-primary); border-color: var(--text-muted); }

.result-count { font-size: var(--text-xs); color: var(--text-muted); margin-left: auto; }

/* Hints */
.loading-hint { font-size: var(--text-sm); color: var(--text-muted); text-align: center; padding: var(--space-8) 0; }

.start-hint {
  display: flex; flex-direction: column; align-items: center;
  gap: var(--space-3); padding: var(--space-10) 0;
  color: var(--text-muted); font-size: var(--text-sm); text-align: center;
}
.hint-icon { font-size: 40px; }

.empty-state {
  display: flex; flex-direction: column; align-items: center;
  gap: var(--space-3); padding: var(--space-10) 0; text-align: center;
}
.empty-icon  { font-size: 40px; }
.empty-title { font-size: var(--text-lg); color: var(--text-secondary); font-weight: 600; margin: 0; }

/* Error */
.error-banner {
  padding: var(--space-3) var(--space-4);
  background: rgba(248,113,113,0.1);
  border: 1px solid rgba(248,113,113,0.3);
  border-radius: var(--radius-md);
  color: var(--status-error);
  font-size: var(--text-sm);
}

/* Local Results */
.results { display: flex; flex-direction: column; gap: var(--space-6); }

.result-section { display: flex; flex-direction: column; gap: var(--space-3); }

.section-title {
  display: flex; align-items: center; gap: var(--space-2);
  font-size: var(--text-xs); font-weight: 600; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.08em; margin: 0;
}
.sec-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--sec-color); flex-shrink: 0; }
.sec-count { font-weight: 400; }

.result-list { display: flex; flex-direction: column; gap: 2px; }

.result-item {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-surface); border: 1px solid var(--bg-border);
  border-left: 2px solid transparent; border-radius: var(--radius-md);
  text-align: left; cursor: pointer; width: 100%;
  transition: background 0.1s, border-left-color 0.1s;
}
.result-item:hover { background: var(--bg-elevated); border-left-color: var(--item-color); }

.result-thumb {
  width: 36px; height: 54px; object-fit: cover;
  border-radius: var(--radius-sm); flex-shrink: 0; background: var(--bg-elevated);
}
.result-thumb--round { border-radius: 50%; width: 40px; height: 40px; }
.result-thumb--placeholder {
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; border: 1px solid var(--bg-border);
}

.result-info { flex: 1; min-width: 0; }
.result-title { font-size: var(--text-sm); color: var(--text-secondary); font-weight: 500; margin: 0 0 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.result-title :deep(mark) { background: rgba(255,255,255,0.15); color: var(--text-primary); border-radius: 2px; padding: 0 1px; }
.result-meta { font-size: var(--text-xs); color: var(--text-muted); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.result-status { font-size: var(--text-sm); font-weight: 600; flex-shrink: 0; }
.status-ok   { color: var(--status-success); }
.status-miss { color: var(--text-muted); }

/* Prowlarr Results */
.prowlarr-skeleton { display: flex; flex-direction: column; gap: var(--space-2); }
.prowlarr-skel-row { padding: var(--space-3) var(--space-4); background: var(--bg-surface); border: 1px solid var(--bg-border); border-radius: var(--radius-md); display: flex; flex-direction: column; gap: var(--space-1); }
.skel-title { height: 14px; width: 70%; border-radius: 4px; }
.skel-meta  { height: 11px; width: 45%; border-radius: 4px; }

.prowlarr-results { display: flex; flex-direction: column; gap: 2px; }

.prowlarr-row {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-surface); border: 1px solid var(--bg-border);
  border-radius: var(--radius-md);
  transition: background 0.1s;
}
.prowlarr-row:hover { background: var(--bg-elevated); }

.prowlarr-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }

.prowlarr-title {
  font-size: var(--text-sm); color: var(--text-secondary);
  font-weight: 500; margin: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.prowlarr-meta { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
.prowlarr-meta > * { font-size: var(--text-xs); color: var(--text-muted); }

.meta-indexer { font-weight: 500; color: var(--text-tertiary); }
.meta-size    { font-variant-numeric: tabular-nums; }
.meta-seeds   { font-weight: 600; }
.seeds-ok     { color: var(--status-success); }
.seeds-none   { color: var(--status-error); }
.meta-protocol { text-transform: uppercase; letter-spacing: 0.05em; font-size: 10px; }
.meta-date    { font-variant-numeric: tabular-nums; }

.grab-btn {
  width: 32px; height: 32px; border-radius: var(--radius-md);
  background: var(--bg-elevated); border: 1px solid var(--bg-border);
  color: var(--text-secondary); font-size: var(--text-base);
  cursor: pointer; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.grab-btn:hover:not(:disabled) { background: var(--sabnzbd); border-color: var(--sabnzbd); color: #000; }
.grab-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.grab-btn.grab-success { background: rgba(34,197,94,0.15); border-color: rgba(34,197,94,0.3); color: var(--status-success); }
</style>
