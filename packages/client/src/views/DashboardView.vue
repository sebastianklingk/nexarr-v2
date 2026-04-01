<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useMoviesStore } from '../stores/movies.store.js';
import { useSeriesStore } from '../stores/series.store.js';
import { useMusicStore } from '../stores/music.store.js';
import { useQueueStore } from '../stores/queue.store.js';
import { useGotifyStore } from '../stores/gotify.store.js';
import { useApi } from '../composables/useApi.js';
import type { TautulliStream, OverseerrRequest } from '@nexarr/shared';

const router  = useRouter();
const movies  = useMoviesStore();
const series  = useSeriesStore();
const music   = useMusicStore();
const queue   = useQueueStore();
const gotify  = useGotifyStore();
const { get } = useApi();

// ── Uhr ──────────────────────────────────────────────────────────────────────
const now = ref(new Date());
let clockTimer: ReturnType<typeof setInterval>;
const timeStr = computed(() => now.value.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
const dateStr = computed(() => now.value.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));

// ── Integration Health ────────────────────────────────────────────────────────
interface IntegStatus { name: string; status: 'online' | 'offline' | 'unconfigured'; version: string | null; url: string | null }
const integrations = ref<IntegStatus[]>([]);
async function loadIntegrations() {
  try { integrations.value = await get<IntegStatus[]>('/api/system/integrations'); } catch { /* */ }
}
const integMeta: Record<string, { label: string; color: string }> = {
  radarr:    { label: 'Radarr',    color: 'var(--radarr)' },
  sonarr:    { label: 'Sonarr',    color: 'var(--sonarr)' },
  lidarr:    { label: 'Lidarr',    color: 'var(--lidarr)' },
  prowlarr:  { label: 'Prowlarr',  color: 'var(--prowlarr)' },
  sabnzbd:   { label: 'SABnzbd',   color: 'var(--sabnzbd)' },
  tautulli:  { label: 'Tautulli',  color: 'var(--tautulli)' },
  overseerr: { label: 'Overseerr', color: 'var(--overseerr)' },
  bazarr:    { label: 'Bazarr',    color: 'var(--bazarr)' },
  gotify:    { label: 'Gotify',    color: 'var(--gotify)' },
  plex:      { label: 'Plex',      color: 'var(--plex)' },
  abs:       { label: 'ABS',       color: '#F0A500' },
}

// ── Tautulli ──────────────────────────────────────────────────────────────────
interface TautulliMini { stream_count: number; total_bandwidth: number; wan_bandwidth: number; lan_bandwidth: number; sessions: TautulliStream[] }
const tautulli = ref<TautulliMini | null>(null);
interface TautulliHomeStat { stat_id: string; stat_title: string; rows: Array<{ title: string; grandparent_title?: string; total_plays: number; users_watched?: number; last_play?: number }> }
const tautulliStats = ref<TautulliHomeStat[]>([]);
interface HistoryItem { row_id: number; title: string; parent_title?: string; grandparent_title?: string; full_title?: string; action: string; date: number; media_type: string; thumb?: string; quality?: string; file_size?: number; friendly_name?: string }
const history = ref<HistoryItem[]>([]);

async function loadTautulli() {
  try { tautulli.value = await get<TautulliMini>('/api/tautulli/activity'); } catch { /* */ }
}
async function loadTautulliStats() {
  try {
    const r = await get<{ response?: { data?: TautulliHomeStat[] } }>('/api/tautulli/stats');
    tautulliStats.value = (r as any)?.response?.data ?? (r as any) ?? [];
  } catch { /* */ }
}
async function loadHistory() {
  try {
    const r = await get<any>('/api/tautulli/history');
    history.value = (r?.data?.data ?? r?.data ?? []).slice(0, 15);
  } catch { /* */ }
}

// ── Overseerr ─────────────────────────────────────────────────────────────────
const requests = ref<OverseerrRequest[]>([]);
async function loadOverseerr() {
  try { requests.value = await get<OverseerrRequest[]>('/api/overseerr/requests?filter=pending&take=8'); } catch { /* */ }
}

// ── Plex ──────────────────────────────────────────────────────────────────────
interface PlexSession { key: string; title: string; grandparentTitle?: string; type: string; User?: { title: string }; Player?: { title: string; platform: string }; viewOffset?: number; duration?: number; thumb?: string }
const plexSessions = ref<PlexSession[]>([]);
const plexConfigured = ref(true);
async function loadPlex() {
  try {
    const r = await get<PlexSession[]>('/api/plex/sessions');
    plexSessions.value = r ?? [];
  } catch (e: any) {
    if (e?.status === 503) plexConfigured.value = false;
  }
}

// ── ABS ───────────────────────────────────────────────────────────────────────
interface ABSLib { id: string; name: string; mediaType: string }
const absLibs = ref<ABSLib[]>([]);
const absConfigured = ref(true);
async function loadAbs() {
  try {
    const r = await get<ABSLib[]>('/api/abs/libraries');
    absLibs.value = r ?? [];
  } catch (e: any) {
    if (e?.status === 503) absConfigured.value = false;
  }
}

