<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useQueueStore } from '../stores/queue.store.js';
import { useApi } from '../composables/useApi.js';
import ConfirmDialog from '../components/ui/ConfirmDialog.vue';
import type { ArrQueueItem } from '@nexarr/shared';

const queue  = useQueueStore();
const router = useRouter();
const { get, post, del } = useApi();

onMounted(() => { queue.subscribe(); loadHistory(); loadMissing(); });
onUnmounted(() => queue.unsubscribe());

// ── Tabs ───────────────────────────────────────────────────────────────────────
const activeTab = ref<'queue' | 'history' | 'missing'>('queue');

// ── Stats ──────────────────────────────────────────────────────────────────────
const radarrCount = computed(() => queue.arrItems.filter(i => i.app === 'radarr').length);
const sonarrCount = computed(() => queue.arrItems.filter(i => i.app === 'sonarr').length);
const lidarrCount = computed(() => queue.arrItems.filter(i => i.app === 'lidarr').length);
const sabJobCount = computed(() => queue.sabnzbd?.slots.length ?? 0);

const speedLabel = computed(() => {
  const s = queue.sabnzbd?.speedMbs ?? 0;
  if (s === 0) return '0 KB/s';
  if (s < 1)   return `${(s * 1024).toFixed(0)} KB/s`;
  return `${s.toFixed(1)} MB/s`;
});

const downloadPercent = computed(() => {
  const q = queue.sabnzbd;
  if (!q || q.mbTotal === 0) return 0;
  return Math.round(((q.mbTotal - q.mbLeft) / q.mbTotal) * 100);
});

// ── History ────────────────────────────────────────────────────────────────────
interface HistEntry { id: number; app: 'radarr'|'sonarr'|'lidarr'; title: string; eventType: string; date: string; quality?: string; size?: number; indexer?: string; downloadClient?: string; releaseGroup?: string; sourceTitle?: string; }
const historyItems   = ref<HistEntry[]>([]);
const historyLoading = ref(false);
const historyPage    = ref(0);
const HIST_PAGE      = 15;

async function loadHistory() {
  historyLoading.value = true;
  try {
    const [rr, sr, lr] = await Promise.allSettled([
      get<any>('/api/radarr/history?pageSize=100'),
      get<any>('/api/sonarr/history?pageSize=100'),
      get<any>('/api/lidarr/history?pageSize=50'),
    ]);
    const entries: HistEntry[] = [];
    if (rr.status === 'fulfilled') {
      for (const r of (rr.value?.records ?? [])) entries.push({ id: r.id, app: 'radarr', title: r.movie?.title ?? r.sourceTitle ?? '–', eventType: r.eventType ?? 'grabbed', date: r.date, quality: r.quality?.quality?.name, size: r.size, indexer: r.data?.indexer, downloadClient: r.data?.downloadClient, releaseGroup: r.data?.releaseGroup, sourceTitle: r.sourceTitle });
    }
    if (sr.status === 'fulfilled') {
      for (const r of (sr.value?.records ?? [])) {
        const ep = r.episode;
        const epLabel = ep ? ` S${String(ep.seasonNumber).padStart(2,'0')}E${String(ep.episodeNumber).padStart(2,'0')}` : '';
        entries.push({ id: r.id, app: 'sonarr', title: (r.series?.title ?? r.sourceTitle ?? '–') + epLabel, eventType: r.eventType ?? 'grabbed', date: r.date, quality: r.quality?.quality?.name, size: r.size, indexer: r.data?.indexer, downloadClient: r.data?.downloadClient, releaseGroup: r.data?.releaseGroup, sourceTitle: r.sourceTitle });
      }
    }
    if (lr.status === 'fulfilled') {
      for (const r of (lr.value?.records ?? [])) entries.push({ id: r.id, app: 'lidarr', title: r.artist?.artistName ?? r.sourceTitle ?? '–', eventType: r.eventType ?? 'grabbed', date: r.date, quality: r.quality?.quality?.name, size: r.size, indexer: r.data?.indexer, downloadClient: r.data?.downloadClient, releaseGroup: r.data?.releaseGroup, sourceTitle: r.sourceTitle });
    }
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    historyItems.value = entries;
  } finally { historyLoading.value = false; }
}

const historyPaged  = computed(() => historyItems.value.slice(0, (historyPage.value + 1) * HIST_PAGE));
const hasMoreHist   = computed(() => historyItems.value.length > (historyPage.value + 1) * HIST_PAGE);

