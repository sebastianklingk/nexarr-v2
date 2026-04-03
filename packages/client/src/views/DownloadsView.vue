<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useQueueStore } from '../stores/queue.store.js';
import { useMoviesStore } from '../stores/movies.store.js';
import { useSeriesStore } from '../stores/series.store.js';
import { useApi } from '../composables/useApi.js';
import ConfirmDialog from '../components/ui/ConfirmDialog.vue';
import type { ArrQueueItem, NormalizedSlot, DownloaderType } from '@nexarr/shared';
import { posterUrl as getPosterUrl, tmdbImageUrl } from '../utils/images.js';

const queue       = useQueueStore();
const moviesStore = useMoviesStore();
const seriesStore = useSeriesStore();
const router      = useRouter();
const { get, post, del } = useApi();

onMounted(async () => {
  queue.subscribe();
  if (!moviesStore.movies.length) moviesStore.fetchMovies?.().catch(() => {});
  if (!seriesStore.series.length) seriesStore.fetchSeries?.().catch(() => {});
  await Promise.all([loadHistory(), loadMissing()]);
});
onUnmounted(() => queue.unsubscribe());

// ── Tabs ───────────────────────────────────────────────────────────────────────
const activeTab = ref<'queue' | 'history' | 'missing'>('queue');

// ── Poster Lookup ──────────────────────────────────────────────────────────────
const moviePosterMap = computed(() => {
  const m = new Map<number, string>();
  for (const movie of moviesStore.movies) {
    const p = getPosterUrl(movie.images, 'w92');
    if (p) m.set(movie.id, p);
  }
  return m;
});
const seriesPosterMap = computed(() => {
  const m = new Map<number, string>();
  for (const s of (seriesStore.series ?? [])) {
    const p = getPosterUrl(s.images as any, 'w92');
    if (p) m.set(s.id, p);
  }
  return m;
});

function getPoster(item: ArrQueueItem): string | null {
  if (item.movieId && moviePosterMap.value.has(item.movieId)) return moviePosterMap.value.get(item.movieId)!;
  if (item.seriesId && seriesPosterMap.value.has(item.seriesId)) return seriesPosterMap.value.get(item.seriesId)!;
  return null;
}

// ── Combined Queue: NormalizedSlot + Arr-Match ─────────────────────────────────
interface CombinedSlot {
  slot: NormalizedSlot;
  arr: ArrQueueItem | null;
  poster: string | null;
}

const combinedSlots = computed<CombinedSlot[]>(() => {
  return queue.slots.map(slot => {
    const arr = queue.arrItems.find(a => a.downloadId === slot.nativeId) ?? null;
    return { slot, arr, poster: arr ? getPoster(arr) : null };
  });
});

// Arr-Items ohne Slot-Match → "In Verarbeitung / Import"
const unmatchedArr = computed<(ArrQueueItem & { poster: string | null })[]>(() => {
  const matchedDownloadIds = new Set(
    combinedSlots.value.map(c => c.arr?.downloadId).filter(Boolean)
  );
  return queue.arrItems
    .filter(a => !a.downloadId || !matchedDownloadIds.has(a.downloadId))
    .map(a => ({ ...a, poster: getPoster(a) }));
});

// ── Stats ──────────────────────────────────────────────────────────────────────
const radarrCount  = computed(() => queue.arrItems.filter(i => i.app === 'radarr').length);
const sonarrCount  = computed(() => queue.arrItems.filter(i => i.app === 'sonarr').length);
const lidarrCount  = computed(() => queue.arrItems.filter(i => i.app === 'lidarr').length);

// Gesamt-Download-Speed aller Downloader
const totalSpeedMbs = computed(() => {
  let speed = 0;
  for (const dl of queue.downloaders) speed += dl.speedMbs ?? 0;
  return speed;
});

function fmtSpeed(mbs: number) {
  if (mbs === 0) return '0 KB/s';
  if (mbs < 1)   return `${(mbs * 1024).toFixed(0)} KB/s`;
  return `${mbs.toFixed(1)} MB/s`;
}

// ── Batch Selektion ────────────────────────────────────────────────────────────
const selectedIds   = ref<Set<string>>(new Set());
const showingChecks = computed(() => selectedIds.value.size > 0);

const lastSelectedIndex = ref<number>(-1);

function toggleSelect(slotId: string, index: number, event: MouseEvent) {
  const next = new Set(selectedIds.value);

  if (event.shiftKey && lastSelectedIndex.value >= 0) {
    // Range-Select: alle Slots zwischen letztem Klick und aktuellem selektieren
    const from = Math.min(lastSelectedIndex.value, index);
    const to   = Math.max(lastSelectedIndex.value, index);
    const shouldSelect = !next.has(slotId); // Richtung: auswählen oder abwählen
    for (let i = from; i <= to; i++) {
      const id = combinedSlots.value[i]?.slot.id;
      if (id) {
        if (shouldSelect) next.add(id);
        else next.delete(id);
      }
    }
  } else {
    // Normaler Toggle
    if (next.has(slotId)) next.delete(slotId);
    else next.add(slotId);
    lastSelectedIndex.value = index;
  }

  selectedIds.value = next;
}

function clearSelection() {
  selectedIds.value = new Set();
  lastSelectedIndex.value = -1;
}

const selectedSlots = computed<NormalizedSlot[]>(() =>
  combinedSlots.value.filter(c => selectedIds.value.has(c.slot.id)).map(c => c.slot)
);

/** Aus Auswahl nur Slots mit einer bestimmten Fähigkeit */
function eligibleSlots(cap: 'canPause' | 'canMoveToTop' | 'canSetPriority') {
  return selectedSlots.value.filter(s => s[cap]);
}

const batchMoveToTopCount  = computed(() => selectedSlots.value.filter(s => s.canMoveToTop).length);
const batchPriorityCount   = computed(() => selectedSlots.value.filter(s => s.canSetPriority).length);
const batchPriorityOpen    = ref(false);

// Batch Actions
async function batchPause() {
  await Promise.allSettled(selectedSlots.value.map(s => pauseSlot(s)));
  clearSelection();
}
async function batchResume() {
  await Promise.allSettled(selectedSlots.value.map(s => resumeSlot(s)));
  clearSelection();
}
async function batchDelete() {
  askConfirm(
    `${selectedSlots.value.length} Downloads entfernen?`,
    `${selectedSlots.value.length} ausgewählte Downloads aus der Queue entfernen?`,
    async () => {
      await Promise.allSettled(selectedSlots.value.map(s => deleteSlot(s)));
      clearSelection();
    }
  );
}
async function batchMoveToTop() {
  await Promise.allSettled(eligibleSlots('canMoveToTop').map(s => moveToTop(s)));
}
async function batchSetPriority(priority: string) {
  await Promise.allSettled(eligibleSlots('canSetPriority').map(s => setPriority(s, priority)));
  batchPriorityOpen.value = false;
}

// ── Downloader-aware Actions ───────────────────────────────────────────────────
const itemPending = ref<Record<string, boolean>>({});

async function pauseSlot(slot: NormalizedSlot) {
  itemPending.value[slot.id] = true;
  try {
    if (slot.downloader === 'sabnzbd')      await post(`/api/sabnzbd/queue/${slot.nativeId}/pause`);
    else if (slot.downloader === 'transmission') await post(`/api/transmission/torrent/${slot.nativeId}/pause`);
  } finally { delete itemPending.value[slot.id]; }
}

async function resumeSlot(slot: NormalizedSlot) {
  itemPending.value[slot.id] = true;
  try {
    if (slot.downloader === 'sabnzbd')           await post(`/api/sabnzbd/queue/${slot.nativeId}/resume`);
    else if (slot.downloader === 'transmission')  await post(`/api/transmission/torrent/${slot.nativeId}/resume`);
  } finally { delete itemPending.value[slot.id]; }
}

async function deleteSlot(slot: NormalizedSlot) {
  if (slot.downloader === 'sabnzbd')           await del(`/api/sabnzbd/queue/${slot.nativeId}`);
  else if (slot.downloader === 'transmission')  await del(`/api/transmission/torrent/${slot.nativeId}`);
}

async function moveToTop(slot: NormalizedSlot) {
  if (!slot.canMoveToTop) return;
  itemPending.value[slot.id] = true;
  try { await post(`/api/sabnzbd/queue/${slot.nativeId}/move-top`); }
  finally { delete itemPending.value[slot.id]; }
}

