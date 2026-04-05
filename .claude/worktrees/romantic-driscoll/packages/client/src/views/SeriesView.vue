<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useSeriesStore } from '../stores/series.store.js';
import { useApi } from '../composables/useApi.js';
import PosterCard from '../components/ui/PosterCard.vue';
import AddToLibraryModal from '../components/ui/AddToLibraryModal.vue';
import type { SonarrSeries } from '@nexarr/shared';
import { posterUrl } from '../utils/images.js';

const router  = useRouter();
const store   = useSeriesStore();
const { get } = useApi();
const showAddModal = ref(false);

// ── State ─────────────────────────────────────────────────────────────────────
const search  = ref('');
const filter  = ref<'all'|'continuing'|'ended'|'missing'|'complete'|'unmonitored'>('all');
const sortBy  = ref<'title'|'year'|'added'|'episodes'|'rating'>('title');
const sortDir = ref<'asc'|'desc'>('asc');
const groupBy = ref<'alpha'|'none'>('alpha');
const library = ref('all');

// ── Root Folders ──────────────────────────────────────────────────────────────
interface RootFolder { id: number; path: string; freeSpace: number }
const rootFolders     = ref<RootFolder[]>([]);
const qualityProfiles = ref<Map<number, string>>(new Map());

async function loadRootFolders() {
  try { rootFolders.value = await get<RootFolder[]>('/api/sonarr/rootfolders'); } catch { /* */ }
}

async function loadQualityProfiles() {
  try {
    const profiles = await get<Array<{ id: number; name: string }>>('/api/sonarr/qualityprofiles');
    qualityProfiles.value = new Map(profiles.map(p => [p.id, p.name]));
  } catch { /* */ }
}

function qualityProfileName(s: SonarrSeries): string | undefined {
  const id = (s as any).qualityProfileId as number | undefined;
  if (!id) return undefined;
  return qualityProfiles.value.get(id);
}

// Episoden-Zähler aus seasons.statistics (zuverlässiger als Top-Level-Felder)
function seriesEpFile(s: SonarrSeries): number {
  const fromSeasons = s.seasons.reduce((acc, ss) => acc + (ss.statistics?.episodeFileCount ?? 0), 0);
  if (fromSeasons > 0) return fromSeasons;
  return s.episodeFileCount ?? 0;
}

function seriesEpTotal(s: SonarrSeries): number {
  const fromSeasons = s.seasons.reduce((acc, ss) => acc + (ss.statistics?.totalEpisodeCount ?? 0), 0);
  if (fromSeasons > 0) return fromSeasons;
  return s.episodeCount ?? 0;
}