// ── Missing ────────────────────────────────────────────────────────────────────
interface MissingItem { id: number; app: 'radarr'|'sonarr'|'lidarr'; title: string; subtitle?: string; posterUrl?: string; searching?: boolean; searchOk?: boolean; }
const missingMovies   = ref<MissingItem[]>([]);
const missingEpisodes = ref<MissingItem[]>([]);
const missingAlbums   = ref<MissingItem[]>([]);
const missingLoading  = ref(false);

async function loadMissing() {
  missingLoading.value = true;
  try {
    const [mr, sr, lr] = await Promise.allSettled([
      get<any>('/api/radarr/missing?pageSize=50'),
      get<any>('/api/sonarr/missing?pageSize=50'),
      get<any>('/api/lidarr/missing?pageSize=50'),
    ]);
    if (mr.status === 'fulfilled') missingMovies.value = (mr.value?.records ?? []).map((r: any) => ({ id: r.id, app: 'radarr', title: r.title ?? '–', posterUrl: r.images?.find((i: any) => i.coverType === 'poster')?.remoteUrl }));
    if (sr.status === 'fulfilled') missingEpisodes.value = (sr.value?.records ?? []).map((r: any) => ({ id: r.id, app: 'sonarr', title: r.series?.title ?? '–', subtitle: `S${String(r.seasonNumber).padStart(2,'0')}E${String(r.episodeNumber).padStart(2,'0')} · ${r.title ?? ''}`, posterUrl: r.series?.images?.find((i: any) => i.coverType === 'poster')?.remoteUrl }));
    if (lr.status === 'fulfilled') missingAlbums.value = (lr.value?.records ?? []).map((r: any) => ({ id: r.id, app: 'lidarr', title: r.artist?.artistName ?? '–', subtitle: r.title, posterUrl: r.images?.find((i: any) => i.coverType === 'cover')?.remoteUrl ?? r.artist?.images?.find((i: any) => i.coverType === 'poster')?.remoteUrl }));
  } finally { missingLoading.value = false; }
}

async function searchMissing(item: MissingItem) {
  item.searching = true;
  try {
    if (item.app === 'radarr')       await post('/api/radarr/command', { name: 'MoviesSearch', movieIds: [item.id] });
    else if (item.app === 'sonarr')  await post('/api/sonarr/command', { name: 'EpisodeSearch', episodeIds: [item.id] });
    else                              await post('/api/lidarr/command', { name: 'AlbumSearch', albumIds: [item.id] });
    item.searchOk = true;
    setTimeout(() => { item.searchOk = false; }, 3000);
  } catch { /* */ } finally { item.searching = false; }
}

const missingTotal = computed(() => missingMovies.value.length + missingEpisodes.value.length + missingAlbums.value.length);

// ── Delete Confirm ─────────────────────────────────────────────────────────────
const showDeleteConfirm = ref(false);
const deletePendingId   = ref<string | null>(null);
const deletePendingType = ref<'sab' | 'arr'>('sab');
const deletePendingName = ref('');

function confirmDeleteSab(nzoId: string, name: string) { deletePendingId.value = nzoId; deletePendingType.value = 'sab'; deletePendingName.value = name; showDeleteConfirm.value = true; }
function confirmDeleteArr(item: ArrQueueItem) { deletePendingId.value = String(item.id); deletePendingType.value = 'arr'; deletePendingName.value = item.title; showDeleteConfirm.value = true; }
async function executeDelete() { if (!deletePendingId.value) return; if (deletePendingType.value === 'sab') await del(`/api/sabnzbd/queue/${deletePendingId.value}`); }

// ── Per-Item SABnzbd ───────────────────────────────────────────────────────────
const itemPending = ref<Record<string, boolean>>({});
async function pauseItem(nzoId: string)  { itemPending.value[nzoId] = true; try { await post(`/api/sabnzbd/queue/${nzoId}/pause`); }  finally { delete itemPending.value[nzoId]; } }
async function resumeItem(nzoId: string) { itemPending.value[nzoId] = true; try { await post(`/api/sabnzbd/queue/${nzoId}/resume`); } finally { delete itemPending.value[nzoId]; } }

