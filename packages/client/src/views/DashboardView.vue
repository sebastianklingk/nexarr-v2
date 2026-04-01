<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useMoviesStore } from '../stores/movies.store.js';
import { useSeriesStore } from '../stores/series.store.js';
import { useMusicStore } from '../stores/music.store.js';
import { useQueueStore } from '../stores/queue.store.js';
import { useApi } from '../composables/useApi.js';
import type { TautulliStream, OverseerrRequest, RadarrMovie, SonarrSeries } from '@nexarr/shared';

const router = useRouter();
const movies = useMoviesStore();
const series = useSeriesStore();
const music  = useMusicStore();
const queue  = useQueueStore();
const { get } = useApi();

// ── Zeit ─────────────────────────────────────────────────────────────────────
const now = ref(new Date());
let clockTimer: ReturnType<typeof setInterval>;
const timeStr = computed(() => now.value.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
const dateStr = computed(() => now.value.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }));

// ── Tautulli ─────────────────────────────────────────────────────────────────
interface TautulliMini { stream_count: number; total_bandwidth: number; sessions: TautulliStream[] }
const tautulli = ref<TautulliMini | null>(null);

interface HistoryItem {
  id: number; title: string; parent_title?: string; grandparent_title?: string;
  action: string; date: number; media_type: string; thumb?: string;
  quality_profile?: string; file_size?: number;
}
const history = ref<HistoryItem[]>([]);

async function loadTautulli() {
  try { tautulli.value = await get<TautulliMini>('/api/tautulli/activity'); } catch { /* optional */ }
}
async function loadHistory() {
  try {
    const data = await get<{ data: { data: HistoryItem[] } }>('/api/tautulli/history');
    history.value = (data?.data?.data ?? []).slice(0, 12);
  } catch { /* optional */ }
}

// ── Overseerr ────────────────────────────────────────────────────────────────
const pendingRequests = ref<OverseerrRequest[]>([]);
async function loadOverseerr() {
  try { pendingRequests.value = await get<OverseerrRequest[]>('/api/overseerr/requests?filter=pending'); } catch { /* optional */ }
}

// ── Kalender (nächste 7 Tage) ─────────────────────────────────────────────
interface CalendarItem { id: number; title: string; type: 'movie' | 'episode' | 'album'; date: string; posterUrl?: string; seriesTitle?: string }
const upcoming = ref<CalendarItem[]>([]);

async function loadCalendar() {
  try {
    const start = new Date().toISOString().slice(0, 10);
    const end   = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const data  = await get<{ radarr: any[]; sonarr: any[]; lidarr: any[] }>(`/api/calendar?start=${start}&end=${end}`);
    const items: CalendarItem[] = [];
    for (const m of (data.radarr ?? [])) {
      items.push({ id: m.id, title: m.title, type: 'movie', date: m.digitalRelease ?? m.physicalRelease ?? m.inCinemas ?? '', posterUrl: m.images?.find((i: any) => i.coverType === 'poster')?.remoteUrl });
    }
    for (const e of (data.sonarr ?? [])) {
      items.push({ id: e.id, title: e.title, type: 'episode', date: e.airDate ?? '', seriesTitle: e.series?.title });
    }
    for (const a of (data.lidarr ?? [])) {
      items.push({ id: a.id, title: a.title, type: 'album', date: a.releaseDate ?? '' });
    }
    upcoming.value = items.filter(i => i.date).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 15);
  } catch { /* optional */ }
}

// ── Zuletzt hinzugefügt ───────────────────────────────────────────────────
const recentFilter = ref<'all' | 'movies' | 'series' | 'music'>('all');

