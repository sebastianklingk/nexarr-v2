<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue';
import { useQueueStore } from '../stores/queue.store.js';
import { useApi } from '../composables/useApi.js';
import type { ArrQueueItem } from '@nexarr/shared';

const queue = useQueueStore();
const { post, del } = useApi();

onMounted(() => queue.subscribe());
onUnmounted(() => queue.unsubscribe());

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    downloading:  'Lädt',
    queued:       'Warteschlange',
    paused:       'Pausiert',
    completed:    'Fertig',
    failed:       'Fehler',
    warning:      'Warnung',
    delay:        'Verzögert',
    downloadClientUnavailable: 'Client fehlt',
  };
  return map[status.toLowerCase()] ?? status;
}

function statusClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'downloading')  return 'status-active';
  if (s === 'completed')    return 'status-done';
  if (s === 'failed')       return 'status-error';
  if (s === 'warning')      return 'status-warn';
  return 'status-idle';
}

function appColor(app: ArrQueueItem['app']): string {
  if (app === 'radarr')  return 'var(--radarr)';
  if (app === 'sonarr')  return 'var(--sonarr)';
  if (app === 'lidarr')  return 'var(--lidarr)';
  return 'var(--text-muted)';
}

function appLabel(app: ArrQueueItem['app']): string {
  if (app === 'radarr')  return 'Film';
  if (app === 'sonarr')  return 'Serie';
  if (app === 'lidarr')  return 'Musik';
  return app;
}

// ── SABnzbd Actions ───────────────────────────────────────────────────────────

async function togglePause() {
  const action = queue.sabnzbd?.paused ? 'resume' : 'pause';
  await post(`/api/sabnzbd/${action}`);
}

async function deleteSabItem(nzoId: string) {
  await del(`/api/sabnzbd/queue/${nzoId}`);
}

// ── Speed indicator ───────────────────────────────────────────────────────────

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
</script>

