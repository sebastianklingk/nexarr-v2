<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
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
  isFinale: boolean;
  isSeasonPack: boolean;
  app: 'radarr' | 'sonarr' | 'lidarr';
  releaseType?: 'inCinemas' | 'digital' | 'physical';
  airTime?: string;       // Lokale Uhrzeit aus airDateUtc
  dateKey: string;        // YYYY-MM-DD
  navPath: string;
}

// ── Settings (persistiert via localStorage) ────────────────────────────────────

function ls<T>(key: string, def: T): T {
  try { const v = localStorage.getItem('cal_' + key); return v !== null ? JSON.parse(v) : def; } catch { return def; }
}
function lsSet(key: string, val: unknown) { try { localStorage.setItem('cal_' + key, JSON.stringify(val)); } catch {} }

type ViewMode = 'week' | 'month' | 'list';

const viewMode    = ref<ViewMode>(ls('view', 'week'));
const weekStartMon = ref<boolean>(ls('weekStartMon', true));
const fullColor    = ref<boolean>(ls('fullColor', false));
const showRadarr   = ref<boolean>(ls('showRadarr', true));
const showSonarr   = ref<boolean>(ls('showSonarr', true));
const showLidarr   = ref<boolean>(ls('showLidarr', true));
const showCinemas  = ref<boolean>(ls('showCinemas', true));
const showDigital  = ref<boolean>(ls('showDigital', true));
const showPhysical = ref<boolean>(ls('showPhysical', true));
const showOptions  = ref(false);

watch(viewMode,    v => lsSet('view', v));
watch(weekStartMon, v => lsSet('weekStartMon', v));
watch(fullColor,   v => lsSet('fullColor', v));
watch(showRadarr,  v => lsSet('showRadarr', v));
watch(showSonarr,  v => lsSet('showSonarr', v));
watch(showLidarr,  v => lsSet('showLidarr', v));
watch(showCinemas, v => lsSet('showCinemas', v));
watch(showDigital, v => lsSet('showDigital', v));
watch(showPhysical,v => lsSet('showPhysical', v));

// ── State ─────────────────────────────────────────────────────────────────────

const isLoading = ref(true);
const entries   = ref<CalendarEntry[]>([]);
const hoverEntry = ref<CalendarEntry | null>(null);
const hoverPos   = ref({ x: 0, y: 0 });

// Anchor: erster Tag des sichtbaren Bereichs
const today = new Date();
today.setHours(0, 0, 0, 0);
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
const todayKey = fmtDate(today);
const anchor  = ref(new Date(today));

// ── Navigation ────────────────────────────────────────────────────────────────

function goToday() {
  anchor.value = new Date(today);
}
function goPrev() {
  const d = new Date(anchor.value);
  if (viewMode.value === 'week')  d.setDate(d.getDate() - 7);
  if (viewMode.value === 'month') d.setMonth(d.getMonth() - 1);
  if (viewMode.value === 'list')  d.setDate(d.getDate() - 30);
  anchor.value = d;
}
function goNext() {
  const d = new Date(anchor.value);
  if (viewMode.value === 'week')  d.setDate(d.getDate() + 7);
  if (viewMode.value === 'month') d.setMonth(d.getMonth() + 1);
  if (viewMode.value === 'list')  d.setDate(d.getDate() + 30);
  anchor.value = d;
}

// ── Datum-Berechnungen ────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay(); // 0=So, 1=Mo,...
  const diff = weekStartMon.value
    ? (dow === 0 ? -6 : 1 - dow)
    : -dow;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

const weekDays = computed(() => {
  const start = getWeekStart(anchor.value);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
});

const monthDays = computed(() => {
  const d = new Date(anchor.value.getFullYear(), anchor.value.getMonth(), 1);
  const start = getWeekStart(d);
  const days: Date[] = [];
  const cur = new Date(start);
  while (days.length < 42) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
});

const listStart = computed(() => {
  const d = new Date(anchor.value);
  d.setDate(d.getDate() - 3);
  return d;
});
const listEnd = computed(() => {
  const d = new Date(listStart.value);
  d.setDate(d.getDate() + 36);
  return d;
});



const loadStart = computed(() => {
  if (viewMode.value === 'week')  return weekDays.value[0];
  if (viewMode.value === 'month') return monthDays.value[0];
  return listStart.value;
});
const loadEnd = computed(() => {
  if (viewMode.value === 'week')  return weekDays.value[6];
  if (viewMode.value === 'month') return monthDays.value[41];
  return listEnd.value;
});