const recentlyAdded = computed(() => {
  const items: Array<{ id: number; title: string; type: string; added: string; posterUrl?: string; color: string; route: string }> = [];
  if (recentFilter.value !== 'series' && recentFilter.value !== 'music') {
    for (const m of movies.movies) {
      if (m.added) items.push({ id: m.id, title: m.title, type: 'movie', added: m.added, posterUrl: m.images?.find(i => i.coverType === 'poster')?.remoteUrl, color: 'var(--radarr)', route: `/movies/${m.id}` });
    }
  }
  if (recentFilter.value !== 'movies' && recentFilter.value !== 'music') {
    for (const s of series.series) {
      if (s.added) items.push({ id: s.id, title: s.title, type: 'series', added: s.added, posterUrl: s.images?.find(i => i.coverType === 'poster')?.remoteUrl, color: 'var(--sonarr)', route: `/series/${s.id}` });
    }
  }
  if (recentFilter.value !== 'movies' && recentFilter.value !== 'series') {
    for (const a of music.artists) {
      if (a.added) items.push({ id: a.id, title: a.artistName, type: 'music', added: a.added, posterUrl: a.images?.find(i => i.coverType === 'poster')?.remoteUrl, color: 'var(--lidarr)', route: `/music/${a.id}` });
    }
  }
  return items.sort((a, b) => b.added.localeCompare(a.added)).slice(0, 24);
});

// ── Download Helpers ──────────────────────────────────────────────────────
const speedLabel = computed(() => {
  const s = queue.sabnzbd?.speedMbs ?? 0;
  if (s === 0) return queue.sabnzbd?.paused ? 'Pausiert' : 'Bereit';
  if (s < 1)   return `${(s * 1024).toFixed(0)} KB/s`;
  return `${s.toFixed(1)} MB/s`;
});

// ── Helpers ───────────────────────────────────────────────────────────────
function navigate(route: string) { router.push(route); }

function formatDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  const gb = bytes / 1024 / 1024 / 1024;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

function historyAction(action: string): { label: string; color: string } {
  if (action === 'download') return { label: 'Download', color: '#22c55e' };
  if (action === 'transcode') return { label: 'Transcode', color: 'var(--tautulli)' };
  return { label: action, color: 'var(--text-muted)' };
}

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(async () => {
  clockTimer = setInterval(() => { now.value = new Date(); }, 30000);
  queue.subscribe();
  await Promise.allSettled([
    movies.fetchMovies(),
    series.fetchSeries(),
    music.fetchArtists(),
    loadTautulli(),
    loadOverseerr(),
    loadCalendar(),
    loadHistory(),
  ]);
});

onUnmounted(() => {
  clearInterval(clockTimer);
  queue.unsubscribe();
});
</script>

