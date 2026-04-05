<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useApi } from '../composables/useApi.js';

const { get, post } = useApi();

// ── State ─────────────────────────────────────────────────────────────────────

interface Indexer {
  id: number;
  name: string;
  enable: boolean;
  protocol: 'usenet' | 'torrent';
  privacy: 'public' | 'private' | 'semiPrivate';
}

interface IndexerStat {
  indexerName: string;
  numberOfGrabs: number;
  numberOfQueries: number;
  numberOfFailedQueries: number;
  numberOfFailedGrabs: number;
  averageResponseTime?: number;
}

interface Release {
  guid: string;
  title: string;
  size: number;
  ageHours?: number;
  seeders?: number;
  protocol: string;
  indexer: string;
  indexerId: number;
  customFormatScore?: number;
  quality?: { quality: { name: string } };
  customFormats?: Array<{ name: string }>;
  languages?: Array<{ name: string }>;
}

interface HistoryRecord {
  date: string;
  eventType: string;
  data?: { title?: string; indexer?: string; protocol?: string; size?: number; releaseGroup?: string };
}

// Data
const indexers       = ref<Indexer[]>([]);
const stats          = ref<IndexerStat[]>([]);
const health         = ref<{ radarr: any[]; sonarr: any[] }>({ radarr: [], sonarr: [] });
const historyRecords = ref<HistoryRecord[]>([]);
const rssResults     = ref<Release[]>([]);
const searchResults  = ref<Release[]>([]);

// UI
const activeTab      = ref<'indexer' | 'history' | 'rss'>('indexer');
const isLoadingStats = ref(true);
const isLoadingHealth = ref(true);
const historyLoaded  = ref(false);
const rssLoaded      = ref(false);

// Search
const searchQuery    = ref('');
const searchCat      = ref('');
const searchProto    = ref<'all' | 'usenet' | 'torrent'>('all');
const searchLangDe   = ref(false);
const sortKey        = ref<'score' | 'size' | 'age' | 'seeds'>('score');
const sortAsc        = ref(false);
const isSearching    = ref(false);
const searchTime     = ref('');
const shownCount     = ref(50);

// Per-action state
const testingAll     = ref(false);
const testingArr     = ref<'radarr' | 'sonarr' | null>(null);
const grabbingId     = ref<string | null>(null);
const grabDoneId     = ref<string | null>(null);

// Toast
interface Toast { id: number; msg: string; ok: boolean }
const toasts = ref<Toast[]>([]);
let toastN = 0;
function toast(msg: string, ok = true) {
  const id = ++toastN;
  toasts.value.push({ id, msg, ok });
  setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id); }, 3000);
}

// ── Computed ──────────────────────────────────────────────────────────────────

const statMap = computed(() => {
  const m: Record<string, IndexerStat> = {};
  stats.value.forEach(s => { m[s.indexerName] = s; });
  return m;
});

const totalGrabs   = computed(() => stats.value.reduce((s, x) => s + (x.numberOfGrabs ?? 0), 0));
const totalQueries = computed(() => stats.value.reduce((s, x) => s + (x.numberOfQueries ?? 0), 0));
const totalFails   = computed(() => stats.value.reduce((s, x) => s + (x.numberOfFailedQueries ?? 0), 0));
const successRate  = computed(() => totalQueries.value > 0 ? Math.round((1 - totalFails.value / totalQueries.value) * 100) : 100);
const activeCount  = computed(() => indexers.value.filter(i => i.enable).length);
const maxGrabs     = computed(() => Math.max(1, ...stats.value.map(s => s.numberOfGrabs ?? 0)));

const healthIssues = computed(() => {
  const kws = ['indexer', 'prowlarr', 'newznab', 'torznab', 'rss', 'search', 'grab'];
  const isIndexer = (h: any) => kws.some(k => (h.message ?? '').toLowerCase().includes(k) || (h.source ?? '').toLowerCase().includes(k));
  return [
    ...health.value.radarr.filter(h => (h.type === 'warning' || h.type === 'error') && isIndexer(h)).map((h: any) => ({ ...h, app: 'Radarr', appColor: 'var(--radarr)' })),
    ...health.value.sonarr.filter(h => (h.type === 'warning' || h.type === 'error') && isIndexer(h)).map((h: any) => ({ ...h, app: 'Sonarr', appColor: 'var(--sonarr)' })),
  ];
});

const usenetIndexers  = computed(() => indexers.value.filter(i => i.protocol === 'usenet').sort(sortIndexers));
const torrentIndexers = computed(() => indexers.value.filter(i => i.protocol !== 'usenet').sort(sortIndexers));

function sortIndexers(a: Indexer, b: Indexer) {
  if (a.enable !== b.enable) return a.enable ? -1 : 1;
  return (statMap.value[b.name]?.numberOfGrabs ?? 0) - (statMap.value[a.name]?.numberOfGrabs ?? 0);
}

