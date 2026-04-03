<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useApi } from '../composables/useApi.js';
import type { TautulliActivity, TautulliStream } from '@nexarr/shared';

const { get } = useApi();

// ── Tabs ─────────────────────────────────────────────────────────────────────
const activeTab = ref<'activity' | 'history' | 'libraries' | 'graphs'>('activity');

// ══════════════════════════════ TAB: AKTIVITÄT ══════════════════════════════

const activity = ref<TautulliActivity | null>(null);
const isLoadingActivity = ref(true);
let pollTimer: ReturnType<typeof setInterval>;

async function loadActivity() {
  try { activity.value = await get<TautulliActivity>('/api/tautulli/activity'); } catch { /* */ }
  finally { isLoadingActivity.value = false; }
}

// Watch Stats (get_home_stats)
interface StatRow { title?: string; grandparent_title?: string; year?: number; play_count: number; users_watched?: number; friendly_name?: string; user?: string; platform?: string; thumb?: string; grandparent_thumb?: string; total_plays?: number; last_play?: number }
interface StatCard { stat_id: string; stat_type: string; rows: StatRow[] }
const stats = ref<StatCard[]>([]);
const isLoadingStats = ref(true);
const statRange = ref(30);

async function loadStats() {
  isLoadingStats.value = true;
  try {
    const d = await get<StatCard[]>(`/api/tautulli/stats?time_range=${statRange.value}&stats_count=5`);
    stats.value = Array.isArray(d) ? d : [];
  } catch { /* */ }
  finally { isLoadingStats.value = false; }
}

// Library Stats
interface LibRow { section_name: string; section_type: string; count: string; parent_count?: string; child_count?: string; last_accessed?: number; last_played?: string; plays?: number; duration?: number }
const libraries = ref<LibRow[]>([]);
async function loadLibrariesQuick() {
  try {
    const d = await get<{ data?: LibRow[] }>('/api/tautulli/libraries-table');
    libraries.value = d?.data ?? [];
  } catch { /* */ }
}

// Expanded streams
const expanded = ref<Set<string>>(new Set());
function toggleExpand(id: string) {
  const n = new Set(expanded.value);
  if (n.has(id)) n.delete(id); else n.add(id);
  expanded.value = n;
}

onMounted(async () => {
  await Promise.all([loadActivity(), loadStats(), loadLibrariesQuick()]);
  pollTimer = setInterval(loadActivity, 5000);
});
onUnmounted(() => clearInterval(pollTimer));

const sessions = computed<TautulliStream[]>(() => activity.value?.sessions ?? []);
const streamCount = computed(() => activity.value?.stream_count ?? 0);

// Stat card helpers
function statCard(id: string) { return stats.value.find(s => s.stat_id === id); }
function maxPlays(card?: StatCard) { return Math.max(1, ...(card?.rows ?? []).map(r => r.play_count ?? r.total_plays ?? 0)); }
function barW(val: number, max: number) { return `${Math.round((val / max) * 100)}%`; }
function statLabel(row: StatRow, id: string) {
  if (id.includes('user'))     return row.friendly_name ?? row.user ?? '–';
  if (id.includes('platform')) return row.platform ?? '–';
  if (row.grandparent_title)   return row.grandparent_title;
  return row.title ?? '–';
}
function statSub(row: StatRow, id: string) {
  if (id === 'top_tv' && row.title && row.grandparent_title) return row.title;
  if (row.year) return String(row.year);
  return '';
}
function statColor(id: string) {
  if (id.includes('movie'))     return 'var(--radarr)';
  if (id.includes('tv'))        return 'var(--sonarr)';
  if (id.includes('artist') || id.includes('music')) return 'var(--lidarr)';
  if (id.includes('user'))      return 'var(--tautulli)';
  if (id.includes('platform'))  return 'var(--plex)';
  if (id.includes('library'))   return 'var(--tautulli)';
  return 'var(--text-muted)';
}

const statCardIds = [
  { id: 'top_movies', label: 'Meistgesehene Filme', icon: '🎬', valKey: 'plays' },
  { id: 'popular_movies', label: 'Beliebteste Filme', icon: '🎬', valKey: 'users' },
  { id: 'top_tv', label: 'Meistgesehene Serien', icon: '📺', valKey: 'plays' },
  { id: 'popular_tv', label: 'Beliebteste Serien', icon: '📺', valKey: 'users' },
  { id: 'top_music', label: 'Meistgehörte Künstler', icon: '🎵', valKey: 'plays' },
  { id: 'popular_music', label: 'Beliebteste Künstler', icon: '🎵', valKey: 'users' },
  { id: 'last_watched', label: 'Kürzlich gesehen', icon: '🕐', valKey: 'plays' },
  { id: 'top_libraries', label: 'Aktivste Bibliotheken', icon: '📚', valKey: 'plays' },
  { id: 'top_users', label: 'Aktivste Nutzer', icon: '👤', valKey: 'plays' },
  { id: 'top_platforms', label: 'Aktivste Plattformen', icon: '📱', valKey: 'plays' },
  { id: 'most_concurrent', label: 'Max. gleichzeitige Streams', icon: '📊', valKey: '' },
];

// ══════════════════════════════ TAB: VERLAUF ═══════════════════════════════

interface HistEntry { reference_id?: number; row_id?: number; date: number; friendly_name: string; ip_address?: string; platform?: string; product?: string; player?: string; full_title?: string; title?: string; grandparent_title?: string; parent_title?: string; media_type: string; started?: number; paused_counter?: number; stopped?: number; play_duration?: number; transcode_decision?: string; watched_status?: number; thumb?: string; parent_media_index?: string; media_index?: string; year?: string }
const histData = ref<HistEntry[]>([]);
const histTotal = ref(0);
const histLoading = ref(false);
const histPage = ref(0);
const histSearch = ref('');
const histMediaFilter = ref('');
const histStreamFilter = ref('');
const HIST_PER_PAGE = 25;