<template>
  <div class="dashboard">

    <!-- ── Header ── -->
    <div class="dash-header">
      <div>
        <h1 class="dash-title">Dashboard</h1>
        <p class="dash-date">{{ dateStr }}</p>
      </div>
      <div class="dash-time">{{ timeStr }}</div>
    </div>

    <!-- ── Library Stats ── -->
    <section class="section">
      <div class="stats-row">
        <button class="stat-card" style="--c: var(--radarr)" @click="navigate('/movies')">
          <div class="stat-icon">🎬</div>
          <div class="stat-body">
            <div class="stat-label">Filme</div>
            <div class="stat-num">
              <span v-if="movies.isLoading" class="skel-num" />
              <span v-else>{{ movies.stats.total.toLocaleString('de-DE') }}</span>
            </div>
            <div class="stat-sub">{{ movies.stats.available }} vorhanden · {{ movies.stats.missing }} fehlen</div>
          </div>
          <span class="stat-arrow">›</span>
        </button>
        <button class="stat-card" style="--c: var(--sonarr)" @click="navigate('/series')">
          <div class="stat-icon">📺</div>
          <div class="stat-body">
            <div class="stat-label">Serien</div>
            <div class="stat-num">
              <span v-if="series.isLoading" class="skel-num" />
              <span v-else>{{ series.stats.total.toLocaleString('de-DE') }}</span>
            </div>
            <div class="stat-sub">{{ series.stats.continuing }} laufend · {{ series.stats.ended }} beendet</div>
          </div>
          <span class="stat-arrow">›</span>
        </button>
        <button class="stat-card" style="--c: var(--lidarr)" @click="navigate('/music')">
          <div class="stat-icon">🎵</div>
          <div class="stat-body">
            <div class="stat-label">Künstler</div>
            <div class="stat-num">
              <span v-if="music.isLoading" class="skel-num" />
              <span v-else>{{ music.stats.total.toLocaleString('de-DE') }}</span>
            </div>
            <div class="stat-sub">{{ music.stats.monitored }} überwacht</div>
          </div>
          <span class="stat-arrow">›</span>
        </button>
        <button class="stat-card" style="--c: var(--sabnzbd)" @click="navigate('/downloads')">
          <div class="stat-icon">⬇️</div>
          <div class="stat-body">
            <div class="stat-label">Downloads</div>
            <div class="stat-num">{{ queue.totalCount }}</div>
            <div class="stat-sub">
              <span :class="queue.isConnected ? 'live-dot' : 'off-dot'" />
              {{ speedLabel }}
            </div>
          </div>
          <span class="stat-arrow">›</span>
        </button>
      </div>
    </section>

    <!-- ── Zuletzt hinzugefügt ── -->
    <section class="section">
      <div class="section-head">
        <h2 class="section-label">Zuletzt hinzugefügt</h2>
        <div class="filter-tabs">
          <button :class="['ftab', recentFilter === 'all' && 'ftab--active']" @click="recentFilter = 'all'">Alle</button>
          <button :class="['ftab', recentFilter === 'movies' && 'ftab--active']" style="--ftab-c: var(--radarr)" @click="recentFilter = 'movies'">Filme</button>
          <button :class="['ftab', recentFilter === 'series' && 'ftab--active']" style="--ftab-c: var(--sonarr)" @click="recentFilter = 'series'">Serien</button>
          <button :class="['ftab', recentFilter === 'music' && 'ftab--active']" style="--ftab-c: var(--lidarr)" @click="recentFilter = 'music'">Musik</button>
        </div>
      </div>

      <div v-if="movies.isLoading && series.isLoading" class="poster-scroll">
        <div v-for="i in 10" :key="i" class="poster-card skeleton" />
      </div>
      <div v-else-if="recentlyAdded.length === 0" class="empty-inline">Keine Einträge</div>
      <div v-else class="poster-scroll">
        <div
          v-for="item in recentlyAdded"
          :key="item.type + item.id"
          class="poster-card"
          :style="{ '--pc': item.color }"
          @click="navigate(item.route)"
        >
          <div class="poster-img">
            <img v-if="item.posterUrl" :src="item.posterUrl" :alt="item.title" loading="lazy" />
            <div v-else class="poster-placeholder">{{ item.title[0] }}</div>
            <div class="poster-type-dot" :style="{ background: item.color }" />
          </div>
          <p class="poster-title">{{ item.title }}</p>
          <p class="poster-date">{{ formatDate(item.added) }}</p>
        </div>
      </div>
    </section>

    <!-- ── Mitte: Downloads + Upcoming ── -->
    <div class="mid-grid">

      <!-- Downloads -->
      <section class="section">
        <div class="section-head">
          <h2 class="section-label">Downloads</h2>
          <button class="link-btn" @click="navigate('/downloads')">Alle ›</button>
        </div>

        <div v-if="queue.sabnzbd" class="dl-header-card">
          <span class="sab-badge">SABnzbd</span>
          <span class="dl-speed">{{ speedLabel }}</span>
          <span v-if="queue.sabnzbd.paused" class="dl-paused">⏸ Pausiert</span>
          <span class="dl-count-pill">{{ queue.sabnzbd.slotCount }} Jobs</span>
        </div>

        <div v-if="queue.sabnzbd?.slots.length" class="dl-list">
          <div v-for="slot in queue.sabnzbd.slots.slice(0, 5)" :key="slot.nzo_id" class="dl-item">
            <div class="dl-row">
              <span class="dl-name">{{ slot.filename }}</span>
              <span class="dl-eta">{{ slot.timeleft }}</span>
            </div>
            <div class="dl-bar-wrap">
              <div class="dl-bar" :style="{ width: `${slot.percentage}%` }" />
            </div>
          </div>
          <div v-if="(queue.sabnzbd?.slots.length ?? 0) > 5" class="dl-more" @click="navigate('/downloads')">
            + {{ (queue.sabnzbd?.slots.length ?? 0) - 5 }} weitere →
          </div>
        </div>
        <div v-else class="empty-inline">Keine aktiven Downloads</div>

        <!-- Arr Items -->
        <div v-if="queue.arrItems.length" class="arr-chips">
          <span v-if="queue.radarrItems.length" class="arr-chip" style="color: var(--radarr)">🎬 {{ queue.radarrItems.length }}</span>
          <span v-if="queue.sonarrItems.length" class="arr-chip" style="color: var(--sonarr)">📺 {{ queue.sonarrItems.length }}</span>
          <span v-if="queue.lidarrItems.length" class="arr-chip" style="color: var(--lidarr)">🎵 {{ queue.lidarrItems.length }}</span>
        </div>
      </section>

      <!-- Upcoming Releases -->
      <section class="section">
        <div class="section-head">
          <h2 class="section-label">Nächste Releases</h2>
          <button class="link-btn" @click="navigate('/calendar')">Kalender ›</button>
        </div>

        <div v-if="upcoming.length === 0" class="empty-inline">Keine Releases in den nächsten 7 Tagen</div>
        <div v-else class="upcoming-list">
          <div
            v-for="item in upcoming"
            :key="item.type + item.id"
            class="upcoming-item"
            :style="{ '--uc': item.type === 'movie' ? 'var(--radarr)' : item.type === 'episode' ? 'var(--sonarr)' : 'var(--lidarr)' }"
          >
            <div class="upcoming-date">{{ formatDate(item.date) }}</div>
            <div class="upcoming-info">
              <p class="upcoming-title">{{ item.type === 'episode' && item.seriesTitle ? item.seriesTitle + ' – ' : '' }}{{ item.title }}</p>
              <span class="upcoming-type">{{ item.type === 'movie' ? 'Film' : item.type === 'episode' ? 'Episode' : 'Album' }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- ── Streams + Requests ── -->
    <div class="mid-grid">

      <!-- Aktive Streams -->
      <section v-if="tautulli" class="section">
        <div class="section-head">
          <h2 class="section-label">Aktive Streams</h2>
          <span class="badge-pill" style="background: rgba(229,192,109,.12); color: var(--tautulli); border-color: rgba(229,192,109,.25)">
            {{ tautulli.stream_count }}
          </span>
        </div>
        <div v-if="tautulli.sessions.length === 0" class="empty-inline">Keine aktiven Streams</div>
        <div v-else class="stream-list">
          <div v-for="s in tautulli.sessions" :key="s.session_id" class="stream-card">
            <div class="stream-top">
              <span class="stream-user">{{ s.friendly_name }}</span>
              <span :class="['stream-state', s.state === 'playing' ? 'state-play' : 'state-pause']">
                {{ s.state === 'playing' ? '▶' : '⏸' }}
              </span>
              <span class="stream-pct">{{ s.progress_percent }}%</span>
            </div>
            <p class="stream-title">{{ s.grandparent_title ? `${s.grandparent_title} – ` : '' }}{{ s.title }}</p>
            <div class="stream-meta-row">
              <span>{{ s.transcode_decision ?? 'direct play' }}</span>
              <span>{{ s.player ?? s.platform }}</span>
              <span v-if="s.stream_video_resolution">{{ s.stream_video_resolution }}</span>
            </div>
            <div class="stream-bar-wrap"><div class="stream-bar" :style="{ width: `${s.progress_percent}%` }" /></div>
          </div>
        </div>
      </section>

      <!-- Pending Requests -->
      <section v-if="pendingRequests.length > 0" class="section">
        <div class="section-head">
          <h2 class="section-label">Offene Anfragen</h2>
          <button class="link-btn" @click="navigate('/overseerr')">Alle ›</button>
        </div>
        <div class="req-list">
          <div v-for="r in pendingRequests.slice(0, 6)" :key="r.id" class="req-item" @click="navigate('/overseerr')">
            <span :class="['req-badge', r.type === 'movie' ? 'req-movie' : 'req-tv']">{{ r.type === 'movie' ? 'Film' : 'Serie' }}</span>
            <span class="req-title">{{ r.media?.title ?? `TMDB #${r.media?.tmdbId}` }}</span>
            <span class="req-by">{{ r.requestedBy?.displayName }}</span>
          </div>
        </div>
      </section>
    </div>

    <!-- ── Letzte Aktivität (Tautulli History) ── -->
    <section v-if="history.length" class="section">
      <div class="section-head">
        <h2 class="section-label">Letzte Aktivität</h2>
        <button class="link-btn" @click="navigate('/tautulli')">Statistiken ›</button>
      </div>
      <div class="history-list">
        <div v-for="item in history" :key="item.id" class="history-item">
          <div class="history-thumb">
            <img v-if="item.thumb" :src="`https://image.tmdb.org/t/p/w92${item.thumb}`" loading="lazy" />
            <div v-else class="history-thumb-placeholder">{{ item.media_type === 'movie' ? '🎬' : item.media_type === 'episode' ? '📺' : '🎵' }}</div>
          </div>
          <div class="history-info">
            <p class="history-title">{{ item.grandparent_title ? `${item.grandparent_title} – ` : '' }}{{ item.title }}</p>
            <div class="history-meta">
              <span class="history-action" :style="{ color: historyAction(item.action).color }">{{ historyAction(item.action).label }}</span>
              <span v-if="item.quality_profile" class="history-quality">{{ item.quality_profile }}</span>
              <span v-if="item.file_size" class="history-size">{{ formatBytes(item.file_size) }}</span>
            </div>
          </div>
          <div class="history-date">{{ formatDate(new Date(item.date * 1000).toISOString()) }}</div>
        </div>
      </div>
    </section>

  </div>
</template>

<style scoped>
.dashboard {
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
  min-height: 100%;
}

/* Header */
.dash-header { display: flex; align-items: flex-start; justify-content: space-between; }
.dash-title { font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); margin: 0; }
.dash-date  { font-size: var(--text-sm); color: var(--text-muted); margin: 4px 0 0; }
.dash-time  { font-size: var(--text-2xl); font-weight: 700; color: var(--text-secondary); font-variant-numeric: tabular-nums; }