<template>
  <div class="downloads-view page-context" style="--context-color: var(--sabnzbd)">

    <!-- Header -->
    <div class="view-header">
      <div class="header-left">
        <h1 class="view-title">
          <span class="title-bar" />
          Downloads
          <span v-if="queue.totalCount > 0" class="title-count">{{ queue.totalCount }}</span>
        </h1>
        <div class="header-stats">
          <span
            :class="['connection-dot', queue.isConnected ? 'connected' : 'disconnected']"
            :title="queue.isConnected ? 'Live' : 'Nicht verbunden'"
          />
          <span class="stat-label">{{ queue.isConnected ? 'Live' : 'Verbinde…' }}</span>
        </div>
      </div>
    </div>

    <!-- SABnzbd Panel -->
    <section v-if="queue.sabnzbd" class="sab-panel">
      <div class="sab-header">
        <div class="sab-title-row">
          <span class="app-badge" style="background: rgba(245,197,24,0.12); border-color: rgba(245,197,24,0.3); color: var(--sabnzbd)">
            SABnzbd
          </span>
          <span class="sab-speed">{{ speedLabel }}</span>
          <span v-if="queue.sabnzbd.paused" class="paused-badge">⏸ Pausiert</span>
          <div class="sab-actions">
            <button class="action-btn" @click="togglePause">
              {{ queue.sabnzbd.paused ? '▶ Fortsetzen' : '⏸ Pausieren' }}
            </button>
          </div>
        </div>

        <!-- Gesamt-Progress -->
        <div v-if="queue.sabnzbd.mbTotal > 0" class="sab-progress-row">
          <div class="progress-bar-wrap">
            <div
              class="progress-bar sab-bar"
              :style="{ width: `${downloadPercent}%` }"
            />
          </div>
          <span class="progress-meta">
            {{ fmtSize(queue.sabnzbd.mbTotal - queue.sabnzbd.mbLeft) }}
            / {{ fmtSize(queue.sabnzbd.mbTotal) }}
          </span>
        </div>
      </div>

      <!-- SAB Slots -->
      <div v-if="queue.sabnzbd.slots.length > 0" class="queue-list">
        <div
          v-for="slot in queue.sabnzbd.slots"
          :key="slot.nzo_id"
          class="queue-item sab-item"
        >
          <div class="item-main">
            <div class="item-title-row">
              <span class="item-title">{{ slot.filename }}</span>
              <span :class="['status-badge', statusClass(slot.status)]">
                {{ statusLabel(slot.status) }}
              </span>
            </div>
            <div class="progress-bar-wrap item-progress">
              <div
                class="progress-bar sab-bar"
                :style="{ width: `${slot.percentage}%` }"
              />
            </div>
            <div class="item-meta-row">
              <span class="item-cat">{{ slot.cat }}</span>
              <span class="item-size">{{ fmtSize(slot.mbLeft) }} übrig</span>
              <span v-if="slot.timeleft" class="item-eta">ETA {{ slot.timeleft }}</span>
              <span class="item-pct">{{ slot.percentage.toFixed(0) }}%</span>
            </div>
          </div>
          <button class="delete-btn" title="Entfernen" @click="deleteSabItem(slot.nzo_id)">
            ✕
          </button>
        </div>
      </div>
      <div v-else class="queue-empty">Keine aktiven Downloads in SABnzbd</div>
    </section>

    <!-- Arr Queues (Radarr / Sonarr / Lidarr) -->
    <section v-if="queue.arrItems.length > 0" class="arr-panel">
      <h2 class="section-title">Arr-Warteschlangen</h2>

      <div class="queue-list">
        <div
          v-for="item in queue.arrItems"
          :key="`${item.app}-${item.id}`"
          class="queue-item arr-item"
          :style="{ '--item-color': appColor(item.app) }"
        >
          <div class="item-accent" />
          <div class="item-main">
            <div class="item-title-row">
              <span class="item-app-badge">{{ appLabel(item.app) }}</span>
              <span class="item-title">{{ item.title }}</span>
              <span :class="['status-badge', statusClass(item.status)]">
                {{ statusLabel(item.status) }}
              </span>
            </div>

            <div class="progress-bar-wrap item-progress">
              <div
                class="progress-bar arr-bar"
                :style="{ width: `${item.progress}%`, background: 'var(--item-color)' }"
              />
            </div>

            <div class="item-meta-row">
              <span class="item-protocol">{{ item.protocol }}</span>
              <span v-if="item.indexer" class="item-indexer">{{ item.indexer }}</span>
              <span class="item-size">{{ fmtSize((item.sizeleft ?? 0) / 1_000_000) }} übrig</span>
              <span v-if="item.timeleft" class="item-eta">ETA {{ item.timeleft }}</span>
              <span class="item-pct">{{ item.progress }}%</span>
            </div>

            <div v-if="item.errorMessage" class="item-error">
              {{ item.errorMessage }}
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Alles leer -->
    <div
      v-if="!queue.sabnzbd && queue.arrItems.length === 0 && !queue.lastError"
      class="empty-state"
    >
      <div class="empty-icon">📭</div>
      <p class="empty-title">Keine aktiven Downloads</p>
      <p class="empty-sub">
        {{ queue.isConnected
          ? 'Alles ruhig – keine Dateien in der Warteschlange.'
          : 'Verbinde mit dem Server…' }}
      </p>
    </div>

    <!-- Fehler -->
    <div v-if="queue.lastError" class="error-banner">
      {{ queue.lastError }}
    </div>

  </div>
</template>