async function loadHistory() {
  histLoading.value = true;
  try {
    const params = new URLSearchParams({
      length: String(HIST_PER_PAGE),
      start: String(histPage.value * HIST_PER_PAGE),
    });
    if (histMediaFilter.value) params.set('media_type', histMediaFilter.value);
    if (histStreamFilter.value) params.set('transcode_decision', histStreamFilter.value);
    if (histSearch.value.trim()) params.set('search', histSearch.value.trim());
    const d = await get<{ data?: HistEntry[]; recordsFiltered?: number; recordsTotal?: number }>(`/api/tautulli/history-filtered?${params}`);
    histData.value = d?.data ?? [];
    histTotal.value = d?.recordsFiltered ?? d?.recordsTotal ?? 0;
  } catch { /* */ }
  finally { histLoading.value = false; }
}

const histTotalPages = computed(() => Math.ceil(histTotal.value / HIST_PER_PAGE));

watch([histMediaFilter, histStreamFilter], () => { histPage.value = 0; loadHistory(); });

let searchTimeout: ReturnType<typeof setTimeout>;
function onSearchInput() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => { histPage.value = 0; loadHistory(); }, 400);
}

function histPrev() { if (histPage.value > 0) { histPage.value--; loadHistory(); } }
function histNext() { if (histPage.value < histTotalPages.value - 1) { histPage.value++; loadHistory(); } }

// ══════════════════════════════ TAB: BIBLIOTHEKEN ══════════════════════════

const libData = ref<LibRow[]>([]);
const libLoading = ref(false);
async function loadLibraries() {
  libLoading.value = true;
  try {
    const d = await get<{ data?: LibRow[] }>('/api/tautulli/libraries-table');
    libData.value = d?.data ?? [];
  } catch { /* */ }
  finally { libLoading.value = false; }
}

// ══════════════════════════════ TAB: GRAFIKEN ══════════════════════════════

interface ChartData { categories: string[]; series: Array<{ name: string; data: number[] }> }
const graphRange = ref(30);
const graphDaily = ref<ChartData>({ categories: [], series: [] });
const graphDow = ref<ChartData>({ categories: [], series: [] });
const graphHod = ref<ChartData>({ categories: [], series: [] });
const graphPlatforms = ref<ChartData>({ categories: [], series: [] });
const graphUsers = ref<ChartData>({ categories: [], series: [] });
const graphLoading = ref(false);

async function loadGraphs() {
  graphLoading.value = true;
  const tr = graphRange.value;
  try {
    const [dailyRaw, dow, hod, plat, users] = await Promise.allSettled([
      get<Array<{ date: string; movies: number; tv: number; music: number }>>(`/api/tautulli/plays-by-date?time_range=${tr}`),
      get<ChartData>(`/api/tautulli/plays-by-dayofweek?time_range=${tr}`),
      get<ChartData>(`/api/tautulli/plays-by-hourofday?time_range=${tr}`),
      get<ChartData>(`/api/tautulli/plays-by-top-platforms?time_range=${tr}`),
      get<ChartData>(`/api/tautulli/plays-by-top-users?time_range=${tr}`),
    ]);
    // plays-by-date gibt PlaysByDay[] zurück – in ChartData konvertieren
    if (dailyRaw.status === 'fulfilled' && Array.isArray(dailyRaw.value)) {
      const arr = dailyRaw.value;
      graphDaily.value = {
        categories: arr.map(d => d.date),
        series: [
          { name: 'TV', data: arr.map(d => d.tv) },
          { name: 'Movies', data: arr.map(d => d.movies) },
          { name: 'Music', data: arr.map(d => d.music) },
        ],
      };
    }
    if (dow.status === 'fulfilled')   graphDow.value = dow.value as ChartData ?? { categories: [], series: [] };
    if (hod.status === 'fulfilled')   graphHod.value = hod.value as ChartData ?? { categories: [], series: [] };
    if (plat.status === 'fulfilled')  graphPlatforms.value = plat.value as ChartData ?? { categories: [], series: [] };
    if (users.status === 'fulfilled') graphUsers.value = users.value as ChartData ?? { categories: [], series: [] };
  } catch { /* */ }
  finally { graphLoading.value = false; }
}

watch(graphRange, () => loadGraphs());

// Stacked bar helper
function chartMax(chart: ChartData) {
  const len = chart.categories.length;
  let max = 1;
  for (let i = 0; i < len; i++) {
    let sum = 0;
    for (const s of chart.series) sum += (s.data[i] ?? 0);
    if (sum > max) max = sum;
  }
  return max;
}

function seriesColor(name: string) {
  const n = name.toLowerCase();
  if (n === 'tv') return 'var(--tautulli)';
  if (n === 'movies') return 'var(--text-secondary)';
  if (n === 'music') return 'var(--nexarr)';
  if (n === 'direct play') return '#22c55e';
  if (n === 'direct stream') return 'var(--sonarr)';
  if (n === 'transcode') return '#ef4444';
  return 'var(--text-muted)';
}

// Tab init: load data when tab switches
watch(activeTab, (tab) => {
  if (tab === 'history' && !histData.value.length) loadHistory();
  if (tab === 'libraries' && !libData.value.length) loadLibraries();
  if (tab === 'graphs' && !graphDaily.value.categories.length) loadGraphs();
});

// ══════════════════════════════ SHARED HELPERS ═════════════════════════════