/* Section */
.section { display: flex; flex-direction: column; gap: var(--space-3); }
.section-head { display: flex; align-items: center; justify-content: space-between; }
.section-label { font-size: var(--text-xs); font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .08em; margin: 0; }
.link-btn { font-size: var(--text-xs); color: var(--text-muted); transition: color .15s; }
.link-btn:hover { color: var(--text-secondary); }

/* Stats Row */
.stats-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--space-3); }
.stat-card {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  background: var(--bg-surface); border: 1px solid var(--bg-border);
  border-left: 3px solid var(--c); border-radius: var(--radius-lg);
  cursor: pointer; transition: background .15s, transform .1s; text-align: left;
}
.stat-card:hover { background: var(--bg-elevated); transform: translateY(-1px); }
.stat-icon  { font-size: 26px; line-height: 1; flex-shrink: 0; }
.stat-body  { flex: 1; min-width: 0; }
.stat-label { font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: .05em; }
.stat-num   { font-size: var(--text-2xl); font-weight: 700; color: var(--text-primary); line-height: 1.1; font-variant-numeric: tabular-nums; }
.stat-sub   { font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px; }
.stat-arrow { font-size: var(--text-xl); color: var(--text-muted); }
.skel-num   { display: inline-block; width: 60px; height: 28px; background: var(--bg-elevated); border-radius: 4px; animation: shimmer 1.5s infinite; }
.live-dot, .off-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
.live-dot { background: var(--status-success); }
.off-dot  { background: var(--text-muted); }