// ── Prowlarr ──────────────────────────────────────────────────────────────────
interface Indexer { id: number; name: string; enable: boolean; protocol: string }
const indexers = ref<Indexer[]>([]);
async function loadProwlarr() {
  try { indexers.value = (await get<Indexer[]>('/api/prowlarr/indexers')) ?? []; } catch { /* */ }
}
const enabledIndexers = computed(() => indexers.value.filter(i => i.enable).length);

// ── Kalender (7 Tage) ─────────────────────────────────────────────────────────
interface CalItem { id: number; title: string; type: 'movie'|'episode'|'album'; date: string; seriesTitle?: string; posterUrl?: string }
const upcoming = ref<CalItem[]>([]);
async function loadCalendar() {
  try {
    const start = new Date().toISOString().slice(0, 10);
    const end   = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const d = await get<{ radarr: any[]; sonarr: any[]; lidarr: any[] }>(`/api/calendar?start=${start}&end=${end}`);
    const items: CalItem[] = [];
    for (const m of d.radarr ?? []) items.push({ id: m.id, title: m.title, type: 'movie', date: m.digitalRelease ?? m.physicalRelease ?? m.inCinemas ?? '', posterUrl: m.images?.find((i:any) => i.coverType === 'poster')?.remoteUrl });
    for (const e of d.sonarr ?? []) items.push({ id: e.seriesId ?? e.id, title: e.title, type: 'episode', date: e.airDate ?? '', seriesTitle: e.series?.title });
    for (const a of d.lidarr ?? []) items.push({ id: a.id, title: a.title, type: 'album', date: a.releaseDate ?? '' });
    upcoming.value = items.filter(i => i.date).sort((a,b) => a.date.localeCompare(b.date)).slice(0, 12);
  } catch { /* */ }
}

// ── Zuletzt hinzugefügt ───────────────────────────────────────────────────────
const recentFilter = ref<'all'|'movies'|'series'|'music'>('all');
const recentlyAdded = computed(() => {
  const items: Array<{ id: number; title: string; type: string; added: string; posterUrl?: string; color: string; route: string }> = [];
  if (recentFilter.value !== 'series' && recentFilter.value !== 'music') {
    for (const m of movies.movies) if (m.added) items.push({ id: m.id, title: m.title, type: 'movie', added: m.added, posterUrl: m.images?.find(i => i.coverType === 'poster')?.remoteUrl, color: 'var(--radarr)', route: `/movies/${m.id}` });
  }
  if (recentFilter.value !== 'movies' && recentFilter.value !== 'music') {
    for (const s of series.series) if (s.added) items.push({ id: s.id, title: s.title, type: 'series', added: s.added, posterUrl: s.images?.find(i => i.coverType === 'poster')?.remoteUrl, color: 'var(--sonarr)', route: `/series/${s.id}` });
  }
  if (recentFilter.value !== 'movies' && recentFilter.value !== 'series') {
    for (const a of music.artists) if (a.added) items.push({ id: a.id, title: a.artistName, type: 'music', added: a.added, posterUrl: a.images?.find(i => i.coverType === 'poster')?.remoteUrl, color: 'var(--lidarr)', route: `/music/${a.id}` });
  }
  return items.sort((a,b) => b.added.localeCompare(a.added)).slice(0, 28);
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function nav(r: string) { router.push(r); }
function fmtDate(iso?: string): string { if (!iso) return ''; return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }); }
function fmtBytes(b?: number): string { if (!b) return ''; const g = b/1024/1024/1024; return g >= 1 ? `${g.toFixed(1)} GB` : `${(b/1024/1024).toFixed(0)} MB`; }
function fmtBandwidth(kb: number): string { if (kb === 0) return '0 Mbps'; if (kb > 1000) return `${(kb/1000).toFixed(1)} Mbps`; return `${kb} Kbps`; }
function plexProgress(s: PlexSession): number { if (!s.duration || !s.viewOffset) return 0; return Math.round((s.viewOffset / s.duration) * 100); }
function historyIcon(type: string) { return type === 'movie' ? '🎬' : type === 'episode' ? '📺' : '🎵'; }
function integColor(status: string) { return status === 'online' ? 'var(--status-success)' : status === 'offline' ? 'var(--status-error)' : 'var(--text-muted)'; }
const speedLabel = computed(() => { const s = queue.sabnzbd?.speedMbs ?? 0; if (s === 0) return queue.sabnzbd?.paused ? 'Pausiert' : 'Bereit'; return s < 1 ? `${(s*1024).toFixed(0)} KB/s` : `${s.toFixed(1)} MB/s`; });

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  clockTimer = setInterval(() => { now.value = new Date(); }, 60000);
  queue.subscribe();
  await Promise.allSettled([
  movies.fetchMovies(), series.fetchSeries(), music.fetchArtists(), music.fetchAlbums(),
    loadIntegrations(), loadTautulli(), loadTautulliStats(),
    loadOverseerr(), loadPlex(), loadAbs(), loadProwlarr(),
    loadCalendar(), loadHistory(),
  ]);
});
onUnmounted(() => { clearInterval(clockTimer); queue.unsubscribe(); });
</script>