function fmtBw(kb?: number) { if (!kb) return '0 Kbps'; return kb >= 1000 ? `${(kb/1000).toFixed(1)} Mbps` : `${kb} Kbps`; }
function fmtBitrate(kb?: number) { if (!kb) return ''; return kb >= 1000 ? `${(kb/1000).toFixed(1)} Mbps` : `${kb} Kbps`; }
function fmtDur(ms: number) { const t = Math.floor(ms/1000); const h = Math.floor(t/3600); const m = Math.floor((t%3600)/60); const s = t%60; return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`; }
function fmtSec(sec?: number) { if (!sec) return '–'; const h = Math.floor(sec/3600); const m = Math.floor((sec%3600)/60); return h > 0 ? `${h}h ${m}m` : `${m}m`; }
function fmtTs(ts: number) { return new Date(ts*1000).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}); }
function fmtDate(ts: number) { return new Date(ts*1000).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'}); }
function fmtTime(ts?: number) { if (!ts) return '–'; return new Date(ts*1000).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}); }
function fmtLibDur(sec?: number) { if (!sec) return '–'; const d = Math.floor(sec/86400); const h = Math.floor((sec%86400)/3600); const m = Math.floor((sec%3600)/60); return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`; }

function mediaIcon(t: string) { return t==='movie'?'🎬':t==='episode'?'📺':t==='track'?'🎵':'▶'; }
function decLabel(d?: string) { if (!d) return 'Direct Play'; const t = d.toLowerCase(); return t==='direct play'?'Direct Play':t==='copy'?'Direct Stream':t==='transcode'?'Transcode':d; }
function decClass(d?: string) { if (!d) return 'dec-dp'; const t = d.toLowerCase(); return t==='direct play'?'dec-dp':t==='copy'?'dec-ds':t==='transcode'?'dec-tc':''; }
function stateIcon(s: string) { return s==='playing'?'▶':s==='paused'?'⏸':'⏳'; }
function stateClass(s: string) { return s==='playing'?'st-play':s==='paused'?'st-pause':'st-buf'; }
function libIcon(t: string) { return t==='movie'?'🎬':t==='show'?'📺':t==='artist'?'🎵':'📂'; }
function copyText(t: string) { window.navigator.clipboard.writeText(t).catch(()=>{}); }

function streamTitle(s: TautulliStream): string {
  if (s.media_type === 'episode' && s.grandparent_title) {
    const ep = s.parent_media_index && s.media_index ? `S${String(s.parent_media_index).padStart(2,'0')}E${String(s.media_index).padStart(2,'0')}` : '';
    return `${s.grandparent_title}${ep?' · '+ep:''} – ${s.title}`;
  }
  if (s.media_type === 'track' && s.grandparent_title) return `${s.grandparent_title} – ${s.title}`;
  return s.title + (s.year ? ` (${s.year})` : '');
}

function plexImg(key?: string, w = 200) { if (!key) return null; return `/api/tautulli/plex-image?img=${encodeURIComponent(key)}&width=${w}`; }
function channelLbl(ch?: number, layout?: string) { if (layout) return layout; if (!ch) return ''; return ch===8?'7.1':ch===6?'5.1':ch===2?'Stereo':ch===1?'Mono':`${ch}ch`; }
function locLbl(s: TautulliStream) { return s.location==='lan'?'LAN':s.location==='wan'?'WAN':s.location??''; }
</script>