/* Filter Tabs */
.filter-tabs { display: flex; gap: 4px; }
.ftab {
  padding: 3px 10px; border-radius: var(--radius-sm); font-size: var(--text-xs);
  color: var(--text-muted); border: 1px solid transparent; cursor: pointer; transition: all .15s;
}
.ftab:hover { color: var(--text-secondary); background: var(--bg-elevated); }
.ftab--active { background: var(--bg-elevated); color: var(--ftab-c, var(--text-primary)); border-color: var(--bg-border); font-weight: 600; }

/* Poster Scroll */
.poster-scroll {
  display: flex; gap: var(--space-3); overflow-x: auto; padding-bottom: var(--space-2);
  scrollbar-width: thin; scrollbar-color: var(--bg-border) transparent;
}
.poster-scroll::-webkit-scrollbar { height: 4px; }
.poster-scroll::-webkit-scrollbar-thumb { background: var(--bg-border); border-radius: 2px; }

.poster-card {
  flex-shrink: 0; width: 100px; cursor: pointer;
}
.poster-card.skeleton { width: 100px; aspect-ratio: 2/3; border-radius: var(--radius-md); animation: shimmer 1.5s infinite; }

.poster-img {
  position: relative; aspect-ratio: 2/3; border-radius: var(--radius-md);
  overflow: hidden; background: var(--bg-elevated); border: 1px solid var(--bg-border);
  margin-bottom: var(--space-1); transition: transform .15s;
}
.poster-card:hover .poster-img { transform: scale(1.03); }
.poster-img img { width: 100%; height: 100%; object-fit: cover; }
.poster-placeholder {
  width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
  font-size: 32px; font-weight: 700; color: var(--text-muted);
}
.poster-type-dot {
  position: absolute; bottom: 4px; right: 4px; width: 8px; height: 8px;
  border-radius: 50%; border: 1px solid rgba(0,0,0,.4);
}
.poster-title {
  font-size: 11px; color: var(--text-secondary); font-weight: 500; line-height: 1.3;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0;
}
.poster-date { font-size: 10px; color: var(--text-muted); margin: 0; }