// Priority (SABnzbd only)
const priorityOpen = ref<Record<string, boolean>>({});
async function setPriority(slot: NormalizedSlot, priority: string) {
  await post(`/api/sabnzbd/queue/${slot.nativeId}/priority`, { priority });
  priorityOpen.value[slot.id] = false;
}

function askDeleteSlot(slot: NormalizedSlot, name: string) {
  askConfirm('Download entfernen?', `"${name}" aus der Queue entfernen?`, async () => {
    await deleteSlot(slot);
  });
}

// Arr-Queue (unmatched)
async function deleteArr(item: ArrQueueItem) {
  askConfirm('Download entfernen?', `"${item.title}" aus der Arr-Queue entfernen?`, async () => {
    if (item.app === 'radarr')      await del(`/api/radarr/queue/${item.id}?removeFromClient=true`);
    else if (item.app === 'sonarr') await del(`/api/sonarr/queue/${item.id}?removeFromClient=true`);
    else                             await del(`/api/lidarr/queue/${item.id}?removeFromClient=true`);
  });
}

// ── Global Downloader Controls ────────────────────────────────────────────────
const globalToggling = ref<Record<string, boolean>>({});

async function toggleDownloader(type: DownloaderType, paused: boolean) {
  if (globalToggling.value[type]) return;
  globalToggling.value[type] = true;
  try {
    if (type === 'sabnzbd')      await post(`/api/sabnzbd/${paused ? 'resume' : 'pause'}`);
    else if (type === 'transmission') await post(`/api/transmission/${paused ? 'resume' : 'pause'}`);
  } finally { delete globalToggling.value[type]; }
}

// ── Delete Confirm ─────────────────────────────────────────────────────────────
const showConfirm   = ref(false);
const confirmTitle  = ref('');
const confirmMsg    = ref('');
const confirmAction = ref<() => Promise<void>>(() => Promise.resolve());

function askConfirm(title: string, msg: string, action: () => Promise<void>) {
  confirmTitle.value  = title;
  confirmMsg.value    = msg;
  confirmAction.value = action;
  showConfirm.value   = true;
}
async function doConfirm() {
  await confirmAction.value();
  showConfirm.value = false;
}

// ── History ────────────────────────────────────────────────────────────────────
interface HistEntry {
  id: number;
  app: 'radarr' | 'sonarr' | 'lidarr';
  title: string;
  eventType: string;
  date: string;
  quality?: string;
  size?: number;
  indexer?: string;
  downloadClient?: string;
  releaseGroup?: string;
  sourceTitle?: string;
  languages?: string;
}
const historyItems   = ref<HistEntry[]>([]);
const historyLoading = ref(false);
const histPage       = ref(0);
const HIST_PAGE      = 20;
const histAppFilter   = ref<'all' | 'radarr' | 'sonarr' | 'lidarr'>('all');
const histEventFilter = ref<'all' | 'grab' | 'import' | 'fail'>('all');

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
      for (const r of (rr.value?.records ?? [])) {
        entries.push({ id: r.id, app: 'radarr',
          title: r.movie?.title ?? r.sourceTitle ?? '–',
          eventType: r.eventType ?? 'grabbed', date: r.date,
          quality: r.quality?.quality?.name, size: r.size,
          indexer: r.data?.indexer, downloadClient: r.data?.downloadClient,
          releaseGroup: r.data?.releaseGroup, sourceTitle: r.sourceTitle,
          languages: r.languages?.map((l: any) => l.name).filter(Boolean).join(', '),
        });
      }
    }
    if (sr.status === 'fulfilled') {
      for (const r of (sr.value?.records ?? [])) {
        const ep = r.episode;
        const epLabel = ep ? ` S${String(ep.seasonNumber).padStart(2,'0')}E${String(ep.episodeNumber).padStart(2,'0')}` : '';
        entries.push({ id: r.id, app: 'sonarr',
          title: (r.series?.title ?? r.sourceTitle ?? '–') + epLabel,
          eventType: r.eventType ?? 'grabbed', date: r.date,
          quality: r.quality?.quality?.name, size: r.size,
          indexer: r.data?.indexer, downloadClient: r.data?.downloadClient,
          releaseGroup: r.data?.releaseGroup, sourceTitle: r.sourceTitle,
          languages: r.languages?.map((l: any) => l.name).filter(Boolean).join(', '),
        });
      }
    }
    if (lr.status === 'fulfilled') {
      for (const r of (lr.value?.records ?? [])) {
        entries.push({ id: r.id, app: 'lidarr',
          title: r.artist?.artistName ?? r.sourceTitle ?? '–',
          eventType: r.eventType ?? 'grabbed', date: r.date,
          quality: r.quality?.quality?.name, size: r.size,
          indexer: r.data?.indexer, downloadClient: r.data?.downloadClient,
          releaseGroup: r.data?.releaseGroup, sourceTitle: r.sourceTitle,
        });
      }
    }
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    historyItems.value = entries;
  } finally { historyLoading.value = false; }
}

const filteredHistory = computed(() => {
  let items = historyItems.value;
  if (histAppFilter.value !== 'all') items = items.filter(h => h.app === histAppFilter.value);
  if (histEventFilter.value === 'grab')   items = items.filter(h => h.eventType.toLowerCase().includes('grab'));
  if (histEventFilter.value === 'import') items = items.filter(h => h.eventType.toLowerCase().includes('import') || h.eventType.toLowerCase().includes('download'));
  if (histEventFilter.value === 'fail')   items = items.filter(h => h.eventType.toLowerCase().includes('fail') || h.eventType.toLowerCase().includes('error'));
  return items;
});
const historyPaged = computed(() => filteredHistory.value.slice(0, (histPage.value + 1) * HIST_PAGE));
const hasMoreHist  = computed(() => filteredHistory.value.length > (histPage.value + 1) * HIST_PAGE);

// ── Missing ────────────────────────────────────────────────────────────────────
interface MissingItem {
  id: number;
  app: 'radarr' | 'sonarr' | 'lidarr';
  title: string;
  subtitle?: string;
  year?: number;
  quality?: string;
  posterUrl?: string;
  searching?: boolean;
  searchOk?: boolean;
}
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
    if (mr.status === 'fulfilled') {
      missingMovies.value = (mr.value?.records ?? []).map((r: any) => ({
        id: r.id, app: 'radarr', title: r.title ?? '–', year: r.year,
        quality: r.qualityProfile?.name,
        posterUrl: getPosterUrl(r.images, 'w92'),
      }));
    }
    if (sr.status === 'fulfilled') {
      missingEpisodes.value = (sr.value?.records ?? []).map((r: any) => ({
        id: r.id, app: 'sonarr',
        title: r.series?.title ?? '–',
        subtitle: `S${String(r.seasonNumber).padStart(2,'0')}E${String(r.episodeNumber).padStart(2,'0')} · ${r.title ?? ''}`,
        posterUrl: getPosterUrl(r.series?.images, 'w92'),
      }));
    }
    if (lr.status === 'fulfilled') {
      missingAlbums.value = (lr.value?.records ?? []).map((r: any) => {
        const coverUrl = r.images?.find((i: any) => i.coverType === 'cover')?.remoteUrl
                      ?? r.artist?.images?.find((i: any) => i.coverType === 'poster')?.remoteUrl;
        return {
          id: r.id, app: 'lidarr',
          title: r.artist?.artistName ?? '–',
          subtitle: r.title,
          posterUrl: coverUrl ? (tmdbImageUrl(coverUrl, 'w92') ?? coverUrl) : undefined,
        };
      });
    }
  } finally { missingLoading.value = false; }
}

async function searchMissing(item: MissingItem) {
  item.searching = true;
  try {
    if (item.app === 'radarr')      await post('/api/radarr/command', { name: 'MoviesSearch', movieIds: [item.id] });
    else if (item.app === 'sonarr') await post('/api/sonarr/command', { name: 'EpisodeSearch', episodeIds: [item.id] });
    else                             await post('/api/lidarr/command', { name: 'AlbumSearch', albumIds: [item.id] });
    item.searchOk = true;
    setTimeout(() => { item.searchOk = false; }, 3000);
  } catch { /* noop */ } finally { item.searching = false; }
}

async function searchAllMissing(app: 'radarr' | 'sonarr' | 'lidarr') {
  const items = app === 'radarr' ? missingMovies.value : app === 'sonarr' ? missingEpisodes.value : missingAlbums.value;
  const ids = items.map(i => i.id);
  if (!ids.length) return;
  if (app === 'radarr')      await post('/api/radarr/command', { name: 'MoviesSearch', movieIds: ids });
  else if (app === 'sonarr') await post('/api/sonarr/command', { name: 'EpisodeSearch', episodeIds: ids });
  else                        await post('/api/lidarr/command', { name: 'AlbumSearch', albumIds: ids });
}

