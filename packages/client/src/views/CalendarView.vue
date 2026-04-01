<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '../composables/useApi.js';

const router = useRouter();
const { get } = useApi();

// ── Types ─────────────────────────────────────────────────────────────────────

interface CalendarEntry {
  id: number;
  title: string;
  seriesTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  overview?: string;
  hasFile: boolean;
  app: 'radarr' | 'sonarr' | 'lidarr';
  color: string;
  dateKey: string;
  navPath: string;    // Route zum Navigieren
}

// ── State ─────────────────────────────────────────────────────────────────────

const isLoading  = ref(true);
const error      = ref<string | null>(null);
const entries    = ref<CalendarEntry[]>([]);
const hoverEntry = ref<CalendarEntry | null>(null);
const hoverPos   = ref({ x: 0, y: 0 });

// Offset: 0 = aktuelle Woche/-zeitraum, -1 = zurück, +1 = vorwärts
const offsetDays = ref(0);
const WINDOW = 30; // Tage anzeigen

const today = new Date();
today.setHours(0, 0, 0, 0);
const todayKey = today.toISOString().slice(0, 10);

const startDate = computed(() => {
  const d = new Date(today);
  d.setDate(d.getDate() + offsetDays.value - 3);
  return d;
});

const endDate = computed(() => {
  const d = new Date(startDate.value);
  d.setDate(d.getDate() + WINDOW + 3);
  return d;
});

const fmt = (d: Date) => d.toISOString().slice(0, 10);

// ── Laden ─────────────────────────────────────────────────────────────────────

async function load() {
  isLoading.value = true;
  error.value = null;
  try {
    const data = await get<{
      radarr: Record<string, unknown>[];
      sonarr: Record<string, unknown>[];
      lidarr: Record<string, unknown>[];
    }>(`/api/calendar?start=${fmt(startDate.value)}&end=${fmt(endDate.value)}`);

    const mapped: CalendarEntry[] = [];

    for (const m of data.radarr) {
      const date = (m.digitalRelease ?? m.inCinemas ?? m.physicalRelease) as string | undefined;
      if (!date) continue;
      mapped.push({
        id: m.id as number, title: m.title as string, hasFile: m.hasFile as boolean,
        app: 'radarr', color: 'var(--radarr)',
        dateKey: date.slice(0, 10),
        navPath: `/movies/${m.id}`,
        overview: m.overview as string | undefined,
      });
    }

    for (const e of data.sonarr) {
      const date = (e.airDate ?? e.airDateUtc) as string | undefined;
      if (!date) continue;
      const ser = e.series as Record<string, unknown> | undefined;
      mapped.push({
        id: e.id as number, title: e.title as string, hasFile: e.hasFile as boolean,
        seriesTitle: ser?.title as string | undefined,
        seasonNumber: e.seasonNumber as number, episodeNumber: e.episodeNumber as number,
        app: 'sonarr', color: 'var(--sonarr)',
        dateKey: (date as string).slice(0, 10),
        navPath: `/series/${ser?.id ?? 0}`,
        overview: e.overview as string | undefined,
      });
    }

    for (const a of data.lidarr) {
      const date = a.releaseDate as string | undefined;
      if (!date) continue;
      mapped.push({
        id: a.id as number, title: a.title as string,
        hasFile: ((a.statistics as Record<string, unknown>)?.trackFileCount as number ?? 0) > 0,
        app: 'lidarr', color: 'var(--lidarr)',
        dateKey: (date as string).slice(0, 10),
        navPath: `/music`,
        overview: undefined,
      });
    }

    mapped.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    entries.value = mapped;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Kalender konnte nicht geladen werden';
  } finally {
    isLoading.value = false;
  }
}

onMounted(load);

// ── Gruppierung ───────────────────────────────────────────────────────────────

const grouped = computed(() => {
  const map = new Map<string, CalendarEntry[]>();
  for (const e of entries.value) {
    if (e.dateKey < fmt(startDate.value) || e.dateKey > fmt(endDate.value)) continue;
    if (!map.has(e.dateKey)) map.set(e.dateKey, []);
    map.get(e.dateKey)!.push(e);
  }
  return map;
});

