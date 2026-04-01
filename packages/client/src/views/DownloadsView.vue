<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useQueueStore } from '../stores/queue.store.js';
import { useApi } from '../composables/useApi.js';
import ConfirmDialog from '../components/ui/ConfirmDialog.vue';
import type { ArrQueueItem } from '@nexarr/shared';

const queue = useQueueStore();
const { post, del } = useApi();

onMounted(() => queue.subscribe());
onUnmounted(() => queue.unsubscribe());

// ── Delete Confirm ────────────────────────────────────────────────────────────
const showDeleteConfirm = ref(false);
const deletePendingId   = ref<string | null>(null);
const deletePendingType = ref<'sab' | 'arr'>('sab');
const deletePendingName = ref('');

function confirmDeleteSab(nzoId: string, name: string) {
  deletePendingId.value   = nzoId;
  deletePendingType.value = 'sab';
  deletePendingName.value = name;
  showDeleteConfirm.value = true;
}

function confirmDeleteArr(item: ArrQueueItem) {
  deletePendingId.value   = String(item.id);
  deletePendingType.value = 'arr';
  deletePendingName.value = item.title;
  showDeleteConfirm.value = true;
}

async function executeDelete() {
  if (!deletePendingId.value) return;
  if (deletePendingType.value === 'sab') {
    await del(`/api/sabnzbd/queue/${deletePendingId.value}`);
  }
  // Arr-Delete: aktuell kein generischer Endpoint – skip
}

// ── Per-Item SABnzbd Actions ──────────────────────────────────────────────────
const itemPending = ref<Record<string, 'pause'|'resume'|'delete'>>({});

async function pauseItem(nzoId: string) {
  itemPending.value[nzoId] = 'pause';
  try { await post(`/api/sabnzbd/queue/${nzoId}/pause`); }
  finally { delete itemPending.value[nzoId]; }
}

async function resumeItem(nzoId: string) {
  itemPending.value[nzoId] = 'resume';
  try { await post(`/api/sabnzbd/queue/${nzoId}/resume`); }
  finally { delete itemPending.value[nzoId]; }
}

// ── Global SABnzbd ────────────────────────────────────────────────────────────
const globalToggling = ref(false);

async function toggleGlobalPause() {
  if (globalToggling.value) return;
  globalToggling.value = true;
  try {
    const action = queue.sabnzbd?.paused ? 'resume' : 'pause';
    await post(`/api/sabnzbd/${action}`);
  } finally { globalToggling.value = false; }
}

// ── Speed / Progress ──────────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    downloading: 'Lädt', queued: 'Warteschl.', paused: 'Pausiert',
    completed: 'Fertig', failed: 'Fehler', warning: 'Warnung',
    delay: 'Verzögert', downloadClientUnavailable: 'Client fehlt',
  };
  return map[status.toLowerCase()] ?? status;
}

function statusClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'downloading') return 'st-active';
  if (s === 'completed')   return 'st-done';
  if (s === 'failed')      return 'st-error';
  if (s === 'warning')     return 'st-warn';
  if (s === 'paused')      return 'st-paused';
  return 'st-idle';
}

function appColor(app: ArrQueueItem['app']): string {
  if (app === 'radarr') return 'var(--radarr)';
  if (app === 'sonarr') return 'var(--sonarr)';
  if (app === 'lidarr') return 'var(--lidarr)';
  return 'var(--text-muted)';
}