// ── Laden ─────────────────────────────────────────────────────────────────────

async function load() {
  isLoading.value = true;
  try {
    const data = await get<{
      radarr: Record<string, unknown>[];
      sonarr: Record<string, unknown>[];
      lidarr: Record<string, unknown>[];
    }>(`/api/calendar?start=${fmtDate(loadStart.value)}&end=${fmtDate(loadEnd.value)}`);

    const mapped: CalendarEntry[] = [];

    // Radarr – je Release-Typ eine eigene Karte
    for (const m of data.radarr) {
      const types: { type: 'inCinemas' | 'digital' | 'physical'; date: string }[] = [];
      if (m.inCinemas)        types.push({ type: 'inCinemas', date: m.inCinemas as string });
      if (m.digitalRelease)   types.push({ type: 'digital',  date: m.digitalRelease as string });
      if (m.physicalRelease)  types.push({ type: 'physical', date: m.physicalRelease as string });
      if (!types.length)      continue;
      for (const { type, date } of types) {
        mapped.push({
          id: m.id as number, title: m.title as string, hasFile: m.hasFile as boolean,
          isFinale: false, isSeasonPack: false,
          app: 'radarr', releaseType: type,
          dateKey: date.slice(0, 10),
          navPath: `/movies/${m.id}`,
          overview: m.overview as string | undefined,
        });
      }
    }

    // Sonarr
    for (const e of data.sonarr) {
      const dateUtc = (e.airDateUtc ?? e.airDate) as string | undefined;
      if (!dateUtc) continue;
      const ser = e.series as Record<string, unknown> | undefined;
      const isFinale = ['seasonFinale', 'seriesFinale', 'midSeasonFinale'].includes(
        (e.finaleType as string) ?? (e.episodeType as string) ?? ''
      );
      const sn = e.seasonNumber as number;
      // airDateUtc in lokales Datum umwandeln (verhindert UTC/Ortszeit-Mismatch)
      const localDate = new Date(dateUtc);
      mapped.push({
        id: e.id as number, title: e.title as string, hasFile: e.hasFile as boolean,
        seriesTitle: ser?.title as string | undefined,
        seasonNumber: sn, episodeNumber: e.episodeNumber as number,
        isFinale,
        isSeasonPack: sn === 0,
        app: 'sonarr',
        airTime: dateUtc.includes('T') ? localDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : undefined,
        dateKey: fmtDate(localDate),   // lokales Datum, nicht UTC-String
        navPath: `/series/${ser?.id ?? 0}`,
        overview: e.overview as string | undefined,
      });
    }

    // Lidarr
    for (const a of data.lidarr) {
      const date = a.releaseDate as string | undefined;
      if (!date) continue;
      mapped.push({
        id: a.id as number, title: a.title as string,
        hasFile: ((a.statistics as Record<string, unknown>)?.trackFileCount as number ?? 0) > 0,
        isFinale: false, isSeasonPack: false,
        app: 'lidarr',
        dateKey: date.slice(0, 10),
        navPath: `/music`,
        overview: undefined,
      });
    }

    mapped.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    entries.value = mapped;
  } catch { entries.value = []; }
  finally { isLoading.value = false; }
}

onMounted(load);
watch([anchor, viewMode, weekStartMon], load);

// ── Filter ────────────────────────────────────────────────────────────────────

const filtered = computed(() => entries.value.filter(e => {
  if (e.app === 'radarr' && !showRadarr.value) return false;
  if (e.app === 'sonarr' && !showSonarr.value) return false;
  if (e.app === 'lidarr' && !showLidarr.value) return false;
  if (e.app === 'radarr') {
    if (e.releaseType === 'inCinemas' && !showCinemas.value)  return false;
    if (e.releaseType === 'digital'   && !showDigital.value)  return false;
    if (e.releaseType === 'physical'  && !showPhysical.value) return false;
  }
  return true;
}));

function entriesForDay(dateKey: string) {
  return filtered.value.filter(e => e.dateKey === dateKey);
}

// ── Gruppierung für Listenansicht ─────────────────────────────────────────────

const listGrouped = computed(() => {
  const map = new Map<string, CalendarEntry[]>();
  for (const e of filtered.value) {
    if (e.dateKey < fmtDate(listStart.value) || e.dateKey > fmtDate(listEnd.value)) continue;
    if (!map.has(e.dateKey)) map.set(e.dateKey, []);
    map.get(e.dateKey)!.push(e);
  }
  return map;
});
const listDates = computed(() => [...listGrouped.value.keys()].sort());