<template>
<div class="sv">
  <!-- Header -->
  <div class="sv-hdr">
    <div class="sv-hdr-top">
      <div class="hdr-bar" />
      <div>
        <h1 class="sv-title">Streams<span v-if="streamCount>0" class="cnt-badge">{{ streamCount }}</span></h1>
        <p class="sv-sub">Tautulli · Plex Wiedergabe & Statistiken</p>
      </div>
    </div>
    <!-- Bandwidth (nur wenn Streams aktiv) -->
    <div v-if="activity && streamCount > 0" class="bw-row">
      <span class="bw-sum">{{ streamCount }} Stream{{ streamCount!==1?'s':'' }} ({{ activity.stream_count_direct_play }} Direct Play{{ activity.stream_count_transcode ? `, ${activity.stream_count_transcode} Transcode` : '' }}) · {{ fmtBw(activity.total_bandwidth) }}</span>
      <span class="bw-detail">LAN {{ fmtBw(activity.lan_bandwidth) }} · WAN {{ fmtBw(activity.wan_bandwidth) }}</span>
    </div>
  </div>

  <!-- Tab Bar -->
  <div class="tab-bar">
    <button v-for="t in [{k:'activity',l:'Aktivität'},{k:'history',l:'Verlauf'},{k:'libraries',l:'Bibliotheken'},{k:'graphs',l:'Grafiken'}]" :key="t.k"
      :class="['tab-btn',{active:activeTab===t.k}]" @click="activeTab=t.k as any">{{ t.l }}</button>
  </div>

  <!-- ═══════════ TAB: AKTIVITÄT ═══════════ -->
  <div v-if="activeTab==='activity'" class="tab-body">
    <!-- Active Streams -->
    <section v-if="sessions.length" class="streams-section">
      <div v-for="s in sessions" :key="s.session_id" class="sc" @click="toggleExpand(s.session_id)">
        <div class="sc-accent" />
        <div class="sc-row">
          <div class="sc-poster">
            <img v-if="plexImg(s.grandparent_thumb??s.parent_thumb??s.thumb)" :src="plexImg(s.grandparent_thumb??s.parent_thumb??s.thumb)!" loading="lazy" />
            <div v-else class="sc-ph">{{ mediaIcon(s.media_type as string) }}</div>
          </div>
          <div class="sc-info">
            <div class="sc-line1">
              <span :class="['sc-state',stateClass(s.state as string)]">{{ stateIcon(s.state as string) }}</span>
              <span class="sc-ttl">{{ streamTitle(s) }}</span>
              <span class="sc-pct">{{ s.progress_percent }}%</span>
            </div>
            <div class="sc-line2">
              <span class="sc-user">{{ s.friendly_name }}</span><span class="sep">·</span>
              <span>{{ s.player ?? s.product ?? s.platform }}</span>
              <span v-if="s.bandwidth" class="sep">·</span>
              <span v-if="s.bandwidth">{{ fmtBitrate(s.bandwidth as number) }}</span>
            </div>
            <div class="sc-badges">
              <span :class="['bdg',decClass(s.transcode_decision as string)]">{{ decLabel(s.transcode_decision as string) }}</span>
              <span v-if="s.stream_video_full_resolution||s.stream_video_resolution" class="bdg bdg-res">{{ s.stream_video_full_resolution??s.stream_video_resolution }}</span>
              <span v-if="s.stream_video_codec" class="bdg">{{ (s.stream_video_codec as string).toUpperCase() }}</span>
              <span v-if="s.video_dynamic_range||s.stream_video_dynamic_range" class="bdg bdg-hdr">{{ s.stream_video_dynamic_range??s.video_dynamic_range }}</span>
              <span v-if="s.stream_audio_codec" class="bdg">{{ (s.stream_audio_codec as string).toUpperCase() }} {{ channelLbl(s.stream_audio_channels as number,s.stream_audio_channel_layout as string) }}</span>
              <span v-if="s.subtitle_language" class="bdg bdg-sub">🗨 {{ s.subtitle_language }}</span>
              <span class="bdg bdg-loc">{{ locLbl(s) }}</span>
            </div>
            <div class="sc-prog">
              <div class="sc-prog-bar"><div class="sc-prog-fill" :style="{width:s.progress_percent+'%'}" /></div>
              <span class="sc-prog-time">{{ fmtDur(s.view_offset as number) }} / {{ fmtDur(s.duration as number) }}</span>
            </div>
          </div>
          <div class="sc-arrow"><svg :class="{open:expanded.has(s.session_id)}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></div>
        </div>
        <!-- Expanded -->
        <div v-if="expanded.has(s.session_id)" class="sc-detail" @click.stop>
          <div class="det-grid">
            <div class="det-sec">
              <h4>🎞️ Video</h4>
              <p><b>Quelle:</b> {{ s.video_codec ?? '–' }} · {{ s.video_full_resolution ?? s.video_resolution ?? '–' }}{{ s.video_dynamic_range ? ' · '+s.video_dynamic_range : '' }}{{ s.video_bitrate ? ' · '+fmtBitrate(s.video_bitrate as number) : '' }}</p>
              <p><b>Stream:</b> {{ s.stream_video_codec ?? '–' }} · {{ s.stream_video_full_resolution ?? s.stream_video_resolution ?? '–' }}{{ s.stream_video_bitrate ? ' · '+fmtBitrate(s.stream_video_bitrate as number) : '' }}</p>
              <p><b>Entscheidung:</b> <span :class="decClass(s.video_decision as string)">{{ decLabel(s.video_decision as string) }}</span></p>
            </div>
            <div class="det-sec">
              <h4>🔊 Audio</h4>
              <p><b>Quelle:</b> {{ s.audio_codec ?? '–' }}{{ s.audio_channel_layout ? ' · '+s.audio_channel_layout : '' }}{{ s.audio_language ? ' · '+s.audio_language : '' }}</p>
              <p><b>Stream:</b> {{ s.stream_audio_codec ?? '–' }}{{ s.stream_audio_channel_layout ? ' · '+s.stream_audio_channel_layout : '' }}</p>
              <p><b>Entscheidung:</b> <span :class="decClass(s.audio_decision as string)">{{ decLabel(s.audio_decision as string) }}</span></p>
            </div>
            <div v-if="s.subtitle_language||s.subtitle_codec" class="det-sec">
              <h4>🗨 Untertitel</h4>
              <p>{{ s.subtitle_language ?? '–' }} · {{ s.subtitle_codec ?? '–' }} · {{ decLabel(s.subtitle_decision as string) }}{{ s.subtitle_forced ? ' · Forced' : '' }}</p>
            </div>
            <div v-if="(s.transcode_decision as string)?.toLowerCase()==='transcode'" class="det-sec">
              <h4>⚙️ Transcode</h4>
              <p v-if="s.transcode_video_codec"><b>Video:</b> {{ s.video_codec }} → {{ s.transcode_video_codec }}</p>
              <p v-if="s.transcode_audio_codec"><b>Audio:</b> {{ s.audio_codec }} → {{ s.transcode_audio_codec }}</p>
              <p v-if="s.transcode_speed"><b>Speed:</b> {{ s.transcode_speed }}×{{ s.transcode_throttled ? ' (gedrosselt)' : '' }}</p>
              <p v-if="s.transcode_hw_decoding||s.transcode_hw_encoding"><b>HW:</b> {{ s.transcode_hw_decoding?'Dec':'–' }} / {{ s.transcode_hw_encoding?'Enc':'–' }}</p>
            </div>
            <div class="det-sec">
              <h4>📱 Player</h4>
              <p><b>Produkt:</b> {{ s.product ?? '–' }}{{ s.product_version ? ' v'+s.product_version : '' }}</p>
              <p><b>Player:</b> {{ s.player ?? '–' }}</p>
              <p><b>Plattform:</b> {{ s.platform_name ?? s.platform ?? '–' }}{{ s.platform_version ? ' '+s.platform_version : '' }}</p>
            </div>
            <div class="det-sec">
              <h4>🌐 Netzwerk</h4>
              <p><b>Standort:</b> {{ locLbl(s) }}{{ s.ip_address ? ' · '+s.ip_address : '' }}</p>
              <p v-if="s.bandwidth"><b>Bandbreite:</b> {{ fmtBitrate(s.bandwidth as number) }}</p>
              <p v-if="s.stream_bitrate"><b>Stream-Bitrate:</b> {{ fmtBitrate(s.stream_bitrate as number) }}</p>
              <p v-if="s.quality_profile"><b>Qualität:</b> {{ s.quality_profile }}</p>
              <p><b>Session:</b> <code>{{ s.session_id }}</code></p>
            </div>
          </div>
        </div>
      </div>
    </section>
    <div v-else-if="!isLoadingActivity" class="empty-mini">
      <span>📡</span> Keine aktiven Streams
    </div>

    <!-- Watch Statistics -->
    <section v-if="stats.length" class="stats-section">
      <div class="section-head">
        <h2 class="section-title">Watch Statistics</h2>
        <div class="range-pills">
          <button v-for="r in [7,30,90]" :key="r" :class="['pill',{active:statRange===r}]" @click="statRange=r;loadStats()">{{ r }}d</button>
        </div>
      </div>
      <div class="stats-grid">
        <template v-for="sc in statCardIds" :key="sc.id">
          <div v-if="statCard(sc.id)?.rows?.length" class="stat-card">
            <div class="stc-head"><span class="stc-icon">{{ sc.icon }}</span><span class="stc-label">{{ sc.label }}</span></div>
            <div class="stc-list">
              <div v-for="(row,i) in statCard(sc.id)!.rows" :key="i" class="stc-row">
                <span class="stc-rank">{{ i+1 }}</span>
                <span class="stc-name">{{ statLabel(row, sc.id) }}</span>
                <span v-if="statSub(row, sc.id)" class="stc-sub">{{ statSub(row, sc.id) }}</span>
                <div class="stc-bar-track"><div class="stc-bar-fill" :style="{width:barW(row.play_count??row.total_plays??0,maxPlays(statCard(sc.id))),background:statColor(sc.id)}" /></div>
                <span class="stc-val">{{ row.play_count ?? row.total_plays ?? row.users_watched ?? 0 }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </section>

    <!-- Library Stats (compact) -->
    <section v-if="libraries.length" class="lib-section">
      <h2 class="section-title">Library Statistics</h2>
      <div class="lib-grid">
        <div v-for="lib in libraries" :key="lib.section_name" class="lib-chip">
          <span class="lib-icon">{{ libIcon(lib.section_type) }}</span>
          <span class="lib-name">{{ lib.section_name }}</span>
          <span class="lib-count">{{ lib.count }}</span>
          <span v-if="lib.plays" class="lib-plays">{{ lib.plays }} Plays</span>
        </div>
      </div>
    </section>
  </div>

  <!-- ═══════════ TAB: VERLAUF ═══════════ -->
  <div v-if="activeTab==='history'" class="tab-body">
    <div class="filter-row">
      <div class="filter-chips">
        <button v-for="f in [{v:'',l:'Alle'},{v:'movie',l:'Filme'},{v:'episode',l:'Serien'},{v:'track',l:'Musik'}]" :key="f.v"
          :class="['chip',{active:histMediaFilter===f.v}]" @click="histMediaFilter=f.v">{{ f.l }}</button>
      </div>
      <div class="filter-chips">
        <button v-for="f in [{v:'',l:'Alle Streams'},{v:'direct play',l:'Direct Play'},{v:'copy',l:'Direct Stream'},{v:'transcode',l:'Transcode'}]" :key="f.v"
          :class="['chip',{active:histStreamFilter===f.v}]" @click="histStreamFilter=f.v">{{ f.l }}</button>
      </div>
      <input class="search-input" v-model="histSearch" @input="onSearchInput" placeholder="Suchen…" />
    </div>

    <div v-if="histLoading && !histData.length" class="skel-list"><div v-for="i in 10" :key="i" class="skel skel-row" /></div>
    <div v-else-if="!histData.length" class="empty-mini"><span>📭</span> Kein Verlauf gefunden</div>
    <div v-else class="hist-table-wrap">
      <table class="hist-table">
        <thead><tr>
          <th class="th-date">Datum</th><th>User</th><th class="th-hide">IP</th><th class="th-hide">Plattform</th><th class="th-hide">Player</th><th>Titel</th><th class="th-num">Gestartet</th><th class="th-num th-hide">Pausiert</th><th class="th-num">Dauer</th><th class="th-dot"></th>
        </tr></thead>
        <tbody>
          <tr v-for="h in histData" :key="h.reference_id??h.row_id??h.date">
            <td class="td-date">{{ fmtDate(h.date) }}</td>
            <td class="td-user">{{ h.friendly_name }}</td>
            <td class="td-ip th-hide">{{ h.ip_address ?? '–' }}</td>
            <td class="th-hide">{{ h.platform ?? '–' }}</td>
            <td class="th-hide">{{ h.player ?? '–' }}</td>
            <td class="td-title">
              <span class="td-mi">{{ mediaIcon(h.media_type) }}</span>
              {{ h.full_title ?? h.title ?? '–' }}
            </td>
            <td class="td-num">{{ fmtTime(h.started) }}</td>
            <td class="td-num th-hide">{{ h.paused_counter ? fmtSec(h.paused_counter) : '–' }}</td>
            <td class="td-num">{{ fmtSec(h.play_duration) }}</td>
            <td class="td-dot"><span :class="['dot', h.watched_status ? 'dot-ok' : 'dot-part']" /></td>
          </tr>
        </tbody>
      </table>
      <div class="pagination">
        <button class="pg-btn" :disabled="histPage===0" @click="histPrev">‹ Zurück</button>
        <span class="pg-info">Seite {{ histPage+1 }} / {{ histTotalPages }} ({{ histTotal }} Einträge)</span>
        <button class="pg-btn" :disabled="histPage>=histTotalPages-1" @click="histNext">Weiter ›</button>
      </div>
    </div>
  </div>

  <!-- ═══════════ TAB: BIBLIOTHEKEN ═══════════ -->
  <div v-if="activeTab==='libraries'" class="tab-body">
    <div v-if="libLoading && !libData.length" class="skel-list"><div v-for="i in 8" :key="i" class="skel skel-row" /></div>
    <div v-else-if="!libData.length" class="empty-mini"><span>📚</span> Keine Bibliotheken</div>
    <table v-else class="lib-table">
      <thead><tr>
        <th></th><th>Bibliothek</th><th>Typ</th><th class="th-num">Items</th><th class="th-num th-hide">Staffeln</th><th class="th-num th-hide">Episoden</th><th class="th-hide">Zuletzt gestreamt</th><th class="th-hide">Zuletzt gespielt</th><th class="th-num">Plays</th><th class="th-num th-hide">Spieldauer</th>
      </tr></thead>
      <tbody>
        <tr v-for="lib in libData" :key="lib.section_name">
          <td class="td-icon">{{ libIcon(lib.section_type) }}</td>
          <td class="td-libname">{{ lib.section_name }}</td>
          <td>{{ lib.section_type === 'movie' ? 'Film' : lib.section_type === 'show' ? 'Serie' : 'Musik' }}</td>
          <td class="td-num">{{ lib.count }}</td>
          <td class="td-num th-hide">{{ lib.parent_count ?? '–' }}</td>
          <td class="td-num th-hide">{{ lib.child_count ?? '–' }}</td>
          <td class="th-hide">{{ lib.last_accessed ? fmtTs(lib.last_accessed) : '–' }}</td>
          <td class="td-lastplayed th-hide">{{ lib.last_played ?? '–' }}</td>
          <td class="td-num td-plays">{{ lib.plays ?? 0 }}</td>
          <td class="td-num th-hide">{{ fmtLibDur(lib.duration) }}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- ═══════════ TAB: GRAFIKEN ═══════════ -->
  <div v-if="activeTab==='graphs'" class="tab-body">
    <div class="graph-head">
      <h2 class="section-title">Wiedergabe-Statistiken</h2>
      <div class="range-pills">
        <button v-for="r in [7,14,30,90]" :key="r" :class="['pill',{active:graphRange===r}]" @click="graphRange=r">{{ r }} Tage</button>
      </div>
    </div>

    <div v-if="graphLoading" class="skel-list"><div v-for="i in 3" :key="i" class="skel" style="height:140px;border-radius:8px" /></div>
    <template v-else>
      <!-- Chart Macro -->
      <template v-for="(chart, ci) in [
        { data: graphDaily, title: 'Tägliche Wiedergaben', type: 'daily' },
        { data: graphDow, title: 'Plays nach Wochentag', type: 'bar' },
        { data: graphHod, title: 'Plays nach Uhrzeit', type: 'bar' },
        { data: graphPlatforms, title: 'Plays nach Plattform (Top 10)', type: 'bar' },
        { data: graphUsers, title: 'Plays nach User (Top 10)', type: 'bar' },
      ]" :key="ci">
        <div v-if="chart.data.categories.length" class="chart-card">
          <h3 class="chart-title">{{ chart.title }}</h3>
          <div class="chart-legend">
            <span v-for="s in chart.data.series" :key="s.name" class="legend-item">
              <span class="legend-dot" :style="{background:seriesColor(s.name)}" />{{ s.name }}
            </span>
          </div>
          <div class="chart-wrap">
            <div class="chart-bars">
              <div v-for="(cat, i) in chart.data.categories" :key="cat" class="chart-col" :title="cat+': '+chart.data.series.reduce((a,s)=>a+(s.data[i]??0),0)">
                <div class="chart-stack">
                  <template v-for="s in [...chart.data.series].reverse()" :key="s.name">
                    <div v-if="(s.data[i]??0)>0" class="chart-seg" :style="{height:((s.data[i]??0)/chartMax(chart.data)*100)+'%',background:seriesColor(s.name)}" />
                  </template>
                  <div v-if="!chart.data.series.some(s=>(s.data[i]??0)>0)" class="chart-seg chart-zero" />
                </div>
                <div class="chart-label">{{ cat.length > 5 ? cat.slice(-5) : cat }}</div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</div>
