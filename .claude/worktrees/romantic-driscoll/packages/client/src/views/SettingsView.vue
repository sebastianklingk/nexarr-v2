<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useApi } from '../composables/useApi.js';

interface IntegrationStatus {
  name: string;
  status: 'online' | 'offline' | 'unconfigured';
  version: string | null;
  url: string | null;
}

interface SystemStatus {
  uptime: number;
  nodeVersion: string;
  platform: string;
  memory: { used: number; total: number };
  loadAvg: number[];
  cache: { total: number; active: number; stale: number };
}

const { get, del } = useApi();

const integrations   = ref<IntegrationStatus[]>([]);
const systemStatus   = ref<SystemStatus | null>(null);
const loadingInteg   = ref(true);
const loadingSystem  = ref(true);
const testingAll     = ref(false);
const cacheClearing  = ref(false);
const cacheCleared   = ref(false);

// Per-Integration test state
const testingMap  = ref<Record<string, boolean>>({});
const testResult  = ref<Record<string, 'ok' | 'fail'>>({});

// Toast
interface Toast { id: number; message: string; type: 'ok' | 'err' }
const toasts = ref<Toast[]>([]);
let toastId  = 0;

function showToast(message: string, type: 'ok' | 'err' = 'ok') {
  const id = ++toastId;
  toasts.value.push({ id, message, type });
  setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id); }, 3000);
}

const integrationMeta: Record<string, { label: string; color: string; icon: string }> = {
  radarr:    { label: 'Radarr',         color: 'var(--radarr)',    icon: '🎬' },
  sonarr:    { label: 'Sonarr',         color: 'var(--sonarr)',    icon: '📺' },
  lidarr:    { label: 'Lidarr',         color: 'var(--lidarr)',    icon: '🎵' },
  prowlarr:  { label: 'Prowlarr',       color: 'var(--prowlarr)',  icon: '🔍' },
  sabnzbd:   { label: 'SABnzbd',        color: 'var(--sabnzbd)',   icon: '⬇️' },
  tautulli:  { label: 'Tautulli',       color: 'var(--tautulli)',  icon: '📊' },
  overseerr: { label: 'Overseerr',      color: 'var(--overseerr)', icon: '🙋' },
  bazarr:    { label: 'Bazarr',         color: 'var(--bazarr)',    icon: '💬' },
  gotify:    { label: 'Gotify',         color: 'var(--gotify)',    icon: '🔔' },
  plex:      { label: 'Plex',           color: 'var(--plex)',      icon: '🎞️' },
  abs:       { label: 'Audiobookshelf', color: '#F0A500',          icon: '📚' },
};

onMounted(async () => {
  await Promise.allSettled([loadIntegrations(), loadSystem()]);
});

async function loadIntegrations() {
  loadingInteg.value = true;
  try {
    integrations.value = await get<IntegrationStatus[]>('/api/system/integrations');
  } finally {
    loadingInteg.value = false;
  }
}

async function loadSystem() {
  loadingSystem.value = true;
  try {
    systemStatus.value = await get<SystemStatus>('/api/system/status');
  } finally {
    loadingSystem.value = false;
  }
}

async function retestAll() {
  testingAll.value = true;
  try {
    await loadIntegrations();
    showToast('Alle Verbindungen getestet');
  } finally {
    testingAll.value = false;
  }
}

async function testSingle(name: string) {
  if (testingMap.value[name]) return;
  testingMap.value[name] = true;
  delete testResult.value[name];
  try {
    const res = await get<IntegrationStatus>(`/api/system/integrations/${name}`);
    // Update in list
    const idx = integrations.value.findIndex(i => i.name === name);
    if (idx !== -1) integrations.value[idx] = res;
    testResult.value[name] = res.status === 'online' ? 'ok' : 'fail';
    showToast(
      res.status === 'online'
        ? `✓ ${integrationMeta[name]?.label ?? name} erreichbar`
        : `✗ ${integrationMeta[name]?.label ?? name} nicht erreichbar`,
      res.status === 'online' ? 'ok' : 'err'
    );
    setTimeout(() => { delete testResult.value[name]; }, 3000);
  } catch {
    testResult.value[name] = 'fail';
    setTimeout(() => { delete testResult.value[name]; }, 3000);
  } finally {
    testingMap.value[name] = false;
  }
}