// ── Range Label ───────────────────────────────────────────────────────────────

const rangeLabel = computed(() => {
  if (viewMode.value === 'week') {
    const s = weekDays.value[0].toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
    const e = weekDays.value[6].toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${s} – ${e}`;
  }
  if (viewMode.value === 'month') {
    return anchor.value.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  }
  const s = listStart.value.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  const e = listEnd.value.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${s} – ${e}`;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_NAMES_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DAY_NAMES_FULL  = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function isPast(dk: string)    { return dk < todayKey; }
function isToday(dk: string)   { return dk === todayKey; }
function isCurMonth(d: Date)   { return d.getMonth() === anchor.value.getMonth(); }

function formatDateHeader(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0)  return 'Heute';
  if (diff === 1)  return 'Morgen';
  if (diff === -1) return 'Gestern';
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

function appLabel(app: CalendarEntry['app']) {
  return app === 'radarr' ? 'Film' : app === 'sonarr' ? 'Serie' : 'Album';
}
function releaseTypeLabel(t?: string) {
  if (t === 'inCinemas') return '🎬';
  if (t === 'digital')   return '💻';
  if (t === 'physical')  return '📀';
  return '';
}

function episodeLabel(e: CalendarEntry) {
  if (e.seasonNumber !== undefined && e.episodeNumber !== undefined)
    return `S${String(e.seasonNumber).padStart(2,'0')}E${String(e.episodeNumber).padStart(2,'0')}`;
  return '';
}

function navigateTo(e: CalendarEntry) {
  if (e.navPath && e.navPath !== '/music') router.push(e.navPath);
}

function cardStyle(e: CalendarEntry) {
  return fullColor.value
    ? `background:color-mix(in srgb,${e.app === 'radarr' ? 'var(--radarr)' : e.app === 'sonarr' ? 'var(--sonarr)' : 'var(--lidarr)'} 10%,var(--bg-surface));border-color:color-mix(in srgb,${e.app === 'radarr' ? 'var(--radarr)' : e.app === 'sonarr' ? 'var(--sonarr)' : 'var(--lidarr)'} 25%,transparent)`
    : '';
}

function appColor(app: CalendarEntry['app']) {
  return app === 'radarr' ? 'var(--radarr)' : app === 'sonarr' ? 'var(--sonarr)' : 'var(--lidarr)';
}

// ── Hover Tooltip ─────────────────────────────────────────────────────────────

function onEnter(e: MouseEvent, entry: CalendarEntry) {
  hoverEntry.value = entry;
  updatePos(e);
}
function onMove(e: MouseEvent)  { if (hoverEntry.value) updatePos(e); }
function onLeave()               { hoverEntry.value = null; }
function updatePos(e: MouseEvent) {
  hoverPos.value = {
    x: Math.min(e.clientX + 16, window.innerWidth - 268),
    y: Math.min(e.clientY - 8,  window.innerHeight - 180),
  };
}
</script>

<template>
  <div class="calendar-view">

    <!-- Hover Tooltip -->
    <Teleport to="body">
      <div v-if="hoverEntry" class="hover-tooltip"
        :style="`left:${hoverPos.x}px;top:${hoverPos.y}px;--ec:${appColor(hoverEntry.app)}`">
        <div class="ht-top">
          <span class="ht-badge" :style="`background:color-mix(in srgb,var(--ec) 12%,transparent);color:var(--ec);border:1px solid color-mix(in srgb,var(--ec) 25%,transparent)`">
            {{ appLabel(hoverEntry.app) }}
          </span>
          <span v-if="episodeLabel(hoverEntry)" class="ht-ep">{{ episodeLabel(hoverEntry) }}</span>
          <span v-if="hoverEntry.isFinale" class="ht-finale">★ Finale</span>
          <span v-if="hoverEntry.airTime" class="ht-time">{{ hoverEntry.airTime }}</span>
        </div>
        <p class="ht-title">{{ hoverEntry.seriesTitle ?? hoverEntry.title }}</p>
        <p v-if="hoverEntry.seriesTitle" class="ht-sub">{{ hoverEntry.title }}</p>
        <p v-if="hoverEntry.overview" class="ht-overview">{{ hoverEntry.overview.slice(0, 180) }}{{ hoverEntry.overview.length > 180 ? '…' : '' }}</p>
        <div class="ht-status" :class="hoverEntry.hasFile ? 'ht-ok' : 'ht-miss'">
          {{ hoverEntry.hasFile ? '✓ Vorhanden' : '○ Ausstehend' }}
        </div>
      </div>
    </Teleport>

    <!-- Header -->
    <div class="cal-header">
      <div class="header-left">
        <h1 class="view-title">Kalender</h1>
        <p class="view-sub">{{ rangeLabel }}</p>
      </div>
      <div class="header-right">
        <!-- View Mode -->
        <div class="view-tabs">
          <button v-for="m in (['week','month','list'] as const)" :key="m"
            :class="['vtab', { active: viewMode === m }]"
            @click="viewMode = m">
            {{ m === 'week' ? 'Woche' : m === 'month' ? 'Monat' : 'Liste' }}
          </button>
        </div>
        <!-- Navigation -->
        <div class="nav-group">
          <button class="nav-btn" @click="goPrev">‹</button>
          <button class="today-btn" @click="goToday">Heute</button>
          <button class="nav-btn" @click="goNext">›</button>
        </div>
        <!-- Options Toggle -->
        <button :class="['opt-toggle', { active: showOptions }]" @click="showOptions = !showOptions">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="18" y2="18"/></svg>
          Optionen
        </button>
      </div>
    </div>

    <!-- Options Panel -->
    <Transition name="slide-down">
      <div v-if="showOptions" class="options-panel">
        <div class="opt-group">
          <span class="opt-lbl">Anzeigen</span>
          <label class="opt-chip" :class="{ active: showRadarr }" @click="showRadarr = !showRadarr">
            <span class="opt-dot" style="background:var(--radarr)" />Radarr
          </label>
          <label class="opt-chip" :class="{ active: showSonarr }" @click="showSonarr = !showSonarr">
            <span class="opt-dot" style="background:var(--sonarr)" />Sonarr
          </label>
          <label class="opt-chip" :class="{ active: showLidarr }" @click="showLidarr = !showLidarr">
            <span class="opt-dot" style="background:var(--lidarr)" />Lidarr
          </label>
        </div>
        <div class="opt-sep" />
        <div class="opt-group">
          <span class="opt-lbl">Radarr Release-Typ</span>
          <label class="opt-chip" :class="{ active: showCinemas }"  @click="showCinemas  = !showCinemas">🎬 Kino</label>
          <label class="opt-chip" :class="{ active: showDigital }"  @click="showDigital  = !showDigital">💻 Digital</label>
          <label class="opt-chip" :class="{ active: showPhysical }" @click="showPhysical = !showPhysical">📀 Physisch</label>
        </div>
        <div class="opt-sep" />
        <div class="opt-group">
          <span class="opt-lbl">Wochenstart</span>
          <label class="opt-chip" :class="{ active: weekStartMon }"  @click="weekStartMon = true">Mo</label>
          <label class="opt-chip" :class="{ active: !weekStartMon }" @click="weekStartMon = false">So</label>
        </div>
        <div class="opt-sep" />
        <div class="opt-group">
          <span class="opt-lbl">Darstellung</span>
          <label class="opt-chip" :class="{ active: fullColor }" @click="fullColor = !fullColor">
            Vollfarbe
          </label>
        </div>
      </div>
    </Transition>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-grid">
      <div v-for="i in 7" :key="i" class="skeleton-col">
        <div class="skeleton" style="height:36px;border-radius:6px" />
        <div v-if="i % 2 === 0" class="skeleton" style="height:52px;border-radius:8px;margin-top:6px" />
        <div v-if="i % 3 !== 0" class="skeleton" style="height:52px;border-radius:8px;margin-top:6px" />
      </div>
    </div>

    <!-- ── Wochenansicht ─────────────────────────────────────────────────── -->
    <div v-else-if="viewMode === 'week'" class="week-view">
      <!-- Day Headers -->
      <div class="week-header-row">
        <div v-for="day in weekDays" :key="fmtDate(day)"
          :class="['week-day-hdr', { 'wdh-today': isToday(fmtDate(day)) }]">
          <span class="wdh-name">{{ DAY_NAMES_SHORT[day.getDay()] }}</span>
          <span class="wdh-num" :class="{ 'wdh-num-today': isToday(fmtDate(day)) }">{{ day.getDate() }}</span>
        </div>
      </div>
      <!-- Day Columns -->
      <div class="week-body">
        <div v-for="day in weekDays" :key="'col-'+fmtDate(day)"
          :class="['week-col', { 'wcol-today': isToday(fmtDate(day)), 'wcol-past': isPast(fmtDate(day)) }]">
          <template v-if="entriesForDay(fmtDate(day)).length">
            <div v-for="entry in entriesForDay(fmtDate(day))" :key="`${entry.app}-${entry.id}-${entry.releaseType}`"
              class="week-event"
              :class="[`evt-${entry.app}`, { 'evt-clickable': entry.navPath !== '/music', 'evt-has': entry.hasFile }]"
              :style="cardStyle(entry)"
              @click="navigateTo(entry)"
              @mouseenter="(e) => onEnter(e, entry)"
              @mousemove="onMove"
              @mouseleave="onLeave">
              <div class="evt-accent" :style="`background:${appColor(entry.app)}`" />
              <div class="evt-body">
                <div class="evt-top">
                  <span class="evt-type-icon">{{ releaseTypeLabel(entry.releaseType) || (entry.app === 'sonarr' ? '📺' : entry.app === 'lidarr' ? '🎵' : '') }}</span>
                  <span v-if="entry.isFinale" class="evt-finale">★</span>
                  <span v-if="entry.airTime" class="evt-time">{{ entry.airTime }}</span>
                  <span v-if="entry.hasFile" class="evt-check">✓</span>
                </div>
                <p class="evt-title">{{ entry.seriesTitle ?? entry.title }}</p>
                <p v-if="entry.seriesTitle" class="evt-ep">{{ episodeLabel(entry) }} {{ entry.title }}</p>
              </div>
            </div>
          </template>
          <div v-else class="week-col-empty" />
        </div>
      </div>
    </div>

    <!-- ── Monatsansicht ─────────────────────────────────────────────────── -->
    <div v-else-if="viewMode === 'month'" class="month-view">
      <!-- Wochentag-Header -->
      <div class="month-hdr-row">
        <div v-for="i in 7" :key="i" class="month-hdr-cell">
          {{ DAY_NAMES_SHORT[weekStartMon ? (i % 7) : (i - 1)] }}
        </div>
      </div>
      <!-- Tages-Grid -->
      <div class="month-grid">
        <div v-for="day in monthDays" :key="fmtDate(day)"
          :class="['month-cell', {
            'mc-other': !isCurMonth(day),
            'mc-today': isToday(fmtDate(day)),
            'mc-past':  isPast(fmtDate(day)) && isCurMonth(day),
          }]">
          <div class="mc-num">{{ day.getDate() }}</div>
          <template v-for="(entry, idx) in entriesForDay(fmtDate(day))" :key="`${entry.app}-${entry.id}-${entry.releaseType}`">
            <div v-if="idx < 3"
              class="mc-event"
              :style="`background:color-mix(in srgb,${appColor(entry.app)} 15%,var(--bg-elevated));border-left:2px solid ${appColor(entry.app)}`"
              @click="navigateTo(entry)"
              @mouseenter="(e) => onEnter(e, entry)"
              @mousemove="onMove"
              @mouseleave="onLeave">
              <span v-if="entry.isFinale" class="mc-finale">★</span>
              <span class="mc-evt-title">{{ entry.seriesTitle ?? entry.title }}</span>
              <span v-if="entry.hasFile" class="mc-check">✓</span>
            </div>
          </template>
          <div v-if="entriesForDay(fmtDate(day)).length > 3" class="mc-more">
            +{{ entriesForDay(fmtDate(day)).length - 3 }} weitere
          </div>
        </div>
      </div>
    </div>

    <!-- ── Listenansicht ─────────────────────────────────────────────────── -->
    <div v-else class="list-view">
      <div v-if="listDates.length === 0" class="empty-state">
        <div class="empty-icon">📅</div>
        <p class="empty-title">Keine Einträge</p>
        <p class="empty-sub">Keine Releases im gewählten Zeitraum gefunden.</p>
      </div>
      <div v-else class="cal-list">
        <div v-for="dk in listDates" :key="dk"
          :class="['date-group', { 'is-past': isPast(dk), 'is-today': isToday(dk) }]">
          <div class="date-header">
            <span class="date-label">{{ formatDateHeader(dk) }}</span>
            <span class="date-count">{{ listGrouped.get(dk)?.length }}</span>
          </div>
          <div class="entries">
            <div v-for="entry in listGrouped.get(dk)" :key="`${entry.app}-${entry.id}-${entry.releaseType}`"
              :class="['entry-card', { 'entry-clickable': entry.navPath !== '/music' }]"
              :style="[`--ec:${appColor(entry.app)}`, cardStyle(entry)]"
              @click="navigateTo(entry)"
              @mouseenter="(e) => onEnter(e, entry)"
              @mousemove="onMove"
              @mouseleave="onLeave">
              <div class="entry-accent" :style="`background:${appColor(entry.app)}`" />
              <div class="entry-body">
                <div class="entry-top">
                  <span class="entry-app-badge" :style="`background:color-mix(in srgb,var(--ec) 12%,transparent);color:var(--ec);border:1px solid color-mix(in srgb,var(--ec) 25%,transparent)`">
                    {{ appLabel(entry.app) }}
                  </span>
                  <span v-if="releaseTypeLabel(entry.releaseType)" class="entry-reltype">{{ releaseTypeLabel(entry.releaseType) }}</span>
                  <span v-if="entry.seriesTitle" class="entry-series">{{ entry.seriesTitle }}</span>
                  <span v-if="episodeLabel(entry)" class="entry-episode">{{ episodeLabel(entry) }}</span>
                  <span v-if="entry.isFinale" class="entry-finale">★ Finale</span>
                  <span v-if="entry.airTime" class="entry-time">{{ entry.airTime }}</span>
                  <span v-if="entry.hasFile" class="entry-available">✓</span>
                </div>
                <p class="entry-title">{{ entry.title }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
.calendar-view { padding: var(--space-6); height: 100%; display: flex; flex-direction: column; gap: var(--space-4); overflow: hidden; }

/* ── Header ──────────────────────────────────────────────────────────────── */
.cal-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-4); flex-wrap: wrap; }
.header-left { display: flex; flex-direction: column; gap: 3px; }
.view-title { font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); margin: 0; }
.view-sub { font-size: var(--text-sm); color: var(--text-muted); margin: 0; }
.header-right { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }

/* View Mode Tabs */
.view-tabs { display: flex; background: var(--bg-elevated); border: 1px solid var(--bg-border); border-radius: var(--radius-md); overflow: hidden; }
.vtab { padding: 5px 14px; font-size: var(--text-sm); font-weight: 500; color: var(--text-muted); cursor: pointer; transition: all .12s; background: none; border: none; }
.vtab:hover { color: var(--text-secondary); }
.vtab.active { background: var(--accent-muted); color: var(--accent); }

/* Navigation */
.nav-group { display: flex; align-items: center; gap: var(--space-1); }
.nav-btn { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md); background: var(--bg-elevated); border: 1px solid var(--bg-border); color: var(--text-secondary); cursor: pointer; font-size: 16px; transition: all .12s; }
.nav-btn:hover { background: var(--bg-overlay); color: var(--text-primary); }
.today-btn { padding: 5px 14px; border-radius: var(--radius-md); background: rgba(155,0,69,.1); border: 1px solid rgba(155,0,69,.25); color: var(--accent); font-size: var(--text-sm); font-weight: 600; cursor: pointer; transition: all .12s; }
.today-btn:hover { background: rgba(155,0,69,.2); }
.opt-toggle { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: var(--radius-md); background: var(--bg-elevated); border: 1px solid var(--bg-border); color: var(--text-muted); font-size: var(--text-sm); cursor: pointer; transition: all .12s; }
.opt-toggle:hover, .opt-toggle.active { border-color: var(--accent); color: var(--accent); background: rgba(155,0,69,.08); }