</template>

<style scoped>
.sv { min-height:100%; display:flex; flex-direction:column; }

/* Header */
.sv-hdr { padding:var(--space-5) var(--space-6) var(--space-3); border-bottom:1px solid var(--bg-border); background:var(--bg-surface); }
.sv-hdr-top { display:flex; align-items:center; gap:var(--space-4); }
.hdr-bar { width:4px; height:36px; background:var(--tautulli); border-radius:2px; flex-shrink:0; }
.sv-title { font-size:var(--text-xl); font-weight:700; color:var(--text-primary); margin:0; display:flex; align-items:center; gap:var(--space-3); }
.cnt-badge { font-size:var(--text-sm); font-weight:700; padding:2px 8px; border-radius:99px; background:rgba(229,160,13,.12); color:var(--tautulli); border:1px solid rgba(229,160,13,.25); }
.sv-sub { font-size:var(--text-sm); color:var(--text-muted); margin:2px 0 0; }
.bw-row { display:flex; gap:var(--space-4); margin-top:var(--space-2); font-size:var(--text-sm); color:var(--text-muted); flex-wrap:wrap; }
.bw-sum { color:var(--text-secondary); font-weight:500; }

/* Tabs */
.tab-bar { display:flex; border-bottom:1px solid var(--bg-border); background:var(--bg-surface); padding:0 var(--space-6); }
.tab-btn { padding:var(--space-3) var(--space-5); font-size:var(--text-sm); color:var(--text-muted); border-bottom:2px solid transparent; margin-bottom:-1px; transition:all .15s; }
.tab-btn:hover { color:var(--text-secondary); }
.tab-btn.active { color:var(--text-primary); border-bottom-color:var(--tautulli); }
.tab-body { flex:1; padding:var(--space-5) var(--space-6); display:flex; flex-direction:column; gap:var(--space-5); }