async function clearCache() {
  cacheClearing.value = true;
  try {
    await del('/api/system/cache');
    cacheCleared.value = true;
    await loadSystem();
    showToast('Cache geleert');
    setTimeout(() => { cacheCleared.value = false; }, 2000);
  } finally {
    cacheClearing.value = false;
  }
}

function fmtUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

function statusColor(status: IntegrationStatus['status']): string {
  if (status === 'online')  return 'var(--status-success)';
  if (status === 'offline') return 'var(--status-error)';
  return 'var(--text-muted)';
}

function statusLabel(status: IntegrationStatus['status']): string {
  if (status === 'online')  return 'Online';
  if (status === 'offline') return 'Offline';
  return 'Nicht konfiguriert';
}
</script>

<template>
  <div class="settings-view page-context" style="--context-color: var(--text-tertiary)">

    <!-- Toast Container -->
    <Teleport to="body">
      <div class="toast-container">
        <TransitionGroup name="toast">
          <div v-for="t in toasts" :key="t.id" :class="['toast-item', t.type === 'err' ? 'toast-err' : 'toast-ok']">
            {{ t.message }}
          </div>
        </TransitionGroup>
      </div>
    </Teleport>

    <!-- Header -->
    <div class="view-header">
      <h1 class="view-title">
        <span class="title-bar" />
        Einstellungen
      </h1>
    </div>

    <!-- ── Integrationen ── -->
    <section class="section">
      <div class="section-header">
        <h2 class="section-label">Integrationen</h2>
        <button class="action-btn" :disabled="testingAll || loadingInteg" @click="retestAll">
          <svg v-if="testingAll" class="spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          {{ testingAll ? 'Teste…' : '↻ Alle testen' }}
        </button>
      </div>

      <!-- Skeleton -->
      <div v-if="loadingInteg" class="integ-grid">
        <div v-for="i in 11" :key="i" class="integ-card skeleton-card">
          <div class="skeleton skeleton-icon" />
          <div class="skeleton-text">
            <div class="skeleton skeleton-title" />
            <div class="skeleton skeleton-sub" />
          </div>
        </div>
      </div>

      <!-- Grid -->
      <div v-else class="integ-grid">
        <div v-for="integ in integrations" :key="integ.name"
          class="integ-card"
          :style="{ '--integ-color': integrationMeta[integ.name]?.color ?? 'var(--text-muted)' }">

          <!-- Status-Dot -->
          <div class="status-dot"
            :style="{ background: statusColor(integ.status) }"
            :title="statusLabel(integ.status)" />

          <!-- Icon -->
          <div class="integ-icon">{{ integrationMeta[integ.name]?.icon ?? '🔌' }}</div>

          <!-- Info -->
          <div class="integ-info">
            <p class="integ-name">{{ integrationMeta[integ.name]?.label ?? integ.name }}</p>
            <p class="integ-meta">
              <span class="integ-status" :style="{ color: statusColor(integ.status) }">{{ statusLabel(integ.status) }}</span>
              <span v-if="integ.version" class="integ-version">v{{ integ.version }}</span>
            </p>
            <p v-if="integ.url" class="integ-url">{{ integ.url }}</p>
          </div>

          <!-- Per-Integration Test Button -->
          <button
            class="test-btn"
            :class="{
              'test-ok':   testResult[integ.name] === 'ok',
              'test-fail': testResult[integ.name] === 'fail',
              'test-busy': testingMap[integ.name]
            }"
            :disabled="testingMap[integ.name] || integ.status === 'unconfigured'"
            :title="integ.status === 'unconfigured' ? 'Nicht konfiguriert' : 'Verbindung testen'"
            @click.stop="testSingle(integ.name)">
            <svg v-if="testingMap[integ.name]" class="spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <span v-else-if="testResult[integ.name] === 'ok'">✓</span>
            <span v-else-if="testResult[integ.name] === 'fail'">✗</span>
            <svg v-else width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.02-7.36"/></svg>
          </button>
        </div>
      </div>
    </section>

    <!-- ── System ── -->
    <section class="section">
      <h2 class="section-label">System</h2>
      <div v-if="loadingSystem" class="system-grid">
        <div v-for="i in 4" :key="i" class="system-card">
          <div class="skeleton skeleton-sys-label" />
          <div class="skeleton skeleton-sys-value" />
        </div>
      </div>
      <div v-else-if="systemStatus" class="system-grid">
        <div class="system-card">
          <p class="sys-label">Uptime</p>
          <p class="sys-value">{{ fmtUptime(systemStatus.uptime) }}</p>
        </div>
        <div class="system-card">
          <p class="sys-label">Node.js</p>
          <p class="sys-value">{{ systemStatus.nodeVersion }}</p>
        </div>
        <div class="system-card">
          <p class="sys-label">Speicher</p>
          <p class="sys-value">{{ fmtBytes(systemStatus.memory.used) }} / {{ fmtBytes(systemStatus.memory.total) }}</p>
        </div>
        <div class="system-card">
          <p class="sys-label">Load Avg</p>
          <p class="sys-value">{{ systemStatus.loadAvg.map(n => n.toFixed(2)).join(' · ') }}</p>
        </div>
      </div>
    </section>

    <!-- ── Cache ── -->
    <section class="section">
      <div class="section-header">
        <h2 class="section-label">Cache</h2>
        <button class="action-btn action-btn--danger" :disabled="cacheClearing" @click="clearCache">
          <span v-if="cacheCleared">✓ Geleert</span>
          <span v-else-if="cacheClearing">Leere…</span>
          <span v-else>Cache leeren</span>
        </button>
      </div>
      <div v-if="systemStatus" class="cache-stats">
        <div class="cache-pill">
          <span class="cache-num">{{ systemStatus.cache.active }}</span>
          <span class="cache-lbl">Aktiv</span>
        </div>
        <div class="cache-pill">
          <span class="cache-num">{{ systemStatus.cache.stale }}</span>
          <span class="cache-lbl">Veraltet</span>
        </div>
        <div class="cache-pill">
          <span class="cache-num">{{ systemStatus.cache.total }}</span>
          <span class="cache-lbl">Gesamt</span>
        </div>
      </div>
    </section>

    <!-- ── About ── -->
    <section class="section">
      <h2 class="section-label">About</h2>
      <div class="about-card">
        <div class="about-logo">
          <div class="logo-mark">n</div>
          <div>
            <p class="about-name">nexarr</p>
            <p class="about-version">v2.0.0 – Media Dashboard</p>
          </div>
        </div>
        <p class="about-desc">Self-hosted Media Dashboard für Radarr, Sonarr, Lidarr, SABnzbd und mehr.</p>
      </div>
    </section>

  </div>