function libName(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function seriesProgress(s: SonarrSeries): number {
  const total = s.episodeCount ?? 0;
  const has   = s.episodeFileCount ?? 0;
  if (total === 0) return 0;
  return Math.round((has / total) * 100);
}

// ── Filtered + Sorted ─────────────────────────────────────────────────────────
const filtered = computed((): SonarrSeries[] => {
  let list = [...store.series];

  // Bibliothek
  if (library.value !== 'all') {
    list = list.filter(s => s.rootFolderPath === library.value ||
      s.path?.startsWith(library.value));
  }

  // Suche
  if (search.value.trim()) {
    const q = search.value.toLowerCase();
    list = list.filter(s => s.title.toLowerCase().includes(q));
  }

  // Status
  switch (filter.value) {
    case 'continuing':  list = list.filter(s => s.status === 'continuing'); break;
    case 'ended':       list = list.filter(s => s.status === 'ended'); break;
    case 'unmonitored': list = list.filter(s => !s.monitored); break;
    case 'missing':     list = list.filter(s => { const p = seriesProgress(s); return p < 100 && p > 0 && s.monitored; }); break;
    case 'complete':    list = list.filter(s => seriesProgress(s) === 100); break;
  }

  list.sort((a, b) => {
    let cmp = 0;
    if (sortBy.value === 'title')    cmp = a.sortTitle.localeCompare(b.sortTitle);
    if (sortBy.value === 'year')     cmp = (a.year ?? 0) - (b.year ?? 0);
    if (sortBy.value === 'added')    cmp = a.added.localeCompare(b.added);
    if (sortBy.value === 'episodes') cmp = (a.episodeCount ?? 0) - (b.episodeCount ?? 0);
    if (sortBy.value === 'rating')   cmp = (a.ratings?.value ?? 0) - (b.ratings?.value ?? 0);
    return sortDir.value === 'asc' ? cmp : -cmp;
  });

  return list;
});

// ── Alphabetische Gruppen ─────────────────────────────────────────────────────
const grouped = computed((): Array<{ letter: string; items: SonarrSeries[] }> => {
  if (groupBy.value === 'none') return [{ letter: '', items: filtered.value }];
  const map = new Map<string, SonarrSeries[]>();
  for (const s of filtered.value) {
    const first = s.sortTitle[0]?.toUpperCase() ?? '#';
    const key   = /[A-Z]/.test(first) ? first : '#';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  const sorted = [...map.keys()].sort((a, b) => {
    if (a === '#') return -1; if (b === '#') return 1;
    return a.localeCompare(b);
  });
  return sorted.map(l => ({ letter: l, items: map.get(l)! }));
});

const availableLetters = computed(() => new Set(grouped.value.map(g => g.letter)));

// Stats
const statsComplete = computed(() => store.series.filter(s => seriesProgress(s) === 100).length);
const statsMissing  = computed(() => store.series.filter(s => { const p = seriesProgress(s); return p < 100 && p > 0 && s.monitored; }).length);

// posterUrl imported from @/utils/images

function episodesLabel(s: SonarrSeries): string {
  const total = s.episodeCount ?? 0;
  return total > 0 ? `${total} Ep.` : '';
}

function seriesSeasons(s: SonarrSeries): number {
  return (s.seasons ?? []).filter(season => season.seasonNumber > 0).length;
}

function seriesTechBadges(s: SonarrSeries): Array<{ label: string; color: string }> {
  const badges: Array<{ label: string; color: string }> = [];
  badges.push({ label: s.status === 'continuing' ? 'Laufend' : 'Beendet', color: s.status === 'continuing' ? '#35c5f4' : '#555' });
  if (s.network) badges.push({ label: s.network, color: '#444' });
  const ef = s.episodeFileCount ?? 0;
  const et = s.episodeCount ?? 0;
  if (et > 0) badges.push({ label: `${ef}/${et} Ep.`, color: '#555' });
  return badges;
}

function toggleSort(field: typeof sortBy.value) {
  if (sortBy.value === field) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else { sortBy.value = field; sortDir.value = 'asc'; }
}

function scrollToLetter(letter: string) {
  document.getElementById(`alpha-${letter}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

onMounted(async () => {
  await Promise.allSettled([store.fetchSeries(), loadRootFolders(), loadQualityProfiles()]);
});

const ALPHABET = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
</script>

<template>
  <div class="series-view">

    <!-- ── Header ── -->
    <div class="view-header">
      <div class="header-left">
        <div class="title-row">
          <div class="app-bar" />
          <h1 class="view-title">Serien</h1>
          <span v-if="!store.isLoading" class="total-count">
            {{ filtered.length.toLocaleString('de-DE') }} / {{ store.stats.total.toLocaleString('de-DE') }}
          </span>
        </div>
        <div class="chips">
          <span class="chip chip-on">▶ {{ store.stats.continuing }} laufend</span>
          <span class="chip chip-off">■ {{ store.stats.ended }} beendet</span>
          <span class="chip chip-ok">✓ {{ statsComplete }} komplett</span>
          <span v-if="statsMissing > 0" class="chip chip-warn">⚠ {{ statsMissing }} unvollständig</span>
        </div>
      </div>

      <div class="header-right">
        <div class="search-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input v-model="search" type="search" class="search-input" placeholder="Serien suchen…" />
          <button v-if="search" class="search-clear" @click="search=''">×</button>
        </div>
        <button class="add-btn" @click="showAddModal = true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Serie hinzufügen
        </button>
      </div>
    </div>

    <!-- ── Toolbar ── -->
    <div class="toolbar">
      <div class="btn-group">
        <button :class="['tbtn', filter==='all'&&'tbtn-on']" @click="filter='all'">Alle</button>
        <button :class="['tbtn', filter==='continuing'&&'tbtn-on']" @click="filter='continuing'">Laufend</button>
        <button :class="['tbtn', filter==='ended'&&'tbtn-on']" @click="filter='ended'">Beendet</button>
        <button :class="['tbtn', filter==='complete'&&'tbtn-on']" @click="filter='complete'">Komplett</button>
        <button :class="['tbtn', filter==='missing'&&'tbtn-on']" @click="filter='missing'">Fehlend</button>
        <button :class="['tbtn', filter==='unmonitored'&&'tbtn-on']" @click="filter='unmonitored'">Nicht überwacht</button>
      </div>

      <!-- Bibliothek -->
      <div v-if="rootFolders.length > 1" class="btn-group">
        <button :class="['tbtn', library==='all'&&'tbtn-on']" @click="library='all'">Alle Bibliotheken</button>
        <button
          v-for="rf in rootFolders"
          :key="rf.id"
          :class="['tbtn', library===rf.path&&'tbtn-on']"
          @click="library = library===rf.path ? 'all' : rf.path"
        >{{ libName(rf.path) }}</button>
      </div>

      <div class="toolbar-sep" />

      <div class="btn-group">
        <button v-for="s in (['title','year','added','episodes','rating'] as const)" :key="s"
          :class="['tbtn', sortBy===s&&'tbtn-on']" @click="toggleSort(s)">
          {{ s==='title'?'A–Z':s==='year'?'Jahr':s==='added'?'Neu':s==='episodes'?'Episoden':'Bewertung' }}
          <span v-if="sortBy===s">{{ sortDir==='asc'?'↑':'↓' }}</span>
        </button>
      </div>

      <div class="toolbar-sep" />

      <div class="btn-group">
        <button :class="['tbtn', groupBy==='alpha'&&'tbtn-on']" @click="groupBy='alpha'">A–Z</button>
        <button :class="['tbtn', groupBy==='none'&&'tbtn-on']" @click="groupBy='none'">Alle</button>
      </div>

      <span class="result-count">{{ filtered.length.toLocaleString('de-DE') }} Serien</span>
    </div>

    <div v-if="store.error" class="error-banner">{{ store.error }}</div>

    <!-- Loading -->
    <div v-if="store.isLoading" class="poster-grid">
      <div v-for="i in 32" :key="i" class="skel-card">
        <div class="skel-img skeleton" />
        <div class="skel-line skeleton" style="width:75%;margin-top:6px" />
        <div class="skel-line skeleton" style="width:45%;margin-top:4px" />
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="filtered.length === 0" class="empty-state">
      <div class="empty-icon">📺</div>
      <p class="empty-title">Keine Serien gefunden</p>
      <p class="empty-sub">{{ search ? `Keine Treffer für „${search}"` : 'Kein Eintrag entspricht dem Filter.' }}</p>
      <button v-if="filter!=='all'||search||library!=='all'" class="reset-btn" @click="filter='all';search='';library='all'">Filter zurücksetzen</button>
    </div>

    <!-- Content -->
    <template v-else>
      <div class="content-wrap">
        <div class="groups-wrap">
          <template v-for="group in grouped" :key="group.letter">
            <div v-if="group.letter" :id="`alpha-${group.letter}`" class="alpha-header">{{ group.letter }}</div>
            <div class="poster-grid">
              <PosterCard
                v-for="s in group.items"
                :key="s.id"
                :title="s.title"
                :year="s.year"
                :poster-url="posterUrl(s.images)"
                :rating="s.ratings?.value"
                :has-file="(s.episodeFileCount ?? 0) > 0"
                :monitored="s.monitored"
                :episode-file="seriesEpFile(s)"
                :episode-total="seriesEpTotal(s)"
                :quality-profile="qualityProfileName(s)"
                :seasons="seriesSeasons(s)"
                :overview="s.overview"
                :genres="s.genres"
                :network="s.network"
                :tech-badges="seriesTechBadges(s)"
                app-color="var(--sonarr)"
                @click="router.push(`/series/${s.id}`)"
              />
            </div>
          </template>
        </div>

        <nav v-if="groupBy==='alpha'" class="alpha-nav">
          <button
            v-for="letter in ALPHABET" :key="letter"
            :class="['alpha-btn', availableLetters.has(letter)?'alpha-on':'alpha-off']"
            :disabled="!availableLetters.has(letter)"
            @click="scrollToLetter(letter)"
          >{{ letter }}</button>
        </nav>
      </div>
    </template>
    <AddToLibraryModal v-model="showAddModal" type="series" />
  </div>
</template>

<style scoped>
.series-view { padding: var(--space-5) var(--space-6) var(--space-6); min-height: 100%; }

.view-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-4); margin-bottom: var(--space-4); flex-wrap: wrap; }
.header-left { display: flex; flex-direction: column; gap: var(--space-2); }
.title-row   { display: flex; align-items: center; gap: var(--space-3); }
.app-bar     { width: 3px; height: 24px; background: var(--sonarr); border-radius: 2px; flex-shrink: 0; }
.view-title  { font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); margin: 0; }
.total-count { font-size: var(--text-sm); color: var(--text-muted); }
.chips { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.chip { font-size: 11px; padding: 2px 8px; border-radius: 99px; font-weight: 500; }
.chip-on   { background: rgba(53,197,244,.1); color: var(--sonarr); border: 1px solid rgba(53,197,244,.25); }
.chip-off  { background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--bg-border); }
.chip-ok   { background: rgba(34,197,94,.1); color: #22c55e; border: 1px solid rgba(34,197,94,.25); }
.chip-warn { background: rgba(245,158,11,.1); color: #f59e0b; border: 1px solid rgba(245,158,11,.25); }

.header-right { display: flex; align-items: center; gap: var(--space-3); flex-shrink: 0; }
.search-box { display: flex; align-items: center; gap: var(--space-2); padding: 7px 12px; background: var(--bg-elevated); border: 1px solid var(--bg-border); border-radius: var(--radius-md); color: var(--text-muted); transition: border-color .15s; }
.search-box:focus-within { border-color: var(--sonarr); }
.search-input { background: none; border: none; outline: none; font-size: var(--text-sm); color: var(--text-primary); width: 200px; }
.search-input::placeholder { color: var(--text-muted); }
.search-clear { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 16px; padding: 0; line-height: 1; }
.add-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; background: var(--sonarr); border: none; border-radius: var(--radius-md); color: #000; font-size: var(--text-sm); font-weight: 600; cursor: pointer; transition: opacity .15s; white-space: nowrap; }
.add-btn:hover { opacity: .85; }

.toolbar { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-5); flex-wrap: wrap; }
.btn-group { display: flex; gap: 2px; background: var(--bg-elevated); border: 1px solid var(--bg-border); border-radius: var(--radius-md); padding: 2px; }
.tbtn { padding: 5px 11px; border-radius: calc(var(--radius-md) - 2px); font-size: var(--text-xs); color: var(--text-muted); transition: background .12s, color .12s; white-space: nowrap; cursor: pointer; }
.tbtn:hover { color: var(--text-secondary); }
.tbtn-on { background: var(--bg-overlay); color: var(--text-primary); font-weight: 500; }
.toolbar-sep { width: 1px; height: 20px; background: var(--bg-border); flex-shrink: 0; }
.result-count { font-size: var(--text-xs); color: var(--text-muted); margin-left: auto; }
.error-banner { padding: var(--space-4); background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.25); border-radius: var(--radius-md); color: #ef4444; margin-bottom: var(--space-5); font-size: var(--text-sm); }

.content-wrap { display: flex; gap: var(--space-3); align-items: flex-start; }
.groups-wrap  { flex: 1; min-width: 0; }
.alpha-header { font-size: var(--text-sm); font-weight: 700; color: var(--text-muted); padding: var(--space-3) 0 var(--space-2); border-bottom: 1px solid var(--bg-border); margin-bottom: var(--space-3); scroll-margin-top: 80px; }
.poster-grid  { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: var(--space-3); margin-bottom: var(--space-5); }

.alpha-nav { position: sticky; top: var(--space-4); display: flex; flex-direction: column; gap: 1px; flex-shrink: 0; }
.alpha-btn { width: 22px; height: 22px; border-radius: 4px; font-size: 11px; font-weight: 600; text-align: center; line-height: 22px; padding: 0; cursor: pointer; transition: background .1s, color .1s; }
.alpha-on  { color: var(--text-secondary); }
.alpha-on:hover  { background: var(--bg-elevated); color: var(--sonarr); }
.alpha-off { color: var(--text-muted); opacity: .3; cursor: default; }

.skel-card { border-radius: var(--radius-md); overflow: hidden; background: var(--bg-surface); border: 1px solid var(--bg-border); padding: 0 0 var(--space-2); }
.skel-img  { aspect-ratio: 2/3; width: 100%; }
.skel-line { height: 10px; border-radius: 3px; margin: 0 var(--space-2); }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 40vh; padding: var(--space-8) var(--space-4); gap: var(--space-3); text-align: center; }
.empty-icon  { font-size: 48px; }
.empty-title { font-size: var(--text-lg); color: var(--text-secondary); font-weight: 600; margin: 0; }
.empty-sub   { color: var(--text-muted); font-size: var(--text-sm); margin: 0; }
.reset-btn   { padding: 7px 16px; background: var(--bg-elevated); border: 1px solid var(--bg-border); border-radius: var(--radius-md); color: var(--text-secondary); font-size: var(--text-sm); cursor: pointer; }
.reset-btn:hover { background: var(--bg-overlay); }
</style>
