<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useApi } from '../composables/useApi.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CalendarEntry {
  id: number;
  title: string;
  airDate?: string;
  releaseDate?: string;
  digitalRelease?: string;
  inCinemas?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  seriesTitle?: string;
  overview?: string;
  hasFile: boolean;
  app: 'radarr' | 'sonarr' | 'lidarr';
  color: string;
  dateKey: string;   // YYYY-MM-DD für Gruppierung
}

// ── State ─────────────────────────────────────────────────────────────────────

const { get } = useApi();
const isLoading = ref(true);
const error     = ref<string | null>(null);
const entries   = ref<CalendarEntry[]>([]);

// Datumsbereich: heute ± 14 Tage → nächste 30 Tage
const today     = new Date();
const startDate = new Date(today);
startDate.setDate(today.getDate() - 3);   // 3 Tage zurück
const endDate   = new Date(today);
endDate.setDate(today.getDate() + 27);    // 27 Tage voraus

const fmt = (d: Date) => d.toISOString().slice(0, 10);

// ── Load ──────────────────────────────────────────────────────────────────────

onMounted(async () => {
  try {
    const data = await get<{
      radarr: Record<string, unknown>[];
      sonarr: Record<string, unknown>[];
      lidarr: Record<string, unknown>[];
    }>(`/api/calendar?start=${fmt(startDate)}&end=${fmt(endDate)}`);

    const mapped: CalendarEntry[] = [];

    // Radarr – Filme (digitalRelease oder inCinemas)
    for (const m of data.radarr) {
      const date = (m.digitalRelease ?? m.inCinemas ?? m.physicalRelease) as string | undefined;
      if (!date) continue;
      mapped.push({
        id:       m.id as number,
        title:    m.title as string,
        hasFile:  m.hasFile as boolean,
        app:      'radarr',
        color:    'var(--radarr)',
        dateKey:  date.slice(0, 10),
      });
    }

    // Sonarr – Episoden
    for (const e of data.sonarr) {
      const date = (e.airDate ?? e.airDateUtc) as string | undefined;
      if (!date) continue;
      mapped.push({
        id:            e.id as number,
        title:         e.title as string,
        seriesTitle:   (e.series as Record<string, unknown>)?.title as string | undefined,
        seasonNumber:  e.seasonNumber as number,
        episodeNumber: e.episodeNumber as number,
        hasFile:       e.hasFile as boolean,
        app:           'sonarr',
        color:         'var(--sonarr)',
        dateKey:       (date as string).slice(0, 10),
      });
    }

    // Lidarr – Alben
    for (const a of data.lidarr) {
      const date = a.releaseDate as string | undefined;
      if (!date) continue;
      mapped.push({
        id:      a.id as number,
        title:   a.title as string,
        hasFile: ((a.statistics as Record<string, unknown>)?.trackFileCount as number ?? 0) > 0,
        app:     'lidarr',
        color:   'var(--lidarr)',
        dateKey: (date as string).slice(0, 10),
      });
    }

    // Sortieren
    mapped.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    entries.value = mapped;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Kalender konnte nicht geladen werden';
  } finally {
    isLoading.value = false;
  }
});

// ── Gruppierung nach Datum ────────────────────────────────────────────────────

const grouped = computed(() => {
  const map = new Map<string, CalendarEntry[]>();
  for (const e of entries.value) {
    if (!map.has(e.dateKey)) map.set(e.dateKey, []);
    map.get(e.dateKey)!.push(e);
  }
  return map;
});

const sortedDates = computed(() => [...grouped.value.keys()].sort());

// ── Helpers ───────────────────────────────────────────────────────────────────

const todayKey = fmt(today);

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const diff = Math.round((d.getTime() - today.setHours(0,0,0,0)) / 86400000);
  if (diff === 0)  return 'Heute';
  if (diff === 1)  return 'Morgen';
  if (diff === -1) return 'Gestern';
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

function isPast(dateStr: string): boolean {
  return dateStr < todayKey;
}

function appLabel(app: CalendarEntry['app']): string {
  return app === 'radarr' ? 'Film' : app === 'sonarr' ? 'Serie' : 'Album';
}

function episodeLabel(entry: CalendarEntry): string {
  if (entry.seasonNumber !== undefined && entry.episodeNumber !== undefined) {
    return `S${String(entry.seasonNumber).padStart(2,'0')}E${String(entry.episodeNumber).padStart(2,'0')}`;
  }
  return '';
}
</script>