const sortedDates = computed(() => [...grouped.value.keys()].sort());

// ── Navigation ────────────────────────────────────────────────────────────────

function goToday() { offsetDays.value = 0; load(); }
function goPrev()  { offsetDays.value -= WINDOW; load(); }
function goNext()  { offsetDays.value += WINDOW; load(); }

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0)  return 'Heute';
  if (diff === 1)  return 'Morgen';
  if (diff === -1) return 'Gestern';
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function isPast(dateStr: string) { return dateStr < todayKey; }
function isToday(dateStr: string) { return dateStr === todayKey; }

function appLabel(app: CalendarEntry['app']): string {
  return app === 'radarr' ? 'Film' : app === 'sonarr' ? 'Serie' : 'Album';
}

function episodeLabel(entry: CalendarEntry): string {
  if (entry.seasonNumber !== undefined && entry.episodeNumber !== undefined) {
    return `S${String(entry.seasonNumber).padStart(2,'0')}E${String(entry.episodeNumber).padStart(2,'0')}`;
  }
  return '';
}

function navigateTo(entry: CalendarEntry) {
  if (entry.navPath && entry.navPath !== '/music') {
    router.push(entry.navPath);
  }
}

// ── Hover Tooltip ─────────────────────────────────────────────────────────────

function onCardMouseEnter(e: MouseEvent, entry: CalendarEntry) {
  hoverEntry.value = entry;
  updateHoverPos(e);
}

function onCardMouseMove(e: MouseEvent) {
  if (hoverEntry.value) updateHoverPos(e);
}

function onCardMouseLeave() {
  hoverEntry.value = null;
}

function updateHoverPos(e: MouseEvent) {
  const x = e.clientX + 16;
  const y = e.clientY - 8;
  hoverPos.value = {
    x: Math.min(x, window.innerWidth - 260),
    y: Math.min(y, window.innerHeight - 160),
  };
}