const filteredResults = computed(() => {
  let list = searchResults.value;
  if (searchProto.value !== 'all') list = list.filter(r => r.protocol === searchProto.value);
  if (searchLangDe.value) list = list.filter(r => parseLangs(r.title).includes('DE'));
  list = [...list].sort((a, b) => {
    let va = 0, vb = 0;
    if (sortKey.value === 'score') { va = a.customFormatScore ?? 0; vb = b.customFormatScore ?? 0; }
    if (sortKey.value === 'size')  { va = a.size ?? 0; vb = b.size ?? 0; }
    if (sortKey.value === 'age')   { va = a.ageHours ?? 99999; vb = b.ageHours ?? 99999; }
    if (sortKey.value === 'seeds') { va = a.seeders ?? 0; vb = b.seeders ?? 0; }
    return sortAsc.value ? va - vb : vb - va;
  });
  return list;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtSize(b: number) {
  if (!b) return '–';
  const gb = b / 1073741824;
  return gb >= 1 ? gb.toFixed(1) + ' GB' : (b / 1048576).toFixed(0) + ' MB';
}

function fmtAge(h?: number) {
  if (!h) return '–';
  if (h < 1) return Math.round(h * 60) + 'm';
  if (h < 24) return Math.round(h) + 'h';
  return Math.round(h / 24) + 'd';
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function numFmt(n: number) {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function parseLangs(title: string): string[] {
  const t = title.toLowerCase();
  const langs: string[] = [];
  if (/\bger(man)?\b|\.ger\.|deutsch/.test(t)) langs.push('DE');
  if (/\beng(lish)?\b|\.eng\./.test(t))        langs.push('EN');
  return langs;
}

function techBadges(title: string): string[] {
  const t = title.toUpperCase();
  const b: string[] = [];
  if (/2160P|4K|UHD/.test(t))          b.push('4K');
  else if (/1080P/.test(t))            b.push('1080p');
  else if (/720P/.test(t))             b.push('720p');
  if (/DOLBY.VISION|DV\.|\bDV\b/.test(t)) b.push('DV');
  if (/HDR10\+/.test(t))               b.push('HDR10+');
  else if (/HDR/.test(t))              b.push('HDR');
  if (/REMUX/.test(t))                 b.push('REMUX');
  else if (/BLURAY|BLU-RAY/.test(t))  b.push('Blu-ray');
  else if (/WEBDL|WEB-DL/.test(t))    b.push('WEB-DL');
  else if (/WEBRIP/.test(t))          b.push('WEBRip');
  if (/ATMOS/.test(t))                 b.push('Atmos');
  else if (/TRUEHD/.test(t))          b.push('TrueHD');
  else if (/DTS-X/.test(t))           b.push('DTS:X');
  else if (/DTS-HD/.test(t))          b.push('DTS-HD');
  else if (/EAC3|DD\+/.test(t))       b.push('DD+');
  if (/H\.265|X265|HEVC/.test(t))      b.push('H.265');
  else if (/H\.264|X264|AVC/.test(t)) b.push('H.264');
  return b;
}

function seedsClass(n?: number) {
  if (!n) return 'seeds-none';
  if (n >= 20) return 'seeds-hi';
  if (n >= 5)  return 'seeds-mid';
  return 'seeds-lo';
}

function healthColor(pct: number) {
  if (pct >= 95) return 'var(--status-success)';
  if (pct >= 70) return 'var(--status-warning)';
  return 'var(--status-error)';
}

// ── Load ──────────────────────────────────────────────────────────────────────

onMounted(async () => {
  await Promise.all([loadStats(), loadHealth()]);
});

async function loadStats() {
  isLoadingStats.value = true;
  try {
    const [idxData, statsData] = await Promise.all([
      get<Indexer[]>('/api/prowlarr/indexers'),
      get<{ indexers: IndexerStat[] }>('/api/prowlarr/stats').catch(() => ({ indexers: [] })),
    ]);
    indexers.value = Array.isArray(idxData) ? idxData : [];
    // Prowlarr /indexerstats liefert { indexers: [...] }
    const rawStats = statsData as any;
    stats.value    = rawStats?.indexers ?? rawStats?.data?.indexers ?? [];
  } catch (e) {
    console.error('[IndexerView] loadStats error:', e);
  } finally { isLoadingStats.value = false; }
}

async function loadHealth() {
  isLoadingHealth.value = true;
  try {
    const [r, s] = await Promise.all([
      get<any[]>('/api/radarr/health').catch(() => []),
      get<any[]>('/api/sonarr/health').catch(() => []),
    ]);
    health.value = { radarr: r ?? [], sonarr: s ?? [] };
  } finally { isLoadingHealth.value = false; }
}

async function switchTab(tab: 'indexer' | 'history' | 'rss') {
  activeTab.value = tab;
  if (tab === 'history' && !historyLoaded.value) await loadHistory();
  if (tab === 'rss'     && !rssLoaded.value)     await loadRss();
}

async function loadHistory() {
  try {
    const data = await get<any>('/api/prowlarr/history?pageSize=100');
    // Prowlarr history liefert { records: [...] } oder direkt Array
    const raw = data as any;
    const records: HistoryRecord[] = Array.isArray(raw) ? raw : (raw?.records ?? []);
    historyRecords.value = records.filter(r => r.eventType === 'releaseGrabbed');
  } catch { historyRecords.value = []; }
  historyLoaded.value = true;
}

async function loadRss() {
  try {
    const data = await get<Release[]>('/api/prowlarr/rss?categories=5000&limit=50');
    rssResults.value = (data ?? []).sort((a, b) => (a.ageHours ?? 999) - (b.ageHours ?? 999));
  } catch { rssResults.value = []; }
  rssLoaded.value = true;
}

async function doSearch() {
  const q = searchQuery.value.trim();
  if (!q) return;
  isSearching.value = true;
  shownCount.value  = 50;
  const t0 = Date.now();
  try {
    const cat = searchCat.value ? `&categories=${searchCat.value}` : '';
    const data = await get<Release[]>(`/api/prowlarr/search?q=${encodeURIComponent(q)}${cat}&type=search`);
    searchResults.value = data ?? [];
    searchTime.value = `${((Date.now() - t0) / 1000).toFixed(1)}s · ${searchResults.value.length} Treffer`;
  } catch (e) {
    toast(e instanceof Error ? e.message : 'Suche fehlgeschlagen', false);
    searchResults.value = [];
  } finally { isSearching.value = false; }
}

async function grab(release: Release) {
  grabbingId.value = release.guid;
  try {
    await post('/api/prowlarr/grab', { guid: release.guid, indexerId: release.indexerId });
    grabDoneId.value = release.guid;
    toast('Download gestartet!');
    setTimeout(() => { grabDoneId.value = null; }, 3000);
  } catch (e) {
    toast(e instanceof Error ? e.message : 'Fehler', false);
  } finally { grabbingId.value = null; }
}

async function testAll(arr: 'radarr' | 'sonarr') {
  testingArr.value = arr;
  try {
    await post(`/api/${arr}/indexer/testall`, {});
    toast(`${arr === 'radarr' ? 'Radarr' : 'Sonarr'} Indexer getestet`);
    await loadHealth();
  } catch (e) {
    toast(e instanceof Error ? e.message : 'Fehler', false);
  } finally { testingArr.value = null; }
}

async function reload() {
  await loadStats();
  historyLoaded.value = false;
  rssLoaded.value     = false;
  if (activeTab.value === 'history') await loadHistory();
  if (activeTab.value === 'rss')     await loadRss();
}

function setSort(key: typeof sortKey.value) {
  if (sortKey.value === key) sortAsc.value = !sortAsc.value;
  else { sortKey.value = key; sortAsc.value = false; }
}
</script>

<template>
  <div class="indexer-view">

    <!-- Toasts -->
    <Teleport to="body">
      <div class="toast-wrap">
        <TransitionGroup name="toast">
          <div v-for="t in toasts" :key="t.id" :class="['toast-item', t.ok ? 'tok' : 'terr']">{{ t.msg }}</div>
        </TransitionGroup>
      </div>
    </Teleport>

    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Indexer</h1>
        <p class="page-sub" v-if="!isLoadingStats">
          Prowlarr · {{ indexers.length }} Indexer · {{ activeCount }} aktiv
        </p>
        <p class="page-sub" v-else>Prowlarr · Lade…</p>
      </div>
      <div class="header-actions">
        <button class="btn-sec" @click="reload">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.02-7.36"/></svg>
          Aktualisieren
        </button>
        <a href="http://192.168.188.69:9696" target="_blank" class="btn-prowlarr">↗ Prowlarr öffnen</a>
      </div>
    </div>

    <!-- Stats Row -->
    <div class="stats-row">
      <div v-if="isLoadingStats" v-for="i in 5" :key="i" class="stat-card skeleton" style="height:58px" />
      <template v-else>
        <div class="stat-card">
          <div class="stat-lbl">Indexer</div>
          <div class="stat-val">{{ activeCount }}/{{ indexers.length }} aktiv</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Grabs</div>
          <div class="stat-val">{{ numFmt(totalGrabs) }}</div>
          <div class="stat-sub">Gesamt</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Abfragen</div>
          <div class="stat-val">{{ numFmt(totalQueries) }}</div>
          <div class="stat-sub">Gesamt</div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Fehler</div>
          <div class="stat-val" :style="totalFails > 0 ? 'color:var(--status-error)' : ''">{{ numFmt(totalFails) }}</div>
          <div class="stat-sub" :style="totalFails > 0 ? 'color:var(--status-error)' : 'color:var(--status-success)'">
            {{ totalFails > 0 ? Math.round(totalFails/Math.max(totalQueries,1)*100) + '% Fehlerrate' : 'Alles OK' }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-lbl">Erfolgsrate</div>
          <div class="stat-val" :style="`color:${healthColor(successRate)}`">{{ successRate }}%</div>
          <div class="stat-bar-wrap">
            <div class="stat-bar-fill" :style="`width:${successRate}%;background:${healthColor(successRate)}`" />
          </div>
        </div>
      </template>
    </div>

    <!-- Health Widget -->
    <div class="health-widget">
      <div class="health-header">
        <span class="health-title">Indexer Health</span>
        <div class="health-actions">
          <button class="btn-arr-test radarr" :disabled="testingArr === 'radarr'" @click="testAll('radarr')">
            {{ testingArr === 'radarr' ? 'Teste…' : 'Radarr testen' }}
          </button>
          <button class="btn-arr-test sonarr" :disabled="testingArr === 'sonarr'" @click="testAll('sonarr')">
            {{ testingArr === 'sonarr' ? 'Teste…' : 'Sonarr testen' }}
          </button>
        </div>
      </div>
      <div v-if="isLoadingHealth" class="skeleton" style="height:28px;border-radius:6px" />
      <div v-else-if="!healthIssues.length" class="health-ok">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--status-success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        Alle Indexer reagieren korrekt – kein Handlungsbedarf
      </div>
      <div v-else class="health-issues">
        <div v-for="(h, i) in healthIssues" :key="i" class="health-issue" :class="h.type">
          <span class="issue-app" :style="`color:${h.appColor}`">{{ h.app }}</span>
          <span class="issue-type">{{ h.type?.toUpperCase() }}</span>
          <span class="issue-msg">{{ h.message }}</span>
        </div>
      </div>
    </div>

    <!-- Search Box -->
    <div class="search-box">
      <div class="search-title">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        Prowlarr Release-Suche
      </div>

      <!-- Main Row -->
      <div class="search-main">
        <div class="search-input-wrap">
          <svg class="search-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input v-model="searchQuery" class="search-inp" type="text" placeholder="Filmtitel, Serienname, Künstler…"
            @keydown.enter="doSearch" />
        </div>
        <select v-model="searchCat" class="search-sel">
          <option value="">Alle Kategorien</option>
          <option value="2000">🎬 Filme</option>
          <option value="5000">📺 TV / Serien</option>
          <option value="6000">🎵 Musik</option>
        </select>
        <button class="btn-search" :disabled="isSearching" @click="doSearch">
          <svg v-if="!isSearching" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <svg v-else class="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          {{ isSearching ? 'Suche läuft…' : 'Suchen' }}
        </button>
      </div>

      <!-- Filter Row -->
      <div class="filter-row">
        <span class="filter-lbl">Protokoll:</span>
        <button v-for="p in (['all','usenet','torrent'] as const)" :key="p"
          :class="['fchip', `fchip-${p}`, { active: searchProto === p }]"
          @click="searchProto = p">
          {{ p === 'all' ? 'Alle' : p === 'usenet' ? 'Usenet' : 'Torrent' }}
        </button>
        <div class="filter-sep" />
        <span class="filter-lbl">Sprache:</span>
        <button :class="['fchip', 'fchip-de', { active: searchLangDe }]" @click="searchLangDe = !searchLangDe">🇩🇪 Deutsch</button>
        <div class="filter-sep" />
        <span class="filter-lbl">Sortierung:</span>
        <button v-for="s in (['score','size','age','seeds'] as const)" :key="s"
          :class="['sort-btn', { active: sortKey === s }]"
          @click="setSort(s)">
          {{ s === 'score' ? 'Score' : s === 'size' ? 'Größe' : s === 'age' ? 'Alter' : 'Seeds' }}
          <span v-if="sortKey === s">{{ sortAsc ? '▲' : '▼' }}</span>
        </button>
      </div>

      <!-- Results -->
      <div v-if="searchResults.length > 0 || searchTime" class="results-area">
        <div class="results-meta">
          <span class="results-count">{{ filteredResults.length }} / {{ searchResults.length }} Ergebnisse</span>
          <span class="results-time">{{ searchTime }}</span>
        </div>
        <div class="release-list">
          <div v-for="r in filteredResults.slice(0, shownCount)" :key="r.guid" class="rel-row">
            <div class="rel-main">
              <div class="rel-title">{{ r.title }}</div>
              <div class="rel-badges">
                <span :class="['rb', r.protocol === 'usenet' ? 'rb-usenet' : 'rb-torrent']">{{ r.protocol }}</span>
                <span v-for="b in techBadges(r.title)" :key="b" class="rb rb-tech">{{ b }}</span>
                <span v-for="cf in (r.customFormats ?? []).slice(0,3)" :key="cf.name" class="rb rb-cf">{{ cf.name }}</span>
                <span v-for="l in parseLangs(r.title)" :key="l" class="rb rb-lang">{{ l }}</span>
                <span v-if="r.customFormatScore" :class="['rb', r.customFormatScore >= 0 ? 'rb-score-pos' : 'rb-score-neg']">
                  {{ r.customFormatScore >= 0 ? '+' : '' }}{{ r.customFormatScore }}
                </span>
                <span v-if="r.indexer" class="rb rb-indexer">{{ r.indexer }}</span>
              </div>
            </div>
            <div class="rel-right">
              <span v-if="r.size" class="rel-size">{{ fmtSize(r.size) }}</span>
              <span v-if="r.ageHours" class="rel-age">{{ fmtAge(r.ageHours) }}</span>
              <span v-if="r.protocol !== 'usenet'" :class="['rel-seeds', seedsClass(r.seeders)]">{{ r.seeders ?? 0 }} Seeds</span>
              <button
                :class="['btn-grab', { 'btn-grab-done': grabDoneId === r.guid }]"
                :disabled="grabbingId === r.guid"
                @click="grab(r)">
                <span v-if="grabDoneId === r.guid">✓</span>
                <span v-else-if="grabbingId === r.guid">…</span>
                <span v-else>↓ Laden</span>
              </button>
            </div>
          </div>
        </div>
        <div v-if="filteredResults.length > shownCount" class="load-more">
          <button class="btn-sec" @click="shownCount += 50">Weitere laden</button>
        </div>
        <div v-else-if="filteredResults.length === 0 && searchResults.length > 0" class="empty-results">
          Keine Ergebnisse für diese Filter
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-bar">
      <button v-for="t in (['indexer','history','rss'] as const)" :key="t"
        :class="['tab-btn', { active: activeTab === t }]"
        @click="switchTab(t)">
        {{ t === 'indexer' ? 'Indexer' : t === 'history' ? 'Letzte Grabs' : 'RSS / Neueste' }}
      </button>
    </div>

    <!-- Tab: Indexer Grid -->
    <div v-if="activeTab === 'indexer'" class="tab-content">
      <div v-if="isLoadingStats" class="indexer-grid">
        <div v-for="i in 4" :key="i" class="skeleton" style="height:130px;border-radius:var(--radius-lg)" />
      </div>
      <div v-else-if="!indexers.length" class="empty-state">Keine Indexer konfiguriert</div>
      <template v-else>
        <!-- Usenet -->
        <template v-if="usenetIndexers.length">
          <div class="group-header">
            <span class="group-title">Usenet</span>
            <div class="group-line" />
            <span class="group-count">{{ usenetIndexers.length }}</span>
          </div>
          <div class="indexer-grid">
            <div v-for="idx in usenetIndexers" :key="idx.id"
              :class="['idx-card', { disabled: !idx.enable }]">
              <div class="idx-head">
                <span :class="['idx-dot', idx.enable ? 'dot-on' : 'dot-off']" />
                <span class="idx-name" :title="idx.name">{{ idx.name }}</span>
                <span class="ib ib-usenet">Usenet</span>
                <span :class="['ib', idx.privacy === 'public' ? 'ib-pub' : idx.privacy === 'private' ? 'ib-priv' : 'ib-semi']">
                  {{ idx.privacy === 'public' ? 'Public' : idx.privacy === 'private' ? 'Private' : 'Semi' }}
                </span>
              </div>
              <div class="idx-stats" v-if="statMap[idx.name]">
                <div class="is">
                  <div class="is-val">{{ numFmt(statMap[idx.name].numberOfGrabs ?? 0) }}</div>
                  <div class="is-lbl">Grabs</div>
                  <div class="is-bar"><div class="is-fill" :style="`width:${Math.round((statMap[idx.name].numberOfGrabs??0)/maxGrabs*100)}%`" /></div>
                </div>
                <div class="is">
                  <div class="is-val">{{ numFmt(statMap[idx.name].numberOfQueries ?? 0) }}</div>
                  <div class="is-lbl">Abfragen</div>
                </div>
                <div class="is">
                  <div class="is-val" :style="(statMap[idx.name].averageResponseTime??0) > 2000 ? 'color:var(--status-error)' : (statMap[idx.name].averageResponseTime??0) > 500 ? 'color:var(--status-warning)' : ''">
                    {{ statMap[idx.name].averageResponseTime ? Math.round(statMap[idx.name].averageResponseTime!) + 'ms' : '–' }}
                  </div>
                  <div class="is-lbl">Antwortzeit</div>
                </div>
              </div>
              <div v-if="statMap[idx.name]" class="idx-health">
                <div class="h-pct" :style="`color:${healthColor(statMap[idx.name].numberOfQueries > 0 ? Math.round((1-statMap[idx.name].numberOfFailedQueries/statMap[idx.name].numberOfQueries)*100) : 100)}`">
                  {{ statMap[idx.name].numberOfQueries > 0 ? Math.round((1 - statMap[idx.name].numberOfFailedQueries / statMap[idx.name].numberOfQueries) * 100) : 100 }}%
                </div>
                <div class="h-bar">
                  <div class="h-fill" :style="`width:${statMap[idx.name].numberOfQueries > 0 ? Math.round((1-statMap[idx.name].numberOfFailedQueries/statMap[idx.name].numberOfQueries)*100) : 100}%;background:${healthColor(statMap[idx.name].numberOfQueries > 0 ? Math.round((1-statMap[idx.name].numberOfFailedQueries/statMap[idx.name].numberOfQueries)*100) : 100)}`" />
                </div>
                <div class="h-lbl">Erfolgsrate</div>
              </div>
            </div>
          </div>
        </template>
        <!-- Torrent -->
        <template v-if="torrentIndexers.length">
          <div class="group-header">
            <span class="group-title">Torrent</span>
            <div class="group-line" />
            <span class="group-count">{{ torrentIndexers.length }}</span>
          </div>
          <div class="indexer-grid">
            <div v-for="idx in torrentIndexers" :key="idx.id"
              :class="['idx-card', { disabled: !idx.enable }]">
              <div class="idx-head">
                <span :class="['idx-dot', idx.enable ? 'dot-on' : 'dot-off']" />
                <span class="idx-name" :title="idx.name">{{ idx.name }}</span>
                <span class="ib ib-torrent">Torrent</span>
                <span :class="['ib', idx.privacy === 'public' ? 'ib-pub' : idx.privacy === 'private' ? 'ib-priv' : 'ib-semi']">
                  {{ idx.privacy === 'public' ? 'Public' : idx.privacy === 'private' ? 'Private' : 'Semi' }}
                </span>
              </div>
              <div class="idx-stats" v-if="statMap[idx.name]">
                <div class="is">
                  <div class="is-val">{{ numFmt(statMap[idx.name].numberOfGrabs ?? 0) }}</div>
                  <div class="is-lbl">Grabs</div>
                  <div class="is-bar"><div class="is-fill" :style="`width:${Math.round((statMap[idx.name].numberOfGrabs??0)/maxGrabs*100)}%`" /></div>
                </div>
                <div class="is">
                  <div class="is-val">{{ numFmt(statMap[idx.name].numberOfQueries ?? 0) }}</div>
                  <div class="is-lbl">Abfragen</div>
                </div>
                <div class="is">
                  <div class="is-val" :style="(statMap[idx.name].averageResponseTime??0) > 2000 ? 'color:var(--status-error)' : (statMap[idx.name].averageResponseTime??0) > 500 ? 'color:var(--status-warning)' : ''">
                    {{ statMap[idx.name].averageResponseTime ? Math.round(statMap[idx.name].averageResponseTime!) + 'ms' : '–' }}
                  </div>
                  <div class="is-lbl">Antwortzeit</div>
                </div>
              </div>
              <div v-if="statMap[idx.name]" class="idx-health">
                <div class="h-pct" :style="`color:${healthColor(statMap[idx.name].numberOfQueries > 0 ? Math.round((1-statMap[idx.name].numberOfFailedQueries/statMap[idx.name].numberOfQueries)*100) : 100)}`">
                  {{ statMap[idx.name].numberOfQueries > 0 ? Math.round((1 - statMap[idx.name].numberOfFailedQueries / statMap[idx.name].numberOfQueries) * 100) : 100 }}%
                </div>
                <div class="h-bar">
                  <div class="h-fill" :style="`width:${statMap[idx.name].numberOfQueries > 0 ? Math.round((1-statMap[idx.name].numberOfFailedQueries/statMap[idx.name].numberOfQueries)*100) : 100}%;background:${healthColor(statMap[idx.name].numberOfQueries > 0 ? Math.round((1-statMap[idx.name].numberOfFailedQueries/statMap[idx.name].numberOfQueries)*100) : 100)}`" />
                </div>
                <div class="h-lbl">Erfolgsrate</div>
              </div>
            </div>
          </div>
        </template>
      </template>
    </div>

    <!-- Tab: History -->
    <div v-if="activeTab === 'history'" class="tab-content">
      <div v-if="!historyLoaded" class="loading-msg">
        <svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        Lade History…
      </div>
      <div v-else-if="!historyRecords.length" class="empty-state">Keine Grab-History vorhanden</div>
      <div v-else class="hist-table-wrap">
        <table class="hist-table">
          <thead>
            <tr>
              <th>Datum</th><th>Titel</th><th>Indexer</th><th>Protokoll</th><th>Größe</th><th>Release-Group</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in historyRecords" :key="i">
              <td class="td-date">{{ fmtDate(r.date) }}</td>
              <td class="td-title" :title="r.data?.title ?? ''">{{ r.data?.title ?? '–' }}</td>
              <td><span class="rb rb-indexer">{{ r.data?.indexer ?? '–' }}</span></td>
              <td><span :class="['rb', r.data?.protocol === 'usenet' ? 'rb-usenet' : 'rb-torrent']">{{ r.data?.protocol ?? '–' }}</span></td>
              <td class="td-num">{{ r.data?.size ? fmtSize(r.data.size) : '–' }}</td>
              <td class="td-rg">{{ r.data?.releaseGroup ?? '–' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Tab: RSS -->
    <div v-if="activeTab === 'rss'" class="tab-content">
      <div v-if="!rssLoaded" class="loading-msg">
        <svg class="spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        Lade aktuelle Releases…
      </div>
      <div v-else-if="!rssResults.length" class="empty-state">Keine RSS-Releases verfügbar</div>
      <template v-else>
        <div class="results-meta" style="margin-bottom:var(--space-3)">
          <span class="results-count">{{ rssResults.length }} neueste Releases</span>
        </div>
        <div class="release-list">
          <div v-for="r in rssResults" :key="r.guid" class="rel-row">
            <div class="rel-main">
              <div class="rel-title">{{ r.title }}</div>
              <div class="rel-badges">
                <span :class="['rb', r.protocol === 'usenet' ? 'rb-usenet' : 'rb-torrent']">{{ r.protocol }}</span>
                <span v-for="b in techBadges(r.title)" :key="b" class="rb rb-tech">{{ b }}</span>
                <span v-if="r.indexer" class="rb rb-indexer">{{ r.indexer }}</span>
              </div>
            </div>
            <div class="rel-right">
              <span v-if="r.size" class="rel-size">{{ fmtSize(r.size) }}</span>
              <span v-if="r.ageHours" class="rel-age">{{ fmtAge(r.ageHours) }}</span>
              <span v-if="r.protocol !== 'usenet'" :class="['rel-seeds', seedsClass(r.seeders)]">{{ r.seeders ?? 0 }} Seeds</span>
              <button :class="['btn-grab', { 'btn-grab-done': grabDoneId === r.guid }]"
                :disabled="grabbingId === r.guid" @click="grab(r)">
                <span v-if="grabDoneId === r.guid">✓</span>
                <span v-else-if="grabbingId === r.guid">…</span>
                <span v-else>↓ Laden</span>
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>

  </div>
</template>

<style scoped>
.indexer-view { padding: var(--space-6); min-height: 100%; display: flex; flex-direction: column; gap: var(--space-5); }

/* Header */
.page-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); }
.page-title  { font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); margin: 0; }
.page-sub    { font-size: var(--text-sm); color: var(--text-muted); margin: 4px 0 0; }
.header-actions { display: flex; gap: var(--space-2); }
.btn-sec { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; background: transparent; border: 1px solid var(--bg-border); color: var(--text-muted); border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: 600; cursor: pointer; transition: all .15s; }
.btn-sec:hover { border-color: var(--bg-border-hover); color: var(--text-secondary); }
.btn-prowlarr { display: inline-flex; align-items: center; padding: 6px 14px; background: rgba(230,96,0,.08); border: 1px solid rgba(230,96,0,.25); color: var(--prowlarr); border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: 600; text-decoration: none; transition: all .15s; }
.btn-prowlarr:hover { background: rgba(230,96,0,.15); }

/* Stats */
.stats-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--space-3); }
.stat-card { background: var(--bg-surface); border: 1px solid var(--bg-border); border-top: 2px solid var(--prowlarr); border-radius: var(--radius-lg); padding: var(--space-3) var(--space-4); }
.stat-lbl { font-size: 9px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .07em; margin-bottom: 3px; }
.stat-val { font-size: var(--text-xl); font-weight: 800; color: var(--text-primary); }
.stat-sub { font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px; }
.stat-bar-wrap { height: 3px; background: var(--bg-border); border-radius: 3px; margin-top: 5px; overflow: hidden; }
.stat-bar-fill { height: 100%; border-radius: 3px; transition: width .5s; }

/* Health */
.health-widget { background: var(--bg-surface); border: 1px solid var(--bg-border); border-radius: var(--radius-lg); padding: var(--space-4); }
.health-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3); }
.health-title  { font-size: var(--text-xs); font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .07em; }
.health-actions { display: flex; gap: var(--space-2); }
.btn-arr-test { padding: 4px 12px; border-radius: var(--radius-sm); font-size: 10px; font-weight: 700; cursor: pointer; transition: all .12s; }
.btn-arr-test.radarr { background: rgba(255,194,48,.08); border: 1px solid rgba(255,194,48,.25); color: var(--radarr); }
.btn-arr-test.sonarr { background: rgba(33,147,181,.08); border: 1px solid rgba(33,147,181,.25); color: var(--sonarr); }
.btn-arr-test:disabled { opacity: .5; cursor: not-allowed; }
.health-ok { display: flex; align-items: center; gap: 6px; font-size: var(--text-sm); color: var(--status-success); }
.health-issues { display: flex; flex-direction: column; gap: var(--space-2); }
.health-issue { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-3); background: var(--bg-elevated); border-radius: var(--radius-md); }
.health-issue.error { border: 1px solid rgba(248,113,113,.2); }
.health-issue.warning { border: 1px solid rgba(251,191,36,.2); }
.issue-app  { font-size: var(--text-xs); font-weight: 700; }
.issue-type { font-size: var(--text-xs); font-weight: 700; color: var(--status-warning); }
.health-issue.error .issue-type { color: var(--status-error); }
.issue-msg  { font-size: var(--text-sm); color: var(--text-muted); flex: 1; }