<template>
  <div class="calendar-view page-context" style="--context-color: var(--text-tertiary)">

    <!-- Header -->
    <div class="view-header">
      <h1 class="view-title">
        <span class="title-bar" />
        Kalender
      </h1>
      <p class="view-sub">Nächste 30 Tage – Filme, Serien &amp; Alben</p>
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
      <p class="empty-sub">Radarr, Sonarr und Lidarr haben keine geplanten Releases.</p>
    </div>

    <!-- Calendar -->
    <div v-else class="calendar-list">
      <div
        v-for="dateKey in sortedDates"
        :key="dateKey"
        :class="['date-group', { 'is-past': isPast(dateKey), 'is-today': dateKey === todayKey }]"
      >
        <!-- Date Header -->
        <div class="date-header">
          <span class="date-label">{{ formatDateHeader(dateKey) }}</span>
          <span class="date-sub">{{ new Date(dateKey + 'T12:00:00').toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' }) }}</span>
        </div>

        <!-- Entries -->
        <div class="entries">
          <div
            v-for="entry in grouped.get(dateKey)"
            :key="`${entry.app}-${entry.id}`"
            class="entry-card"
            :style="{ '--entry-color': entry.color }"
          >
            <div class="entry-accent" />
            <div class="entry-body">
              <div class="entry-top">
                <span class="entry-app-badge">{{ appLabel(entry.app) }}</span>
                <span v-if="entry.seriesTitle" class="entry-series">{{ entry.seriesTitle }}</span>
                <span v-if="episodeLabel(entry)" class="entry-episode">{{ episodeLabel(entry) }}</span>
                <span v-if="entry.hasFile" class="entry-available" title="Vorhanden">✓</span>
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
.calendar-view {
  padding: var(--space-6);
  min-height: 100%;
}

/* Header */
.view-header {
  margin-bottom: var(--space-6);
}

.view-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 var(--space-1) 0;
}

.title-bar {
  display: inline-block;
  width: 3px;
  height: 1.2em;
  background: var(--context-color);
  border-radius: 2px;
  flex-shrink: 0;
}

.view-sub {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin: 0;
  padding-left: calc(3px + var(--space-3));
}

/* Calendar List */
.calendar-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

/* Date Group */
.date-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.date-group.is-past {
  opacity: 0.5;
}

.date-group.is-today .date-label {
  color: var(--text-primary);
  font-weight: 700;
}

.date-group.is-today .date-label::before {
  content: '● ';
  color: var(--status-success);
  font-size: 10px;
}

/* Date Header */
.date-header {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--bg-border);
}

.date-label {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-secondary);
}

.date-sub {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

/* Entries */
.entries {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.entry-card {
  display: flex;
  gap: var(--space-3);
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: background 0.15s ease;
}

.entry-card:hover {
  background: var(--bg-elevated);
}

.entry-accent {
  width: 3px;
  background: var(--entry-color, var(--text-muted));
  flex-shrink: 0;
}

.entry-body {
  flex: 1;
  padding: var(--space-3) var(--space-4) var(--space-3) var(--space-1);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.entry-top {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.entry-app-badge {
  font-size: var(--text-xs);
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--entry-color) 12%, transparent);
  color: var(--entry-color);
  border: 1px solid color-mix(in srgb, var(--entry-color) 25%, transparent);
}

.entry-series {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  font-weight: 500;
}

.entry-episode {
  font-size: var(--text-xs);
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.entry-available {
  font-size: var(--text-xs);
  color: var(--status-success);
  margin-left: auto;
}

.entry-title {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: 500;
  margin: 0;
  line-height: 1.3;
}

/* Error */
.error-banner {
  padding: var(--space-4);
  background: rgba(248,113,113,0.1);
  border: 1px solid rgba(248,113,113,0.3);
  border-radius: var(--radius-md);
  color: var(--status-error);
  font-size: var(--text-sm);
}

/* Empty */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-12) var(--space-4);
  gap: var(--space-3);
  text-align: center;
}
.empty-icon  { font-size: 48px; }
.empty-title { font-size: var(--text-lg); color: var(--text-secondary); font-weight: 600; margin: 0; }
.empty-sub   { color: var(--text-muted); font-size: var(--text-sm); margin: 0; }

/* Skeleton */
.skeleton-list    { display: flex; flex-direction: column; gap: var(--space-6); }
.skeleton-group   { display: flex; flex-direction: column; gap: var(--space-2); }
.skeleton-date    { height: 16px; width: 160px; border-radius: 4px; }
.skeleton-entry   { height: 56px; width: 100%; border-radius: var(--radius-md); }
</style>