const missingTotal = computed(() => missingMovies.value.length + missingEpisodes.value.length + missingAlbums.value.length);

// ── Navigation ─────────────────────────────────────────────────────────────────
function navigateTo(item: ArrQueueItem) {
  if (item.app === 'radarr' && item.movieId)   router.push(`/movies/${item.movieId}`);
  else if (item.app === 'sonarr' && item.seriesId) router.push(`/series/${item.seriesId}`);
  else if (item.app === 'lidarr' && item.artistId) router.push(`/music/${item.artistId}`);
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtMb(mb: number) { return mb >= 1024 ? `${(mb/1024).toFixed(1)} GB` : `${mb.toFixed(0)} MB`; }
function fmtBytes(b?: number) {
  if (!b) return '';
  const g = b/1024/1024/1024;
  return g >= 1 ? `${g.toFixed(1)} GB` : `${(b/1024/1024).toFixed(0)} MB`;
}
function fmtDate(iso?: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
}
function stLabel(s: string) {
  return ({downloading:'Lädt', queued:'Warte', paused:'Pause', completed:'Fertig',
    failed:'Fehler', warning:'Warnung', importpending:'Import', seeding:'Seeden',
    checking:'Prüfen', error:'Fehler'} as Record<string,string>)[s.toLowerCase()] ?? s;
}
function stClass(s: string) {
  const t = s.toLowerCase();
  return t === 'downloading' ? 'st-active'
       : t === 'seeding' ? 'st-seed'
       : t === 'completed' || t === 'importpending' ? 'st-done'
       : t === 'error' || t === 'failed' ? 'st-err'
       : t === 'paused' ? 'st-pause'
       : 'st-idle';
}
function appColor(app: string) {
  return app==='radarr'?'var(--radarr)':app==='sonarr'?'var(--sonarr)':app==='lidarr'?'var(--lidarr)':'var(--text-muted)';
}
function appLabel(app: string) {
  return app==='radarr'?'Film':app==='sonarr'?'Serie':app==='lidarr'?'Musik':app;
}
function appIcon(app: string) {
  if (app==='radarr')  return '🎬';
  if (app==='sonarr')  return '📺';
  if (app==='lidarr')  return '🎵';
  return '📦';
}
function dlColor(type: DownloaderType): string {
  if (type === 'sabnzbd')      return 'var(--sabnzbd)';
  if (type === 'transmission') return 'var(--transmission)';
  if (type === 'qbittorrent')  return '#1c5c93';
  if (type === 'nzbget')       return '#4e9b5a';
  return 'var(--text-muted)';
}
function dlLabel(type: DownloaderType): string {
  if (type === 'sabnzbd')      return 'SAB';
  if (type === 'transmission') return 'TR';
  if (type === 'qbittorrent')  return 'qBit';
  if (type === 'nzbget')       return 'NZB';
  return type;
}
function dlIcon(type: DownloaderType): string {
  if (type === 'transmission') return '🔄';
  return '📥';
}
function evBadge(et: string) {
  const t = (et ?? '').toLowerCase();
  if (t.includes('grab'))    return { label:'Grab',    cls:'ev-grab' };
  if (t.includes('import') || t.includes('download')) return { label:'Import', cls:'ev-import' };
  if (t.includes('fail') || t.includes('error'))       return { label:'Fehler', cls:'ev-err' };
  if (t.includes('delet'))   return { label:'Gelöscht', cls:'ev-del' };
  return { label: et, cls: 'ev-idle' };
}
</script>

<template>
  <div class="dv page-context" style="--context-color: var(--sabnzbd)">

    <!-- ── Header ── -->
    <div class="dv-header">
      <div class="dv-title-row">
        <h1 class="dv-title">
          <span class="title-bar" />
          Downloads
          <span v-if="queue.totalCount > 0" class="title-count">{{ queue.totalCount }}</span>
          <span class="live-pill" :class="queue.isConnected ? 'live' : 'offline'">
            <span class="live-dot" />
            {{ queue.isConnected ? 'Live' : 'Verbinde…' }}
          </span>
        </h1>
        <!-- Downloader Controls (pro Downloader) -->
        <div class="header-controls">
          <span v-if="totalSpeedMbs > 0" class="speed-label">{{ fmtSpeed(totalSpeedMbs) }}</span>
          <template v-for="dl in queue.downloaders" :key="dl.type">
            <button
              class="hdr-btn"
              :class="{'hdr-btn-warn': dl.paused}"
              :style="dl.paused ? {} : {}"
              :disabled="!!globalToggling[dl.type]"
              @click="toggleDownloader(dl.type, !!dl.paused)"
            >
              <span class="dl-badge-mini" :style="{background:`color-mix(in srgb,${dlColor(dl.type)} 15%,transparent)`,color:dlColor(dl.type),borderColor:`color-mix(in srgb,${dlColor(dl.type)} 30%,transparent)`}">
                {{ dlLabel(dl.type) }}
              </span>
              <svg v-if="dl.paused" width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              {{ dl.paused ? 'Fortsetzen' : 'Pausieren' }}
            </button>
          </template>
        </div>
      </div>

      <!-- Gesamt-Fortschrittsbalken (wenn SABnzbd aktiv) -->
      <template v-for="dl in queue.downloaders" :key="`prog-${dl.type}`">
        <div v-if="dl.totalMb && dl.totalMb > 0" class="global-prog-row">
          <span class="gp-dl-label" :style="{color: dlColor(dl.type)}">{{ dlLabel(dl.type) }}</span>
          <div class="gp-bar-wrap">
            <div class="gp-bar" :style="{
              width: dl.totalMb > 0 ? (((dl.totalMb - (dl.leftMb ?? 0)) / dl.totalMb) * 100).toFixed(0) + '%' : '0%',
              background: dlColor(dl.type)
            }" />
          </div>
          <span class="gp-label">{{ fmtMb(dl.totalMb - (dl.leftMb ?? 0)) }} / {{ fmtMb(dl.totalMb) }}</span>
          <span class="gp-pct">{{ dl.totalMb > 0 ? (((dl.totalMb - (dl.leftMb ?? 0)) / dl.totalMb) * 100).toFixed(0) : 0 }}%</span>
        </div>
      </template>
    </div>

    <!-- ── Stats Bar ── -->
    <div class="stats-bar">
      <div class="sc" style="--c: var(--radarr)" @click="activeTab='queue'">
        <span class="sc-icon">🎬</span>
        <div class="sc-body"><span class="sc-n">{{ radarrCount }}</span><span class="sc-l">Filme</span></div>
      </div>
      <div class="sc" style="--c: var(--sonarr)" @click="activeTab='queue'">
        <span class="sc-icon">📺</span>
        <div class="sc-body"><span class="sc-n">{{ sonarrCount }}</span><span class="sc-l">Episoden</span></div>
      </div>
      <div class="sc" style="--c: var(--lidarr)" @click="activeTab='queue'">
        <span class="sc-icon">🎵</span>
        <div class="sc-body"><span class="sc-n">{{ lidarrCount }}</span><span class="sc-l">Alben</span></div>
      </div>
      <!-- Pro Downloader eine Stats-Card -->
      <div
        v-for="dl in queue.downloaders"
        :key="`sc-${dl.type}`"
        class="sc"
        :style="`--c: ${dlColor(dl.type)}`"
        @click="activeTab='queue'"
      >
        <div class="sc-body">
          <span class="sc-n">{{ dl.slotCount }}</span>
          <span class="sc-l">{{ dl.name }}</span>
        </div>
        <span v-if="dl.speedMbs && dl.speedMbs > 0" class="sc-speed">{{ fmtSpeed(dl.speedMbs) }}</span>
        <span v-if="dl.paused" class="sc-paused">⏸</span>
      </div>
    </div>

    <!-- ── Tab Bar ── -->
    <div class="tab-bar">
      <button :class="['tab-btn', {active: activeTab==='queue'}]" @click="activeTab='queue'">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        Queue
        <span v-if="queue.totalCount > 0" class="tab-badge">{{ queue.totalCount }}</span>
      </button>
      <button :class="['tab-btn', {active: activeTab==='history'}]" @click="activeTab='history'">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        History
        <span v-if="historyItems.length > 0" class="tab-badge">{{ historyItems.length }}</span>
      </button>
      <button :class="['tab-btn', {active: activeTab==='missing'}]" @click="activeTab='missing'">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        Fehlend
        <span v-if="missingTotal > 0" class="tab-badge tab-badge-warn">{{ missingTotal }}</span>
      </button>
    </div>

    <!-- ════════════════════ TAB: QUEUE ════════════════════ -->
    <div v-if="activeTab==='queue'" class="tab-content">

      <!-- Combined Slots (alle Downloader) -->
      <div v-if="combinedSlots.length > 0" class="queue-section">
        <div class="section-header">
          <span class="section-title">Downloads</span>
          <span class="section-meta">{{ combinedSlots.length }} Slot{{ combinedSlots.length !== 1 ? 's' : '' }}</span>
          <span v-if="showingChecks" class="section-meta" style="margin-left:auto">{{ selectedIds.size }} ausgewählt</span>
          <button v-if="showingChecks" class="select-all-btn select-clear-btn" @click="clearSelection">
            Auswahl aufheben
          </button>
        </div>

        <div class="dl-list">
          <div
            v-for="c in combinedSlots"
            :key="c.slot.id"
            class="dl-card"
            :class="{
              'dl-card-selected': selectedIds.has(c.slot.id),
              'dl-card-selectable': showingChecks,
            }"
            :style="c.arr ? {'--accent': appColor(c.arr.app)} : {'--accent': dlColor(c.slot.downloader)}"
          >
            <!-- Checkbox -->
            <div
              class="dl-checkbox"
              :class="{'dl-checkbox-visible': showingChecks || selectedIds.has(c.slot.id)}"
              @click.stop="(e) => toggleSelect(c.slot.id, combinedSlots.indexOf(c), e)"
            >
              <div class="dl-cb-inner" :class="{'dl-cb-checked': selectedIds.has(c.slot.id)}">
                <svg v-if="selectedIds.has(c.slot.id)" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
            </div>

            <!-- Left accent bar -->
            <div class="dl-accent" />

            <!-- Poster -->
            <div class="dl-poster" @click="c.arr && navigateTo(c.arr)" :class="{'dl-poster-link': c.arr?.movieId || c.arr?.seriesId}">
              <img v-if="c.poster" :src="c.poster" :alt="c.arr?.title" loading="lazy" />
              <div v-else class="dl-poster-ph">{{ c.arr ? appIcon(c.arr.app) : dlIcon(c.slot.downloader) }}</div>
            </div>

            <!-- Main Content -->
            <div class="dl-main">
              <div class="dl-title-row">
                <!-- App-Tag (Radarr/Sonarr/Lidarr) -->
                <span v-if="c.arr" class="app-tag" :style="{background:`color-mix(in srgb,${appColor(c.arr.app)} 12%,transparent)`,color:appColor(c.arr.app),borderColor:`color-mix(in srgb,${appColor(c.arr.app)} 25%,transparent)`}">
                  {{ appLabel(c.arr.app) }}
                </span>
                <!-- Downloader-Badge -->
                <span class="dl-type-badge" :style="{background:`color-mix(in srgb,${dlColor(c.slot.downloader)} 12%,transparent)`,color:dlColor(c.slot.downloader),borderColor:`color-mix(in srgb,${dlColor(c.slot.downloader)} 25%,transparent)`}">
                  {{ dlLabel(c.slot.downloader) }}
                </span>
                <p class="dl-title" @click="c.arr && navigateTo(c.arr)" :class="{'dl-title-link': c.arr?.movieId || c.arr?.seriesId}">
                  {{ c.arr?.title ?? c.slot.filename }}
                </p>
                <span v-if="c.arr" class="dl-release">{{ c.slot.filename }}</span>
                <span :class="['st-badge', stClass(c.slot.status)]">{{ stLabel(c.slot.status) }}</span>
              </div>

              <!-- Badges -->
              <div class="dl-badges">
                <span v-if="c.arr?.quality" class="badge badge-quality">{{ c.arr.quality }}</span>
                <template v-if="c.arr?.languages?.length">
                  <span v-for="lang in c.arr.languages.slice(0,3)" :key="lang" class="badge badge-lang">{{ lang }}</span>
                </template>
                <template v-if="c.arr?.customFormats?.length">
                  <span v-for="cf in c.arr.customFormats.slice(0,2)" :key="cf" class="badge badge-cf">{{ cf }}</span>
                </template>
                <span v-if="c.slot.category" class="badge badge-cat">{{ c.slot.category }}</span>
                <span v-if="c.arr?.indexer" class="badge badge-idx">{{ c.arr.indexer }}</span>
                <!-- Torrent-spezifisch -->
                <span v-if="c.slot.seeds !== undefined && c.slot.seeds > 0" class="badge badge-seeds">
                  {{ c.slot.seeds }} Peers
                </span>
                <span v-if="c.slot.seedRatio !== undefined && c.slot.status === 'seeding'" class="badge badge-ratio">
                  Ratio {{ c.slot.seedRatio.toFixed(2) }}
                </span>
              </div>

              <!-- Progress -->
              <div class="dl-progress-row">
                <div class="dl-prog-wrap">
                  <div class="dl-prog-bar" :style="{width: c.slot.percentage.toFixed(0)+'%', background:'var(--accent)'}"/>
                </div>
                <span class="dl-prog-meta">
                  {{ c.slot.percentage.toFixed(0) }}%
                  <span class="sep">·</span>
                  {{ fmtMb(c.slot.mbLeft) }} übrig
                  <template v-if="c.slot.speedMbs && c.slot.speedMbs > 0">
                    <span class="sep">·</span>
                    <span class="eta">{{ fmtSpeed(c.slot.speedMbs) }}</span>
                  </template>
                  <template v-if="c.slot.timeleft">
                    <span class="sep">·</span>
                    <span class="eta">⏱ {{ c.slot.timeleft }}</span>
                  </template>
                </span>
              </div>
            </div>

            <!-- Actions -->
            <div class="dl-acts" @click.stop>
              <!-- Move to Top (SABnzbd only) -->
              <button v-if="c.slot.canMoveToTop" class="act-btn act-top" :disabled="!!itemPending[c.slot.id]" @click="moveToTop(c.slot)" title="An Anfang">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>
              </button>

              <!-- Pause -->
              <button v-if="c.slot.canPause && (c.slot.status === 'downloading' || c.slot.status === 'seeding' || c.slot.status === 'queued')"
                class="act-btn act-pause" :disabled="!!itemPending[c.slot.id]" @click="pauseSlot(c.slot)" title="Pausieren">
                <svg v-if="itemPending[c.slot.id]" class="spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              </button>

              <!-- Resume -->
              <button v-else-if="c.slot.canPause && c.slot.status === 'paused'"
                class="act-btn act-resume" :disabled="!!itemPending[c.slot.id]" @click="resumeSlot(c.slot)" title="Fortsetzen">
                <svg v-if="itemPending[c.slot.id]" class="spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </button>

              <!-- Priority (SABnzbd only) -->
              <div v-if="c.slot.canSetPriority" class="priority-wrap">
                <button class="act-btn act-prio" @click.stop="priorityOpen[c.slot.id] = !priorityOpen[c.slot.id]" title="Priorität">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="4"/><polyline points="6 9 12 3 18 9"/></svg>
                </button>
                <div v-if="priorityOpen[c.slot.id]" class="priority-menu">
                  <button v-for="p in ['Force','High','Normal','Low']" :key="p" class="prio-item" @click="setPriority(c.slot, p)">{{ p }}</button>
                </div>
              </div>

              <!-- Delete -->
              <button class="act-btn act-del" @click="askDeleteSlot(c.slot, c.arr?.title ?? c.slot.filename)" title="Entfernen">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Unmatched Arr Items -->
      <div v-if="unmatchedArr.length > 0" class="queue-section">
        <div class="section-header">
          <span class="section-title">In Verarbeitung / Import</span>
          <span class="section-meta">{{ unmatchedArr.length }} Eintrag{{ unmatchedArr.length !== 1 ? 'einträge' : '' }}</span>
        </div>
        <div class="dl-list">
          <div v-for="item in unmatchedArr" :key="`arr-${item.app}-${item.id}`"
            class="dl-card dl-card-processing" :style="{'--accent': appColor(item.app)}">
            <div class="dl-accent" />
            <div class="dl-poster dl-poster-sm" @click="navigateTo(item)">
              <img v-if="item.poster" :src="item.poster" :alt="item.title" loading="lazy" />
              <div v-else class="dl-poster-ph">{{ appIcon(item.app) }}</div>
            </div>
            <div class="dl-main">
              <div class="dl-title-row">
                <span class="app-tag" :style="{background:`color-mix(in srgb,${appColor(item.app)} 12%,transparent)`,color:appColor(item.app),borderColor:`color-mix(in srgb,${appColor(item.app)} 25%,transparent)`}">{{ appLabel(item.app) }}</span>
                <p class="dl-title dl-title-link" @click="navigateTo(item)">{{ item.title }}</p>
                <span :class="['st-badge', stClass(item.status)]">{{ stLabel(item.status) }}</span>
              </div>
              <div class="dl-badges">
                <span v-if="item.quality" class="badge badge-quality">{{ item.quality }}</span>
                <template v-if="item.languages?.length">
                  <span v-for="lang in item.languages.slice(0,3)" :key="lang" class="badge badge-lang">{{ lang }}</span>
                </template>
                <span v-if="item.protocol" class="badge badge-cat">{{ item.protocol }}</span>
              </div>
              <div v-if="item.progress > 0" class="dl-progress-row">
                <div class="dl-prog-wrap">
                  <div class="dl-prog-bar" :style="{width: item.progress + '%', background:'var(--accent)'}"/>
                </div>
                <span class="dl-prog-meta">{{ item.progress }}%</span>
              </div>
              <div v-if="item.errorMessage" class="item-err">{{ item.errorMessage }}</div>
            </div>
            <div class="dl-acts" @click.stop>
              <button class="act-btn act-del" @click="deleteArr(item)" title="Entfernen">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="combinedSlots.length === 0 && unmatchedArr.length === 0" class="empty-state">
        <div class="empty-icon">📭</div>
        <p class="empty-title">Keine aktiven Downloads</p>
        <p class="empty-sub">{{ queue.isConnected ? 'Alles ruhig – keine Jobs in der Queue.' : 'Verbinde mit dem Server…' }}</p>
      </div>

      <div v-if="queue.lastError" class="err-banner">{{ queue.lastError }}</div>
    </div>

    <!-- ════════════════════ TAB: HISTORY ════════════════════ -->
    <div v-if="activeTab==='history'" class="tab-content">
      <div class="filter-bar">
        <div class="filter-group">
          <button v-for="f in [{v:'all',l:'Alle'},{v:'grab',l:'Grab'},{v:'import',l:'Import'},{v:'fail',l:'Fehler'}]"
            :key="f.v" :class="['filter-chip', {active: histEventFilter===f.v}]"
            @click="histEventFilter=f.v as any; histPage=0">{{ f.l }}</button>
        </div>
        <div class="filter-group filter-apps">
          <button v-for="f in [{v:'all',l:'Alle'},{v:'radarr',l:'Radarr',c:'var(--radarr)'},{v:'sonarr',l:'Sonarr',c:'var(--sonarr)'},{v:'lidarr',l:'Lidarr',c:'var(--lidarr)'}]"
            :key="f.v" :class="['filter-chip', {active: histAppFilter===f.v}]"
            :style="histAppFilter===f.v && f.c ? {borderColor:`color-mix(in srgb,${f.c} 40%,transparent)`,color:f.c} : {}"
            @click="histAppFilter=f.v as any; histPage=0">{{ f.l }}</button>
        </div>
      </div>
      <div v-if="historyLoading" class="loading-list">
        <div v-for="i in 8" :key="i" class="skeleton" style="height:64px;border-radius:8px"/>
      </div>
      <div v-else-if="!filteredHistory.length" class="empty-state">
        <p class="empty-title">Keine Einträge</p>
        <p class="empty-sub">{{ historyItems.length ? 'Kein Ergebnis für diesen Filter.' : 'History ist leer.' }}</p>
      </div>
      <div v-else class="hist-panel">
        <div v-for="h in historyPaged" :key="`${h.app}-${h.id}`" class="hist-row" :style="{'--ic': appColor(h.app)}">
          <div class="hist-ev">
            <span :class="['ev-badge', evBadge(h.eventType).cls]">{{ evBadge(h.eventType).label }}</span>
          </div>
          <span class="app-tag hist-app" :style="{background:`color-mix(in srgb,var(--ic) 10%,transparent)`,color:'var(--ic)',borderColor:`color-mix(in srgb,var(--ic) 25%,transparent)`}">{{ appLabel(h.app) }}</span>
          <div class="hist-main">
            <p class="hist-title">{{ h.title }}</p>
            <p v-if="h.sourceTitle" class="hist-nzb">{{ h.sourceTitle }}</p>
            <div class="hist-meta">
              <span v-if="h.quality" class="badge badge-quality">{{ h.quality }}</span>
              <span v-if="h.languages" class="badge badge-lang">{{ h.languages }}</span>
              <span v-if="h.releaseGroup" class="badge badge-idx">{{ h.releaseGroup }}</span>
              <span v-if="h.size" class="badge">{{ fmtBytes(h.size) }}</span>
              <span v-if="h.downloadClient" class="badge badge-client">{{ h.downloadClient }}</span>
              <span v-if="h.indexer" class="badge badge-idx">{{ h.indexer }}</span>
            </div>
          </div>
          <span class="hist-date">{{ fmtDate(h.date) }}</span>
        </div>
        <div v-if="hasMoreHist" class="load-more">
          <button class="ctrl-btn" @click="histPage++">Weitere laden ({{ filteredHistory.length - historyPaged.length }} mehr)</button>
        </div>
      </div>
    </div>

    <!-- ════════════════════ TAB: FEHLEND ════════════════════ -->
    <div v-if="activeTab==='missing'" class="tab-content">
      <div v-if="missingLoading" class="loading-list">
        <div v-for="i in 6" :key="i" class="skeleton" style="height:72px;border-radius:8px"/>
      </div>
      <template v-else>
        <div v-if="missingMovies.length" class="miss-section">
          <div class="miss-head" style="--c: var(--radarr)">
            <div class="miss-head-left">
              <div class="miss-head-accent" /><span class="miss-head-icon">🎬</span>
              <span class="miss-head-label">Fehlende Filme</span>
              <span class="miss-head-count">{{ missingMovies.length }}</span>
            </div>
            <button class="search-all-btn" style="--btn-c: var(--radarr)" @click="searchAllMissing('radarr')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Alle suchen
            </button>
          </div>
          <div class="miss-list">
            <div v-for="m in missingMovies" :key="m.id" class="miss-item" @click="router.push(`/movies/${m.id}`)">
              <div class="miss-poster"><img v-if="m.posterUrl" :src="m.posterUrl" :alt="m.title" loading="lazy"/><div v-else class="miss-ph">🎬</div></div>
              <div class="miss-info">
                <p class="miss-title">{{ m.title }}</p>
                <div class="miss-sub-row"><span v-if="m.year" class="badge">{{ m.year }}</span><span v-if="m.quality" class="badge badge-quality">{{ m.quality }}</span></div>
              </div>
              <button class="miss-btn" :class="{'miss-btn-ok': m.searchOk}" :disabled="m.searching" @click.stop="searchMissing(m)">
                <svg v-if="m.searching" class="spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <svg v-else-if="m.searchOk" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </button>
            </div>
          </div>
        </div>
        <div v-if="missingEpisodes.length" class="miss-section">
          <div class="miss-head" style="--c: var(--sonarr)">
            <div class="miss-head-left">
              <div class="miss-head-accent" /><span class="miss-head-icon">📺</span>
              <span class="miss-head-label">Fehlende Episoden</span>
              <span class="miss-head-count">{{ missingEpisodes.length }}</span>
            </div>
            <button class="search-all-btn" style="--btn-c: var(--sonarr)" @click="searchAllMissing('sonarr')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Alle suchen
            </button>
          </div>
          <div class="miss-list">
            <div v-for="m in missingEpisodes" :key="m.id" class="miss-item">
              <div class="miss-poster"><img v-if="m.posterUrl" :src="m.posterUrl" :alt="m.title" loading="lazy"/><div v-else class="miss-ph">📺</div></div>
              <div class="miss-info"><p class="miss-title">{{ m.title }}</p><p v-if="m.subtitle" class="miss-ep">{{ m.subtitle }}</p></div>
              <button class="miss-btn" :class="{'miss-btn-ok': m.searchOk}" :disabled="m.searching" @click.stop="searchMissing(m)">
                <svg v-if="m.searching" class="spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <svg v-else-if="m.searchOk" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </button>
            </div>
          </div>
        </div>
        <div v-if="missingAlbums.length" class="miss-section">
          <div class="miss-head" style="--c: var(--lidarr)">
            <div class="miss-head-left">
              <div class="miss-head-accent" /><span class="miss-head-icon">🎵</span>
              <span class="miss-head-label">Fehlende Alben</span>
              <span class="miss-head-count">{{ missingAlbums.length }}</span>
            </div>
            <button class="search-all-btn" style="--btn-c: var(--lidarr)" @click="searchAllMissing('lidarr')">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              Alle suchen
            </button>
          </div>
          <div class="miss-list">
            <div v-for="m in missingAlbums" :key="m.id" class="miss-item">
              <div class="miss-poster"><img v-if="m.posterUrl" :src="m.posterUrl" :alt="m.title" loading="lazy"/><div v-else class="miss-ph">🎵</div></div>
              <div class="miss-info"><p class="miss-title">{{ m.title }}</p><p v-if="m.subtitle" class="miss-ep">{{ m.subtitle }}</p></div>
              <button class="miss-btn" :class="{'miss-btn-ok': m.searchOk}" :disabled="m.searching" @click.stop="searchMissing(m)">
                <svg v-if="m.searching" class="spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <svg v-else-if="m.searchOk" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
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

    <!-- ════════════ BATCH TOOLBAR (Slide-up) ════════════ -->
    <Transition name="batch-bar">
      <div v-if="showingChecks" class="batch-bar">
        <div class="batch-left">
          <span class="batch-count">{{ selectedIds.size }} ausgewählt</span>
        </div>
        <div class="batch-actions">
          <!-- An Anfang (nur SABnzbd-fähige) -->
          <button
            v-if="batchMoveToTopCount > 0"
            class="batch-btn batch-top"
            @click="batchMoveToTop"
            :title="batchMoveToTopCount < selectedIds.size ? `Gilt für ${batchMoveToTopCount} von ${selectedIds.size} (nur SABnzbd)` : undefined"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>
            An Anfang
            <span v-if="batchMoveToTopCount < selectedIds.size" class="batch-eligible">({{ batchMoveToTopCount }})</span>
          </button>

          <!-- Priorität (nur SABnzbd-fähige) -->
          <div v-if="batchPriorityCount > 0" class="batch-prio-wrap">
            <button
              class="batch-btn batch-prio"
              @click.stop="batchPriorityOpen = !batchPriorityOpen"
              :title="batchPriorityCount < selectedIds.size ? `Gilt für ${batchPriorityCount} von ${selectedIds.size} (nur SABnzbd)` : undefined"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="4"/><polyline points="6 9 12 3 18 9"/></svg>
              Priorität
              <span v-if="batchPriorityCount < selectedIds.size" class="batch-eligible">({{ batchPriorityCount }})</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div v-if="batchPriorityOpen" class="batch-prio-menu">
              <button v-for="p in ['Force','High','Normal','Low']" :key="p" class="prio-item" @click="batchSetPriority(p)">{{ p }}</button>
            </div>
          </div>

          <div class="batch-divider" />

          <button class="batch-btn batch-pause" @click="batchPause">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            Pausieren
          </button>
          <button class="batch-btn batch-resume" @click="batchResume">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Fortsetzen
          </button>
          <button class="batch-btn batch-del" @click="batchDelete">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
            Löschen
          </button>
          <button class="batch-btn batch-clear" @click="clearSelection">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Aufheben
          </button>
        </div>
      </div>
    </Transition>

    <!-- Confirm Dialog -->
    <ConfirmDialog
      v-model="showConfirm"
      :title="confirmTitle"
      :message="confirmMsg"
      confirm-label="Entfernen"
      @confirm="doConfirm"
    />
  </div>