function appLabel(app: ArrQueueItem['app']): string {
  if (app === 'radarr') return 'Film';
  if (app === 'sonarr') return 'Serie';
  if (app === 'lidarr') return 'Musik';
  return app;
}
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
          <span :class="['connection-dot', queue.isConnected ? 'connected' : 'disconnected']" />
          <span class="stat-label">{{ queue.isConnected ? 'Live' : 'Verbinde…' }}</span>
        </div>
      </div>
    </div>

    <!-- SABnzbd Panel -->
    <section v-if="queue.sabnzbd" class="panel">
      <div class="panel-header">
        <div class="panel-title-row">
          <span class="app-badge" style="background:rgba(245,197,24,.12);border-color:rgba(245,197,24,.3);color:var(--sabnzbd)">SABnzbd</span>
          <span class="sab-speed">{{ speedLabel }}</span>
          <span v-if="queue.sabnzbd.paused" class="paused-badge">⏸ Pausiert</span>
          <div class="panel-actions">
            <button class="ctrl-btn" :disabled="globalToggling" @click="toggleGlobalPause">
              <svg v-if="queue.sabnzbd.paused" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              {{ queue.sabnzbd.paused ? 'Fortsetzen' : 'Pausieren' }}
            </button>
          </div>
        </div>

        <!-- Gesamt-Progress -->
        <div v-if="queue.sabnzbd.mbTotal > 0" class="global-progress-row">
          <div class="prog-wrap">
            <div class="prog-bar sab-bar" :style="{ width: downloadPercent+'%' }" />
          </div>
          <span class="prog-meta">{{ fmtSize(queue.sabnzbd.mbTotal - queue.sabnzbd.mbLeft) }} / {{ fmtSize(queue.sabnzbd.mbTotal) }}</span>
          <span class="prog-pct">{{ downloadPercent }}%</span>
        </div>
      </div>

      <!-- SAB Slots -->
      <div v-if="queue.sabnzbd.slots.length > 0" class="queue-list">
        <div v-for="slot in queue.sabnzbd.slots" :key="slot.nzo_id" class="queue-item">
          <div class="item-main">
            <div class="item-top">
              <p class="item-title">{{ slot.filename }}</p>
              <span :class="['st-badge', statusClass(slot.status)]">{{ statusLabel(slot.status) }}</span>
            </div>
            <div class="prog-wrap item-prog">
              <div class="prog-bar sab-bar" :style="{ width: slot.percentage.toFixed(0)+'%' }" />
            </div>
            <div class="item-meta">
              <span class="meta-chip">{{ slot.cat }}</span>
              <span>{{ fmtSize(slot.mbLeft) }} übrig</span>
              <span v-if="slot.timeleft" class="meta-eta">ETA {{ slot.timeleft }}</span>
              <span class="meta-pct">{{ slot.percentage.toFixed(0) }}%</span>
            </div>
          </div>

          <!-- Per-Item Actions -->
          <div class="item-actions">
            <!-- Pause wenn aktiv, Resume wenn pausiert -->
            <button v-if="slot.status.toLowerCase() === 'paused'"
              class="ia-btn ia-resume" title="Fortsetzen"
              :disabled="!!itemPending[slot.nzo_id]"
              @click="resumeItem(slot.nzo_id)">
              <svg v-if="itemPending[slot.nzo_id]" class="spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
            <button v-else-if="slot.status.toLowerCase() === 'downloading'"
              class="ia-btn ia-pause" title="Pausieren"
              :disabled="!!itemPending[slot.nzo_id]"
              @click="pauseItem(slot.nzo_id)">
              <svg v-if="itemPending[slot.nzo_id]" class="spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            </button>

            <button class="ia-btn ia-del" title="Entfernen" @click="confirmDeleteSab(slot.nzo_id, slot.filename)">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
            </button>
          </div>
        </div>
      </div>
      <div v-else class="queue-empty">Keine aktiven Downloads in SABnzbd</div>
    </section>

    <!-- Arr Queues -->
    <section v-if="queue.arrItems.length > 0" class="panel">
      <div class="arr-header">
        <span class="arr-label">Arr-Warteschlangen</span>
        <span class="arr-count">{{ queue.arrItems.length }} Einträge</span>
      </div>
      <div class="queue-list">
        <div v-for="item in queue.arrItems" :key="`${item.app}-${item.id}`"
          class="queue-item arr-item"
          :style="{ '--ic': appColor(item.app) }">
          <div class="arr-accent" />
          <div class="item-main">
            <div class="item-top">
              <span class="arr-app-badge">{{ appLabel(item.app) }}</span>
              <p class="item-title">{{ item.title }}</p>
              <span :class="['st-badge', statusClass(item.status)]">{{ statusLabel(item.status) }}</span>
            </div>
            <div class="prog-wrap item-prog">
              <div class="prog-bar" :style="{ width: item.progress+'%', background: 'var(--ic)' }" />
            </div>
            <div class="item-meta">
              <span class="meta-chip">{{ item.protocol }}</span>
              <span v-if="item.indexer">{{ item.indexer }}</span>
              <span>{{ fmtSize((item.sizeleft ?? 0) / 1_000_000) }} übrig</span>
              <span v-if="item.timeleft" class="meta-eta">ETA {{ item.timeleft }}</span>
              <span class="meta-pct">{{ item.progress }}%</span>
            </div>
            <div v-if="item.errorMessage" class="item-error">{{ item.errorMessage }}</div>
          </div>
          <div class="item-actions">
            <button class="ia-btn ia-del" title="Entfernen" @click="confirmDeleteArr(item)">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Alles leer -->
    <div v-if="!queue.sabnzbd && queue.arrItems.length === 0 && !queue.lastError" class="empty-state">
      <div class="empty-icon">📭</div>
      <p class="empty-title">Keine aktiven Downloads</p>
      <p class="empty-sub">{{ queue.isConnected ? 'Alles ruhig – keine Dateien in der Warteschlange.' : 'Verbinde mit dem Server…' }}</p>
    </div>

    <div v-if="queue.lastError" class="error-banner">{{ queue.lastError }}</div>

    <!-- Delete Confirm -->
    <ConfirmDialog
      v-model="showDeleteConfirm"
      title="Download entfernen?"
      :message="`'${deletePendingName}' aus der Warteschlange entfernen?`"
      confirm-label="Entfernen"
      @confirm="executeDelete"
    />

  </div>