<template>
  <div class="dashboard">

    <!-- ── Header ────────────────────────────────────────────────────── -->
    <div class="dash-header">
      <div>
        <h1 class="dash-title">Dashboard</h1>
        <p class="dash-sub">{{ dateStr }}</p>
      </div>
      <div class="dash-right">
        <div class="dash-time">{{ timeStr }}</div>
      </div>
    </div>

    <!-- ── Integration Health Bar ─────────────────────────────────────── -->
    <div class="health-bar">
      <div
        v-for="integ in integrations"
        :key="integ.name"
        class="health-chip"
        :title="`${integMeta[integ.name]?.label ?? integ.name} – ${integ.status}${integ.version ? ' v'+integ.version : ''}`"
      >
        <span class="health-dot" :style="{ background: integColor(integ.status) }" />
        <span class="health-label" :style="{ color: integ.status === 'online' ? integMeta[integ.name]?.color : 'var(--text-muted)' }">
          {{ integMeta[integ.name]?.label ?? integ.name }}
        </span>
        <span v-if="integ.version" class="health-ver">v{{ integ.version }}</span>
      </div>
    </div>

    <!-- ── Stat Cards ─────────────────────────────────────────────────── -->
    <div class="stats-grid">
      <button class="stat-card" style="--c:var(--radarr)" @click="nav('/movies')">
        <div class="sc-icon">🎬</div>
        <div class="sc-body">
          <div class="sc-label">Filme</div>
          <div class="sc-num"><span v-if="movies.isLoading" class="skel" />
            <span v-else>{{ movies.stats.total.toLocaleString('de-DE') }}</span></div>
          <div class="sc-meta">
            <span class="sc-ok">{{ movies.stats.available.toLocaleString('de-DE') }} ✓</span>
            <span class="sc-miss">{{ movies.stats.missing.toLocaleString('de-DE') }} ✗</span>
          </div>
        </div>
        <span class="sc-arr">›</span>
      </button>

      <button class="stat-card" style="--c:var(--sonarr)" @click="nav('/series')">
        <div class="sc-icon">📺</div>
        <div class="sc-body">
          <div class="sc-label">Serien</div>
          <div class="sc-num"><span v-if="series.isLoading" class="skel" />
            <span v-else>{{ series.stats.total.toLocaleString('de-DE') }}</span></div>
          <div class="sc-meta">
            <span style="color:var(--status-success)">{{ series.stats.continuing }} ▶</span>
            <span style="color:var(--text-muted)">{{ series.stats.ended }} ■</span>
          </div>
        </div>
        <span class="sc-arr">›</span>
      </button>

      <button class="stat-card" style="--c:var(--lidarr)" @click="nav('/music')">
        <div class="sc-icon">🎵</div>
        <div class="sc-body">
          <div class="sc-label">Künstler</div>
          <div class="sc-num"><span v-if="music.isLoading" class="skel" />
            <span v-else>{{ music.stats.total.toLocaleString('de-DE') }}</span></div>
          <div class="sc-meta">
            <span>{{ music.stats.monitored }} überwacht</span>
            <span style="color:var(--text-muted)">· {{ music.stats.albums }} Alben</span>
          </div>
        </div>
        <span class="sc-arr">›</span>
      </button>

      <button class="stat-card" style="--c:var(--sabnzbd)" @click="nav('/downloads')">
        <div class="sc-icon">⬇️</div>
        <div class="sc-body">
          <div class="sc-label">Downloads</div>
          <div class="sc-num">{{ queue.totalCount }}</div>
          <div class="sc-meta">
            <span :class="queue.isConnected ? 'live' : 'off'" />
            <span>{{ speedLabel }}</span>
            <span v-if="queue.sabnzbd?.paused" style="color:var(--sabnzbd)">· ⏸</span>
          </div>
        </div>
        <span class="sc-arr">›</span>
      </button>

      <button class="stat-card" style="--c:var(--tautulli)" @click="nav('/tautulli')">
        <div class="sc-icon">📊</div>
        <div class="sc-body">
          <div class="sc-label">Streams</div>
          <div class="sc-num">{{ tautulli?.stream_count ?? 0 }}</div>
          <div class="sc-meta">
            <span v-if="tautulli">↑ {{ fmtBandwidth(tautulli.total_bandwidth) }}</span>
            <span v-else>–</span>
          </div>
        </div>
        <span class="sc-arr">›</span>
      </button>

      <button class="stat-card" style="--c:var(--overseerr)" @click="nav('/overseerr')">
        <div class="sc-icon">🙋</div>
        <div class="sc-body">
          <div class="sc-label">Anfragen</div>
          <div class="sc-num">{{ requests.length }}</div>
          <div class="sc-meta"><span style="color:var(--overseerr)">offen</span></div>
        </div>
        <span class="sc-arr">›</span>
      </button>

      <button class="stat-card" style="--c:var(--prowlarr)" @click="nav('/search')">
        <div class="sc-icon">🔍</div>
        <div class="sc-body">
          <div class="sc-label">Prowlarr</div>
          <div class="sc-num">{{ enabledIndexers }}</div>
          <div class="sc-meta"><span>Indexer aktiv</span></div>
        </div>
        <span class="sc-arr">›</span>
      </button>

      <button class="stat-card" style="--c:var(--gotify)" @click="nav('/gotify')">
        <div class="sc-icon">🔔</div>
        <div class="sc-body">
          <div class="sc-label">Gotify</div>
          <div class="sc-num">{{ gotify.unreadCount }}</div>
          <div class="sc-meta"><span>Nachrichten</span></div>
        </div>
        <span class="sc-arr">›</span>
      </button>
    </div>

    <!-- ── Zuletzt hinzugefügt ────────────────────────────────────────── -->
    <section class="widget">
      <div class="widget-head">
        <span class="widget-title">Zuletzt hinzugefügt</span>
        <div class="ftabs">
          <button :class="['ftab', recentFilter==='all' && 'ftab-on']" @click="recentFilter='all'">Alle</button>
          <button :class="['ftab', recentFilter==='movies' && 'ftab-on']" style="--ftc:var(--radarr)" @click="recentFilter='movies'">Filme</button>
          <button :class="['ftab', recentFilter==='series' && 'ftab-on']" style="--ftc:var(--sonarr)" @click="recentFilter='series'">Serien</button>
          <button :class="['ftab', recentFilter==='music' && 'ftab-on']" style="--ftc:var(--lidarr)" @click="recentFilter='music'">Musik</button>
        </div>
      </div>
      <div v-if="movies.isLoading && series.isLoading" class="poster-row">
        <div v-for="i in 12" :key="i" class="poster skeleton" />
      </div>
      <div v-else class="poster-row">
        <div v-for="item in recentlyAdded" :key="item.type+item.id" class="poster" @click="nav(item.route)">
          <div class="poster-img">
            <img v-if="item.posterUrl" :src="item.posterUrl" :alt="item.title" loading="lazy" />
            <div v-else class="poster-ph">{{ item.title[0] }}</div>
            <div class="poster-dot" :style="{ background: item.color }" />
          </div>
          <p class="poster-name">{{ item.title }}</p>
          <p class="poster-date">{{ fmtDate(item.added) }}</p>
        </div>
      </div>
    </section>

    <!-- ── Mittleres Grid: Downloads + Releases + Streams ────────────── -->
    <div class="tri-grid">

      <!-- Downloads Widget -->
      <section class="widget">
        <div class="widget-head">
          <span class="widget-title">Downloads</span>
          <button class="wlink" @click="nav('/downloads')">Alle ›</button>
        </div>

        <div v-if="queue.sabnzbd" class="sab-header">
          <span class="sab-badge">SABnzbd</span>
          <span class="sab-speed">{{ speedLabel }}</span>
          <span v-if="queue.sabnzbd.paused" class="sab-pause">⏸</span>
          <span class="sab-jobs">{{ queue.sabnzbd.slotCount }} Jobs</span>
        </div>

        <div v-if="queue.sabnzbd?.slots.length" class="dl-list">
          <div v-for="s in queue.sabnzbd.slots.slice(0,5)" :key="s.nzo_id" class="dl-row">
            <div class="dl-top">
              <span class="dl-name">{{ s.filename }}</span>
              <span class="dl-eta">{{ s.timeleft }}</span>
            </div>
            <div class="dl-track"><div class="dl-fill" :style="{width:`${s.percentage}%`}" /></div>
          </div>
          <div v-if="(queue.sabnzbd?.slots.length??0)>5" class="dl-more" @click="nav('/downloads')">
            + {{ (queue.sabnzbd?.slots.length??0)-5 }} weitere →
          </div>
        </div>
        <div v-else class="w-empty">Keine aktiven Downloads</div>

        <div v-if="queue.arrItems.length" class="arr-row">
          <span v-if="queue.radarrItems.length" class="arr-c" style="color:var(--radarr)">🎬 {{ queue.radarrItems.length }}</span>
          <span v-if="queue.sonarrItems.length" class="arr-c" style="color:var(--sonarr)">📺 {{ queue.sonarrItems.length }}</span>
          <span v-if="queue.lidarrItems.length" class="arr-c" style="color:var(--lidarr)">🎵 {{ queue.lidarrItems.length }}</span>
        </div>
      </section>

      <!-- Nächste Releases -->
      <section class="widget">
        <div class="widget-head">
          <span class="widget-title">Nächste 7 Tage</span>
          <button class="wlink" @click="nav('/calendar')">Kalender ›</button>
        </div>
        <div v-if="!upcoming.length" class="w-empty">Keine Releases</div>
        <div v-else class="cal-list">
          <div v-for="item in upcoming" :key="item.type+item.id" class="cal-row"
            :style="{'--cc': item.type==='movie' ? 'var(--radarr)' : item.type==='episode' ? 'var(--sonarr)' : 'var(--lidarr)'}">
            <span class="cal-date">{{ fmtDate(item.date) }}</span>
            <div class="cal-info">
              <p class="cal-title">{{ item.type==='episode' && item.seriesTitle ? item.seriesTitle+' – ' : '' }}{{ item.title }}</p>
              <span class="cal-type">{{ item.type==='movie' ? 'Film' : item.type==='episode' ? 'Episode' : 'Album' }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Aktive Streams -->
      <section class="widget">
        <div class="widget-head">
          <span class="widget-title">Aktive Streams</span>
          <span v-if="tautulli?.stream_count" class="w-badge" style="color:var(--tautulli)">{{ tautulli.stream_count }}</span>
        </div>
        <div v-if="!tautulli || tautulli.sessions.length===0" class="w-empty">Keine aktiven Streams</div>
        <div v-else class="stream-list">
          <div v-for="s in tautulli.sessions" :key="s.session_id" class="stream-card">
            <div class="stream-top">
              <span class="stream-user">{{ s.friendly_name }}</span>
              <span :class="s.state==='playing'?'s-play':'s-pause'">{{ s.state==='playing'?'▶':'⏸' }}</span>
              <span class="stream-pct">{{ s.progress_percent }}%</span>
            </div>
            <p class="stream-title">{{ s.grandparent_title ? s.grandparent_title+' – ' : '' }}{{ s.title }}</p>
            <div class="stream-tags">
              <span class="s-tag">{{ s.transcode_decision ?? 'direct play' }}</span>
              <span v-if="s.stream_video_resolution" class="s-tag">{{ s.stream_video_resolution }}</span>
              <span class="s-tag">{{ s.player ?? s.platform }}</span>
            </div>
            <div class="s-track"><div class="s-fill" :style="{width:`${s.progress_percent}%`}" /></div>
          </div>
        </div>
        <div v-if="tautulli" class="stream-bw">
          <span>↑ {{ fmtBandwidth(tautulli.wan_bandwidth) }} WAN</span>
          <span>{{ fmtBandwidth(tautulli.lan_bandwidth) }} LAN</span>
        </div>
      </section>
    </div>

    <!-- ── Unteres Grid: Gotify + Overseerr + Plex/ABS ────────────────── -->
    <div class="tri-grid">

      <!-- Gotify Widget -->
      <section class="widget" style="--wb:var(--gotify)">
        <div class="widget-head">
          <span class="widget-title">🔔 Benachrichtigungen</span>
          <button class="wlink" @click="nav('/gotify')">Alle ›</button>
        </div>
        <div v-if="!gotify.configured" class="w-empty">Gotify nicht konfiguriert</div>
        <div v-else-if="!gotify.messages.length" class="w-empty">Keine Nachrichten</div>
        <div v-else class="gotify-list">
          <div v-for="msg in gotify.messages.slice(0,5)" :key="msg.id" class="gotify-row" :class="msg.priority>=8?'g-crit':msg.priority>=5?'g-high':''">
            <div class="g-prio" :title="`Priorität ${msg.priority}`">
              <span v-if="msg.priority>=8">🔴</span>
              <span v-else-if="msg.priority>=5">🟡</span>
              <span v-else>🔵</span>
            </div>
            <div class="g-body">
              <p class="g-title">{{ msg.title }}</p>
              <p class="g-msg">{{ msg.message }}</p>
            </div>
            <span class="g-date">{{ fmtDate(msg.date) }}</span>
          </div>
        </div>
      </section>

      <!-- Overseerr Widget -->
      <section class="widget" style="--wb:var(--overseerr)">
        <div class="widget-head">
          <span class="widget-title">🙋 Anfragen</span>
          <button class="wlink" @click="nav('/overseerr')">Alle ›</button>
        </div>
        <div v-if="!requests.length" class="w-empty">Keine offenen Anfragen</div>
        <div v-else class="req-list">
          <div v-for="r in requests.slice(0,6)" :key="r.id" class="req-row" @click="nav('/overseerr')">
            <span :class="['req-badge', r.type==='movie'?'r-movie':'r-tv']">{{ r.type==='movie'?'Film':'Serie' }}</span>
            <span class="req-title">{{ r.media?.title ?? `TMDB #${r.media?.tmdbId}` }}</span>
            <span class="req-by">{{ r.requestedBy?.displayName }}</span>
          </div>
        </div>
      </section>

      <!-- Plex + ABS Widget -->
      <section class="widget">
        <div class="widget-head">
          <span class="widget-title">Plex & Audiobookshelf</span>
        </div>

        <!-- Plex -->
        <div class="plex-section">
          <div class="mini-head">
            <span style="color:var(--plex)">🎞️ Plex</span>
            <button class="wlink" @click="nav('/settings')">›</button>
          </div>
          <div v-if="!plexConfigured" class="w-empty-sm">Nicht konfiguriert</div>
          <div v-else-if="!plexSessions.length" class="w-empty-sm">Keine aktiven Sessions</div>
          <div v-else class="plex-list">
            <div v-for="s in plexSessions" :key="s.key" class="plex-row">
              <div class="plex-info">
                <p class="plex-title">{{ s.grandparentTitle ? s.grandparentTitle+' – ' : '' }}{{ s.title }}</p>
                <p class="plex-meta">{{ s.User?.title }} · {{ s.Player?.platform }}</p>
              </div>
              <span class="plex-pct">{{ plexProgress(s) }}%</span>
            </div>
          </div>
        </div>

        <!-- Separator -->
        <div class="mini-sep" />

        <!-- ABS -->
        <div class="abs-section">
          <div class="mini-head">
            <span style="color:#F0A500">📚 Audiobookshelf</span>
            <button class="wlink" @click="nav('/audiobookshelf')">›</button>
          </div>
          <div v-if="!absConfigured" class="w-empty-sm">Nicht konfiguriert</div>
          <div v-else-if="!absLibs.length" class="w-empty-sm">Keine Libraries</div>
          <div v-else class="abs-libs">
            <div v-for="lib in absLibs" :key="lib.id" class="abs-lib" @click="nav('/audiobookshelf')">
              <span class="abs-icon">{{ lib.mediaType==='book'?'📖':'🎙️' }}</span>
              <span class="abs-name">{{ lib.name }}</span>
              <span class="abs-type">{{ lib.mediaType==='book'?'Hörbücher':'Podcasts' }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- ── Letzte Aktivität (Tautulli History) ────────────────────────── -->
    <section v-if="history.length" class="widget">
      <div class="widget-head">
        <span class="widget-title">Letzte Aktivität</span>
        <button class="wlink" @click="nav('/tautulli')">Statistiken ›</button>
      </div>
      <div class="history-list">
        <div v-for="item in history" :key="item.row_id" class="history-row">
          <div class="h-icon">{{ historyIcon(item.media_type) }}</div>
          <div class="h-info">
            <p class="h-title">{{ item.grandparent_title ? item.grandparent_title+' – ' : '' }}{{ item.title }}</p>
            <div class="h-tags">
              <span class="h-tag" style="color:var(--status-success)">{{ item.action }}</span>
              <span v-if="item.quality" class="h-tag">{{ item.quality }}</span>
              <span v-if="item.file_size" class="h-tag">{{ fmtBytes(item.file_size) }}</span>
              <span v-if="item.friendly_name" class="h-tag" style="color:var(--tautulli)">{{ item.friendly_name }}</span>
            </div>
          </div>
          <span class="h-date">{{ fmtDate(new Date(item.date * 1000).toISOString()) }}</span>
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
.dashboard {
  padding: var(--space-5) var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  min-height: 100%;
  max-width: 1600px;
}

/* Header */
.dash-header   { display: flex; align-items: flex-start; justify-content: space-between; }
.dash-title    { font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); margin: 0; }
.dash-sub      { font-size: var(--text-sm); color: var(--text-muted); margin: 2px 0 0; }
.dash-right    { display: flex; align-items: center; gap: var(--space-4); }
.dash-time     { font-size: var(--text-2xl); font-weight: 700; color: var(--text-secondary); font-variant-numeric: tabular-nums; }

/* Health Bar */
.health-bar {
  display: flex; flex-wrap: wrap; gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-lg);
  align-items: center;
}
.health-chip   { display: flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: var(--radius-sm); background: var(--bg-elevated); border: 1px solid var(--bg-border); }
.health-dot    { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.health-label  { font-size: 11px; font-weight: 600; }
.health-ver    { font-size: 10px; color: var(--text-muted); }

/* Stats Grid */
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(175px, 1fr)); gap: var(--space-3); }
.stat-card {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-surface); border: 1px solid var(--bg-border);
  border-left: 3px solid var(--c); border-radius: var(--radius-lg);
  cursor: pointer; transition: background .15s, transform .1s; text-align: left;
}
.stat-card:hover { background: var(--bg-elevated); transform: translateY(-1px); }
.sc-icon   { font-size: 22px; line-height: 1; flex-shrink: 0; }
.sc-body   { flex: 1; min-width: 0; }
.sc-label  { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .06em; }
.sc-num    { font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); line-height: 1.1; font-variant-numeric: tabular-nums; }
.sc-meta   { font-size: 10px; color: var(--text-muted); margin-top: 1px; display: flex; gap: 4px; align-items: center; }
.sc-ok     { color: var(--status-success); }
.sc-miss   { color: var(--status-error); }
.sc-arr    { font-size: 18px; color: var(--text-muted); }
.skel      { display: inline-block; width: 50px; height: 22px; background: var(--bg-elevated); border-radius: 4px; animation: shimmer 1.5s infinite; }
.live      { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--status-success); }
.off       { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); }