</template>

<style scoped>
/* ── Layout ─────────────────────────────────────────────────────────────── */
.dv { min-height: 100%; display: flex; flex-direction: column; }

/* ── Header ──────────────────────────────────────────────────────────────── */
.dv-header { padding: var(--space-5) var(--space-6) var(--space-3); border-bottom: 1px solid var(--bg-border); background: var(--bg-surface); }
.dv-title-row { display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap; }
.dv-title { display: flex; align-items: center; gap: var(--space-3); font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); margin: 0; flex: 1; }
.title-bar { display: inline-block; width: 3px; height: 1.2em; background: var(--context-color); border-radius: 2px; flex-shrink: 0; }
.title-count { font-size: var(--text-base); font-weight: 400; color: var(--text-muted); }
.live-pill { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-muted); padding: 2px 8px; border-radius: 99px; background: var(--bg-elevated); border: 1px solid var(--bg-border); }
.live-pill.live .live-dot { background: #22c55e; box-shadow: 0 0 5px #22c55e; }
.live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); }

.header-controls { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.speed-label { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); font-variant-numeric: tabular-nums; min-width: 70px; text-align: right; }
.dl-badge-mini {
  font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px; border: 1px solid;
  letter-spacing: .05em; white-space: nowrap;
}
.hdr-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: 500; background: var(--bg-elevated); border: 1px solid var(--bg-border); color: var(--text-secondary); cursor: pointer; transition: all .15s; }
.hdr-btn:hover:not(:disabled) { background: var(--bg-overlay); color: var(--text-primary); }
.hdr-btn:disabled { opacity: .5; cursor: not-allowed; }
.hdr-btn-warn { border-color: rgba(34,197,94,.3); color: #22c55e; }

/* Global Progress Bars */
.global-prog-row { display: flex; align-items: center; gap: var(--space-3); padding-top: var(--space-3); }
.gp-dl-label { font-size: 10px; font-weight: 700; min-width: 30px; }
.gp-bar-wrap { flex: 1; height: 3px; background: var(--bg-elevated); border-radius: 99px; overflow: hidden; }
.gp-bar { height: 100%; border-radius: 99px; transition: width .5s ease; }
.gp-label { font-size: 11px; color: var(--text-muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
.gp-pct { font-size: 11px; color: var(--text-secondary); font-weight: 600; min-width: 30px; text-align: right; font-variant-numeric: tabular-nums; }

/* ── Stats Bar ────────────────────────────────────────────────────────────── */
.stats-bar { display: flex; border-bottom: 1px solid var(--bg-border); background: var(--bg-surface); flex-wrap: wrap; }
.sc { flex: 1; min-width: 80px; display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); border-left: 2px solid var(--c, transparent); cursor: pointer; transition: background .15s; }
.sc:first-child { border-left: none; }
.sc:hover { background: var(--bg-elevated); }
.sc-icon { font-size: 18px; flex-shrink: 0; }
.sc-body { display: flex; flex-direction: column; gap: 1px; }
.sc-n { font-size: var(--text-lg); font-weight: 700; color: var(--text-primary); line-height: 1; font-variant-numeric: tabular-nums; }
.sc-l { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .06em; }
.sc-speed { font-size: 11px; color: var(--text-muted); font-variant-numeric: tabular-nums; margin-left: auto; }
.sc-paused { font-size: 14px; margin-left: auto; opacity: .7; }

/* ── Tab Bar ──────────────────────────────────────────────────────────────── */
.tab-bar { display: flex; border-bottom: 1px solid var(--bg-border); background: var(--bg-surface); padding: 0 var(--space-6); gap: var(--space-1); }
.tab-btn { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-3) var(--space-4); font-size: var(--text-sm); color: var(--text-muted); border-bottom: 2px solid transparent; cursor: pointer; transition: color .15s, border-color .15s; margin-bottom: -1px; }
.tab-btn:hover { color: var(--text-secondary); }
.tab-btn.active { color: var(--text-primary); border-bottom-color: var(--sabnzbd); }
.tab-badge { font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 99px; background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--bg-border); }
.tab-badge-warn { background: rgba(239,68,68,.12); color: #ef4444; border-color: rgba(239,68,68,.25); }

/* ── Tab Content ──────────────────────────────────────────────────────────── */
.tab-content { flex: 1; padding: var(--space-5) var(--space-6) 80px; display: flex; flex-direction: column; gap: var(--space-5); }

/* ── Queue Section ────────────────────────────────────────────────────────── */
.queue-section { display: flex; flex-direction: column; gap: var(--space-3); }
.section-header { display: flex; align-items: center; gap: var(--space-3); }
.section-title { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); }
.section-meta { font-size: 11px; color: var(--text-muted); }
.select-all-btn { font-size: 11px; color: var(--text-muted); padding: 2px 8px; border-radius: 99px; border: 1px solid var(--bg-border); background: var(--bg-elevated); cursor: pointer; transition: all .12s; }
.select-all-btn:hover { color: var(--text-secondary); border-color: rgba(255,255,255,.2); }
.select-clear-btn { color: var(--text-secondary); border-color: rgba(255,255,255,.2); }

