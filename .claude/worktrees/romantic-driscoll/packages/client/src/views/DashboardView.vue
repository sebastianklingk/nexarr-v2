<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref } from 'vue';
import { useMoviesStore } from '../stores/movies.store.js';
import { useSeriesStore } from '../stores/series.store.js';
import { useMusicStore } from '../stores/music.store.js';
import { useQueueStore } from '../stores/queue.store.js';
import { useGotifyStore } from '../stores/gotify.store.js';
import { useDashboardStore } from '../stores/dashboard.store.js';
import { useApi } from '../composables/useApi.js';
import type { TautulliStream } from '@nexarr/shared';

// Widget components
import HealthBarWidget from '../components/dashboard/HealthBarWidget.vue';
import StatsWidget from '../components/dashboard/StatsWidget.vue';
import RecentlyAddedWidget from '../components/dashboard/RecentlyAddedWidget.vue';
import DownloadsWidget from '../components/dashboard/DownloadsWidget.vue';
import CalendarWidget from '../components/dashboard/CalendarWidget.vue';
import StreamsWidget from '../components/dashboard/StreamsWidget.vue';
import GotifyWidget from '../components/dashboard/GotifyWidget.vue';
import OverseerrWidget from '../components/dashboard/OverseerrWidget.vue';
import PlexAbsWidget from '../components/dashboard/PlexAbsWidget.vue';
import HistoryWidget from '../components/dashboard/HistoryWidget.vue';
import WidgetWrapper from '../components/dashboard/WidgetWrapper.vue';
import WidgetCatalog from '../components/dashboard/WidgetCatalog.vue';

const movies  = useMoviesStore();
const series  = useSeriesStore();
const music   = useMusicStore();
const queue   = useQueueStore();
const gotify  = useGotifyStore();
const dash    = useDashboardStore();
const { get } = useApi();

// ── Clock ────────────────────────────────────────────────────────────────────
const now = ref(new Date());
let clockTimer: ReturnType<typeof setInterval>;
const timeStr = computed(() => now.value.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
const dateStr = computed(() => now.value.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));

// ── Tautulli data (shared across widgets) ────────────────────────────────────
interface TautulliMini { stream_count: number; total_bandwidth: number; wan_bandwidth: number; lan_bandwidth: number; sessions: TautulliStream[] }
const tautulli = ref<TautulliMini | null>(null);

// ── Prowlarr ─────────────────────────────────────────────────────────────────
interface Indexer { id: number; name: string; enable: boolean; protocol: string }
const indexers = ref<Indexer[]>([]);
const enabledIndexers = computed(() => indexers.value.filter(i => i.enable).length);

// ── Overseerr count (for stats) ──────────────────────────────────────────────
const requestCount = ref(0);

// ── Widget component map ─────────────────────────────────────────────────────
const widgetComponents: Record<string, any> = {
  health:    HealthBarWidget,
  stats:     StatsWidget,
  recent:    RecentlyAddedWidget,
  downloads: DownloadsWidget,
  calendar:  CalendarWidget,
  streams:   StreamsWidget,
  gotify:    GotifyWidget,
  overseerr: OverseerrWidget,
  plexabs:   PlexAbsWidget,
  history:   HistoryWidget,
};

// ── Col span helper ──────────────────────────────────────────────────────────
function colSpanFor(widgetId: string): 1 | 2 | 3 {
  return dash.widgetDef(widgetId)?.defaultColSpan ?? 1;
}

// ── Drag & Drop state ────────────────────────────────────────────────────────
const dragFromIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

function onDragStart(index: number) {
  dragFromIndex.value = index;
}

function onDragOver(index: number) {
  dragOverIndex.value = index;
}

function onDragEnd() {
  if (dragFromIndex.value !== null && dragOverIndex.value !== null && dragFromIndex.value !== dragOverIndex.value) {
    // Map visible indices to layout indices
    const visibleItems = dash.visibleWidgets;
    const fromWidgetId = visibleItems[dragFromIndex.value]?.widgetId;
    const toWidgetId   = visibleItems[dragOverIndex.value]?.widgetId;
    if (fromWidgetId && toWidgetId) {
      const fromLayoutIdx = dash.layout.findIndex(l => l.widgetId === fromWidgetId);
      const toLayoutIdx   = dash.layout.findIndex(l => l.widgetId === toWidgetId);
      if (fromLayoutIdx !== -1 && toLayoutIdx !== -1) {
        dash.moveWidget(fromLayoutIdx, toLayoutIdx);
      }
    }
  }
  dragFromIndex.value = null;
  dragOverIndex.value = null;
}