/* Widget Base */
.widget {
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-top: 2px solid var(--wb, var(--bg-border));
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex; flex-direction: column; gap: var(--space-3);
}
.widget-head { display: flex; align-items: center; justify-content: space-between; }
.widget-title { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); }
.wlink { font-size: var(--text-xs); color: var(--text-muted); transition: color .15s; }
.wlink:hover { color: var(--text-secondary); }
.w-badge { font-size: var(--text-sm); font-weight: 700; }
.w-empty { font-size: var(--text-sm); color: var(--text-muted); padding: var(--space-3) 0; }
.w-empty-sm { font-size: var(--text-xs); color: var(--text-muted); }

/* Filter tabs */
.ftabs { display: flex; gap: 3px; }
.ftab { padding: 2px 8px; border-radius: var(--radius-sm); font-size: 11px; color: var(--text-muted); border: 1px solid transparent; cursor: pointer; transition: all .15s; }
.ftab:hover { color: var(--text-secondary); background: var(--bg-elevated); }
.ftab-on { background: var(--bg-elevated); color: var(--ftc, var(--text-primary)); border-color: var(--bg-border); font-weight: 600; }

/* Poster Scroll */
.poster-row {
  display: flex; gap: var(--space-3); overflow-x: auto; padding-bottom: var(--space-1);
  scrollbar-width: thin; scrollbar-color: var(--bg-border) transparent;
}
.poster-row::-webkit-scrollbar { height: 3px; }
.poster-row::-webkit-scrollbar-thumb { background: var(--bg-border); border-radius: 2px; }
.poster { flex-shrink: 0; width: 90px; cursor: pointer; }
.poster.skeleton { height: 135px; border-radius: var(--radius-md); animation: shimmer 1.5s infinite; }
.poster-img { position: relative; aspect-ratio: 2/3; border-radius: var(--radius-md); overflow: hidden; background: var(--bg-elevated); border: 1px solid var(--bg-border); margin-bottom: 4px; transition: transform .15s; }
.poster:hover .poster-img { transform: scale(1.04); }
.poster-img img { width: 100%; height: 100%; object-fit: cover; }
.poster-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; color: var(--text-muted); }
.poster-dot { position: absolute; bottom: 3px; right: 3px; width: 7px; height: 7px; border-radius: 50%; border: 1px solid rgba(0,0,0,.5); }
.poster-name { font-size: 10px; color: var(--text-secondary); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0; }
.poster-date { font-size: 10px; color: var(--text-muted); margin: 0; }