/* ── Download Card ────────────────────────────────────────────────────────── */
.dl-list { display: flex; flex-direction: column; gap: var(--space-2); }

.dl-card {
  display: flex; align-items: stretch;
  background: var(--bg-surface); border: 1px solid var(--bg-border);
  border-radius: var(--radius-lg); overflow: hidden;
  transition: background .12s, border-color .12s;
  position: relative;
}
.dl-card:hover { background: var(--bg-elevated); border-color: color-mix(in srgb, var(--accent, var(--sabnzbd)) 20%, var(--bg-border)); }
.dl-card:hover .dl-acts { opacity: 1; }
.dl-card:hover .dl-checkbox { opacity: 1; }

.dl-card-selected {
  background: var(--bg-elevated) !important;
  border-color: color-mix(in srgb, var(--accent, var(--sabnzbd)) 35%, var(--bg-border)) !important;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent, var(--sabnzbd)) 20%, transparent);
}
.dl-card-selected .dl-checkbox { opacity: 1; }

/* Checkbox */
.dl-checkbox {
  display: flex; align-items: center; justify-content: center;
  width: 36px; flex-shrink: 0; opacity: 0; transition: opacity .12s;
  cursor: pointer;
}
.dl-checkbox-visible { opacity: 1; }
.dl-cb-inner {
  width: 16px; height: 16px; border-radius: 4px;
  border: 1.5px solid var(--bg-border); background: var(--bg-elevated);
  display: flex; align-items: center; justify-content: center;
  transition: all .12s;
}
.dl-cb-checked {
  background: var(--accent, var(--sabnzbd));
  border-color: var(--accent, var(--sabnzbd));
  color: #000;
}
.dl-card-selectable .dl-checkbox { opacity: 1; }