/* Mid Grid */
.mid-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-5); }
@media (max-width: 900px) { .mid-grid { grid-template-columns: 1fr; } }

/* Downloads */
.dl-header-card {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4); background: var(--bg-surface);
  border: 1px solid var(--bg-border); border-radius: var(--radius-md);
}
.sab-badge { font-size: var(--text-xs); font-weight: 700; color: var(--sabnzbd); padding: 1px 7px; border: 1px solid rgba(245,197,24,.3); border-radius: 99px; background: rgba(245,197,24,.08); }
.dl-speed  { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); flex: 1; }
.dl-paused { font-size: var(--text-xs); color: var(--sabnzbd); }
.dl-count-pill { font-size: var(--text-xs); color: var(--text-muted); }

.dl-list { background: var(--bg-surface); border: 1px solid var(--bg-border); border-radius: var(--radius-lg); overflow: hidden; }
.dl-item { padding: var(--space-2) var(--space-4); border-bottom: 1px solid var(--bg-border); }
.dl-item:last-child { border-bottom: none; }
.dl-row { display: flex; justify-content: space-between; align-items: center; gap: var(--space-2); margin-bottom: 4px; }
.dl-name { font-size: var(--text-xs); color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
.dl-eta  { font-size: var(--text-xs); color: var(--text-muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
.dl-bar-wrap { height: 2px; background: var(--bg-elevated); border-radius: 99px; overflow: hidden; }
.dl-bar { height: 100%; background: var(--sabnzbd); border-radius: 99px; transition: width .5s ease; }
.dl-more { padding: var(--space-2) var(--space-4); font-size: var(--text-xs); color: var(--text-muted); cursor: pointer; text-align: center; }
.dl-more:hover { color: var(--text-secondary); }

.arr-chips { display: flex; gap: var(--space-3); padding: var(--space-2) 0; }
.arr-chip { font-size: var(--text-xs); font-weight: 600; }

/* Upcoming */
.upcoming-list { display: flex; flex-direction: column; gap: 2px; }
.upcoming-item {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-2) var(--space-3); background: var(--bg-surface);
  border: 1px solid var(--bg-border); border-left: 3px solid var(--uc);
  border-radius: var(--radius-md);
}
.upcoming-date { font-size: var(--text-xs); color: var(--text-muted); font-weight: 600; font-variant-numeric: tabular-nums; min-width: 36px; }
.upcoming-info { flex: 1; min-width: 0; }
.upcoming-title { font-size: var(--text-xs); color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0; font-weight: 500; }
.upcoming-type { font-size: 10px; color: var(--text-muted); }

/* Streams */
.stream-list { display: flex; flex-direction: column; gap: var(--space-2); }
.stream-card {
  background: var(--bg-surface); border: 1px solid var(--bg-border);
  border-left: 3px solid var(--tautulli); border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4); display: flex; flex-direction: column; gap: var(--space-1);
}
.stream-top { display: flex; align-items: center; gap: var(--space-2); }
.stream-user { font-size: var(--text-sm); font-weight: 600; color: var(--tautulli); flex: 1; }
.stream-state { font-size: var(--text-xs); }
.state-play { color: var(--status-success); }
.state-pause { color: var(--text-muted); }
.stream-pct { font-size: var(--text-xs); color: var(--text-muted); font-variant-numeric: tabular-nums; }
.stream-title { font-size: var(--text-xs); color: var(--text-secondary); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stream-meta-row { display: flex; gap: var(--space-3); }
.stream-meta-row > * { font-size: 10px; color: var(--text-muted); }
.stream-bar-wrap { height: 2px; background: var(--bg-elevated); border-radius: 99px; overflow: hidden; margin-top: 2px; }
.stream-bar { height: 100%; background: var(--tautulli); opacity: .7; border-radius: 99px; transition: width 1s ease; }

/* Requests */
.req-list { display: flex; flex-direction: column; gap: 2px; }
.req-item {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-2) var(--space-3); background: var(--bg-surface);
  border: 1px solid var(--bg-border); border-radius: var(--radius-md); cursor: pointer;
  transition: background .15s;
}
.req-item:hover { background: var(--bg-elevated); }
.req-badge { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px; flex-shrink: 0; }
.req-movie { background: rgba(244,165,74,.12); color: var(--radarr); border: 1px solid rgba(244,165,74,.25); }
.req-tv    { background: rgba(53,197,244,.12); color: var(--sonarr); border: 1px solid rgba(53,197,244,.25); }
.req-title { font-size: var(--text-xs); color: var(--text-secondary); font-weight: 500; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.req-by    { font-size: 10px; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }

/* History */
.history-list { display: flex; flex-direction: column; gap: 2px; }
.history-item {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-2) var(--space-3); background: var(--bg-surface);
  border: 1px solid var(--bg-border); border-radius: var(--radius-md);
}
.history-thumb { width: 36px; height: 36px; flex-shrink: 0; border-radius: var(--radius-sm); overflow: hidden; background: var(--bg-elevated); }
.history-thumb img { width: 100%; height: 100%; object-fit: cover; }
.history-thumb-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 16px; }
.history-info { flex: 1; min-width: 0; }
.history-title { font-size: var(--text-xs); color: var(--text-secondary); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0 0 2px; }
.history-meta { display: flex; gap: var(--space-2); align-items: center; }
.history-action { font-size: 10px; font-weight: 600; }
.history-quality, .history-size { font-size: 10px; color: var(--text-muted); }
.history-date { font-size: 10px; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }

/* Badge Pill */
.badge-pill { font-size: var(--text-xs); font-weight: 700; padding: 1px 8px; border-radius: 99px; border: 1px solid; }

/* Empty */
.empty-inline { font-size: var(--text-sm); color: var(--text-muted); padding: var(--space-4) 0; }

@keyframes shimmer { 0%, 100% { opacity: .4; } 50% { opacity: .9; } }
</style>
