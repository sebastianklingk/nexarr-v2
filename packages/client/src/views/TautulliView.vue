<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useApi } from '../composables/useApi.js';

const { get } = useApi();

// ── State ────────────────────────────────────────────────────────────────────

interface StatRow {
  title?: string;
  grandparent_title?: string;
  year?: number;
  play_count: number;
  users_watched?: number;
  // Users
  friendly_name?: string;
  user?: string;
  // Platforms
  platform?: string;
  // Thumbs
  thumb?: string;
  grandparent_thumb?: string;
}

interface StatCard {
  stat_id: string;
  stat_type: string;
  count?: number;
  rows: StatRow[];
}

interface HistoryEntry {
  id: number;
  date: number;
  title: string;
  grandparent_title?: string;
  full_title?: string;
  media_type: 'movie' | 'episode' | 'track';
  user: string;
  player: string;
  duration: number;
  watched_status: number;
  thumb?: string;
}

interface HistoryResponse {
  data: HistoryEntry[];
  recordsFiltered?: number;
  recordsTotal?: number;
}

const stats       = ref<StatCard[]>([]);
const history     = ref<HistoryEntry[]>([]);
const historyTotal = ref(0);
const isLoadingStats   = ref(true);
const isLoadingHistory = ref(true);
const errorStats   = ref<string | null>(null);
const errorHistory = ref<string | null>(null);
const activeTab    = ref<'top' | 'history'>('top');

// ── Computed ─────────────────────────────────────────────────────────────────

const topMovies  = computed(() => stats.value.find(s => s.stat_id === 'top_movies'));
const topShows   = computed(() => stats.value.find(s => s.stat_id === 'top_tv'));
const topUsers   = computed(() => stats.value.find(s => s.stat_id === 'top_users'));
const topPlatforms = computed(() => stats.value.find(s => s.stat_id === 'top_platforms'));

function maxPlayCount(card: StatCard | undefined): number {
  if (!card?.rows?.length) return 1;
  return Math.max(...card.rows.map(r => r.play_count), 1);
}

function barWidth(row: StatRow, card: StatCard | undefined): string {
  const max = maxPlayCount(card);
  return `${Math.round((row.play_count / max) * 100)}%`;
}

function rowLabel(row: StatRow, statId: string): string {
  if (statId === 'top_users')     return row.friendly_name ?? row.user ?? '–';
  if (statId === 'top_platforms') return row.platform ?? '–';
  if (row.grandparent_title)      return row.grandparent_title; // Serie
  return row.title ?? '–';
}

function rowSub(row: StatRow, statId: string): string {
  if (statId === 'top_tv' && row.title && row.grandparent_title) return row.title;
  if (row.year) return String(row.year);
  return '';
}

// ── History Helpers ───────────────────────────────────────────────────────────

function mediaTypeIcon(type: string): string {
  if (type === 'movie')   return '🎬';
  if (type === 'episode') return '📺';
  if (type === 'track')   return '🎵';
  return '▶';
}