</template>

<style scoped>
.settings-view { padding: var(--space-6); min-height: 100%; display: flex; flex-direction: column; gap: var(--space-8); }

/* Header */
.view-header { margin-bottom: calc(-1 * var(--space-2)); }
.view-title { display: flex; align-items: center; gap: var(--space-3); font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); margin: 0; }
.title-bar { display: inline-block; width: 3px; height: 1.2em; background: var(--context-color); border-radius: 2px; flex-shrink: 0; }

/* Section */
.section { display: flex; flex-direction: column; gap: var(--space-4); }
.section-header { display: flex; align-items: center; justify-content: space-between; }
.section-label { font-size: var(--text-xs); font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin: 0; }

/* Action Button */
.action-btn { display: inline-flex; align-items: center; gap: 5px; padding: var(--space-1) var(--space-4); border-radius: var(--radius-md); font-size: var(--text-sm); background: var(--bg-elevated); border: 1px solid var(--bg-border); color: var(--text-secondary); cursor: pointer; transition: all .15s ease; }
.action-btn:hover:not(:disabled) { background: var(--bg-overlay); color: var(--text-primary); }
.action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.action-btn--danger:hover:not(:disabled) { background: rgba(248,113,113,.1); border-color: rgba(248,113,113,.3); color: var(--status-error); }

/* Integration Grid */
.integ-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--space-3); }
.integ-card { position: relative; display: flex; align-items: center; gap: var(--space-3); padding: var(--space-3) var(--space-4); background: var(--bg-surface); border: 1px solid var(--bg-border); border-left: 3px solid var(--integ-color, var(--bg-border)); border-radius: var(--radius-lg); transition: background .15s ease; }
.integ-card:hover { background: var(--bg-elevated); }