const globalToggling = ref(false);
async function toggleGlobalPause() { if (globalToggling.value) return; globalToggling.value = true; try { await post(`/api/sabnzbd/${queue.sabnzbd?.paused ? 'resume' : 'pause'}`); } finally { globalToggling.value = false; } }

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtMb(mb: number) { return mb >= 1024 ? `${(mb/1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`; }
function fmtBytes(b?: number) { if (!b) return ''; const g = b/1024/1024/1024; return g >= 1 ? `${g.toFixed(1)} GB` : `${(b/1024/1024).toFixed(0)} MB`; }
function fmtDate(iso?: string) { if (!iso) return ''; return new Date(iso).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' }); }
function stLabel(s: string) { return ({downloading:'Lädt',queued:'Warte',paused:'Pause',completed:'Fertig',failed:'Fehler',warning:'Warnung'} as any)[s.toLowerCase()] ?? s; }
function stClass(s: string) { const t=s.toLowerCase(); return t==='downloading'?'st-active':t==='completed'?'st-done':t==='failed'?'st-err':t==='paused'?'st-pause':'st-idle'; }
function appColor(app: string) { return app==='radarr'?'var(--radarr)':app==='sonarr'?'var(--sonarr)':app==='lidarr'?'var(--lidarr)':'var(--text-muted)'; }
function appLabel(app: string) { return app==='radarr'?'Film':app==='sonarr'?'Serie':app==='lidarr'?'Musik':app; }
function evBadge(et: string) {
  const t = (et ?? '').toLowerCase();
  if (t.includes('grab'))   return { label: 'Grab',    cls: 'ev-grab' };
  if (t.includes('import') || t.includes('download')) return { label: 'Import', cls: 'ev-import' };
  if (t.includes('fail') || t.includes('error'))      return { label: 'Fehler', cls: 'ev-err' };
  if (t.includes('delet'))  return { label: 'Gelöscht', cls: 'ev-del' };
  return { label: et, cls: 'ev-idle' };
}
</script>

<template>
  <div class="dv page-context" style="--context-color: var(--sabnzbd)">

    <!-- Header -->
    <div class="dv-header">
      <h1 class="dv-title">
        <span class="title-bar" />
        Downloads
        <span v-if="queue.totalCount > 0" class="title-count">{{ queue.totalCount }}</span>
        <span class="live-dot" :class="queue.isConnected ? 'live' : 'offline'" />
        <span class="live-lbl">{{ queue.isConnected ? 'Live' : 'Verbinde…' }}</span>
      </h1>
    </div>

    <!-- Stats Bar -->
    <div class="stats-bar">
      <div class="sc" style="--c: var(--radarr)" @click="activeTab='queue'">
        <span class="sc-n">{{ radarrCount }}</span>
        <span class="sc-l">Filme</span>
      </div>
      <div class="sc" style="--c: var(--sonarr)" @click="activeTab='queue'">
        <span class="sc-n">{{ sonarrCount }}</span>
        <span class="sc-l">Episoden</span>
      </div>
      <div class="sc" style="--c: var(--lidarr)" @click="activeTab='queue'">
        <span class="sc-n">{{ lidarrCount }}</span>
        <span class="sc-l">Alben</span>
      </div>
      <div class="sc" style="--c: var(--sabnzbd)" @click="activeTab='queue'">
        <span class="sc-n">{{ sabJobCount }}</span>
        <span class="sc-l">SABnzbd · {{ speedLabel }}</span>
      </div>
    </div>

    <!-- Tab Bar -->
    <div class="tab-bar">
      <button :class="['tab-btn', {active: activeTab==='queue'}]" @click="activeTab='queue'">
        Queue <span v-if="queue.totalCount>0" class="tab-badge">{{ queue.totalCount }}</span>
      </button>
      <button :class="['tab-btn', {active: activeTab==='history'}]" @click="activeTab='history'">
        History <span v-if="historyItems.length>0" class="tab-badge">{{ historyItems.length }}</span>
      </button>
      <button :class="['tab-btn', {active: activeTab==='missing'}]" @click="activeTab='missing'">
        Fehlend <span v-if="missingTotal>0" class="tab-badge tab-badge-warn">{{ missingTotal }}</span>
      </button>
    </div>

    <!-- ── Tab: Queue ── -->
    <div v-if="activeTab==='queue'" class="tab-content">

      <!-- SABnzbd -->
      <section v-if="queue.sabnzbd" class="panel">
        <div class="panel-head">
          <span class="app-pill" style="background:rgba(245,197,24,.12);border-color:rgba(245,197,24,.3);color:var(--sabnzbd)">SABnzbd</span>
          <span class="sab-speed">{{ speedLabel }}</span>
          <span v-if="queue.sabnzbd.paused" class="paused-pill">⏸ Pausiert</span>
          <button class="ctrl-btn" :disabled="globalToggling" @click="toggleGlobalPause" style="margin-left:auto">
            <svg v-if="queue.sabnzbd.paused" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            {{ queue.sabnzbd.paused ? 'Fortsetzen' : 'Pausieren' }}
          </button>
        </div>
        <div v-if="queue.sabnzbd.mbTotal > 0" class="global-prog">
          <div class="prog-wrap"><div class="prog-bar" style="background:var(--sabnzbd)" :style="{width:downloadPercent+'%'}"/></div>
          <span class="prog-meta">{{ fmtMb(queue.sabnzbd.mbTotal - queue.sabnzbd.mbLeft) }} / {{ fmtMb(queue.sabnzbd.mbTotal) }}</span>
          <span class="prog-pct">{{ downloadPercent }}%</span>
        </div>
        <div v-if="queue.sabnzbd.slots.length" class="q-list">
          <div v-for="s in queue.sabnzbd.slots" :key="s.nzo_id" class="q-item">
            <div class="q-main">
              <div class="q-top">
                <p class="q-title">{{ s.filename }}</p>
                <span :class="['st-badge', stClass(s.status)]">{{ stLabel(s.status) }}</span>
              </div>
              <div class="prog-wrap"><div class="prog-bar" style="background:var(--sabnzbd)" :style="{width:s.percentage.toFixed(0)+'%'}"/></div>
              <div class="q-meta">
                <span class="meta-chip">{{ s.cat }}</span>
                <span>{{ fmtMb(s.mbLeft) }} übrig</span>
                <span v-if="s.timeleft">ETA {{ s.timeleft }}</span>
                <span style="margin-left:auto">{{ s.percentage.toFixed(0) }}%</span>
              </div>
            </div>
            <div class="q-acts">
              <button v-if="s.status.toLowerCase()==='paused'" class="ia-btn ia-resume" :disabled="!!itemPending[s.nzo_id]" @click="resumeItem(s.nzo_id)">
                <svg v-if="itemPending[s.nzo_id]" class="spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </button>
              <button v-else-if="s.status.toLowerCase()==='downloading'" class="ia-btn ia-pause" :disabled="!!itemPending[s.nzo_id]" @click="pauseItem(s.nzo_id)">
                <svg v-if="itemPending[s.nzo_id]" class="spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              </button>
              <button class="ia-btn ia-del" @click="confirmDeleteSab(s.nzo_id, s.filename)">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
              </button>
            </div>
          </div>
        </div>
        <div v-else class="q-empty">Keine aktiven Downloads in SABnzbd</div>
      </section>

      <!-- Arr Queues -->
      <section v-if="queue.arrItems.length > 0" class="panel">
        <div class="panel-head" style="border-bottom:1px solid var(--bg-border)">
          <span class="section-lbl">Arr-Warteschlangen</span>
          <span class="section-count">{{ queue.arrItems.length }}</span>
        </div>
        <div class="q-list">
          <div v-for="item in queue.arrItems" :key="`${item.app}-${item.id}`" class="q-item arr-item" :style="{'--ic': appColor(item.app)}">
            <div class="arr-accent"/>
            <div class="q-main">
              <div class="q-top">
                <span class="arr-pill">{{ appLabel(item.app) }}</span>
                <p class="q-title">{{ item.title }}</p>
                <span :class="['st-badge', stClass(item.status)]">{{ stLabel(item.status) }}</span>
              </div>
              <div class="prog-wrap"><div class="prog-bar" :style="{width:item.progress+'%',background:'var(--ic)'}"/></div>
              <div class="q-meta">
                <span class="meta-chip">{{ item.protocol }}</span>
                <span v-if="item.indexer">{{ item.indexer }}</span>
                <span>{{ fmtMb((item.sizeleft ?? 0) / 1_000_000) }} übrig</span>
                <span v-if="item.timeleft">ETA {{ item.timeleft }}</span>
                <span style="margin-left:auto">{{ item.progress }}%</span>
              </div>
              <div v-if="item.errorMessage" class="item-err">{{ item.errorMessage }}</div>
            </div>
            <div class="q-acts">
              <button class="ia-btn ia-del" @click="confirmDeleteArr(item)">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
              </button>
            </div>
          </div>
        </div>
      </section>

      <div v-if="!queue.sabnzbd && queue.arrItems.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <p class="empty-title">Keine aktiven Downloads</p>
        <p class="empty-sub">{{ queue.isConnected ? 'Alles ruhig.' : 'Verbinde mit dem Server…' }}</p>
      </div>
      <div v-if="queue.lastError" class="err-banner">{{ queue.lastError }}</div>
    </div>

    <!-- ── Tab: History ── -->
    <div v-if="activeTab==='history'" class="tab-content">
      <div v-if="historyLoading" class="loading-row">
        <div v-for="i in 5" :key="i" class="skeleton" style="height:48px;border-radius:8px"/>
      </div>
      <div v-else-if="!historyItems.length" class="empty-state">
        <p class="empty-title">Keine History vorhanden</p>
      </div>
      <div v-else class="panel">
        <div class="hist-list">
          <div v-for="h in historyPaged" :key="`${h.app}-${h.id}`" class="hist-row" :style="{'--ic': appColor(h.app)}">
            <div class="hist-left">
              <span :class="['ev-badge', evBadge(h.eventType).cls]">{{ evBadge(h.eventType).label }}</span>
              <span class="arr-pill" :style="{background:`color-mix(in srgb, var(--ic) 12%, transparent)`,color:'var(--ic)',borderColor:`color-mix(in srgb, var(--ic) 30%, transparent)`}">{{ appLabel(h.app) }}</span>
            </div>
            <div class="hist-main">
              <p class="hist-title">{{ h.title }}</p>
              <p v-if="h.sourceTitle" class="hist-nzb">{{ h.sourceTitle }}</p>
              <div class="hist-meta">
                <span v-if="h.quality" class="meta-chip">{{ h.quality }}</span>
                <span v-if="h.releaseGroup" class="meta-chip">{{ h.releaseGroup }}</span>
                <span v-if="h.size" class="meta-chip">{{ fmtBytes(h.size) }}</span>
                <span v-if="h.downloadClient" class="meta-chip">{{ h.downloadClient }}</span>
              </div>
            </div>
            <span class="hist-date">{{ fmtDate(h.date) }}</span>
          </div>
        </div>
        <div v-if="hasMoreHist" class="load-more">
          <button class="ctrl-btn" @click="historyPage++">Weitere laden</button>
        </div>
      </div>
    </div>

    <!-- ── Tab: Fehlend ── -->
    <div v-if="activeTab==='missing'" class="tab-content">
      <div v-if="missingLoading" class="loading-row">
        <div v-for="i in 6" :key="i" class="skeleton" style="height:80px;border-radius:8px"/>
      </div>
      <template v-else>

        <!-- Filme -->
        <div v-if="missingMovies.length" class="miss-section">
          <div class="miss-head" style="--c: var(--radarr)">
            <span class="miss-head-label">Filme</span>
            <span class="miss-head-count">{{ missingMovies.length }}</span>
          </div>
          <div class="miss-grid">
            <div v-for="m in missingMovies" :key="m.id" class="miss-card" @click="router.push(`/movies/${m.id}`)">
              <div class="miss-poster">
                <img v-if="m.posterUrl" :src="m.posterUrl" :alt="m.title" loading="lazy"/>
                <div v-else class="miss-ph">🎬</div>
              </div>
              <div class="miss-info">
                <p class="miss-title">{{ m.title }}</p>
                <p v-if="m.subtitle" class="miss-sub">{{ m.subtitle }}</p>
              </div>
              <button class="miss-search-btn" :class="{'btn-ok': m.searchOk}" :disabled="m.searching" @click.stop="searchMissing(m)">
                <svg v-if="m.searching" class="spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                {{ m.searchOk ? '✓' : '' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Episoden -->
        <div v-if="missingEpisodes.length" class="miss-section">
          <div class="miss-head" style="--c: var(--sonarr)">
            <span class="miss-head-label">Episoden</span>
            <span class="miss-head-count">{{ missingEpisodes.length }}</span>
          </div>
          <div class="miss-grid">
            <div v-for="m in missingEpisodes" :key="m.id" class="miss-card">
              <div class="miss-poster">
                <img v-if="m.posterUrl" :src="m.posterUrl" :alt="m.title" loading="lazy"/>
                <div v-else class="miss-ph">📺</div>
              </div>
              <div class="miss-info">
                <p class="miss-title">{{ m.title }}</p>
                <p v-if="m.subtitle" class="miss-sub">{{ m.subtitle }}</p>
              </div>
              <button class="miss-search-btn" :class="{'btn-ok': m.searchOk}" :disabled="m.searching" @click.stop="searchMissing(m)">
                <svg v-if="m.searching" class="spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                {{ m.searchOk ? '✓' : '' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Alben -->
        <div v-if="missingAlbums.length" class="miss-section">
          <div class="miss-head" style="--c: var(--lidarr)">
            <span class="miss-head-label">Alben</span>
            <span class="miss-head-count">{{ missingAlbums.length }}</span>
          </div>
          <div class="miss-grid">
            <div v-for="m in missingAlbums" :key="m.id" class="miss-card">
              <div class="miss-poster">
                <img v-if="m.posterUrl" :src="m.posterUrl" :alt="m.title" loading="lazy"/>
                <div v-else class="miss-ph">🎵</div>
              </div>
              <div class="miss-info">
                <p class="miss-title">{{ m.title }}</p>
                <p v-if="m.subtitle" class="miss-sub">{{ m.subtitle }}</p>
              </div>
              <button class="miss-search-btn" :class="{'btn-ok': m.searchOk}" :disabled="m.searching" @click.stop="searchMissing(m)">
                <svg v-if="m.searching" class="spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                {{ m.searchOk ? '✓' : '' }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="!missingTotal" class="empty-state">
          <div class="empty-icon">✅</div>
          <p class="empty-title">Nichts fehlend</p>
          <p class="empty-sub">Alle überwachten Inhalte sind vorhanden.</p>
        </div>
      </template>
    </div>

    <ConfirmDialog v-model="showDeleteConfirm" title="Download entfernen?" :message="`'${deletePendingName}' aus der Warteschlange entfernen?`" confirm-label="Entfernen" @confirm="executeDelete"/>
  </div>
</template>

<style scoped>
.dv { min-height:100%; display:flex; flex-direction:column; }
.dv-header { padding: var(--space-5) var(--space-6) var(--space-4); }
.dv-title { display:flex; align-items:center; gap:var(--space-3); font-size:var(--text-xl); font-weight:700; color:var(--text-primary); margin:0; }
.title-bar { display:inline-block; width:3px; height:1.2em; background:var(--context-color); border-radius:2px; flex-shrink:0; }
.title-count { font-size:var(--text-base); font-weight:400; color:var(--text-muted); }
.live-dot { display:inline-block; width:7px; height:7px; border-radius:50%; margin-left:var(--space-1); flex-shrink:0; }
.live-dot.live { background:var(--status-success); box-shadow:0 0 4px var(--status-success); }
.live-dot.offline { background:var(--text-muted); }
.live-lbl { font-size:var(--text-xs); color:var(--text-muted); }

/* Stats Bar */
.stats-bar { display:flex; border-bottom:1px solid var(--bg-border); background:var(--bg-surface); }
.sc { flex:1; display:flex; flex-direction:column; gap:2px; padding:var(--space-3) var(--space-5); border-left:3px solid var(--c); cursor:pointer; transition:background .15s; }
.sc:hover { background:var(--bg-elevated); }
.sc:first-child { border-left:none; }
.sc-n { font-size:var(--text-xl); font-weight:700; color:var(--text-primary); font-variant-numeric:tabular-nums; line-height:1; }
.sc-l { font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.06em; }

/* Tabs */
.tab-bar { display:flex; border-bottom:1px solid var(--bg-border); background:var(--bg-surface); padding:0 var(--space-6); }
.tab-btn { display:flex; align-items:center; gap:var(--space-2); padding:var(--space-3) var(--space-4); font-size:var(--text-sm); color:var(--text-muted); border-bottom:2px solid transparent; cursor:pointer; transition:color .15s,border-color .15s; margin-bottom:-1px; }
.tab-btn:hover { color:var(--text-secondary); }
.tab-btn.active { color:var(--text-primary); border-bottom-color:var(--sabnzbd); }
.tab-badge { font-size:10px; font-weight:700; padding:1px 5px; border-radius:99px; background:var(--bg-elevated); color:var(--text-muted); border:1px solid var(--bg-border); }
.tab-badge-warn { background:rgba(239,68,68,.12); color:#ef4444; border-color:rgba(239,68,68,.25); }
.tab-content { flex:1; padding:var(--space-5) var(--space-6); display:flex; flex-direction:column; gap:var(--space-4); }

/* Panel */
.panel { background:var(--bg-surface); border:1px solid var(--bg-border); border-radius:var(--radius-lg); overflow:hidden; }
.panel-head { display:flex; align-items:center; gap:var(--space-3); padding:var(--space-3) var(--space-5); flex-wrap:wrap; }
.app-pill { font-size:var(--text-xs); font-weight:600; padding:2px 8px; border-radius:99px; border:1px solid; letter-spacing:.04em; }
.sab-speed { font-size:var(--text-sm); color:var(--text-secondary); font-weight:600; font-variant-numeric:tabular-nums; }
.paused-pill { font-size:var(--text-xs); color:var(--sabnzbd); background:rgba(245,197,24,.1); border:1px solid rgba(245,197,24,.25); border-radius:99px; padding:2px 8px; }
.section-lbl { font-size:var(--text-xs); font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.06em; }
.section-count { font-size:var(--text-xs); color:var(--text-muted); margin-left:auto; }
.ctrl-btn { display:inline-flex; align-items:center; gap:5px; padding:5px 12px; border-radius:var(--radius-md); font-size:var(--text-sm); background:var(--bg-elevated); border:1px solid var(--bg-border); color:var(--text-secondary); cursor:pointer; transition:all .15s; }
.ctrl-btn:hover:not(:disabled) { background:var(--bg-overlay); color:var(--text-primary); }
.ctrl-btn:disabled { opacity:.5; cursor:not-allowed; }
.global-prog { display:flex; align-items:center; gap:var(--space-3); padding:0 var(--space-5) var(--space-3); }
.prog-wrap { flex:1; height:4px; background:var(--bg-elevated); border-radius:99px; overflow:hidden; }
.prog-bar { height:100%; border-radius:99px; transition:width .5s ease; }
.prog-meta { font-size:var(--text-xs); color:var(--text-muted); white-space:nowrap; font-variant-numeric:tabular-nums; }
.prog-pct { font-size:var(--text-xs); color:var(--text-secondary); font-weight:600; min-width:32px; text-align:right; font-variant-numeric:tabular-nums; }

/* Queue */
.q-list { display:flex; flex-direction:column; }
.q-item { display:flex; align-items:flex-start; gap:var(--space-3); padding:var(--space-4) var(--space-5); border-bottom:1px solid rgba(255,255,255,.03); transition:background .12s; }
.q-item:last-child { border-bottom:none; }
.q-item:hover { background:var(--bg-elevated); }
.q-item:hover .q-acts { opacity:1; }
.arr-item { padding-left:var(--space-4); }
.arr-accent { width:3px; align-self:stretch; border-radius:2px; background:var(--ic,var(--text-muted)); flex-shrink:0; }
.arr-pill { font-size:var(--text-xs); font-weight:600; padding:1px 6px; border-radius:4px; border:1px solid; background:color-mix(in srgb,var(--ic) 12%,transparent); color:var(--ic); border-color:color-mix(in srgb,var(--ic) 25%,transparent); white-space:nowrap; flex-shrink:0; }
.q-main { flex:1; display:flex; flex-direction:column; gap:var(--space-2); min-width:0; }
.q-top { display:flex; align-items:center; gap:var(--space-2); flex-wrap:wrap; }
.q-title { font-size:var(--text-sm); color:var(--text-secondary); font-weight:500; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin:0; }
.q-meta { display:flex; align-items:center; gap:var(--space-3); flex-wrap:wrap; font-size:var(--text-xs); color:var(--text-muted); }
.meta-chip { text-transform:uppercase; letter-spacing:.05em; font-weight:500; }
.item-err { font-size:var(--text-xs); color:var(--status-error); background:rgba(248,113,113,.08); border-radius:var(--radius-sm); padding:3px 8px; }
.q-acts { display:flex; align-items:center; gap:4px; flex-shrink:0; opacity:0; transition:opacity .15s; align-self:center; }
.ia-btn { display:flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:var(--radius-sm); border:1px solid var(--bg-border); background:var(--bg-elevated); color:var(--text-muted); cursor:pointer; transition:all .12s; }
.ia-btn:hover:not(:disabled) { color:var(--text-secondary); border-color:rgba(255,255,255,.2); }
.ia-btn:disabled { opacity:.5; cursor:not-allowed; }
.ia-pause:hover { color:var(--sabnzbd)!important; border-color:rgba(245,197,24,.35)!important; }
.ia-resume:hover { color:#22c55e!important; border-color:rgba(34,197,94,.35)!important; }
.ia-del:hover { color:#ef4444!important; border-color:rgba(239,68,68,.35)!important; }
.q-empty { padding:var(--space-6); text-align:center; color:var(--text-muted); font-size:var(--text-sm); }

/* Status Badges */
.st-badge { font-size:var(--text-xs); padding:1px 6px; border-radius:4px; font-weight:500; white-space:nowrap; flex-shrink:0; }
.st-active { background:rgba(34,197,94,.12); color:#22c55e; border:1px solid rgba(34,197,94,.2); }
.st-done   { background:rgba(99,102,241,.12); color:#818cf8; border:1px solid rgba(99,102,241,.2); }
.st-err    { background:rgba(248,113,113,.12); color:#ef4444; border:1px solid rgba(248,113,113,.2); }
.st-pause  { background:rgba(245,197,24,.08); color:#a16207; border:1px solid rgba(245,197,24,.15); }
.st-idle   { background:var(--bg-elevated); color:var(--text-muted); border:1px solid var(--bg-border); }

/* History */
.hist-list { display:flex; flex-direction:column; }
.hist-row { display:flex; align-items:flex-start; gap:var(--space-3); padding:var(--space-3) var(--space-5); border-bottom:1px solid rgba(255,255,255,.03); transition:background .12s; }
.hist-row:last-child { border-bottom:none; }
.hist-row:hover { background:var(--bg-elevated); }
.hist-left { display:flex; flex-direction:column; gap:4px; flex-shrink:0; width:80px; }
.ev-badge { font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; text-align:center; white-space:nowrap; }
.ev-grab   { background:rgba(53,197,244,.12); color:var(--sonarr); border:1px solid rgba(53,197,244,.25); }
.ev-import { background:rgba(34,197,94,.12); color:#22c55e; border:1px solid rgba(34,197,94,.25); }
.ev-err    { background:rgba(239,68,68,.12); color:#ef4444; border:1px solid rgba(239,68,68,.25); }
.ev-del    { background:rgba(245,197,24,.12); color:var(--sabnzbd); border:1px solid rgba(245,197,24,.25); }
.ev-idle   { background:var(--bg-elevated); color:var(--text-muted); border:1px solid var(--bg-border); }
.hist-main { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
.hist-title { font-size:var(--text-sm); color:var(--text-secondary); font-weight:500; margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.hist-nzb { font-size:10px; color:var(--text-muted); font-family:monospace; margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.hist-meta { display:flex; gap:4px; flex-wrap:wrap; }
.hist-meta .meta-chip { font-size:10px; padding:1px 5px; background:var(--bg-elevated); border:1px solid var(--bg-border); border-radius:3px; color:var(--text-muted); text-transform:none; letter-spacing:0; font-weight:400; }
.hist-date { font-size:10px; color:var(--text-muted); white-space:nowrap; flex-shrink:0; margin-top:2px; }
.load-more { padding:var(--space-4); text-align:center; border-top:1px solid var(--bg-border); }

/* Missing */
.miss-section { display:flex; flex-direction:column; gap:var(--space-3); }
.miss-head { display:flex; align-items:center; gap:var(--space-3); padding:var(--space-2) 0; border-left:3px solid var(--c); padding-left:var(--space-3); }
.miss-head-label { font-size:var(--text-sm); font-weight:600; color:var(--text-secondary); }
.miss-head-count { font-size:var(--text-xs); color:var(--text-muted); background:var(--bg-elevated); padding:1px 6px; border-radius:99px; border:1px solid var(--bg-border); }
.miss-grid { display:flex; flex-direction:column; gap:2px; }
.miss-card { display:flex; align-items:center; gap:var(--space-3); padding:var(--space-2) var(--space-3); background:var(--bg-surface); border:1px solid var(--bg-border); border-radius:var(--radius-md); cursor:pointer; transition:background .12s; }
.miss-card:hover { background:var(--bg-elevated); }
.miss-poster { width:36px; height:54px; border-radius:4px; overflow:hidden; background:var(--bg-elevated); flex-shrink:0; border:1px solid var(--bg-border); }
.miss-poster img { width:100%; height:100%; object-fit:cover; }
.miss-ph { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:18px; }
.miss-info { flex:1; min-width:0; }
.miss-title { font-size:var(--text-sm); font-weight:500; color:var(--text-secondary); margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.miss-sub { font-size:11px; color:var(--text-muted); margin:2px 0 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.miss-search-btn { display:flex; align-items:center; justify-content:center; gap:4px; width:30px; height:30px; border-radius:var(--radius-sm); background:var(--bg-elevated); border:1px solid var(--bg-border); color:var(--text-muted); cursor:pointer; flex-shrink:0; transition:all .12s; }
.miss-search-btn:hover:not(:disabled) { color:var(--text-primary); border-color:rgba(255,255,255,.2); }
.miss-search-btn:disabled { opacity:.5; cursor:not-allowed; }
.miss-search-btn.btn-ok { color:#22c55e; border-color:rgba(34,197,94,.35); background:rgba(34,197,94,.1); }

/* Misc */
.loading-row { display:flex; flex-direction:column; gap:var(--space-2); }
.empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:var(--space-12) var(--space-4); gap:var(--space-3); text-align:center; flex:1; }
.empty-icon { font-size:48px; }
.empty-title { font-size:var(--text-lg); color:var(--text-secondary); font-weight:600; margin:0; }
.empty-sub { color:var(--text-muted); font-size:var(--text-sm); margin:0; }
.err-banner { padding:var(--space-4); background:rgba(248,113,113,.1); border:1px solid rgba(248,113,113,.3); border-radius:var(--radius-md); color:var(--status-error); font-size:var(--text-sm); }
@keyframes spin { to { transform:rotate(360deg); } }
.spin { animation:spin .8s linear infinite; }
</style>