<style scoped>
.downloads-view {
  padding: var(--space-6);
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* ── Header ── */
.view-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

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

.title-count {
  font-size: var(--text-base);
  font-weight: 400;
  color: var(--text-muted);
}

.header-stats {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.connection-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.connection-dot.connected    { background: var(--status-success); box-shadow: 0 0 4px var(--status-success); }
.connection-dot.disconnected { background: var(--text-muted); }

.stat-label {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* ── Panels ── */
.sab-panel,
.arr-panel {
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.sab-header {
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--bg-border);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.sab-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.app-badge {
  font-size: var(--text-xs);
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 99px;
  border: 1px solid;
  letter-spacing: 0.04em;
}

.sab-speed {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.paused-badge {
  font-size: var(--text-xs);
  color: var(--sabnzbd);
  background: rgba(245, 197, 24, 0.1);
  border: 1px solid rgba(245, 197, 24, 0.25);
  border-radius: 99px;
  padding: 2px 8px;
}

.sab-actions {
  margin-left: auto;
}

.action-btn {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  background: var(--bg-elevated);
  border: 1px solid var(--bg-border);
  color: var(--text-secondary);
  transition: background 0.15s ease, color 0.15s ease;
  cursor: pointer;
}
.action-btn:hover {
  background: var(--bg-overlay);
  color: var(--text-primary);
}

/* ── Progress Bars ── */
.sab-progress-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.progress-bar-wrap {
  flex: 1;
  height: 4px;
  background: var(--bg-elevated);
  border-radius: 99px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  border-radius: 99px;
  transition: width 0.5s ease;
}

.sab-bar { background: var(--sabnzbd); }

.progress-meta {
  font-size: var(--text-xs);
  color: var(--text-muted);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

/* ── Queue List ── */
.queue-list {
  display: flex;
  flex-direction: column;
}

.queue-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--bg-border);
  transition: background 0.1s ease;
}
.queue-item:last-child { border-bottom: none; }
.queue-item:hover      { background: var(--bg-elevated); }

.item-accent {
  width: 3px;
  align-self: stretch;
  border-radius: 2px;
  background: var(--item-color, var(--text-muted));
  flex-shrink: 0;
}

.item-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.item-title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.item-app-badge {
  font-size: var(--text-xs);
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--item-color, var(--text-muted)) 15%, transparent);
  color: var(--item-color, var(--text-muted));
  border: 1px solid color-mix(in srgb, var(--item-color, var(--text-muted)) 30%, transparent);
  white-space: nowrap;
}

.item-title {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.item-progress {
  flex: none;
}

.arr-bar {
  height: 100%;
  border-radius: 99px;
  transition: width 0.5s ease;
  opacity: 0.85;
}

.item-meta-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.item-meta-row > * {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.item-cat,
.item-protocol {
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 500;
}

.item-pct {
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}

.item-error {
  font-size: var(--text-xs);
  color: var(--status-error);
  background: rgba(248, 113, 113, 0.08);
  border-radius: var(--radius-sm);
  padding: 3px 8px;
}

/* ── Status Badges ── */
.status-badge {
  font-size: var(--text-xs);
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
  white-space: nowrap;
}

.status-active {
  background: rgba(34, 197, 94, 0.12);
  color: var(--status-success);
  border: 1px solid rgba(34, 197, 94, 0.2);
}
.status-done {
  background: rgba(99, 102, 241, 0.12);
  color: #818cf8;
  border: 1px solid rgba(99, 102, 241, 0.2);
}
.status-error {
  background: rgba(248, 113, 113, 0.12);
  color: var(--status-error);
  border: 1px solid rgba(248, 113, 113, 0.2);
}
.status-warn {
  background: rgba(245, 197, 24, 0.12);
  color: var(--sabnzbd);
  border: 1px solid rgba(245, 197, 24, 0.2);
}
.status-idle {
  background: var(--bg-elevated);
  color: var(--text-muted);
  border: 1px solid var(--bg-border);
}

/* ── Section Title ── */
.section-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-tertiary);
  padding: var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--bg-border);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0;
}

/* ── Empty ── */
.queue-empty {
  padding: var(--space-6) var(--space-5);
  font-size: var(--text-sm);
  color: var(--text-muted);
  text-align: center;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-4);
  gap: var(--space-3);
  text-align: center;
  flex: 1;
}

.empty-icon  { font-size: 48px; line-height: 1; }
.empty-title { font-size: var(--text-lg); color: var(--text-secondary); font-weight: 600; margin: 0; }
.empty-sub   { color: var(--text-muted); font-size: var(--text-sm); margin: 0; }

/* ── Delete Button ── */
.delete-btn {
  opacity: 0;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  background: transparent;
  border: 1px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
  align-self: center;
}

.queue-item:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background: rgba(248, 113, 113, 0.1);
  border-color: rgba(248, 113, 113, 0.3);
  color: var(--status-error);
}

/* ── Error Banner ── */
.error-banner {
  padding: var(--space-4);
  background: rgba(248, 113, 113, 0.1);
  border: 1px solid rgba(248, 113, 113, 0.3);
  border-radius: var(--radius-md);
  color: var(--status-error);
  font-size: var(--text-sm);
}
</style>