.status-dot { position: absolute; top: var(--space-3); right: 38px; width: 8px; height: 8px; border-radius: 50%; }

.integ-icon { font-size: 22px; line-height: 1; flex-shrink: 0; }
.integ-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.integ-name { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); margin: 0; }
.integ-meta { display: flex; align-items: center; gap: var(--space-2); margin: 0; }
.integ-status { font-size: var(--text-xs); font-weight: 500; }
.integ-version { font-size: var(--text-xs); color: var(--text-muted); }
.integ-url { font-size: 10px; color: var(--text-muted); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Per-Integration Test Button */
.test-btn { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: var(--radius-sm); background: var(--bg-elevated); border: 1px solid var(--bg-border); color: var(--text-muted); cursor: pointer; flex-shrink: 0; transition: all .12s; font-size: 11px; font-weight: 700; }
.test-btn:hover:not(:disabled) { background: var(--bg-overlay); color: var(--text-secondary); border-color: rgba(255,255,255,.15); }
.test-btn:disabled { opacity: .4; cursor: not-allowed; }
.test-ok  { background: rgba(34,197,94,.12); border-color: rgba(34,197,94,.3); color: #22c55e; }
.test-fail { background: rgba(239,68,68,.12); border-color: rgba(239,68,68,.3); color: #ef4444; }

/* Skeleton */
.skeleton-card { min-height: 72px; }
.skeleton-icon  { width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0; }
.skeleton-text  { flex: 1; display: flex; flex-direction: column; gap: var(--space-1); }
.skeleton-title { height: 14px; width: 70%; border-radius: 4px; }
.skeleton-sub   { height: 11px; width: 50%; border-radius: 4px; }

/* System Grid */
.system-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: var(--space-3); }
.system-card { background: var(--bg-surface); border: 1px solid var(--bg-border); border-radius: var(--radius-lg); padding: var(--space-4); }
.sys-label { font-size: var(--text-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 var(--space-1) 0; }
.sys-value { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); font-variant-numeric: tabular-nums; margin: 0; }
.skeleton-sys-label { height: 11px; width: 60%; border-radius: 4px; margin-bottom: var(--space-1); }
.skeleton-sys-value { height: 16px; width: 80%; border-radius: 4px; }

/* Cache */
.cache-stats { display: flex; gap: var(--space-3); flex-wrap: wrap; }
.cache-pill { display: flex; align-items: baseline; gap: var(--space-2); background: var(--bg-surface); border: 1px solid var(--bg-border); border-radius: var(--radius-lg); padding: var(--space-3) var(--space-5); }
.cache-num { font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.cache-lbl { font-size: var(--text-xs); color: var(--text-muted); }

/* About */
.about-card { background: var(--bg-surface); border: 1px solid var(--bg-border); border-radius: var(--radius-lg); padding: var(--space-5); display: flex; flex-direction: column; gap: var(--space-3); max-width: 480px; }
.about-logo { display: flex; align-items: center; gap: var(--space-3); }
.logo-mark { width: 36px; height: 36px; background: var(--accent); border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; color: #fff; flex-shrink: 0; }
.about-name { font-size: var(--text-md); font-weight: 700; color: var(--text-primary); margin: 0; }
.about-version { font-size: var(--text-xs); color: var(--text-muted); margin: 0; }
.about-desc { font-size: var(--text-sm); color: var(--text-tertiary); line-height: 1.6; margin: 0; }

/* Toast */
.toast-container { position: fixed; bottom: 24px; right: 24px; z-index: 99999; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
.toast-item { padding: 10px 18px; border-radius: var(--radius-lg); font-size: var(--text-sm); font-weight: 600; box-shadow: 0 8px 32px rgba(0,0,0,.5); }
.toast-ok  { background: rgba(34,197,94,.15); border: 1px solid rgba(34,197,94,.3); color: #22c55e; }
.toast-err { background: rgba(239,68,68,.15); border: 1px solid rgba(239,68,68,.3); color: #ef4444; }
.toast-enter-active { transition: all .2s ease; }
.toast-leave-active { transition: all .2s ease; }
.toast-enter-from   { opacity: 0; transform: translateY(8px); }
.toast-leave-to     { opacity: 0; transform: translateX(20px); }

@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin .8s linear infinite; }
</style>