/* Search Box */
.search-box { background: var(--bg-surface); border: 1px solid rgba(230,96,0,.2); border-radius: var(--radius-lg); padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-3); }
.search-title { font-size: 10px; font-weight: 700; color: var(--prowlarr); text-transform: uppercase; letter-spacing: 1.2px; display: flex; align-items: center; gap: 6px; }
.search-main { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.search-input-wrap { position: relative; flex: 1; min-width: 260px; }
.search-ico { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
.search-inp { width: 100%; background: var(--bg-elevated); border: 1px solid var(--bg-border); color: var(--text-primary); padding: 9px 14px 9px 38px; border-radius: var(--radius-md); font-size: var(--text-sm); outline: none; transition: border-color .15s; }
.search-inp:focus { border-color: var(--prowlarr); }
.search-sel { background: var(--bg-elevated); border: 1px solid var(--bg-border); color: var(--text-muted); padding: 9px 12px; border-radius: var(--radius-md); font-size: var(--text-sm); outline: none; cursor: pointer; transition: border-color .15s; }
.search-sel:focus { border-color: var(--prowlarr); }
.btn-search { display: inline-flex; align-items: center; gap: 6px; padding: 9px 20px; background: var(--prowlarr); border: none; color: #fff; border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: 700; cursor: pointer; transition: opacity .15s; white-space: nowrap; }
.btn-search:hover:not(:disabled) { opacity: .88; }
.btn-search:disabled { opacity: .5; cursor: not-allowed; }

/* Filter Row */
.filter-row { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.filter-lbl { font-size: 9px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: .07em; white-space: nowrap; }
.filter-sep { width: 1px; height: 14px; background: var(--bg-border); }
.fchip { padding: 3px 10px; border-radius: 99px; font-size: var(--text-xs); font-weight: 600; background: transparent; border: 1px solid var(--bg-border); color: var(--text-muted); cursor: pointer; transition: all .12s; }
.fchip:hover { border-color: var(--bg-border-hover); color: var(--text-secondary); }
.fchip-all.active    { border-color: var(--prowlarr); color: var(--prowlarr); background: rgba(230,96,0,.08); }
.fchip-usenet.active { border-color: var(--sonarr); color: var(--sonarr); background: rgba(33,147,181,.08); }
.fchip-torrent.active { border-color: var(--status-success); color: var(--status-success); background: rgba(34,197,94,.08); }
.fchip-de.active     { border-color: var(--sabnzbd); color: var(--sabnzbd); background: rgba(255,202,40,.08); }
.sort-btn { padding: 3px 10px; border-radius: 99px; font-size: var(--text-xs); font-weight: 600; background: transparent; border: 1px solid var(--bg-border); color: var(--text-muted); cursor: pointer; transition: all .12s; }
.sort-btn:hover { color: var(--text-secondary); border-color: var(--bg-border-hover); }
.sort-btn.active { border-color: var(--prowlarr); color: var(--prowlarr); background: rgba(230,96,0,.08); }

/* Results */
.results-area { margin-top: var(--space-2); }
.results-meta { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3); }
.results-count { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); }
.results-time  { font-size: var(--text-xs); color: var(--text-muted); }

/* Release List */
.release-list { display: flex; flex-direction: column; gap: 3px; }
.rel-row { display: flex; align-items: flex-start; gap: var(--space-3); padding: 8px 12px; border-radius: var(--radius-md); background: var(--bg-elevated); border: 1px solid transparent; transition: border-color .1s; }
.rel-row:hover { border-color: var(--bg-border); }
.rel-main { flex: 1; min-width: 0; }
.rel-title { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); line-height: 1.4; word-break: break-all; margin-bottom: 4px; }
.rel-badges { display: flex; gap: 3px; flex-wrap: wrap; }
.rb { display: inline-flex; align-items: center; padding: 1px 6px; border-radius: var(--radius-sm); font-size: 9px; font-weight: 700; white-space: nowrap; }
.rb-usenet  { background: rgba(33,147,181,.08); color: var(--sonarr); border: 1px solid rgba(33,147,181,.2); }
.rb-torrent { background: rgba(34,197,94,.08); color: var(--status-success); border: 1px solid rgba(34,197,94,.2); }
.rb-tech    { background: var(--bg-surface); color: var(--text-tertiary); border: 1px solid var(--bg-border); }
.rb-cf      { background: rgba(155,0,69,.06); color: var(--accent); border: 1px solid rgba(155,0,69,.15); }
.rb-lang    { background: rgba(255,202,40,.06); color: #888; border: 1px solid var(--bg-border); }
.rb-score-pos { background: rgba(34,197,94,.1); color: var(--status-success); border: 1px solid rgba(34,197,94,.2); }
.rb-score-neg { background: rgba(248,113,113,.08); color: var(--status-error); border: 1px solid rgba(248,113,113,.15); }
.rb-indexer { background: var(--bg-surface); color: var(--text-muted); border: 1px solid var(--bg-border); }
.rel-right { display: flex; flex-direction: column; align-items: flex-end; gap: 3px; flex-shrink: 0; min-width: 90px; }
.rel-size  { font-size: var(--text-sm); color: var(--text-tertiary); }
.rel-age   { font-size: var(--text-xs); color: var(--text-muted); }
.rel-seeds { font-size: var(--text-sm); font-weight: 700; }
.seeds-hi   { color: var(--status-success); }
.seeds-mid  { color: var(--status-warning); }
.seeds-lo   { color: var(--status-error); }
.seeds-none { color: var(--text-muted); }
.btn-grab { display: inline-flex; align-items: center; justify-content: center; padding: 4px 11px; background: var(--prowlarr); border: none; color: #fff; border-radius: var(--radius-sm); font-size: 10px; font-weight: 700; cursor: pointer; transition: opacity .15s; white-space: nowrap; }
.btn-grab:hover:not(:disabled) { opacity: .85; }
.btn-grab:disabled { opacity: .5; cursor: not-allowed; }
.btn-grab-done { background: var(--status-success); color: #000; }
.load-more { text-align: center; margin-top: var(--space-3); }
.empty-results { color: var(--text-muted); text-align: center; padding: var(--space-6); font-size: var(--text-sm); }

/* Tabs */
.tabs-bar { display: flex; border-bottom: 1px solid var(--bg-border); }
.tab-btn { padding: var(--space-3) var(--space-5); font-size: var(--text-sm); color: var(--text-muted); border-bottom: 2px solid transparent; transition: color .15s, border-color .15s; margin-bottom: -1px; cursor: pointer; background: none; border-left: none; border-top: none; border-right: none; }
.tab-btn:hover { color: var(--text-secondary); }
.tab-btn.active { color: var(--text-primary); border-bottom-color: var(--prowlarr); }

/* Tab Content */
.tab-content { padding: var(--space-4) 0; }

/* Indexer Cards */
.group-header { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-3); margin-top: var(--space-2); }
.group-title  { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.4px; color: var(--prowlarr); white-space: nowrap; }
.group-line   { flex: 1; height: 1px; background: var(--bg-border); }
.group-count  { font-size: 10px; color: var(--text-muted); background: var(--bg-elevated); border: 1px solid var(--bg-border); padding: 1px 8px; border-radius: 10px; }
.indexer-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--space-3); margin-bottom: var(--space-4); }
.idx-card { background: var(--bg-surface); border: 1px solid var(--bg-border); border-radius: var(--radius-lg); padding: var(--space-4); transition: border-color .12s; }
.idx-card:hover { border-color: var(--bg-border-hover); }
.idx-card.disabled { opacity: .35; }
.idx-head { display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-3); }
.idx-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.dot-on  { background: var(--status-success); box-shadow: 0 0 5px rgba(34,197,94,.4); }
.dot-off { background: var(--text-muted); }
.idx-name { font-size: var(--text-sm); font-weight: 700; color: var(--text-secondary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ib { font-size: 9px; padding: 1px 5px; border-radius: var(--radius-sm); font-weight: 700; }
.ib-usenet  { background: rgba(33,147,181,.08); color: var(--sonarr); border: 1px solid rgba(33,147,181,.2); }
.ib-torrent { background: rgba(34,197,94,.08); color: var(--status-success); border: 1px solid rgba(34,197,94,.2); }
.ib-pub  { background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--bg-border); }
.ib-priv { background: rgba(155,0,69,.06); color: var(--accent); border: 1px solid rgba(155,0,69,.15); }
.ib-semi { background: rgba(255,202,40,.06); color: #888; border: 1px solid rgba(255,202,40,.15); }
.idx-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); margin-bottom: var(--space-3); }
.is { text-align: center; }
.is-val { font-size: var(--text-base); font-weight: 700; color: var(--text-secondary); }
.is-lbl { font-size: 8px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .5px; margin-top: 1px; font-weight: 700; }
.is-bar { height: 2px; background: var(--bg-border); border-radius: 2px; margin-top: 3px; overflow: hidden; }
.is-fill { height: 100%; background: var(--prowlarr); border-radius: 2px; transition: width .5s; }
.idx-health { display: flex; align-items: center; gap: var(--space-2); padding-top: var(--space-2); border-top: 1px solid var(--bg-elevated); }
.h-pct { font-size: 9px; font-weight: 700; white-space: nowrap; min-width: 30px; }
.h-bar { flex: 1; height: 3px; background: var(--bg-border); border-radius: 3px; overflow: hidden; }
.h-fill { height: 100%; border-radius: 3px; transition: width .5s; }
.h-lbl { font-size: 9px; color: var(--text-muted); white-space: nowrap; }