/* Tri Grid */
.tri-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-4); }
@media (max-width: 1100px) { .tri-grid { grid-template-columns: 1fr 1fr; } }
@media (max-width: 700px)  { .tri-grid { grid-template-columns: 1fr; } }

/* SABnzbd */
.sab-header { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: var(--bg-elevated); border-radius: var(--radius-md); }
.sab-badge  { font-size: 10px; font-weight: 700; color: var(--sabnzbd); padding: 1px 6px; border: 1px solid rgba(245,197,24,.3); border-radius: 99px; background: rgba(245,197,24,.08); }
.sab-speed  { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); flex: 1; }
.sab-pause  { color: var(--sabnzbd); }
.sab-jobs   { font-size: var(--text-xs); color: var(--text-muted); }

.dl-list { display: flex; flex-direction: column; gap: 2px; }
.dl-row  { padding: var(--space-2) 0; border-bottom: 1px solid var(--bg-border); }
.dl-row:last-child { border-bottom: none; }
.dl-top  { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; gap: var(--space-2); }
.dl-name { font-size: 11px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
.dl-eta  { font-size: 10px; color: var(--text-muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
.dl-track { height: 2px; background: var(--bg-elevated); border-radius: 99px; overflow: hidden; }
.dl-fill  { height: 100%; background: var(--sabnzbd); border-radius: 99px; transition: width .5s ease; }
.dl-more  { font-size: 11px; color: var(--text-muted); text-align: center; cursor: pointer; padding: var(--space-2) 0; }
.dl-more:hover { color: var(--text-secondary); }
.arr-row { display: flex; gap: var(--space-3); padding-top: var(--space-1); }
.arr-c   { font-size: var(--text-xs); font-weight: 600; }

/* Calendar */
.cal-list { display: flex; flex-direction: column; gap: 2px; overflow-y: auto; max-height: 280px; }
.cal-row  { display: flex; align-items: center; gap: var(--space-2); padding: 5px var(--space-2); border-left: 2px solid var(--cc); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; background: var(--bg-elevated); }
.cal-date { font-size: 10px; color: var(--text-muted); font-weight: 600; min-width: 32px; font-variant-numeric: tabular-nums; }
.cal-info { flex: 1; min-width: 0; }
.cal-title { font-size: 11px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0; font-weight: 500; }
.cal-type { font-size: 10px; color: var(--text-muted); }

/* Streams */
.stream-list { display: flex; flex-direction: column; gap: var(--space-2); }
.stream-card { background: var(--bg-elevated); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); border-left: 2px solid var(--tautulli); }
.stream-top  { display: flex; align-items: center; gap: var(--space-2); margin-bottom: 2px; }
.stream-user { font-size: var(--text-xs); font-weight: 600; color: var(--tautulli); flex: 1; }
.s-play  { color: var(--status-success); font-size: 10px; }
.s-pause { color: var(--text-muted); font-size: 10px; }
.stream-pct { font-size: 10px; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.stream-title { font-size: 11px; color: var(--text-secondary); margin: 0 0 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stream-tags { display: flex; gap: var(--space-2); flex-wrap: wrap; margin-bottom: 4px; }
.s-tag { font-size: 10px; color: var(--text-muted); }
.s-track { height: 2px; background: var(--bg-border); border-radius: 99px; overflow: hidden; }
.s-fill  { height: 100%; background: var(--tautulli); opacity: .8; border-radius: 99px; transition: width 1s ease; }
.stream-bw { display: flex; gap: var(--space-3); font-size: 10px; color: var(--text-muted); padding-top: var(--space-1); }

/* Gotify */
.gotify-list { display: flex; flex-direction: column; gap: 2px; }
.gotify-row  { display: flex; align-items: flex-start; gap: var(--space-2); padding: var(--space-2); background: var(--bg-elevated); border-radius: var(--radius-sm); }
.gotify-row.g-crit { border-left: 2px solid #ef4444; }
.gotify-row.g-high { border-left: 2px solid #f59e0b; }
.g-prio  { flex-shrink: 0; font-size: 12px; line-height: 1.5; }
.g-body  { flex: 1; min-width: 0; }
.g-title { font-size: 11px; color: var(--text-secondary); font-weight: 600; margin: 0 0 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.g-msg   { font-size: 10px; color: var(--text-muted); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.g-date  { font-size: 10px; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }

/* Requests */
.req-list { display: flex; flex-direction: column; gap: 2px; }
.req-row  { display: flex; align-items: center; gap: var(--space-2); padding: 5px var(--space-2); background: var(--bg-elevated); border-radius: var(--radius-sm); cursor: pointer; transition: background .15s; }
.req-row:hover { background: var(--bg-overlay); }
.req-badge { font-size: 10px; font-weight: 600; padding: 1px 5px; border-radius: 3px; flex-shrink: 0; }
.r-movie { background: rgba(244,165,74,.12); color: var(--radarr); }
.r-tv    { background: rgba(53,197,244,.12); color: var(--sonarr); }
.req-title { font-size: 11px; color: var(--text-secondary); font-weight: 500; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.req-by   { font-size: 10px; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }

/* Plex + ABS */
.plex-section, .abs-section { display: flex; flex-direction: column; gap: var(--space-2); }
.mini-head { display: flex; align-items: center; justify-content: space-between; font-size: var(--text-xs); font-weight: 600; }
.mini-sep  { height: 1px; background: var(--bg-border); margin: var(--space-1) 0; }
.plex-list { display: flex; flex-direction: column; gap: 4px; }
.plex-row  { display: flex; align-items: center; gap: var(--space-2); }
.plex-info { flex: 1; min-width: 0; }
.plex-title { font-size: 11px; color: var(--text-secondary); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0; }
.plex-meta  { font-size: 10px; color: var(--text-muted); margin: 0; }
.plex-pct   { font-size: 10px; color: var(--plex); font-weight: 600; }
.abs-libs { display: flex; flex-direction: column; gap: 4px; }
.abs-lib  { display: flex; align-items: center; gap: var(--space-2); padding: 4px var(--space-2); background: var(--bg-elevated); border-radius: var(--radius-sm); cursor: pointer; transition: background .15s; }
.abs-lib:hover { background: var(--bg-overlay); }
.abs-icon { font-size: 14px; }
.abs-name { font-size: 11px; color: var(--text-secondary); font-weight: 500; flex: 1; }
.abs-type { font-size: 10px; color: var(--text-muted); }

/* History */
.history-list { display: flex; flex-direction: column; gap: 2px; }
.history-row  { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-2); background: var(--bg-elevated); border-radius: var(--radius-sm); }
.h-icon  { font-size: 16px; flex-shrink: 0; }
.h-info  { flex: 1; min-width: 0; }
.h-title { font-size: 11px; color: var(--text-secondary); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0 0 2px; }
.h-tags  { display: flex; gap: var(--space-2); align-items: center; }
.h-tag   { font-size: 10px; color: var(--text-muted); }
.h-date  { font-size: 10px; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }

@keyframes shimmer { 0%, 100% { opacity: .4; } 50% { opacity: .9; } }
</style>