function mediaTypeBg(type: string): string {
  if (type === 'movie')   return 'rgba(244,165,74,0.12)';
  if (type === 'episode') return 'rgba(53,197,244,0.12)';
  if (type === 'track')   return 'rgba(34,198,91,0.12)';
  return 'transparent';
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
    + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(sec: number): string {
  if (!sec) return '–';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Load ─────────────────────────────────────────────────────────────────────

onMounted(async () => {
  // Stats
  try {
    const data = await get<StatCard[]>('/api/tautulli/stats');
    stats.value = Array.isArray(data) ? data : [];
  } catch (e) {
    errorStats.value = e instanceof Error ? e.message : 'Fehler beim Laden';
  } finally {
    isLoadingStats.value = false;
  }

  // History
  try {
    const data = await get<HistoryResponse>('/api/tautulli/history');
    history.value = data?.data ?? [];
    historyTotal.value = data?.recordsTotal ?? 0;
  } catch (e) {
    errorHistory.value = e instanceof Error ? e.message : 'Fehler beim Laden';
  } finally {
    isLoadingHistory.value = false;
  }
});
</script>

<template>
  <div class="tautulli-view">

    <!-- Header -->
    <div class="view-header">
      <div class="view-header-inner">
        <div class="header-indicator" />
        <div>
          <h1 class="view-title">Statistiken</h1>
          <p class="view-subtitle">Wiedergabe-Aktivität · letzte 30 Tage</p>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs-bar">
      <button
        v-for="tab in (['top', 'history'] as const)"
        :key="tab"
        :class="['tab-btn', { active: activeTab === tab }]"
        @click="activeTab = tab"
      >
        {{ tab === 'top' ? 'Top-Inhalte' : 'Verlauf' }}
        <span v-if="tab === 'history' && historyTotal" class="tab-count">{{ historyTotal }}</span>
      </button>
    </div>

    <!-- ── Tab: Top-Inhalte ───────────────────────────────────────────────── -->
    <div v-if="activeTab === 'top'" class="tab-content">

      <!-- Loading -->
      <div v-if="isLoadingStats" class="stats-grid">
        <div v-for="i in 4" :key="i" class="stat-card skeleton-card">
          <div class="skeleton skeleton-title-sm" />
          <div v-for="j in 5" :key="j" class="skeleton skeleton-bar" />
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="errorStats" class="error-state">
        <p>{{ errorStats }}</p>
      </div>

      <!-- Empty -->
      <div v-else-if="!stats.length" class="empty-state">
        <p class="empty-title">Keine Statistiken verfügbar</p>
        <p class="empty-sub">Tautulli ist möglicherweise nicht konfiguriert.</p>
      </div>

      <!-- Grid -->
      <div v-else class="stats-grid">

        <!-- Top Filme -->
        <div v-if="topMovies?.rows?.length" class="stat-card">
          <div class="stat-card-header">
            <span class="stat-card-icon movie-icon">🎬</span>
            <span class="stat-card-title">Top Filme</span>
          </div>
          <div class="bar-list">
            <div v-for="row in topMovies.rows" :key="row.title" class="bar-row">
              <div class="bar-label-wrap">
                <span class="bar-label">{{ rowLabel(row, 'top_movies') }}</span>
                <span v-if="rowSub(row, 'top_movies')" class="bar-sub">{{ rowSub(row, 'top_movies') }}</span>
              </div>
              <div class="bar-track">
                <div
                  class="bar-fill bar-movie"
                  :style="`width: ${barWidth(row, topMovies)}`"
                />
              </div>
              <span class="bar-count">{{ row.play_count }}×</span>
            </div>
          </div>
        </div>

        <!-- Top Serien -->
        <div v-if="topShows?.rows?.length" class="stat-card">
          <div class="stat-card-header">
            <span class="stat-card-icon">📺</span>
            <span class="stat-card-title">Top Serien</span>
          </div>
          <div class="bar-list">
            <div v-for="row in topShows.rows" :key="(row.grandparent_title ?? '') + row.title" class="bar-row">
              <div class="bar-label-wrap">
                <span class="bar-label">{{ rowLabel(row, 'top_tv') }}</span>
                <span v-if="rowSub(row, 'top_tv')" class="bar-sub">{{ rowSub(row, 'top_tv') }}</span>
              </div>
              <div class="bar-track">
                <div
                  class="bar-fill bar-show"
                  :style="`width: ${barWidth(row, topShows)}`"
                />
              </div>
              <span class="bar-count">{{ row.play_count }}×</span>
            </div>
          </div>
        </div>

        <!-- Top User -->
        <div v-if="topUsers?.rows?.length" class="stat-card">
          <div class="stat-card-header">
            <span class="stat-card-icon">👤</span>
            <span class="stat-card-title">Aktivste Nutzer</span>
          </div>
          <div class="bar-list">
            <div v-for="row in topUsers.rows" :key="row.user" class="bar-row">
              <div class="bar-label-wrap">
                <span class="bar-label">{{ rowLabel(row, 'top_users') }}</span>
              </div>
              <div class="bar-track">
                <div
                  class="bar-fill bar-user"
                  :style="`width: ${barWidth(row, topUsers)}`"
                />
              </div>
              <span class="bar-count">{{ row.play_count }}×</span>
            </div>
          </div>
        </div>

        <!-- Top Plattformen -->
        <div v-if="topPlatforms?.rows?.length" class="stat-card">
          <div class="stat-card-header">
            <span class="stat-card-icon">📱</span>
            <span class="stat-card-title">Plattformen</span>
          </div>
          <div class="bar-list">
            <div v-for="row in topPlatforms.rows" :key="row.platform" class="bar-row">
              <div class="bar-label-wrap">
                <span class="bar-label">{{ rowLabel(row, 'top_platforms') }}</span>
              </div>
              <div class="bar-track">
                <div
                  class="bar-fill bar-platform"
                  :style="`width: ${barWidth(row, topPlatforms)}`"
                />
              </div>
              <span class="bar-count">{{ row.play_count }}×</span>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- ── Tab: Verlauf ───────────────────────────────────────────────────── -->
    <div v-if="activeTab === 'history'" class="tab-content">

      <!-- Loading -->
      <div v-if="isLoadingHistory" class="history-list">
        <div v-for="i in 10" :key="i" class="history-row skeleton-row">
          <div class="skeleton skeleton-icon-sm" />
          <div class="history-info">
            <div class="skeleton skeleton-title-sm" />
            <div class="skeleton skeleton-meta-sm" />
          </div>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="errorHistory" class="error-state">
        <p>{{ errorHistory }}</p>
      </div>

      <!-- Empty -->
      <div v-else-if="!history.length" class="empty-state">
        <p class="empty-title">Kein Verlauf</p>
      </div>

      <!-- List -->
      <div v-else class="history-list">
        <div
          v-for="entry in history"
          :key="entry.id"
          class="history-row"
          :style="`background: ${mediaTypeBg(entry.media_type)}`"
        >
          <div class="history-type-icon">{{ mediaTypeIcon(entry.media_type) }}</div>
          <div class="history-info">
            <span class="history-title">
              {{ entry.grandparent_title ? entry.grandparent_title + ' – ' : '' }}{{ entry.title }}
            </span>
            <span class="history-meta">
              <span class="history-user">{{ entry.user }}</span>
              <span class="meta-sep">·</span>
              <span>{{ entry.player }}</span>
              <span class="meta-sep">·</span>
              <span>{{ formatDuration(entry.duration) }}</span>
            </span>
          </div>
          <div class="history-right">
            <span :class="['watched-dot', entry.watched_status ? 'watched' : 'partial']" title="Gesehen" />
            <span class="history-date">{{ formatDate(entry.date) }}</span>
          </div>
        </div>
      </div>

    </div>

  </div>
</template>

<style scoped>
.tautulli-view {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.view-header {
  padding: var(--space-6) var(--space-6) var(--space-4);
  border-bottom: 1px solid var(--bg-border);
}

.view-header-inner {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.header-indicator {
  width: 4px;
  height: 36px;
  background: var(--tautulli);
  border-radius: 2px;
  flex-shrink: 0;
}

.view-title {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.view-subtitle {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-top: 2px;
}

/* ── Tabs ────────────────────────────────────────────────────────────────── */
.tabs-bar {
  display: flex;
  border-bottom: 1px solid var(--bg-border);
  padding: 0 var(--space-6);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  font-size: var(--text-sm);
  color: var(--text-muted);
  border-bottom: 2px solid transparent;
  transition: color 0.15s ease, border-color 0.15s ease;
  margin-bottom: -1px;
}
.tab-btn:hover { color: var(--text-secondary); }
.tab-btn.active {
  color: var(--text-primary);
  border-bottom-color: var(--tautulli);
}

.tab-count {
  padding: 1px 7px;
  background: var(--bg-elevated);
  border-radius: 99px;
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* ── Tab Content ─────────────────────────────────────────────────────────── */
.tab-content {
  padding: var(--space-6);
  flex: 1;
}

/* ── Stats Grid ──────────────────────────────────────────────────────────── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-4);
}

.stat-card {
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.stat-card-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.stat-card-icon {
  font-size: 16px;
  line-height: 1;
}

.stat-card-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* ── Bar Chart ───────────────────────────────────────────────────────────── */
.bar-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.bar-row {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto;
  column-gap: var(--space-3);
  align-items: center;
}

.bar-label-wrap {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  grid-column: 1;
  grid-row: 1;
}

.bar-label {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-sub {
  font-size: var(--text-xs);
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-track {
  grid-column: 1;
  grid-row: 2;
  height: 5px;
  background: var(--bg-border);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 4px;
}

.bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.bar-movie    { background: var(--radarr); }
.bar-show     { background: var(--sonarr); }
.bar-user     { background: var(--tautulli); }
.bar-platform { background: var(--plex); }

.bar-count {
  grid-column: 2;
  grid-row: 1 / 3;
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  align-self: center;
}

/* ── Skeleton: Stats ─────────────────────────────────────────────────────── */
.skeleton-card {
  min-height: 220px;
}

.skeleton-title-sm {
  height: 14px;
  width: 40%;
  border-radius: var(--radius-sm);
}

.skeleton-bar {
  height: 28px;
  width: 100%;
  border-radius: var(--radius-sm);
}

/* ── History ─────────────────────────────────────────────────────────────── */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 900px;
}

.history-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  border: 1px solid var(--bg-border);
  transition: background 0.12s ease;
}

.history-row:hover {
  border-color: rgba(229, 160, 13, 0.25);
}

.history-type-icon {
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
}

.history-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history-title {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-muted);
  flex-wrap: wrap;
}

.history-user { color: var(--tautulli); }
.meta-sep { color: var(--bg-border); }

.history-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.watched-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: block;
}
.watched-dot.watched { background: var(--status-success); }
.watched-dot.partial { background: var(--status-warning, var(--radarr)); opacity: 0.6; }

.history-date {
  font-size: var(--text-xs);
  color: var(--text-muted);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* ── Skeleton: History ───────────────────────────────────────────────────── */
.skeleton-row {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-md);
}

.skeleton-icon-sm {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.skeleton-meta-sm {
  height: 12px;
  width: 55%;
  border-radius: var(--radius-sm);
  margin-top: 4px;
}

/* ── Error / Empty ───────────────────────────────────────────────────────── */
.error-state {
  padding: var(--space-8);
  text-align: center;
  color: var(--status-error);
  font-size: var(--text-sm);
}

.empty-state {
  padding: var(--space-12) var(--space-8);
  text-align: center;
}

.empty-title {
  font-size: var(--text-lg);
  color: var(--text-secondary);
  font-weight: 600;
}

.empty-sub {
  margin-top: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-muted);
}
</style>