/* ── Options Panel ───────────────────────────────────────────────────────── */
.options-panel { background: var(--bg-surface); border: 1px solid var(--bg-border); border-radius: var(--radius-lg); padding: var(--space-4) var(--space-5); display: flex; flex-wrap: wrap; gap: var(--space-4) var(--space-5); align-items: center; }
.opt-group { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.opt-lbl { font-size: 9px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .07em; white-space: nowrap; }
.opt-sep { width: 1px; height: 20px; background: var(--bg-border); }
.opt-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.opt-chip { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 99px; font-size: var(--text-xs); font-weight: 500; background: var(--bg-elevated); border: 1px solid var(--bg-border); color: var(--text-muted); cursor: pointer; transition: all .12s; user-select: none; }
.opt-chip:hover { border-color: var(--bg-border-hover); color: var(--text-secondary); }
.opt-chip.active { background: rgba(155,0,69,.1); border-color: rgba(155,0,69,.3); color: var(--accent); }

.slide-down-enter-active, .slide-down-leave-active { transition: all .2s ease; overflow: hidden; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; }
.slide-down-enter-to, .slide-down-leave-from { max-height: 200px; }

/* ── Loading Skeleton ────────────────────────────────────────────────────── */
.loading-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: var(--space-2); }
.skeleton-col { display: flex; flex-direction: column; gap: var(--space-2); }