.dl-accent { width: 3px; flex-shrink: 0; background: var(--accent, var(--sabnzbd)); }

.dl-poster {
  width: 42px; flex-shrink: 0; background: var(--bg-elevated);
  overflow: hidden; display: flex; align-items: center; justify-content: center;
  border-right: 1px solid var(--bg-border);
}
.dl-poster img { width: 100%; height: 100%; object-fit: cover; }
.dl-poster-ph { font-size: 18px; }
.dl-poster-link { cursor: pointer; }
.dl-poster-link:hover { opacity: .85; }
.dl-poster-sm { width: 38px; }

.dl-main {
  flex: 1; padding: var(--space-3) var(--space-4);
  display: flex; flex-direction: column; gap: var(--space-2); min-width: 0;
}

.dl-title-row { display: flex; align-items: center; gap: var(--space-2); overflow: hidden; }
.dl-title { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0; flex-shrink: 1; }
.dl-title-link { cursor: pointer; }
.dl-title-link:hover { color: var(--text-primary); }
.dl-release { font-size: 10px; color: var(--text-muted); font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; opacity: .6; }

/* App Tag */
.app-tag { font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 4px; border: 1px solid; white-space: nowrap; flex-shrink: 0; letter-spacing: .03em; }

/* Downloader-Type Badge */
.dl-type-badge { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 3px; border: 1px solid; white-space: nowrap; flex-shrink: 0; letter-spacing: .05em; font-family: monospace; }