/* History Table */
.hist-table-wrap { overflow-x: auto; }
.hist-table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
.hist-table th { text-align: left; color: var(--text-muted); font-size: 9px; text-transform: uppercase; letter-spacing: .07em; padding: 6px 10px; border-bottom: 1px solid var(--bg-border); font-weight: 700; }
.hist-table td { padding: 7px 10px; border-bottom: 1px solid var(--bg-elevated); color: var(--text-tertiary); vertical-align: middle; }
.hist-table tbody tr:hover td { background: rgba(255,255,255,.015); }
.td-date { white-space: nowrap; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.td-title { max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-secondary); font-weight: 500; }
.td-num { font-variant-numeric: tabular-nums; }
.td-rg { color: var(--text-muted); font-style: italic; }

/* Loading / Empty */
.loading-msg { display: flex; align-items: center; gap: var(--space-2); color: var(--text-muted); font-size: var(--text-sm); padding: var(--space-8) 0; }
.empty-state { color: var(--text-muted); text-align: center; padding: var(--space-10); font-size: var(--text-sm); }

/* Toast */
.toast-wrap { position: fixed; bottom: 24px; right: 24px; z-index: 99999; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
.toast-item { padding: 10px 18px; border-radius: var(--radius-lg); font-size: var(--text-sm); font-weight: 600; box-shadow: 0 8px 32px rgba(0,0,0,.5); }
.tok  { background: rgba(34,197,94,.15); border: 1px solid rgba(34,197,94,.3); color: #22c55e; }
.terr { background: rgba(239,68,68,.15); border: 1px solid rgba(239,68,68,.3); color: #ef4444; }
.toast-enter-active, .toast-leave-active { transition: all .2s ease; }
.toast-enter-from   { opacity: 0; transform: translateY(8px); }
.toast-leave-to     { opacity: 0; transform: translateX(20px); }

@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin .8s linear infinite; }
</style>