/* ── Week View ───────────────────────────────────────────────────────────── */
.week-view { display: flex; flex-direction: column; border: 1px solid var(--bg-border); border-radius: var(--radius-lg); overflow: hidden; flex: 1; min-height: 0; }

.week-header-row { display: grid; grid-template-columns: repeat(7, 1fr); border-bottom: 1px solid var(--bg-border); flex-shrink: 0; }
.week-day-hdr { display: flex; flex-direction: column; align-items: center; padding: var(--space-2) var(--space-1); gap: 2px; background: var(--bg-surface); border-right: 1px solid var(--bg-border); }
.week-day-hdr:last-child { border-right: none; }
.wdh-today { background: rgba(155,0,69,.06); }
.wdh-name { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: .07em; }
.wdh-num { font-size: var(--text-base); font-weight: 700; color: var(--text-secondary); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
.wdh-num-today { background: var(--accent); color: #fff; }

.week-body { display: grid; grid-template-columns: repeat(7, 1fr); overflow-y: auto; flex: 1; }

.week-col { display: flex; flex-direction: column; gap: 3px; padding: var(--space-2) var(--space-1); border-right: 1px solid var(--bg-border); }
.week-col:last-child { border-right: none; }
.wcol-today { background: rgba(155,0,69,.03); }
.wcol-past { opacity: .5; }
.week-col-empty { flex: 1; min-height: 120px; }

.week-event { display: flex; gap: 0; border-radius: var(--radius-sm); border: 1px solid var(--bg-border); overflow: hidden; transition: all .12s; background: var(--bg-surface); }
.week-event.evt-clickable { cursor: pointer; }
.week-event.evt-clickable:hover { border-color: rgba(255,255,255,.15); transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,.3); }
.evt-accent { width: 3px; flex-shrink: 0; }
.evt-body { flex: 1; min-width: 0; padding: 4px 5px; }
.evt-top { display: flex; align-items: center; gap: 3px; flex-wrap: wrap; margin-bottom: 2px; }
.evt-type-icon { font-size: 10px; line-height: 1; }
.evt-finale { font-size: 10px; color: var(--sabnzbd); font-weight: 700; }
.evt-time { font-size: 9px; color: var(--text-muted); margin-left: auto; font-variant-numeric: tabular-nums; }
.evt-check { font-size: 9px; color: var(--status-success); }
.evt-title { font-size: 10px; font-weight: 600; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0; line-height: 1.3; }
.evt-ep { font-size: 9px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0; line-height: 1.3; }

/* ── Month View ──────────────────────────────────────────────────────────── */
.month-view { display: flex; flex-direction: column; border: 1px solid var(--bg-border); border-radius: var(--radius-lg); overflow: hidden; flex: 1; min-height: 0; }
.month-grid { display: grid; grid-template-columns: repeat(7, 1fr); overflow-y: auto; flex: 1; }
.month-hdr-row { display: grid; grid-template-columns: repeat(7, 1fr); border-bottom: 1px solid var(--bg-border); background: var(--bg-surface); }
.month-hdr-cell { padding: var(--space-2); text-align: center; font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: .07em; border-right: 1px solid var(--bg-border); }
.month-hdr-cell:last-child { border-right: none; }
.month-cell { min-height: 90px; padding: var(--space-1); border-right: 1px solid var(--bg-border); border-bottom: 1px solid var(--bg-border); display: flex; flex-direction: column; gap: 2px; }
.month-cell:nth-child(7n) { border-right: none; }
.mc-other { opacity: .3; }
.mc-today .mc-num { background: var(--accent); color: #fff; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
.mc-past { opacity: .45; }
.mc-num { font-size: 11px; font-weight: 700; color: var(--text-muted); width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.mc-event { display: flex; align-items: center; gap: 3px; border-radius: 3px; padding: 1px 4px; cursor: pointer; overflow: hidden; transition: opacity .12s; }
.mc-event:hover { opacity: .75; }
.mc-finale { font-size: 9px; color: var(--sabnzbd); flex-shrink: 0; }
.mc-evt-title { font-size: 9px; font-weight: 600; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.mc-check { font-size: 9px; color: var(--status-success); flex-shrink: 0; }
.mc-more { font-size: 9px; color: var(--text-muted); padding: 1px 4px; cursor: pointer; }

/* ── List View ───────────────────────────────────────────────────────────── */
.list-view { flex: 1; overflow-y: auto; }
.cal-list { display: flex; flex-direction: column; gap: var(--space-5); }
.date-group { display: flex; flex-direction: column; gap: var(--space-2); }
.date-group.is-past { opacity: .45; }
.date-header { display: flex; align-items: baseline; gap: var(--space-3); padding-bottom: var(--space-2); border-bottom: 1px solid var(--bg-border); }
.date-group.is-today .date-label { color: var(--accent); font-weight: 700; }
.date-label { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); }
.date-count { font-size: var(--text-xs); color: var(--text-muted); background: var(--bg-elevated); border: 1px solid var(--bg-border); border-radius: 99px; padding: 0 7px; margin-left: auto; }
.entries { display: flex; flex-direction: column; gap: var(--space-2); }
.entry-card { display: flex; background: var(--bg-surface); border: 1px solid var(--bg-border); border-radius: var(--radius-md); overflow: hidden; transition: all .12s; }
.entry-clickable { cursor: pointer; }
.entry-clickable:hover { background: var(--bg-elevated); border-color: var(--bg-border-hover); }
.entry-accent { width: 3px; flex-shrink: 0; }
.entry-body { flex: 1; padding: var(--space-3) var(--space-4) var(--space-3) var(--space-2); }
.entry-top { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; margin-bottom: 3px; }
.entry-app-badge { font-size: var(--text-xs); font-weight: 600; padding: 1px 6px; border-radius: 4px; }
.entry-reltype { font-size: 12px; line-height: 1; }
.entry-series  { font-size: var(--text-xs); color: var(--text-tertiary); font-weight: 500; }
.entry-episode { font-size: var(--text-xs); color: var(--text-muted); font-variant-numeric: tabular-nums; font-weight: 600; }
.entry-finale  { font-size: var(--text-xs); color: var(--sabnzbd); font-weight: 700; }
.entry-time    { font-size: var(--text-xs); color: var(--text-muted); margin-left: auto; font-variant-numeric: tabular-nums; }
.entry-available { font-size: var(--text-xs); color: var(--status-success); }
.entry-title   { font-size: var(--text-sm); color: var(--text-secondary); font-weight: 500; margin: 0; }

/* Hover Tooltip */
.hover-tooltip { position: fixed; z-index: 9999; width: 256px; background: var(--bg-elevated); border: 1px solid color-mix(in srgb, var(--ec) 30%, var(--bg-border)); border-radius: var(--radius-lg); padding: var(--space-3) var(--space-4); box-shadow: 0 8px 32px rgba(0,0,0,.7); pointer-events: none; }
.ht-top    { display: flex; align-items: center; gap: 5px; margin-bottom: 5px; flex-wrap: wrap; }
.ht-badge  { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 3px; }
.ht-ep     { font-size: 10px; color: var(--text-muted); font-weight: 600; }
.ht-finale { font-size: 10px; color: var(--sabnzbd); font-weight: 700; }
.ht-time   { font-size: 10px; color: var(--text-muted); margin-left: auto; font-variant-numeric: tabular-nums; }
.ht-title  { font-size: var(--text-sm); font-weight: 700; color: var(--text-primary); margin: 0 0 2px; }
.ht-sub    { font-size: 11px; color: var(--text-tertiary); margin: 0 0 4px; }
.ht-overview { font-size: 11px; color: var(--text-muted); line-height: 1.5; margin: 0 0 6px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.ht-status { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 99px; display: inline-flex; }
.ht-ok   { background: rgba(34,197,94,.12); color: #22c55e; border: 1px solid rgba(34,197,94,.2); }
.ht-miss { background: rgba(255,255,255,.05); color: var(--text-muted); border: 1px solid var(--bg-border); }

/* Empty */
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-12) var(--space-4); gap: var(--space-3); text-align: center; }
.empty-icon  { font-size: 48px; }
.empty-title { font-size: var(--text-lg); color: var(--text-secondary); font-weight: 600; margin: 0; }
.empty-sub   { color: var(--text-muted); font-size: var(--text-sm); margin: 0; }
</style>