// ── Date Range Label ──────────────────────────────────────────────────────────
const rangeLabel = computed(() => {
  const s = startDate.value.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  const e = endDate.value.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${s} – ${e}`;
});
</script>

<template>
  <div class="calendar-view page-context" style="--context-color: var(--text-tertiary)">

    <!-- Hover Tooltip -->
    <Teleport to="body">
      <div v-if="hoverEntry" class="hover-tooltip"
        :style="{ left: hoverPos.x + 'px', top: hoverPos.y + 'px', '--ec': hoverEntry.color }">
        <div class="ht-top">
          <span class="ht-app-badge">{{ appLabel(hoverEntry.app) }}</span>
          <span v-if="episodeLabel(hoverEntry)" class="ht-ep">{{ episodeLabel(hoverEntry) }}</span>
        </div>
        <p class="ht-title">{{ hoverEntry.seriesTitle ?? hoverEntry.title }}</p>
        <p v-if="hoverEntry.seriesTitle" class="ht-sub">{{ hoverEntry.title }}</p>
        <p v-if="hoverEntry.overview" class="ht-overview">{{ hoverEntry.overview.slice(0, 160) }}{{ hoverEntry.overview.length > 160 ? '…' : '' }}</p>
        <div class="ht-status" :class="hoverEntry.hasFile ? 'ht-ok' : 'ht-miss'">
          {{ hoverEntry.hasFile ? '✓ Vorhanden' : '○ Ausstehend' }}
        </div>
      </div>
    </Teleport>

    <!-- Header -->
    <div class="view-header">
      <div class="header-left">
        <h1 class="view-title">
          <span class="title-bar" />
          Kalender
        </h1>
        <p class="view-sub">{{ rangeLabel }}</p>
      </div>

      <!-- Navigation -->
      <div class="nav-controls">
        <button class="nav-btn" @click="goPrev">‹ Zurück</button>
        <button class="today-btn" @click="goToday">Heute</button>
        <button class="nav-btn" @click="goNext">Weiter ›</button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="skeleton-list">
      <div v-for="i in 8" :key="i" class="skeleton-group">
        <div class="skeleton skeleton-date" />
        <div class="skeleton skeleton-entry" />
        <div v-if="i % 3 !== 0" class="skeleton skeleton-entry" />
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-banner">{{ error }}</div>

    <!-- Empty -->
    <div v-else-if="sortedDates.length === 0" class="empty-state">
      <div class="empty-icon">📅</div>
      <p class="empty-title">Keine Einträge im Zeitraum</p>
      <p class="empty-sub">Radarr, Sonarr und Lidarr haben keine Releases geplant.</p>
    </div>

    <!-- Calendar -->
    <div v-else class="calendar-list">
      <div v-for="dateKey in sortedDates" :key="dateKey"
        :class="['date-group', { 'is-past': isPast(dateKey), 'is-today': isToday(dateKey) }]">

        <!-- Date Header -->
        <div class="date-header">
          <span class="date-label">{{ formatDateHeader(dateKey) }}</span>
          <span class="date-sub">{{ fmtDate(dateKey) }}</span>
          <span class="date-count">{{ grouped.get(dateKey)?.length }} Einträge</span>
        </div>

        <!-- Entries -->
        <div class="entries">
          <div v-for="entry in grouped.get(dateKey)" :key="`${entry.app}-${entry.id}`"
            :class="['entry-card', { 'entry-clickable': entry.navPath && entry.navPath !== '/music' }]"
            :style="{ '--ec': entry.color }"
            @click="navigateTo(entry)"
            @mouseenter="(e) => onCardMouseEnter(e, entry)"
            @mousemove="onCardMouseMove"
            @mouseleave="onCardMouseLeave">

            <div class="entry-accent" />
            <div class="entry-body">
              <div class="entry-top">
                <span class="entry-app-badge">{{ appLabel(entry.app) }}</span>
                <span v-if="entry.seriesTitle" class="entry-series">{{ entry.seriesTitle }}</span>
                <span v-if="episodeLabel(entry)" class="entry-episode">{{ episodeLabel(entry) }}</span>
                <span v-if="entry.hasFile" class="entry-available" title="Vorhanden">✓</span>
                <svg v-if="entry.navPath && entry.navPath !== '/music'" class="entry-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
              <p class="entry-title">{{ entry.title }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.calendar-view { padding: var(--space-6); min-height: 100%; }

/* Header */
.view-header { margin-bottom: var(--space-6); display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap; }
.header-left { display: flex; flex-direction: column; gap: var(--space-1); }
.view-title { display: flex; align-items: center; gap: var(--space-3); font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); margin: 0; }
.title-bar { display: inline-block; width: 3px; height: 1.2em; background: var(--context-color); border-radius: 2px; flex-shrink: 0; }
.view-sub { font-size: var(--text-sm); color: var(--text-muted); margin: 0; padding-left: calc(3px + var(--space-3)); }

/* Navigation */
.nav-controls { display: flex; align-items: center; gap: var(--space-2); }
.nav-btn { padding: 5px 14px; border-radius: var(--radius-md); font-size: var(--text-sm); background: var(--bg-elevated); border: 1px solid var(--bg-border); color: var(--text-secondary); cursor: pointer; transition: all .15s; }
.nav-btn:hover { background: var(--bg-overlay); color: var(--text-primary); }
.today-btn { padding: 5px 14px; border-radius: var(--radius-md); font-size: var(--text-sm); background: rgba(155,0,69,.12); border: 1px solid rgba(155,0,69,.3); color: var(--accent); cursor: pointer; transition: all .15s; font-weight: 600; }
.today-btn:hover { background: rgba(155,0,69,.22); }

/* Calendar List */
.calendar-list { display: flex; flex-direction: column; gap: var(--space-6); }

/* Date Group */
.date-group { display: flex; flex-direction: column; gap: var(--space-2); }
.date-group.is-past { opacity: 0.5; }
.date-group.is-today .date-label { color: var(--text-primary); font-weight: 700; }
.date-group.is-today .date-label::before { content: '● '; color: #22c55e; font-size: 10px; }

.date-header { display: flex; align-items: baseline; gap: var(--space-3); padding-bottom: var(--space-2); border-bottom: 1px solid var(--bg-border); }
.date-label { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); }
.date-sub { font-size: var(--text-xs); color: var(--text-muted); }
.date-count { font-size: var(--text-xs); color: var(--text-muted); margin-left: auto; }

/* Entries */
.entries { display: flex; flex-direction: column; gap: var(--space-2); }

.entry-card {
  display: flex; gap: var(--space-3);
  background: var(--bg-surface); border: 1px solid var(--bg-border);
  border-radius: var(--radius-md); overflow: hidden;
  transition: background .15s, border-color .15s;
}
.entry-clickable { cursor: pointer; }
.entry-clickable:hover { background: var(--bg-elevated); border-color: color-mix(in srgb, var(--ec) 30%, transparent); }

.entry-accent { width: 3px; background: var(--ec, var(--text-muted)); flex-shrink: 0; }

.entry-body { flex: 1; padding: var(--space-3) var(--space-4) var(--space-3) var(--space-1); display: flex; flex-direction: column; gap: var(--space-1); }

.entry-top { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.entry-app-badge { font-size: var(--text-xs); font-weight: 600; padding: 1px 6px; border-radius: 4px; background: color-mix(in srgb, var(--ec) 12%, transparent); color: var(--ec); border: 1px solid color-mix(in srgb, var(--ec) 25%, transparent); }
.entry-series { font-size: var(--text-xs); color: var(--text-tertiary); font-weight: 500; }
.entry-episode { font-size: var(--text-xs); color: var(--text-muted); font-variant-numeric: tabular-nums; font-weight: 600; }
.entry-available { font-size: var(--text-xs); color: #22c55e; margin-left: auto; }
.entry-arrow { color: var(--text-muted); margin-left: 2px; flex-shrink: 0; }
.entry-title { font-size: var(--text-sm); color: var(--text-secondary); font-weight: 500; margin: 0; line-height: 1.3; }

/* Hover Tooltip */
.hover-tooltip {
  position: fixed; z-index: 9999; width: 248px;
  background: var(--bg-elevated); border: 1px solid color-mix(in srgb, var(--ec) 30%, var(--bg-border));
  border-radius: var(--radius-lg); padding: var(--space-3) var(--space-4);
  box-shadow: 0 8px 32px rgba(0,0,0,.7); pointer-events: none;
  animation: ht-in .1s ease;
}
@keyframes ht-in { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
.ht-top { display: flex; align-items: center; gap: 5px; margin-bottom: 5px; }
.ht-app-badge { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 3px; background: color-mix(in srgb, var(--ec) 12%, transparent); color: var(--ec); border: 1px solid color-mix(in srgb, var(--ec) 25%, transparent); }
.ht-ep { font-size: 10px; color: var(--text-muted); font-weight: 600; }
.ht-title { font-size: var(--text-sm); font-weight: 700; color: var(--text-primary); margin: 0 0 2px; }
.ht-sub { font-size: 11px; color: var(--text-tertiary); margin: 0 0 5px; }
.ht-overview { font-size: 11px; color: var(--text-muted); line-height: 1.5; margin: 0 0 6px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.ht-status { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 99px; display: inline-flex; }
.ht-ok { background: rgba(34,197,94,.12); color: #22c55e; border: 1px solid rgba(34,197,94,.2); }
.ht-miss { background: rgba(255,255,255,.05); color: var(--text-muted); border: 1px solid var(--bg-border); }

/* Error / Empty / Skeleton */
.error-banner { padding: var(--space-4); background: rgba(248,113,113,.1); border: 1px solid rgba(248,113,113,.3); border-radius: var(--radius-md); color: var(--status-error); font-size: var(--text-sm); }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-12) var(--space-4); gap: var(--space-3); text-align: center; }
.empty-icon { font-size: 48px; }
.empty-title { font-size: var(--text-lg); color: var(--text-secondary); font-weight: 600; margin: 0; }
.empty-sub { color: var(--text-muted); font-size: var(--text-sm); margin: 0; }
.skeleton-list { display: flex; flex-direction: column; gap: var(--space-6); }
.skeleton-group { display: flex; flex-direction: column; gap: var(--space-2); }
.skeleton-date { height: 16px; width: 160px; border-radius: 4px; }
.skeleton-entry { height: 56px; width: 100%; border-radius: var(--radius-md); }
</style>
