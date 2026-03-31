<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useMoviesStore } from '../stores/movies.store.js';
import { useSeriesStore } from '../stores/series.store.js';
import { useMusicStore } from '../stores/music.store.js';
import { useQueueStore } from '../stores/queue.store.js';
import { useApi } from '../composables/useApi.js';
import type { TautulliStream, OverseerrRequest } from '@nexarr/shared';

const router = useRouter();
const movies = useMoviesStore();
const series = useSeriesStore();
const music  = useMusicStore();
const queue  = useQueueStore();
const { get } = useApi();

// Tautulli
interface TautulliMini { stream_count: number; total_bandwidth: number; sessions: TautulliStream[]; }
const tautulli = ref<TautulliMini | null>(null);
async function loadTautulli() {
  try { tautulli.value = await get<TautulliMini>('/api/tautulli/activity'); } catch { /* nicht konfiguriert */ }
}

// Overseerr
const pendingRequests = ref<OverseerrRequest[]>([]);
async function loadOverseerr() {
  try { pendingRequests.value = await get<OverseerrRequest[]>('/api/overseerr/requests?filter=pending'); } catch { /* nicht konfiguriert */ }
}

onMounted(async () => {
  await Promise.allSettled([
    movies.fetchMovies(),
    series.fetchSeries(),
    music.fetchArtists(),
    loadTautulli(),
    loadOverseerr(),
  ]);
  queue.subscribe();
});

onUnmounted(() => queue.unsubscribe());

// ── Stats Cards ───────────────────────────────────────────────────────────────

const libraryCards = computed(() => [
  {
    key:     'movies',
    label:   'Filme',
    icon:    '🎬',
    color:   'var(--radarr)',
    route:   '/movies',
    total:   movies.stats?.total   ?? 0,
    sub:     movies.stats?.available ?? 0,
    subLabel: 'vorhanden',
    loading: movies.isLoading,
  },
  {
    key:     'series',
    label:   'Serien',
    icon:    '📺',
    color:   'var(--sonarr)',
    route:   '/series',
    total:   series.stats?.total ?? 0,
    sub:     series.stats?.continuing ?? 0,
    subLabel: 'laufend',
    loading: series.isLoading,
  },
  {
    key:     'music',
    label:   'Künstler',
    icon:    '🎵',
    color:   'var(--lidarr)',
    route:   '/music',
    total:   music.stats?.total ?? 0,
    sub:     music.stats?.monitored ?? 0,
    subLabel: 'überwacht',
    loading: music.isLoading,
  },
]);

// ── Download Summary ──────────────────────────────────────────────────────────

const hasDownloads = computed(() => queue.totalCount > 0);

const downloadSummary = computed(() => {
  const arr = queue.arrItems.length;
  const sab = queue.sabnzbd?.slotCount ?? 0;
  return { arr, sab, speed: queue.sabnzbd?.speedMbs ?? 0 };
});

const speedLabel = computed(() => {
  const s = downloadSummary.value.speed;
  if (s === 0) return queue.sabnzbd?.paused ? '⏸ Pausiert' : 'Bereit';
  if (s < 1)   return `${(s * 1024).toFixed(0)} KB/s`;
  return `${s.toFixed(1)} MB/s`;
});

function navigate(route: string) {
  router.push(route);
}
</script>

