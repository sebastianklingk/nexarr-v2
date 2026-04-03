<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '../composables/useApi.js';
import { useMoviesStore } from '../stores/movies.store.js';
import { useSeriesStore } from '../stores/series.store.js';
import { useMusicStore } from '../stores/music.store.js';
import { posterUrl as getPosterUrl } from '../utils/images.js';
import { getPlatformIcon } from '../utils/platformIcons.js';
import MediaIcon from '../components/ui/MediaIcon.vue';
import type { TautulliActivity, TautulliStream } from '@nexarr/shared';

const { get } = useApi();
const router = useRouter();
const moviesStore = useMoviesStore();
const seriesStore = useSeriesStore();
const musicStore  = useMusicStore();

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
interface StatRow { title?: string; grandparent_title?: string; year?: number; play_count: number; users_watched?: number; friendly_name?: string; user?: string; platform?: string; thumb?: string; grandparent_thumb?: string; total_plays?: number; last_play?: number; count?: number; media_type?: string; rating_key?: string; user_thumb?: string }
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

// (expand feature removed – all info shown directly on card)

onMounted(async () => {
  await Promise.all([
    loadActivity(), loadStats(), loadLibrariesQuick(),
    moviesStore.fetchMovies(), seriesStore.fetchSeries(), musicStore.fetchArtists(),
  ]);
  pollTimer = setInterval(loadActivity, 5000);
});
onUnmounted(() => clearInterval(pollTimer));

const sessions = computed<TautulliStream[]>(() => activity.value?.sessions ?? []);
const streamCount = computed(() => activity.value?.stream_count ?? 0);