// ── Touch DnD ────────────────────────────────────────────────────────────────
const touchDragIndex = ref<number | null>(null);
const touchGhostEl = ref<HTMLElement | null>(null);
const touchCurrentOverIndex = ref<number | null>(null);

function onTouchStart(index: number, e: TouchEvent) {
  if (!dash.editMode) return;

  // Long-press detection: start drag after 300ms hold
  const touch = e.touches[0];
  const startX = touch.clientX;
  const startY = touch.clientY;
  let moved = false;

  const longPressTimer = setTimeout(() => {
    if (moved) return;
    touchDragIndex.value = index;

    // Create ghost element
    const target = (e.target as HTMLElement).closest('.widget-wrapper') as HTMLElement;
    if (target) {
      const rect = target.getBoundingClientRect();
      const ghost = target.cloneNode(true) as HTMLElement;
      ghost.style.cssText = `position:fixed;top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px;opacity:.7;z-index:1000;pointer-events:none;transition:none;`;
      document.body.appendChild(ghost);
      touchGhostEl.value = ghost;
    }
  }, 300);

  const onTouchMove = (me: TouchEvent) => {
    const dx = me.touches[0].clientX - startX;
    const dy = me.touches[0].clientY - startY;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) moved = true;

    if (touchDragIndex.value !== null && touchGhostEl.value) {
      me.preventDefault();
      const t = me.touches[0];
      touchGhostEl.value.style.top  = `${t.clientY - 30}px`;
      touchGhostEl.value.style.left = `${t.clientX - 60}px`;

      // Find element under touch
      touchGhostEl.value.style.display = 'none';
      const elUnder = document.elementFromPoint(t.clientX, t.clientY);
      touchGhostEl.value.style.display = '';
      const wrapper = elUnder?.closest('[data-widget-idx]') as HTMLElement | null;
      if (wrapper) {
        touchCurrentOverIndex.value = Number(wrapper.dataset.widgetIdx);
      }
    }
  };

  const onTouchEnd = () => {
    clearTimeout(longPressTimer);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('touchend', onTouchEnd);

    if (touchDragIndex.value !== null && touchCurrentOverIndex.value !== null) {
      dragFromIndex.value = touchDragIndex.value;
      dragOverIndex.value = touchCurrentOverIndex.value;
      onDragEnd();
    }

    if (touchGhostEl.value) {
      touchGhostEl.value.remove();
      touchGhostEl.value = null;
    }
    touchDragIndex.value = null;
    touchCurrentOverIndex.value = null;
  };

  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  clockTimer = setInterval(() => { now.value = new Date(); }, 60000);
  queue.subscribe();
  await Promise.allSettled([
    movies.fetchMovies(),
    series.fetchSeries(),
    music.fetchArtists(),
    music.fetchAlbums(),
    get<TautulliMini>('/api/tautulli/activity').then(r => { tautulli.value = r; }).catch(() => {}),
    get<Indexer[]>('/api/prowlarr/indexers').then(r => { indexers.value = r ?? []; }).catch(() => {}),
    get<any[]>('/api/overseerr/requests?filter=pending&take=8').then(r => { requestCount.value = r?.length ?? 0; }).catch(() => {}),
  ]);
});

onUnmounted(() => {
  clearInterval(clockTimer);
  queue.unsubscribe();
  if (touchGhostEl.value) touchGhostEl.value.remove();
});
</script>