</template>

<style scoped>
.downloads-view { padding: var(--space-6); min-height: 100%; display: flex; flex-direction: column; gap: var(--space-5); }

/* Header */
.view-header { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--space-4); }
.header-left { display: flex; flex-direction: column; gap: var(--space-2); }
.view-title { display: flex; align-items: center; gap: var(--space-3); font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); margin: 0; }
.title-bar { display: inline-block; width: 3px; height: 1.2em; background: var(--context-color); border-radius: 2px; flex-shrink: 0; }
.title-count { font-size: var(--text-base); font-weight: 400; color: var(--text-muted); }
.header-stats { display: flex; align-items: center; gap: var(--space-2); }
.connection-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
.connection-dot.connected { background: var(--status-success); box-shadow: 0 0 4px var(--status-success); }
.connection-dot.disconnected { background: var(--text-muted); }
.stat-label { font-size: var(--text-xs); color: var(--text-muted); }

/* Panel */
.panel { background: var(--bg-surface); border: 1px solid var(--bg-border); border-radius: var(--radius-lg); overflow: hidden; }
.panel-header { padding: var(--space-4) var(--space-5); border-bottom: 1px solid var(--bg-border); display: flex; flex-direction: column; gap: var(--space-3); }
.panel-title-row { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
.app-badge { font-size: var(--text-xs); font-weight: 600; padding: 2px 8px; border-radius: 99px; border: 1px solid; letter-spacing: .04em; }
.sab-speed { font-size: var(--text-sm); color: var(--text-secondary); font-weight: 600; font-variant-numeric: tabular-nums; }
.paused-badge { font-size: var(--text-xs); color: var(--sabnzbd); background: rgba(245,197,24,.1); border: 1px solid rgba(245,197,24,.25); border-radius: 99px; padding: 2px 8px; }
.panel-actions { margin-left: auto; display: flex; gap: var(--space-2); }

.ctrl-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: var(--radius-md); font-size: var(--text-sm); background: var(--bg-elevated); border: 1px solid var(--bg-border); color: var(--text-secondary); cursor: pointer; transition: all .15s; }
.ctrl-btn:hover:not(:disabled) { background: var(--bg-overlay); color: var(--text-primary); }
.ctrl-btn:disabled { opacity: .5; cursor: not-allowed; }

/* Global progress */
.global-progress-row { display: flex; align-items: center; gap: var(--space-3); }
.prog-wrap { flex: 1; height: 4px; background: var(--bg-elevated); border-radius: 99px; overflow: hidden; }
.prog-bar { height: 100%; border-radius: 99px; transition: width .5s ease; }
.sab-bar { background: var(--sabnzbd); }
.prog-meta { font-size: var(--text-xs); color: var(--text-muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
.prog-pct { font-size: var(--text-xs); color: var(--text-secondary); font-weight: 600; min-width: 32px; text-align: right; font-variant-numeric: tabular-nums; }

/* Arr header */
.arr-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-3) var(--space-5); border-bottom: 1px solid var(--bg-border); }
.arr-label { font-size: var(--text-xs); font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .06em; }
.arr-count { font-size: var(--text-xs); color: var(--text-muted); }