<template>
  <div class="dashboard-view page-context" style="--context-color: var(--nexarr)">

    <!-- Header -->
    <div class="view-header">
      <h1 class="view-title">
        <span class="title-bar" />
        Dashboard
      </h1>
    </div>

    <!-- Library Stats -->
    <section class="section">
      <h2 class="section-label">Bibliothek</h2>

      <div class="stats-grid">
        <button
          v-for="card in libraryCards"
          :key="card.key"
          class="stat-card"
          :style="{ '--card-color': card.color }"
          @click="navigate(card.route)"
        >
          <div class="card-icon">{{ card.icon }}</div>
          <div class="card-body">
            <div class="card-label">{{ card.label }}</div>
            <div class="card-number">
              <span v-if="card.loading" class="skeleton-num" />
              <span v-else>{{ card.total.toLocaleString('de-DE') }}</span>
            </div>
            <div class="card-sub">
              <span v-if="!card.loading">{{ card.sub.toLocaleString('de-DE') }} {{ card.subLabel }}</span>
            </div>
          </div>
          <div class="card-chevron">›</div>
        </button>
      </div>
    </section>

    <!-- Downloads -->
    <section class="section">
      <div class="section-header-row">
        <h2 class="section-label">Downloads</h2>
        <button class="link-btn" @click="navigate('/downloads')">Alle anzeigen ›</button>
      </div>

      <!-- Verbindungs-Indikator -->
      <div class="connection-row">
        <span :class="['dot', queue.isConnected ? 'dot-live' : 'dot-off']" />
        <span class="conn-label">{{ queue.isConnected ? 'Live' : 'Verbinde…' }}</span>
      </div>

      <!-- SABnzbd Speed Card -->
      <div v-if="queue.sabnzbd" class="download-cards">
        <div class="dl-card sab-card">
          <div class="dl-card-header">
            <span class="dl-badge" style="color: var(--sabnzbd); border-color: rgba(245,197,24,0.3); background: rgba(245,197,24,0.08)">
              SABnzbd
            </span>
            <span class="dl-speed">{{ speedLabel }}</span>
            <span v-if="queue.sabnzbd.paused" class="dl-paused">Pausiert</span>
          </div>
          <div v-if="queue.sabnzbd.slotCount > 0" class="dl-count">
            {{ queue.sabnzbd.slotCount }} {{ queue.sabnzbd.slotCount === 1 ? 'Download' : 'Downloads' }}
          </div>
          <div v-else class="dl-empty">Keine aktiven Downloads</div>
        </div>

        <!-- Arr Summary -->
        <div v-if="queue.arrItems.length > 0" class="dl-card arr-card">
          <div class="dl-card-header">
            <span class="dl-badge" style="color: var(--text-tertiary); border-color: var(--bg-border)">
              Arr
            </span>
          </div>
          <div class="arr-summary">
            <span v-if="queue.radarrItems.length > 0" class="arr-chip" style="color: var(--radarr)">
              {{ queue.radarrItems.length }} Film{{ queue.radarrItems.length !== 1 ? 'e' : '' }}
            </span>
            <span v-if="queue.sonarrItems.length > 0" class="arr-chip" style="color: var(--sonarr)">
              {{ queue.sonarrItems.length }} Episode{{ queue.sonarrItems.length !== 1 ? 'n' : '' }}
            </span>
            <span v-if="queue.lidarrItems.length > 0" class="arr-chip" style="color: var(--lidarr)">
              {{ queue.lidarrItems.length }} Album{{ queue.lidarrItems.length !== 1 ? 's' : '' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Kein Download-System -->
      <div v-else-if="!queue.isConnected" class="dl-placeholder">
        <span class="placeholder-text">Verbinde…</span>
      </div>
      <div v-else class="dl-placeholder">
        <span class="placeholder-text">SABnzbd nicht konfiguriert</span>
      </div>

      <!-- Aktive Downloads Kurzliste -->
      <div v-if="hasDownloads && queue.sabnzbd?.slots.length" class="active-list">
        <div
          v-for="slot in queue.sabnzbd.slots.slice(0, 3)"
          :key="slot.nzo_id"
          class="active-item"
        >
          <div class="active-info">
            <span class="active-name">{{ slot.filename }}</span>
            <span class="active-meta">{{ slot.timeleft || slot.eta }}</span>
          </div>
          <div class="active-progress-wrap">
            <div class="active-progress" :style="{ width: `${slot.percentage}%` }" />
          </div>
        </div>
        <div v-if="(queue.sabnzbd?.slots.length ?? 0) > 3" class="more-hint">
          + {{ (queue.sabnzbd?.slots.length ?? 0) - 3 }} weitere →
        </div>
      </div>

    </section>

    <!-- Tautulli Streams -->
    <section v-if="tautulli" class="section">
      <div class="section-header-row">
        <h2 class="section-label">Aktive Streams</h2>
        <span class="section-badge" style="color: var(--tautulli)">{{ tautulli.stream_count }}</span>
      </div>
      <div v-if="tautulli.sessions.length === 0" class="dl-placeholder">
        <span class="placeholder-text">Keine aktiven Streams</span>
      </div>
      <div v-else class="stream-list">
        <div v-for="s in tautulli.sessions" :key="s.session_id" class="stream-card">
          <div class="stream-meta">
            <span class="stream-user">{{ s.friendly_name }}</span>
            <span class="stream-sep">·</span>
            <span class="stream-title">{{ s.grandparent_title ? `${s.grandparent_title} – ` : '' }}{{ s.title }}</span>
          </div>
          <div class="stream-sub">
            <span :class="['stream-state', s.state === 'playing' ? 'state-play' : 'state-pause']">{{ s.state === 'playing' ? '▶' : '⏸' }}</span>
            <span class="stream-progress">{{ s.progress_percent }}%</span>
            <span class="stream-decision">{{ s.transcode_decision ?? 'direct play' }}</span>
            <span class="stream-platform">{{ s.player ?? s.platform }}</span>
          </div>
          <div class="stream-bar-wrap">
            <div class="stream-bar" :style="{ width: `${s.progress_percent}%` }" />
          </div>
        </div>
      </div>
    </section>

    <!-- Overseerr Requests -->
    <section v-if="pendingRequests.length > 0" class="section">
      <div class="section-header-row">
        <h2 class="section-label">Pending Requests</h2>
        <button class="link-btn" @click="navigate('/settings')">Overseerr ›</button>
      </div>
      <div class="request-list">
        <div v-for="r in pendingRequests.slice(0, 5)" :key="r.id" class="request-card">
          <span :class="['request-type', r.type === 'movie' ? 'type-movie' : 'type-tv']">{{ r.type === 'movie' ? 'Film' : 'Serie' }}</span>
          <span class="request-title">{{ r.media?.title ?? `TMDB #${r.media?.tmdbId}` }}</span>
          <span class="request-by">von {{ r.requestedBy?.displayName }}</span>
        </div>
      </div>
    </section>

    <!-- Quick Nav -->
    <section class="section">
      <h2 class="section-label">Schnellzugriff</h2>
      <div class="quick-nav">
        <button class="quick-btn" @click="navigate('/downloads')">
          <span class="quick-icon">⬇️</span>Downloads
        </button>
        <button class="quick-btn" @click="navigate('/calendar')">
          <span class="quick-icon">📅</span>Kalender
        </button>
        <button class="quick-btn" @click="navigate('/search')">
          <span class="quick-icon">🔍</span>Suche
        </button>
        <button class="quick-btn" @click="navigate('/settings')">
          <span class="quick-icon">⚙️</span>Einstellungen
        </button>
      </div>
    </section>

  </div>
</template>

<style scoped>
.dashboard-view {
  padding: var(--space-6);
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

/* ── Header ── */
.view-header { margin-bottom: calc(-1 * var(--space-2)); }

.view-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.title-bar {
  display: inline-block;
  width: 3px;
  height: 1.2em;
  background: var(--context-color);
  border-radius: 2px;
  flex-shrink: 0;
}

/* ── Sections ── */
.section { display: flex; flex-direction: column; gap: var(--space-4); }

.section-label {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0;
}

.section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.link-btn {
  font-size: var(--text-xs);
  color: var(--text-muted);
  transition: color 0.15s ease;
}
.link-btn:hover { color: var(--text-secondary); }

/* ── Stats Grid ── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-3);
}

.stat-card {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-5);
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-left: 3px solid var(--card-color);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s ease;
  text-align: left;
}
.stat-card:hover {
  background: var(--bg-elevated);
  transform: translateY(-1px);
}

.card-icon {
  font-size: 28px;
  line-height: 1;
  flex-shrink: 0;
}

.card-body {
  flex: 1;
  min-width: 0;
}

.card-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--space-1);
}

.card-number {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.card-sub {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin-top: 3px;
}

.card-chevron {
  font-size: var(--text-xl);
  color: var(--text-muted);
  flex-shrink: 0;
}

.skeleton-num {
  display: inline-block;
  width: 60px;
  height: 28px;
  background: var(--bg-elevated);
  border-radius: 4px;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0%, 100% { opacity: 0.4; }
  50%       { opacity: 0.9; }
}

/* ── Connection ── */
.connection-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-live { background: var(--status-success); box-shadow: 0 0 4px var(--status-success); }
.dot-off  { background: var(--text-muted); }

.conn-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* ── Download Cards ── */
.download-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--space-3);
}

.dl-card {
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4) var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.dl-card-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.dl-badge {
  font-size: var(--text-xs);
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 99px;
  border: 1px solid;
  letter-spacing: 0.04em;
}

.dl-speed {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.dl-paused {
  font-size: var(--text-xs);
  color: var(--sabnzbd);
  opacity: 0.8;
}

.dl-count {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
}

.dl-empty {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

.arr-summary {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.arr-chip {
  font-size: var(--text-xs);
  font-weight: 500;
}

/* ── Active List ── */
.active-list {
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.active-item {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--bg-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.active-item:last-child { border-bottom: none; }

.active-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
}

.active-name {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.active-meta {
  font-size: var(--text-xs);
  color: var(--text-muted);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.active-progress-wrap {
  height: 3px;
  background: var(--bg-elevated);
  border-radius: 99px;
  overflow: hidden;
}

.active-progress {
  height: 100%;
  background: var(--sabnzbd);
  border-radius: 99px;
  transition: width 0.5s ease;
}

.more-hint {
  padding: var(--space-2) var(--space-4);
  font-size: var(--text-xs);
  color: var(--text-muted);
  text-align: center;
}

/* ── Placeholder ── */
.dl-placeholder {
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  text-align: center;
}

.placeholder-text {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

/* ── Quick Nav ── */
.quick-nav {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: var(--space-3);
}

.quick-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-lg);
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.quick-btn:hover {
  background: var(--bg-elevated);
  color: var(--text-secondary);
}

.quick-icon { font-size: 16px; line-height: 1; }

/* ── Section Badge ── */
.section-badge {
  font-size: var(--text-sm);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* ── Tautulli Streams ── */
.stream-list { display: flex; flex-direction: column; gap: var(--space-2); }

.stream-card {
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-left: 3px solid var(--tautulli);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.stream-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.stream-user {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--tautulli);
}

.stream-sep { color: var(--text-muted); }

.stream-title {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.stream-sub {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.stream-sub > * { font-size: var(--text-xs); color: var(--text-muted); }

.stream-state { font-size: var(--text-xs); }
.state-play { color: var(--status-success); }
.state-pause { color: var(--text-muted); }

.stream-bar-wrap {
  height: 2px;
  background: var(--bg-elevated);
  border-radius: 99px;
  overflow: hidden;
  margin-top: var(--space-1);
}

.stream-bar {
  height: 100%;
  background: var(--tautulli);
  border-radius: 99px;
  opacity: 0.7;
  transition: width 1s ease;
}

/* ── Overseerr Requests ── */
.request-list { display: flex; flex-direction: column; gap: 2px; }

.request-card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2) var(--space-4);
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-md);
}

.request-type {
  font-size: var(--text-xs);
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.type-movie {
  background: rgba(244,165,74,0.12);
  color: var(--radarr);
  border: 1px solid rgba(244,165,74,0.25);
}

.type-tv {
  background: rgba(53,197,244,0.12);
  color: var(--sonarr);
  border: 1px solid rgba(53,197,244,0.25);
}

.request-title {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: 500;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.request-by {
  font-size: var(--text-xs);
  color: var(--text-muted);
  white-space: nowrap;
  flex-shrink: 0;
}
</style>