<template>
  <div class="dashboard">

    <!-- Header -->
    <div class="dash-header">
      <div>
        <h1 class="dash-title">Dashboard</h1>
        <p class="dash-sub">{{ dateStr }}</p>
      </div>
      <div class="dash-right">
        <button
          class="edit-btn"
          :class="{ 'edit-btn--active': dash.editMode }"
          :title="dash.editMode ? 'Bearbeiten beenden' : 'Dashboard anpassen'"
          @click="dash.toggleEditMode()"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 11.5V14h2.5l7.37-7.37-2.5-2.5L2 11.5zm11.8-6.8a.66.66 0 000-.94l-1.56-1.56a.66.66 0 00-.94 0L9.88 3.62l2.5 2.5 1.42-1.42z" fill="currentColor"/></svg>
        </button>
        <button
          v-if="dash.editMode"
          class="catalog-btn"
          title="Widget-Katalog"
          @click="dash.catalogOpen = true"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 2h6v6H1V2zm8 0h6v6H9V2zM1 10h6v4H1v-4zm8 0h6v4H9v-4z" fill="currentColor"/></svg>
          Widgets
        </button>
        <div class="dash-time">{{ timeStr }}</div>
      </div>
    </div>

    <!-- Edit mode banner -->
    <div v-if="dash.editMode" class="edit-banner">
      Bearbeitungsmodus — Widgets verschieben, ein-/ausblenden
    </div>

    <!-- Widget Grid -->
    <div class="widget-grid">
      <WidgetWrapper
        v-for="(item, idx) in dash.visibleWidgets"
        :key="item.widgetId"
        :widget-id="item.widgetId"
        :index="idx"
        :col-span="colSpanFor(item.widgetId)"
        :data-widget-idx="idx"
        @drag-start="onDragStart"
        @drag-over="onDragOver"
        @drag-end="onDragEnd"
        @touch-start="onTouchStart"
      >
        <component
          :is="widgetComponents[item.widgetId]"
          v-bind="item.widgetId === 'stats' ? {
            streamCount: tautulli?.stream_count ?? 0,
            requestCount: requestCount,
            enabledIndexers: enabledIndexers,
          } : item.widgetId === 'streams' ? {
            sessions: tautulli?.sessions ?? [],
            streamCount: tautulli?.stream_count ?? 0,
            totalBandwidth: tautulli?.total_bandwidth ?? 0,
            wanBandwidth: tautulli?.wan_bandwidth ?? 0,
            lanBandwidth: tautulli?.lan_bandwidth ?? 0,
          } : {}"
        />
      </WidgetWrapper>
    </div>

    <!-- Widget Catalog Panel -->
    <WidgetCatalog />

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
.dash-header   { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: var(--space-3); }
.dash-title    { font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); margin: 0; }
.dash-sub      { font-size: var(--text-sm); color: var(--text-muted); margin: 2px 0 0; }
.dash-right    { display: flex; align-items: center; gap: var(--space-3); }
.dash-time     { font-size: var(--text-2xl); font-weight: 700; color: var(--text-secondary); font-variant-numeric: tabular-nums; }

/* Edit button */
.edit-btn {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: var(--radius-md);
  background: var(--bg-surface); border: 1px solid var(--bg-border);
  color: var(--text-muted); cursor: pointer; transition: all .15s;
}
.edit-btn:hover { color: var(--text-secondary); border-color: var(--bg-border-hover); }
.edit-btn--active { color: var(--accent); border-color: var(--accent); background: rgba(var(--accent-rgb), .1); }

/* Catalog button */
.catalog-btn {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-3); border-radius: var(--radius-md);
  background: var(--bg-surface); border: 1px solid var(--bg-border);
  color: var(--text-muted); font-size: var(--text-xs); cursor: pointer;
  transition: all .15s;
}
.catalog-btn:hover { color: var(--text-secondary); border-color: var(--bg-border-hover); }

/* Edit banner */
.edit-banner {
  padding: var(--space-2) var(--space-4); border-radius: var(--radius-md);
  background: rgba(var(--accent-rgb), .1); border: 1px solid rgba(var(--accent-rgb), .3);
  color: var(--accent); font-size: var(--text-xs); text-align: center;
}

/* Widget Grid – 3 columns, responsive */
.widget-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-4);
}

@media (max-width: 1100px) {
  .widget-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 700px) {
  .dashboard { padding: var(--space-3) var(--space-4); gap: var(--space-3); }
  .widget-grid { grid-template-columns: 1fr; }
  .dash-time { font-size: var(--text-lg); }
}
</style>