/* Queue List */
.queue-list { display: flex; flex-direction: column; }
.queue-item { display: flex; align-items: flex-start; gap: var(--space-3); padding: var(--space-4) var(--space-5); border-bottom: 1px solid rgba(255,255,255,.03); transition: background .12s; }
.queue-item:last-child { border-bottom: none; }
.queue-item:hover { background: var(--bg-elevated); }
.queue-item:hover .item-actions { opacity: 1; }

/* Arr item accent */
.arr-item { padding-left: var(--space-4); }
.arr-accent { width: 3px; align-self: stretch; border-radius: 2px; background: var(--ic, var(--text-muted)); flex-shrink: 0; }
.arr-app-badge { font-size: var(--text-xs); font-weight: 600; padding: 1px 6px; border-radius: 4px; background: color-mix(in srgb, var(--ic) 12%, transparent); color: var(--ic); border: 1px solid color-mix(in srgb, var(--ic) 25%, transparent); white-space: nowrap; flex-shrink: 0; }

/* Item */
.item-main { flex: 1; display: flex; flex-direction: column; gap: var(--space-2); min-width: 0; }
.item-top { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.item-title { font-size: var(--text-sm); color: var(--text-secondary); font-weight: 500; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0; }
.item-prog { flex: none; }
.item-meta { display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap; }
.item-meta > * { font-size: var(--text-xs); color: var(--text-muted); }
.meta-chip { text-transform: uppercase; letter-spacing: .05em; font-weight: 500; }
.meta-eta { }
.meta-pct { margin-left: auto; font-variant-numeric: tabular-nums; }
.item-error { font-size: var(--text-xs); color: var(--status-error); background: rgba(248,113,113,.08); border-radius: var(--radius-sm); padding: 3px 8px; }

/* Per-Item Actions */
.item-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; opacity: 0; transition: opacity .15s; align-self: center; }
.ia-btn { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: var(--radius-sm); border: 1px solid var(--bg-border); background: var(--bg-elevated); color: var(--text-muted); cursor: pointer; transition: all .12s; }
.ia-btn:hover:not(:disabled) { color: var(--text-secondary); border-color: rgba(255,255,255,.2); }
.ia-btn:disabled { opacity: .5; cursor: not-allowed; }
.ia-pause:hover { color: var(--sabnzbd) !important; border-color: rgba(245,197,24,.35) !important; }
.ia-resume:hover { color: #22c55e !important; border-color: rgba(34,197,94,.35) !important; }
.ia-del:hover { color: #ef4444 !important; border-color: rgba(239,68,68,.35) !important; }

/* Status Badges */
.st-badge { font-size: var(--text-xs); padding: 1px 6px; border-radius: 4px; font-weight: 500; white-space: nowrap; flex-shrink: 0; }
.st-active { background: rgba(34,197,94,.12); color: #22c55e; border: 1px solid rgba(34,197,94,.2); }
.st-done { background: rgba(99,102,241,.12); color: #818cf8; border: 1px solid rgba(99,102,241,.2); }
.st-error { background: rgba(248,113,113,.12); color: #ef4444; border: 1px solid rgba(248,113,113,.2); }
.st-warn { background: rgba(245,197,24,.12); color: var(--sabnzbd); border: 1px solid rgba(245,197,24,.2); }
.st-paused { background: rgba(245,197,24,.08); color: #a16207; border: 1px solid rgba(245,197,24,.15); }
.st-idle { background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--bg-border); }

/* Empty + Error */
.queue-empty { padding: var(--space-6) var(--space-5); font-size: var(--text-sm); color: var(--text-muted); text-align: center; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-12) var(--space-4); gap: var(--space-3); text-align: center; flex: 1; }
.empty-icon { font-size: 48px; line-height: 1; }
.empty-title { font-size: var(--text-lg); color: var(--text-secondary); font-weight: 600; margin: 0; }
.empty-sub { color: var(--text-muted); font-size: var(--text-sm); margin: 0; }
.error-banner { padding: var(--space-4); background: rgba(248,113,113,.1); border: 1px solid rgba(248,113,113,.3); border-radius: var(--radius-md); color: var(--status-error); font-size: var(--text-sm); }

@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin .8s linear infinite; }
</style>