/* Status Badges */
.st-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; white-space: nowrap; flex-shrink: 0; }
.st-active  { background: rgba(34,197,94,.12);  color: #22c55e; border: 1px solid rgba(34,197,94,.2); }
.st-seed    { background: rgba(99,102,241,.12);  color: #818cf8; border: 1px solid rgba(99,102,241,.2); }
.st-done    { background: rgba(99,102,241,.12);  color: #818cf8; border: 1px solid rgba(99,102,241,.2); }
.st-err     { background: rgba(239,68,68,.12);   color: #ef4444; border: 1px solid rgba(239,68,68,.2); }
.st-pause   { background: rgba(245,197,24,.08);  color: #ca8a04; border: 1px solid rgba(245,197,24,.15); }
.st-idle    { background: var(--bg-elevated);    color: var(--text-muted); border: 1px solid var(--bg-border); }

/* Badges Row */
.dl-badges { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
.badge { font-size: 10px; padding: 1px 6px; border-radius: 3px; border: 1px solid var(--bg-border); background: var(--bg-elevated); color: var(--text-muted); white-space: nowrap; font-weight: 500; }
.badge-quality { color: #93c5fd; border-color: rgba(147,197,253,.2); background: rgba(147,197,253,.08); }
.badge-lang    { color: #86efac; border-color: rgba(134,239,172,.2); background: rgba(134,239,172,.08); }
.badge-cf      { color: var(--nexarr, #9b0045); border-color: rgba(155,0,69,.2); background: rgba(155,0,69,.08); }
.badge-cat     { color: var(--text-muted); }
.badge-idx     { color: var(--text-muted); font-style: italic; }
.badge-client  { color: var(--sabnzbd); border-color: rgba(245,197,24,.2); background: rgba(245,197,24,.06); }
.badge-seeds   { color: #a3e635; border-color: rgba(163,230,53,.2); background: rgba(163,230,53,.06); }
.badge-ratio   { color: #fb923c; border-color: rgba(251,146,60,.2); background: rgba(251,146,60,.06); }


/* Progress */
.dl-progress-row { display: flex; align-items: center; gap: var(--space-3); }
.dl-prog-wrap { flex: 1; height: 3px; background: var(--bg-elevated); border-radius: 99px; overflow: hidden; }
.dl-prog-bar { height: 100%; border-radius: 99px; transition: width .5s ease; }
.dl-prog-meta { font-size: 11px; color: var(--text-muted); white-space: nowrap; font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 5px; }
.sep { color: var(--bg-border); }
.eta { color: var(--text-secondary); }
.item-err { font-size: 11px; color: #ef4444; background: rgba(239,68,68,.08); border-radius: var(--radius-sm); padding: 2px 8px; }

/* ── Actions ──────────────────────────────────────────────────────────────── */
.dl-acts {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 3px; padding: var(--space-2) var(--space-3); flex-shrink: 0;
  opacity: 0; transition: opacity .15s;
}
.act-btn {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: var(--radius-sm);
  border: 1px solid var(--bg-border); background: var(--bg-elevated);
  color: var(--text-muted); cursor: pointer; transition: all .12s; flex-shrink: 0;
}
.act-btn:hover:not(:disabled) { color: var(--text-secondary); border-color: rgba(255,255,255,.2); background: var(--bg-overlay); }
.act-btn:disabled { opacity: .4; cursor: not-allowed; }
.act-top:hover:not(:disabled)    { color: var(--sabnzbd) !important; border-color: rgba(245,197,24,.35) !important; }
.act-pause:hover:not(:disabled)  { color: var(--sabnzbd) !important; border-color: rgba(245,197,24,.35) !important; }
.act-resume:hover:not(:disabled) { color: #22c55e !important; border-color: rgba(34,197,94,.35) !important; }
.act-del:hover:not(:disabled)    { color: #ef4444 !important; border-color: rgba(239,68,68,.35) !important; background: rgba(239,68,68,.06) !important; }
.act-prio:hover:not(:disabled)   { color: #a78bfa !important; border-color: rgba(167,139,250,.35) !important; }

/* Priority Dropdown */
.priority-wrap { position: relative; }
.priority-menu { position: absolute; right: 0; top: 100%; margin-top: 4px; background: var(--bg-surface); border: 1px solid var(--bg-border); border-radius: var(--radius-md); box-shadow: 0 8px 24px rgba(0,0,0,.4); z-index: 100; min-width: 90px; overflow: hidden; }
.prio-item { display: block; width: 100%; padding: 7px 12px; font-size: var(--text-xs); color: var(--text-secondary); cursor: pointer; transition: background .12s; text-align: left; border-bottom: 1px solid rgba(255,255,255,.04); }
.prio-item:last-child { border-bottom: none; }
.prio-item:hover { background: var(--bg-elevated); color: var(--text-primary); }

/* ── Batch Toolbar ────────────────────────────────────────────────────────── */
.batch-bar {
  position: fixed; bottom: 0; left: 240px; right: 0; /* left = sidebar width */
  height: 56px;
  display: flex; align-items: center; justify-content: space-between; gap: var(--space-4);
  padding: 0 var(--space-6);
  background: var(--bg-surface);
  border-top: 1px solid var(--bg-border);
  box-shadow: 0 -8px 24px rgba(0,0,0,.3);
  z-index: 50;
}
.batch-left { display: flex; align-items: center; gap: var(--space-3); }
.batch-count { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); }
.batch-actions { display: flex; align-items: center; gap: var(--space-2); }
.batch-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: var(--radius-md);
  font-size: var(--text-sm); font-weight: 500;
  cursor: pointer; transition: all .15s; white-space: nowrap;
}
.batch-pause  { background: rgba(245,197,24,.1); border: 1px solid rgba(245,197,24,.2); color: var(--sabnzbd); }
.batch-pause:hover  { background: rgba(245,197,24,.18); }
.batch-resume { background: rgba(34,197,94,.1); border: 1px solid rgba(34,197,94,.2); color: #22c55e; }
.batch-resume:hover { background: rgba(34,197,94,.18); }
.batch-del    { background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.2); color: #ef4444; }
.batch-del:hover    { background: rgba(239,68,68,.18); }
.batch-clear  { background: var(--bg-elevated); border: 1px solid var(--bg-border); color: var(--text-muted); }
.batch-clear:hover  { background: var(--bg-overlay); color: var(--text-secondary); }
.batch-top    { background: rgba(245,197,24,.08); border: 1px solid rgba(245,197,24,.2); color: var(--sabnzbd); }
.batch-top:hover    { background: rgba(245,197,24,.16); }
.batch-prio   { background: rgba(167,139,250,.08); border: 1px solid rgba(167,139,250,.2); color: #a78bfa; }
.batch-prio:hover   { background: rgba(167,139,250,.16); }
.batch-eligible { font-size: 10px; opacity: .7; }
.batch-divider { width: 1px; height: 24px; background: var(--bg-border); flex-shrink: 0; }
/* Batch Priority Dropdown */
.batch-prio-wrap { position: relative; }
.batch-prio-menu { position: absolute; bottom: calc(100% + 6px); left: 0; background: var(--bg-surface); border: 1px solid var(--bg-border); border-radius: var(--radius-md); box-shadow: 0 -8px 24px rgba(0,0,0,.4); z-index: 200; min-width: 90px; overflow: hidden; }

/* Slide-up Animation */
.batch-bar-enter-active, .batch-bar-leave-active { transition: transform .25s cubic-bezier(.4,0,.2,1); }
.batch-bar-enter-from, .batch-bar-leave-to { transform: translateY(100%); }

/* ── History ──────────────────────────────────────────────────────────────── */
.filter-bar { display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap; padding-bottom: var(--space-2); }
.filter-group { display: flex; gap: 4px; }
.filter-chip { font-size: var(--text-xs); padding: 4px 10px; border-radius: 99px; border: 1px solid var(--bg-border); background: var(--bg-elevated); color: var(--text-muted); cursor: pointer; transition: all .12s; font-weight: 500; }
.filter-chip:hover { color: var(--text-secondary); border-color: rgba(255,255,255,.2); }
.filter-chip.active { background: var(--bg-overlay); color: var(--text-primary); border-color: rgba(255,255,255,.25); }
.filter-apps { margin-left: auto; }
.hist-panel { background: var(--bg-surface); border: 1px solid var(--bg-border); border-radius: var(--radius-lg); overflow: hidden; }
.hist-row { display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-3) var(--space-5); border-bottom: 1px solid rgba(255,255,255,.03); transition: background .12s; }
.hist-row:last-child { border-bottom: none; }
.hist-row:hover { background: var(--bg-elevated); }
.hist-ev { flex-shrink: 0; width: 56px; }
.ev-badge { display: block; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-align: center; }
.ev-grab   { background: rgba(53,197,244,.12); color: var(--sonarr); border: 1px solid rgba(53,197,244,.2); }
.ev-import { background: rgba(34,197,94,.12);  color: #22c55e; border: 1px solid rgba(34,197,94,.2); }
.ev-err    { background: rgba(239,68,68,.12);  color: #ef4444; border: 1px solid rgba(239,68,68,.2); }
.ev-del    { background: rgba(245,197,24,.08); color: #ca8a04; border: 1px solid rgba(245,197,24,.15); }
.ev-idle   { background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--bg-border); }
.hist-app { flex-shrink: 0; align-self: flex-start; margin-top: 1px; }
.hist-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.hist-title { font-size: var(--text-sm); color: var(--text-secondary); font-weight: 500; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hist-nzb { font-size: 10px; color: var(--text-muted); font-family: monospace; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hist-meta { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px; }
.hist-date { font-size: 10px; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; margin-top: 2px; font-variant-numeric: tabular-nums; }
.load-more { padding: var(--space-4); text-align: center; border-top: 1px solid var(--bg-border); }
.ctrl-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 16px; border-radius: var(--radius-md); font-size: var(--text-sm); background: var(--bg-elevated); border: 1px solid var(--bg-border); color: var(--text-secondary); cursor: pointer; transition: all .15s; }
.ctrl-btn:hover { background: var(--bg-overlay); color: var(--text-primary); }

/* ── Missing ──────────────────────────────────────────────────────────────── */
.miss-section { display: flex; flex-direction: column; gap: var(--space-2); }
.miss-head { display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-3) var(--space-2) 0; }
.miss-head-left { display: flex; align-items: center; gap: var(--space-2); }
.miss-head-accent { width: 3px; height: 20px; border-radius: 2px; background: var(--c); flex-shrink: 0; }
.miss-head-icon { font-size: 16px; }
.miss-head-label { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); }
.miss-head-count { font-size: 11px; color: var(--text-muted); background: var(--bg-elevated); padding: 1px 7px; border-radius: 99px; border: 1px solid var(--bg-border); }
.search-all-btn { display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px; border-radius: var(--radius-md); font-size: var(--text-xs); font-weight: 500; border: 1px solid color-mix(in srgb, var(--btn-c) 30%, transparent); background: color-mix(in srgb, var(--btn-c) 10%, transparent); color: var(--btn-c); cursor: pointer; transition: all .12s; }
.search-all-btn:hover { background: color-mix(in srgb, var(--btn-c) 18%, transparent); }
.miss-list { display: flex; flex-direction: column; gap: 2px; }
.miss-item { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-4) var(--space-2) var(--space-3); background: var(--bg-surface); border: 1px solid var(--bg-border); border-radius: var(--radius-md); cursor: pointer; transition: background .12s; }
.miss-item:hover { background: var(--bg-elevated); }
.miss-poster { width: 38px; height: 56px; border-radius: 4px; overflow: hidden; background: var(--bg-elevated); flex-shrink: 0; border: 1px solid var(--bg-border); }
.miss-poster img { width: 100%; height: 100%; object-fit: cover; }
.miss-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 18px; }
.miss-info { flex: 1; min-width: 0; }
.miss-title { font-size: var(--text-sm); font-weight: 500; color: var(--text-secondary); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.miss-ep { font-size: 11px; color: var(--text-muted); margin: 2px 0 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.miss-sub-row { display: flex; gap: 4px; margin-top: 3px; }
.miss-btn { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: var(--radius-sm); background: var(--bg-elevated); border: 1px solid var(--bg-border); color: var(--text-muted); cursor: pointer; flex-shrink: 0; transition: all .12s; }
.miss-btn:hover:not(:disabled) { color: var(--text-primary); border-color: rgba(255,255,255,.2); }
.miss-btn:disabled { opacity: .4; cursor: not-allowed; }
.miss-btn-ok { color: #22c55e !important; border-color: rgba(34,197,94,.35) !important; background: rgba(34,197,94,.08) !important; }

/* ── Misc ─────────────────────────────────────────────────────────────────── */
.loading-list { display: flex; flex-direction: column; gap: var(--space-2); }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-16) var(--space-4); gap: var(--space-3); text-align: center; flex: 1; }
.empty-icon { font-size: 48px; }
.empty-title { font-size: var(--text-lg); color: var(--text-secondary); font-weight: 600; margin: 0; }
.empty-sub { color: var(--text-muted); font-size: var(--text-sm); margin: 0; }
.err-banner { padding: var(--space-4); background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.3); border-radius: var(--radius-md); color: #ef4444; font-size: var(--text-sm); }

@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin .8s linear infinite; }
.skeleton { background: var(--bg-elevated); animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
</style>