// Stat card helpers
function statCard(id: string) { return stats.value.find(s => s.stat_id === id); }
function maxPlays(card?: StatCard) { return Math.max(1, ...(card?.rows ?? []).map(r => r.play_count ?? r.total_plays ?? r.count ?? 0)); }
function barW(val: number, max: number) { return `${Math.round((val / max) * 100)}%`; }
function statVal(row: StatRow, id: string): number | string {
  // most_concurrent: count-Feld statt play_count
  if (id === 'most_concurrent') return row.count ?? row.play_count ?? 0;
  // last_watched: kein Count, zeige friendly_name
  if (id === 'last_watched') return row.friendly_name ?? row.user ?? '';
  // popular: users_watched
  if (id.includes('popular')) return row.users_watched ?? row.play_count ?? 0;
  return row.play_count ?? row.total_plays ?? 0;
}
function statLabel(row: StatRow, id: string) {
  if (id.includes('user'))     return row.friendly_name ?? row.user ?? '–';
  if (id.includes('platform')) return row.platform ?? '–';
  if (id === 'most_concurrent') return row.title ?? '–';
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

// Bibliotheks-Abgleich: Tautulli-Titel → Library-Item mit Poster + Route
interface ResolvedItem { route: string; poster: string | null }

// Normalisierung für besseres Matching (Sonderzeichen, „–“ → „-“, trim)
function norm(s: string) { return s.toLowerCase().replace(/[^a-z0-9à-ÿöäüß]/g, '').trim(); }

const movieMap = computed(() => {
  const m = new Map<string, ResolvedItem>();
  for (const movie of moviesStore.movies) {
    m.set(norm(movie.title), {
      route: `/movies/${movie.id}`,
      poster: getPosterUrl(movie.images, 'w92') ?? null,
    });
  }
  return m;
});

const seriesMap = computed(() => {
  const m = new Map<string, ResolvedItem>();
  for (const s of seriesStore.series) {
    m.set(norm(s.title), {
      route: `/series/${s.id}`,
      poster: getPosterUrl(s.images as any, 'w92') ?? null,
    });
  }
  return m;
});

const artistMap = computed(() => {
  const m = new Map<string, ResolvedItem>();
  for (const a of musicStore.artists) {
    m.set(norm(a.artistName), {
      route: `/music/${a.id}`,
      poster: getPosterUrl(a.images as any, 'w92') ?? null,
    });
  }
  return m;
});

function resolveStatItem(row: StatRow, statId: string): ResolvedItem | null {
  const title = norm(row.grandparent_title ?? row.title ?? '');
  if (!title) return null;

  if (statId.includes('movie')) return movieMap.value.get(title) ?? null;
  if (statId.includes('tv'))    return seriesMap.value.get(title) ?? null;
  if (statId.includes('music')) return artistMap.value.get(title) ?? null;
  if (statId.includes('librar')) {
    // Libraries können Filme ODER Serien sein – beides probieren
    return movieMap.value.get(title) ?? seriesMap.value.get(title) ?? artistMap.value.get(title) ?? null;
  }

  // last_watched: anhand media_type entscheiden
  if (statId === 'last_watched') {
    if (row.media_type === 'movie')   return movieMap.value.get(norm(row.title ?? '')) ?? null;
    if (row.media_type === 'episode') return seriesMap.value.get(norm(row.grandparent_title ?? '')) ?? null;
    if (row.media_type === 'track')   return artistMap.value.get(norm(row.grandparent_title ?? row.title ?? '')) ?? null;
  }
  return null;
}

function navigateStat(row: StatRow, id: string) {
  const resolved = resolveStatItem(row, id);
  if (resolved) { router.push(resolved.route); return; }
  // Fallback: Suche
  const title = row.grandparent_title ?? row.title;
  if (title && (id.includes('movie') || id.includes('tv') || id.includes('music') || id === 'last_watched' || id.includes('librar')))
    router.push(`/search?q=${encodeURIComponent(title)}`);
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

  <!-- Library Stats Bar (im Header, über Tabs) -->
  <div v-if="libraries.length" class="lib-bar">
    <div v-for="lib in libraries" :key="lib.section_name" class="lib-chip">
      <span class="lib-icon">{{ libIcon(lib.section_type) }}</span>
      <span class="lib-name">{{ lib.section_name }}</span>
      <span class="lib-count">{{ lib.count }}</span>
      <span v-if="lib.plays" class="lib-plays">· {{ lib.plays }} Plays</span>
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
      <div v-for="s in sessions" :key="s.session_id" class="sc">
        <div class="sc-accent" />
        <div class="sc-row">
          <!-- Poster -->
          <div class="sc-poster">
            <img v-if="plexImg(s.grandparent_thumb??s.parent_thumb??s.thumb,300)" :src="plexImg(s.grandparent_thumb??s.parent_thumb??s.thumb,300)!" loading="lazy" />
            <div v-else class="sc-ph">{{ mediaIcon(s.media_type as string) }}</div>
          </div>

          <!-- Info Grid (Tautulli-Style Label:Value) -->
          <div class="sc-info">
            <div class="sc-info-grid">
              <span class="sc-lbl">PRODUCT</span><span class="sc-val">{{ s.product ?? '–' }}{{ s.product_version ? ' v'+s.product_version : '' }}</span>
              <span class="sc-lbl">PLAYER</span><span class="sc-val">{{ s.player ?? '–' }}{{ s.platform_name && s.platform_name !== s.player ? ' ('+s.platform_name+(s.platform_version?' '+s.platform_version:'')+')' : '' }}</span>
              <span class="sc-lbl">QUALITY</span><span class="sc-val">{{ s.quality_profile ?? 'Original' }}{{ s.video_bitrate ? ` (${fmtBitrate(s.video_bitrate as number)})` : s.stream_bitrate ? ` (${fmtBitrate(s.stream_bitrate as number)})` : '' }}</span>
              <span class="sc-lbl sc-lbl-gap">STREAM</span><span class="sc-val">{{ decLabel(s.transcode_decision as string) }}</span>
              <span class="sc-lbl">CONTAINER</span><span class="sc-val">{{ decLabel(s.stream_container_decision as string) }}{{ s.stream_container ? ` (${(s.stream_container as string).toUpperCase()})` : '' }}</span>
              <span v-if="s.media_type!=='track'" class="sc-lbl">VIDEO</span>
              <span v-if="s.media_type!=='track'" class="sc-val">{{ decLabel(s.video_decision as string) }} ({{ s.stream_video_codec ?? s.video_codec ?? '–' }} {{ s.stream_video_full_resolution ?? s.stream_video_resolution ?? s.video_resolution ?? '' }}{{ s.video_dynamic_range ? ' '+s.video_dynamic_range : '' }})</span>
              <span class="sc-lbl">AUDIO</span><span class="sc-val">{{ decLabel(s.audio_decision as string) }} ({{ s.audio_language ?? '' }}{{ s.audio_language && s.stream_audio_codec ? ' - ' : '' }}{{ s.stream_audio_codec ?? s.audio_codec ?? '–' }} {{ channelLbl(s.stream_audio_channels as number, s.stream_audio_channel_layout as string) }})</span>
              <span v-if="s.media_type!=='track'" class="sc-lbl">SUBTITLE</span>
              <span v-if="s.media_type!=='track'" class="sc-val">{{ s.subtitle_language ? decLabel(s.subtitle_decision as string) + ' (' + s.subtitle_language + (s.subtitle_codec ? ' - ' + (s.subtitle_codec as string).toUpperCase() : '') + ')' : 'None' }}</span>
              <!-- Transcode-Details (nur bei Transcode, untereinander) -->
              <template v-if="(s.transcode_decision as string)?.toLowerCase()==='transcode'">
                <span class="sc-lbl sc-lbl-gap">TRANSCODE</span>
                <span class="sc-val sc-val-wrap">
                  <span v-if="s.transcode_video_codec" class="tc-line">Video: {{ s.video_codec }} → {{ s.transcode_video_codec }}</span>
                  <span v-if="s.transcode_audio_codec" class="tc-line">Audio: {{ s.audio_codec }} → {{ s.transcode_audio_codec }}</span>
                  <span v-if="s.transcode_speed" class="tc-line">Speed: {{ s.transcode_speed }}×{{ s.transcode_throttled ? ' (gedrosselt)' : '' }}</span>
                  <span v-if="s.transcode_hw_decoding||s.transcode_hw_encoding" class="tc-line tc-hw">{{ s.transcode_hw_decoding ? 'HW-Dec' : '' }}{{ s.transcode_hw_decoding && s.transcode_hw_encoding ? ' · ' : '' }}{{ s.transcode_hw_encoding ? 'HW-Enc' : '' }}</span>
                </span>
              </template>
              <span class="sc-lbl sc-lbl-gap">LOCATION</span><span class="sc-val">🔒 {{ locLbl(s) }}{{ s.ip_address ? ': '+s.ip_address : '' }}</span>
              <span class="sc-lbl">BANDWIDTH</span><span class="sc-val">{{ fmtBw(s.bandwidth as number) }}{{ s.stream_bitrate && s.stream_bitrate !== s.bandwidth ? ' (Stream: '+fmtBitrate(s.stream_bitrate as number)+')' : '' }}</span>
            </div>
            <!-- Progress (rechts oben) -->
            <div class="sc-eta">
              <span class="sc-prog-time">{{ fmtDur(s.view_offset as number) }} / {{ fmtDur(s.duration as number) }}</span>
            </div>
            <!-- Progress Bar -->
            <div class="sc-prog">
              <div class="sc-prog-bar"><div class="sc-prog-fill" :style="{width:s.progress_percent+'%'}" /></div>
            </div>
          </div>
        </div>

        <!-- Bottom: Title + User -->
        <div class="sc-bottom">
          <span :class="['sc-state-icon',stateClass(s.state as string)]">{{ stateIcon(s.state as string) }}</span>
          <div class="sc-bottom-info">
            <p class="sc-ttl">{{ streamTitle(s) }}</p>
            <p v-if="s.media_type==='episode'" class="sc-ep">📺 S{{ String(s.parent_media_index??'').padStart(2,'0') }} · E{{ String(s.media_index??'').padStart(2,'0') }}</p>
            <p v-if="s.media_type==='track' && s.parent_title" class="sc-ep">🎵 {{ s.parent_title }}</p>
          </div>
          <div class="sc-bottom-user">
            <span class="sc-user-name">{{ s.friendly_name }}</span>
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
              <div v-for="(row,i) in statCard(sc.id)!.rows" :key="i"
                :class="['stc-row', { 'stc-clickable': sc.id.includes('movie')||sc.id.includes('tv')||sc.id.includes('music')||sc.id==='last_watched'||sc.id.includes('librar') }]"
                @click="navigateStat(row, sc.id)">
                <span class="stc-rank">{{ i+1 }}</span>
                <div class="stc-poster" :class="{ 'stc-poster-round': sc.id.includes('user') || sc.id.includes('platform') }">
                  <img v-if="resolveStatItem(row, sc.id)?.poster" :src="resolveStatItem(row, sc.id)!.poster!" loading="lazy" />
                  <img v-else-if="row.user_thumb" :src="row.user_thumb" loading="lazy" class="stc-avatar" />
                  <span v-else-if="getPlatformIcon(row.platform)" class="stc-plat-icon" v-html="getPlatformIcon(row.platform)" />
                  <img v-else-if="plexImg(row.grandparent_thumb ?? row.thumb)" :src="plexImg(row.grandparent_thumb ?? row.thumb)!" loading="lazy" />
                  <span v-else class="stc-poster-ph">{{ sc.icon }}</span>
                </div>
                <div class="stc-content">
                  <span class="stc-name">{{ statLabel(row, sc.id) }}</span>
                  <span v-if="statSub(row, sc.id)" class="stc-sub">{{ statSub(row, sc.id) }}</span>
                  <div class="stc-bar-track"><div class="stc-bar-fill" :style="{width:barW(Number(statVal(row,sc.id))||0,maxPlays(statCard(sc.id))),background:statColor(sc.id)}" /></div>
                </div>
                <span class="stc-val">{{ statVal(row, sc.id) }}</span>
              </div>
            </div>
          </div>
        </template>
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

/* Library Bar (Header) */
.lib-bar {
  display:flex; gap:var(--space-2); flex-wrap:wrap; padding:var(--space-2) var(--space-6);
  background:var(--bg-surface); border-bottom:1px solid var(--bg-border);
}
.lib-chip { display:flex; align-items:center; gap:var(--space-2); padding:2px var(--space-3); background:var(--bg-elevated); border:1px solid var(--bg-border); border-radius:var(--radius-sm); font-size:11px; }
.lib-icon { font-size:12px; }
.lib-name { color:var(--text-secondary); font-weight:500; }
.lib-count { color:var(--text-primary); font-weight:700; font-variant-numeric:tabular-nums; }
.lib-plays { color:var(--text-muted); }

/* Tabs */
.tab-bar { display:flex; border-bottom:1px solid var(--bg-border); background:var(--bg-surface); padding:0 var(--space-6); }
.tab-btn { padding:var(--space-3) var(--space-5); font-size:var(--text-sm); color:var(--text-muted); border-bottom:2px solid transparent; margin-bottom:-1px; transition:all .15s; }
.tab-btn:hover { color:var(--text-secondary); }
.tab-btn.active { color:var(--text-primary); border-bottom-color:var(--tautulli); }
.tab-body { flex:1; padding:var(--space-5) var(--space-6); display:flex; flex-direction:column; gap:var(--space-5); }

/* Empty */
.empty-mini { display:flex; align-items:center; gap:var(--space-3); padding:var(--space-6); color:var(--text-muted); font-size:var(--text-sm); justify-content:center; }

/* ── Stream Cards ── */
.streams-section { display:grid; grid-template-columns:repeat(auto-fill,minmax(480px,1fr)); gap:var(--space-3); }
.sc { background:var(--bg-surface); border:1px solid var(--bg-border); border-radius:var(--radius-lg); overflow:hidden; transition:border-color .15s; }
.sc:hover { border-color:rgba(229,160,13,.25); }
.sc-accent { height:2px; background:var(--tautulli); }
.sc-row { display:flex; align-items:stretch; }
.sc-poster { width:140px; min-height:140px; flex-shrink:0; background:var(--bg-elevated); overflow:hidden; display:flex; align-items:center; justify-content:center; border-right:1px solid var(--bg-border); }
.sc-poster img { width:100%; height:100%; object-fit:cover; }
.sc-ph { font-size:32px; }
.sc-info { flex:1; padding:var(--space-3) var(--space-4); display:flex; flex-direction:column; gap:var(--space-2); min-width:0; position:relative; }

/* Tautulli-style label:value grid */
.sc-info-grid { display:grid; grid-template-columns:auto 1fr; gap:1px var(--space-4); align-items:baseline; }
.sc-lbl { font-size:10px; font-weight:600; color:var(--text-muted); letter-spacing:.05em; white-space:nowrap; padding:1px 0; }
.sc-lbl-gap { margin-top:var(--space-2); }
.sc-val { font-size:var(--text-sm); color:var(--text-secondary); padding:1px 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sc-val-wrap { white-space:normal; display:flex; flex-direction:column; gap:1px; }
.tc-line { font-size:12px; color:var(--text-secondary); }
.tc-hw { color:#a78bfa; font-weight:600; }
.sc-eta { position:absolute; top:var(--space-3); right:var(--space-4); text-align:right; }
.sc-prog { display:flex; align-items:center; gap:var(--space-3); margin-top:auto; }
.sc-prog-bar { flex:1; height:3px; background:var(--bg-elevated); border-radius:99px; overflow:hidden; }
.sc-prog-fill { height:100%; border-radius:99px; background:var(--tautulli); transition:width 1s ease; }
.sc-prog-time { font-size:11px; color:var(--text-muted); font-variant-numeric:tabular-nums; white-space:nowrap; }

/* Bottom: Title + User */
.sc-bottom { display:flex; align-items:center; gap:var(--space-3); padding:var(--space-2) var(--space-4); border-top:1px solid var(--bg-border); background:var(--bg-elevated); }
.sc-state-icon { font-size:14px; flex-shrink:0; }
.st-play { color:#22c55e; }
.st-pause { color:#ca8a04; }
.st-buf { color:#818cf8; }
.sc-bottom-info { flex:1; min-width:0; }
.sc-ttl { font-size:var(--text-sm); font-weight:600; color:var(--text-secondary); margin:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sc-ep { font-size:11px; color:var(--text-muted); margin:1px 0 0; }
.sc-bottom-user { flex-shrink:0; display:flex; align-items:center; gap:var(--space-2); }
.sc-user-name { font-size:var(--text-xs); color:var(--tautulli); font-weight:600; }

/* Decision text colors */
.dec-dp { color:#22c55e; } .dec-ds { color:var(--sonarr); } .dec-tc { color:#ef4444; }

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
.stc-row { display:flex; align-items:center; gap:var(--space-2); padding:3px 4px; border-radius:var(--radius-sm); transition:background .1s; }
.stc-clickable { cursor:pointer; }
.stc-clickable:hover { background:var(--bg-elevated); }
.stc-rank { font-size:10px; color:var(--text-muted); font-weight:700; width:16px; text-align:center; flex-shrink:0; }
.stc-poster { width:28px; height:40px; border-radius:3px; overflow:hidden; background:var(--bg-elevated); border:1px solid var(--bg-border); flex-shrink:0; display:flex; align-items:center; justify-content:center; }
.stc-poster img { width:100%; height:100%; object-fit:cover; }
.stc-poster-round { border-radius:50%; width:32px; height:32px; }
.stc-avatar { border-radius:50%; }
.stc-plat-icon { width:18px; height:18px; color:var(--text-muted); display:flex; align-items:center; justify-content:center; }
.stc-plat-icon :deep(svg) { width:18px; height:18px; }
.stc-poster-ph { font-size:12px; }
.stc-content { flex:1; min-width:0; display:flex; flex-direction:column; gap:1px; }
.stc-name { font-size:var(--text-sm); color:var(--text-secondary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.stc-clickable .stc-name { color:var(--text-primary); }
.stc-sub { font-size:10px; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.stc-bar-track { height:3px; background:var(--bg-border); border-radius:99px; overflow:hidden; margin-top:2px; }
.stc-bar-fill { height:100%; border-radius:99px; transition:width .5s ease; }
.stc-val { font-size:var(--text-xs); color:var(--text-muted); font-variant-numeric:tabular-nums; flex-shrink:0; min-width:24px; text-align:right; }

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