/* Empty */
.empty-mini { display:flex; align-items:center; gap:var(--space-3); padding:var(--space-6); color:var(--text-muted); font-size:var(--text-sm); justify-content:center; }

/* ── Stream Cards ── */
.streams-section { display:flex; flex-direction:column; gap:var(--space-3); max-width:1000px; }
.sc { background:var(--bg-surface); border:1px solid var(--bg-border); border-radius:var(--radius-lg); overflow:hidden; cursor:pointer; transition:border-color .15s; }
.sc:hover { border-color:rgba(229,160,13,.25); }
.sc-accent { height:2px; background:var(--tautulli); }
.sc-row { display:flex; align-items:stretch; }
.sc-poster { width:75px; flex-shrink:0; background:var(--bg-elevated); overflow:hidden; display:flex; align-items:center; justify-content:center; border-right:1px solid var(--bg-border); }
.sc-poster img { width:100%; height:100%; object-fit:cover; }
.sc-ph { font-size:24px; }
.sc-info { flex:1; padding:var(--space-3) var(--space-4); display:flex; flex-direction:column; gap:var(--space-2); min-width:0; }
.sc-line1 { display:flex; align-items:center; gap:var(--space-2); }
.sc-state { font-size:10px; font-weight:600; padding:2px 6px; border-radius:4px; flex-shrink:0; }
.st-play { background:rgba(34,197,94,.12); color:#22c55e; border:1px solid rgba(34,197,94,.2); }
.st-pause { background:rgba(245,197,24,.08); color:#ca8a04; border:1px solid rgba(245,197,24,.15); }
.st-buf { background:rgba(99,102,241,.12); color:#818cf8; border:1px solid rgba(99,102,241,.2); }
.sc-ttl { font-size:var(--text-sm); font-weight:600; color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; min-width:0; }
.sc-pct { font-size:11px; color:var(--text-muted); font-variant-numeric:tabular-nums; flex-shrink:0; }
.sc-line2 { display:flex; align-items:center; gap:var(--space-2); font-size:var(--text-xs); color:var(--text-muted); flex-wrap:wrap; }
.sc-user { color:var(--tautulli); font-weight:600; }
.sep { color:var(--bg-border); }
.sc-badges { display:flex; gap:4px; flex-wrap:wrap; }
.bdg { font-size:10px; padding:1px 6px; border-radius:3px; border:1px solid var(--bg-border); background:var(--bg-elevated); color:var(--text-muted); white-space:nowrap; font-weight:500; }
.dec-dp { color:#22c55e; border-color:rgba(34,197,94,.25); background:rgba(34,197,94,.08); }
.dec-ds { color:var(--sonarr); border-color:rgba(33,147,181,.25); background:rgba(33,147,181,.08); }
.dec-tc { color:#ef4444; border-color:rgba(239,68,68,.25); background:rgba(239,68,68,.08); }
.bdg-res { color:#93c5fd; border-color:rgba(147,197,253,.2); background:rgba(147,197,253,.06); }
.bdg-hdr { color:#fbbf24; border-color:rgba(251,191,36,.2); background:rgba(251,191,36,.06); font-weight:700; }
.bdg-sub { color:#86efac; border-color:rgba(134,239,172,.2); background:rgba(134,239,172,.06); }
.bdg-loc { font-style:italic; }
.sc-prog { display:flex; align-items:center; gap:var(--space-3); }
.sc-prog-bar { flex:1; height:3px; background:var(--bg-elevated); border-radius:99px; overflow:hidden; }
.sc-prog-fill { height:100%; border-radius:99px; background:var(--tautulli); transition:width 1s ease; }
.sc-prog-time { font-size:10px; color:var(--text-muted); font-variant-numeric:tabular-nums; white-space:nowrap; }
.sc-arrow { display:flex; align-items:center; justify-content:center; width:32px; flex-shrink:0; color:var(--text-muted); border-left:1px solid var(--bg-border); }
.sc-arrow svg { transition:transform .2s; }
.sc-arrow svg.open { transform:rotate(180deg); }

/* Expanded Details */
.sc-detail { border-top:1px solid var(--bg-border); padding:var(--space-4) var(--space-5); background:rgba(0,0,0,.1); cursor:default; }
.det-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:var(--space-4); }
.det-sec h4 { font-size:12px; font-weight:600; color:var(--tautulli); margin:0 0 var(--space-2); }
.det-sec p { font-size:11px; color:var(--text-secondary); margin:2px 0; }
.det-sec b { color:var(--text-muted); font-weight:500; }
.det-sec code { font-size:10px; color:var(--text-muted); background:var(--bg-elevated); padding:1px 4px; border-radius:3px; }

/* ── Watch Statistics ── */
.section-head { display:flex; align-items:center; justify-content:space-between; }
.section-title { font-size:var(--text-md); font-weight:600; color:var(--text-secondary); margin:0; }
.range-pills { display:flex; gap:4px; }
.pill { font-size:11px; padding:3px 10px; border-radius:99px; border:1px solid var(--bg-border); background:var(--bg-elevated); color:var(--text-muted); cursor:pointer; transition:all .12s; }
.pill:hover { color:var(--text-secondary); }
.pill.active { background:var(--tautulli); color:#000; border-color:var(--tautulli); font-weight:600; }
.stats-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:var(--space-3); }
.stat-card { background:var(--bg-surface); border:1px solid var(--bg-border); border-radius:var(--radius-lg); padding:var(--space-3) var(--space-4); }
.stc-head { display:flex; align-items:center; gap:var(--space-2); margin-bottom:var(--space-3); }
.stc-icon { font-size:14px; }
.stc-label { font-size:11px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em; }
.stc-list { display:flex; flex-direction:column; gap:var(--space-2); }
.stc-row { display:grid; grid-template-columns:16px 1fr auto; grid-template-rows:auto auto; column-gap:var(--space-2); align-items:center; }
.stc-rank { font-size:10px; color:var(--text-muted); font-weight:700; grid-row:1/3; text-align:center; }
.stc-name { font-size:var(--text-sm); color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.stc-sub { font-size:10px; color:var(--text-muted); grid-column:2; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.stc-bar-track { grid-column:2; height:3px; background:var(--bg-border); border-radius:99px; overflow:hidden; margin-top:2px; }
.stc-bar-fill { height:100%; border-radius:99px; transition:width .5s ease; }
.stc-val { font-size:var(--text-xs); color:var(--text-muted); font-variant-numeric:tabular-nums; grid-row:1/3; }

/* Library chips */
.lib-section { }
.lib-grid { display:flex; gap:var(--space-2); flex-wrap:wrap; }
.lib-chip { display:flex; align-items:center; gap:var(--space-2); padding:var(--space-2) var(--space-3); background:var(--bg-surface); border:1px solid var(--bg-border); border-radius:var(--radius-md); font-size:var(--text-xs); }
.lib-icon { font-size:14px; }
.lib-name { color:var(--text-secondary); font-weight:500; }
.lib-count { color:var(--text-primary); font-weight:700; font-variant-numeric:tabular-nums; }
.lib-plays { color:var(--text-muted); }

/* ── History Tab ── */
.filter-row { display:flex; gap:var(--space-3); flex-wrap:wrap; align-items:center; }
.filter-chips { display:flex; gap:4px; }
.chip { font-size:var(--text-xs); padding:4px 10px; border-radius:99px; border:1px solid var(--bg-border); background:var(--bg-elevated); color:var(--text-muted); cursor:pointer; transition:all .12s; }
.chip:hover { color:var(--text-secondary); }
.chip.active { background:var(--bg-overlay); color:var(--text-primary); border-color:rgba(255,255,255,.25); }
.search-input { margin-left:auto; padding:5px 12px; border-radius:var(--radius-md); border:1px solid var(--bg-border); background:var(--bg-elevated); color:var(--text-secondary); font-size:var(--text-sm); width:180px; outline:none; transition:border-color .15s; }
.search-input:focus { border-color:var(--tautulli); }

.hist-table-wrap { overflow-x:auto; }
.hist-table { width:100%; border-collapse:collapse; font-size:var(--text-sm); }
.hist-table th { text-align:left; padding:var(--space-2) var(--space-3); font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:.04em; border-bottom:1px solid var(--bg-border); white-space:nowrap; }
.hist-table td { padding:var(--space-2) var(--space-3); border-bottom:1px solid rgba(255,255,255,.03); color:var(--text-secondary); white-space:nowrap; }
.hist-table tr:hover td { background:var(--bg-elevated); }
.th-num { text-align:right; }
.th-dot { width:24px; }
.td-date { color:var(--text-muted); font-variant-numeric:tabular-nums; }
.td-user { color:var(--tautulli); font-weight:500; }
.td-ip { font-family:monospace; font-size:11px; color:var(--text-muted); }
.td-title { max-width:350px; overflow:hidden; text-overflow:ellipsis; }
.td-mi { margin-right:4px; }
.td-num { text-align:right; font-variant-numeric:tabular-nums; color:var(--text-muted); }
.td-dot { text-align:center; }
.dot { display:inline-block; width:8px; height:8px; border-radius:50%; }
.dot-ok { background:#22c55e; }
.dot-part { background:var(--tautulli); opacity:.5; }
.pagination { display:flex; align-items:center; justify-content:center; gap:var(--space-4); padding:var(--space-4) 0; }
.pg-btn { padding:5px 14px; border-radius:var(--radius-md); border:1px solid var(--bg-border); background:var(--bg-elevated); color:var(--text-secondary); font-size:var(--text-sm); cursor:pointer; transition:all .12s; }
.pg-btn:hover:not(:disabled) { background:var(--bg-overlay); }
.pg-btn:disabled { opacity:.3; cursor:not-allowed; }
.pg-info { font-size:var(--text-xs); color:var(--text-muted); }

/* ── Libraries Table ── */
.lib-table { width:100%; border-collapse:collapse; font-size:var(--text-sm); }
.lib-table th { text-align:left; padding:var(--space-2) var(--space-3); font-size:11px; color:var(--text-muted); font-weight:600; text-transform:uppercase; letter-spacing:.04em; border-bottom:1px solid var(--bg-border); white-space:nowrap; }
.lib-table td { padding:var(--space-3) var(--space-3); border-bottom:1px solid rgba(255,255,255,.03); color:var(--text-secondary); }
.lib-table tr:hover td { background:var(--bg-elevated); }
.td-icon { font-size:18px; width:30px; text-align:center; }
.td-libname { font-weight:600; color:var(--text-primary); }
.td-lastplayed { max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; color:var(--text-muted); }
.td-plays { color:var(--tautulli); font-weight:600; }

/* ── Graphs ── */
.graph-head { display:flex; align-items:center; justify-content:space-between; }
.chart-card { background:var(--bg-surface); border:1px solid var(--bg-border); border-radius:var(--radius-lg); padding:var(--space-4); }
.chart-title { font-size:var(--text-sm); font-weight:600; color:var(--text-secondary); margin:0 0 var(--space-2); }
.chart-legend { display:flex; gap:var(--space-3); font-size:10px; color:var(--text-muted); margin-bottom:var(--space-3); flex-wrap:wrap; }
.legend-item { display:flex; align-items:center; gap:4px; }
.legend-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.chart-wrap { overflow-x:auto; padding-bottom:var(--space-1); }
.chart-bars { display:flex; align-items:flex-end; gap:3px; min-height:100px; min-width:min-content; }
.chart-col { display:flex; flex-direction:column; align-items:center; gap:4px; flex:1; min-width:16px; }
.chart-stack { display:flex; flex-direction:column-reverse; width:100%; gap:1px; height:100px; }
.chart-seg { width:100%; border-radius:2px 2px 0 0; min-height:1px; transition:height .4s ease; opacity:.85; }
.chart-col:hover .chart-seg { opacity:1; }
.chart-zero { background:var(--bg-border); height:2px; opacity:.4; }
.chart-label { font-size:9px; color:var(--text-muted); font-variant-numeric:tabular-nums; text-align:center; user-select:none; }

/* Responsive hide */
@media(max-width:900px) { .th-hide { display:none; } }

/* Skeleton */
.skel-list { display:flex; flex-direction:column; gap:var(--space-2); }
.skel { background:var(--bg-elevated); animation:pulse 1.5s ease-in-out infinite; }
.skel-row { height:44px; border-radius:var(--radius-md); }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
</style>
