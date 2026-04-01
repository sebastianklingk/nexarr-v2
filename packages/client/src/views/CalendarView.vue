<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '../composables/useApi.js';
import { useMoviesStore } from '../stores/movies.store.js';
import { useSeriesStore } from '../stores/series.store.js';

const router      = useRouter();
const { get }     = useApi();
const moviesStore = useMoviesStore();
const seriesStore = useSeriesStore();

// ── Types ─────────────────────────────────────────────────────────────────────

interface CalendarEntry {
  id: number;
  title: string;
  seriesTitle?: string;
  seriesId?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  overview?: string;
  hasFile: boolean;
  isFinale: boolean;
  isSeasonPack: boolean;
  bundledCount?: number;          // >1 wenn bundleEpisodes aktiv
  app: 'radarr' | 'sonarr' | 'lidarr';
  releaseType?: 'inCinemas' | 'digital' | 'physical';
  airTime?: string;
  dateKey: string;
  navPath: string;
  radarrId?: number;
}

// ── LocalStorage Helper ───────────────────────────────────────────────────────

function ls<T>(key: string, def: T): T {
  try { const v = localStorage.getItem('cal_' + key); return v !== null ? JSON.parse(v) : def; } catch { return def; }
}
function lsSet(key: string, val: unknown) { try { localStorage.setItem('cal_' + key, JSON.stringify(val)); } catch {} }

// ── Optionen ──────────────────────────────────────────────────────────────────

type ViewMode = 'week' | 'month' | 'list';

const viewMode      = ref<ViewMode>(ls('view', 'week'));
const weekStartMon  = ref<boolean>(ls('weekStartMon', true));
const colHeaderFmt  = ref<string>(ls('colHdrFmt', 'short'));   // short | long | date
const fullColor     = ref<boolean>(ls('fullColor', false));
const showAirTime   = ref<boolean>(ls('showAirTime', true));
// Filter
const showRadarr    = ref<boolean>(ls('showRadarr', true));
const showSonarr    = ref<boolean>(ls('showSonarr', true));
const showLidarr    = ref<boolean>(ls('showLidarr', true));
const showCinemas   = ref<boolean>(ls('showCinemas', true));
const showDigital   = ref<boolean>(ls('showDigital', true));
const showPhysical  = ref<boolean>(ls('showPhysical', true));
// Serien
const bundleEpisodes   = ref<boolean>(ls('bundleEp', false));
const showEpInfo       = ref<boolean>(ls('showEpInfo', true));
const showFinaleSymbol = ref<boolean>(ls('showFinale', true));
const showSpecials     = ref<boolean>(ls('showSpecials', false));
// Musik
const bundleAlbums  = ref<boolean>(ls('bundleAlb', false));

const showOptions   = ref(false);

// Alle persistieren
const watchList = {
  view: viewMode, weekStartMon, colHdrFmt: colHeaderFmt, fullColor, showAirTime,
  showRadarr, showSonarr, showLidarr, showCinemas, showDigital, showPhysical,
  bundleEp: bundleEpisodes, showEpInfo, showFinale: showFinaleSymbol, showSpecials,
  bundleAlb: bundleAlbums,
};
for (const [k, r] of Object.entries(watchList)) watch(r, v => lsSet(k, v));

// ── State ─────────────────────────────────────────────────────────────────────

const isLoading  = ref(true);
const entries    = ref<CalendarEntry[]>([]);
const hoverEntry = ref<CalendarEntry | null>(null);
const hoverPos   = ref({ x: 0, y: 0 });

const today = new Date();
today.setHours(0, 0, 0, 0);
function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
const todayKey = fmtDate(today);
const anchor = ref(new Date(today));

// ── Navigation ────────────────────────────────────────────────────────────────

function goToday() { anchor.value = new Date(today); }
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
  const dow = d.getDay();
  const diff = weekStartMon.value ? (dow === 0 ? -6 : 1 - dow) : -dow;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

const weekDays = computed(() => {
  const start = getWeekStart(anchor.value);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(d.getDate() + i); return d;
  });
});

const monthDays = computed(() => {
  const start = getWeekStart(new Date(anchor.value.getFullYear(), anchor.value.getMonth(), 1));
  const days: Date[] = [];
  const cur = new Date(start);
  while (days.length < 42) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
  return days;
});

const listStart = computed(() => { const d = new Date(anchor.value); d.setDate(d.getDate() - 3); return d; });
const listEnd   = computed(() => { const d = new Date(listStart.value); d.setDate(d.getDate() + 36); return d; });

const loadStart = computed(() => {
  if (viewMode.value === 'week')  return weekDays.value[0];
  if (viewMode.value === 'month') return monthDays.value[0];
  return listStart.value;
});
const loadEnd = computed(() => {
  const base = viewMode.value === 'week'  ? weekDays.value[6]
             : viewMode.value === 'month' ? monthDays.value[41]
             : listEnd.value;
  const d = new Date(base); d.setDate(d.getDate() + 1); return d;
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

    for (const m of data.radarr) {
      const types: { type: 'inCinemas' | 'digital' | 'physical'; date: string }[] = [];
      if (m.inCinemas)       types.push({ type: 'inCinemas', date: m.inCinemas as string });
      if (m.digitalRelease)  types.push({ type: 'digital',   date: m.digitalRelease as string });
      if (m.physicalRelease) types.push({ type: 'physical',  date: m.physicalRelease as string });
      if (!types.length) continue;
      for (const { type, date } of types) {
        mapped.push({
          id: m.id as number, title: m.title as string, hasFile: m.hasFile as boolean,
          isFinale: false, isSeasonPack: false, radarrId: m.id as number,
          app: 'radarr', releaseType: type,
          dateKey: date.slice(0, 10), navPath: `/movies/${m.id}`,
          overview: m.overview as string | undefined,
        });
      }
    }

    for (const e of data.sonarr) {
      const dateUtc = (e.airDateUtc ?? e.airDate) as string | undefined;
      if (!dateUtc) continue;
      const ser = e.series as Record<string, unknown> | undefined;
      const isFinale = ['seasonFinale', 'seriesFinale', 'midSeasonFinale'].includes(
        (e.finaleType as string) ?? (e.episodeType as string) ?? ''
      );
      const sn = e.seasonNumber as number;
      const localDate = new Date(dateUtc);
      mapped.push({
        id: e.id as number, title: e.title as string, hasFile: e.hasFile as boolean,
        seriesTitle: ser?.title as string | undefined,
        seriesId:    ser?.id    as number | undefined,
        seasonNumber: sn, episodeNumber: e.episodeNumber as number,
        isFinale, isSeasonPack: sn === 0,
        app: 'sonarr',
        airTime: dateUtc.includes('T') ? localDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : undefined,
        dateKey: fmtDate(localDate),
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
        isFinale: false, isSeasonPack: false, app: 'lidarr',
        dateKey: date.slice(0, 10), navPath: `/music`,
      });
    }

    mapped.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    entries.value = mapped;
  } catch { entries.value = []; }
  finally { isLoading.value = false; }
}

onMounted(async () => {
  await Promise.allSettled([moviesStore.fetchMovies(), seriesStore.fetchSeries(), load()]);
});
watch([anchor, viewMode, weekStartMon], load);

// ── Filter + Bundle ───────────────────────────────────────────────────────────

const filtered = computed(() => entries.value.filter(e => {
  if (e.app === 'radarr' && !showRadarr.value) return false;
  if (e.app === 'sonarr' && !showSonarr.value) return false;
  if (e.app === 'lidarr' && !showLidarr.value) return false;
  if (e.app === 'radarr' && e.releaseType === 'inCinemas' && !showCinemas.value)  return false;
  if (e.app === 'radarr' && e.releaseType === 'digital'   && !showDigital.value)  return false;
  if (e.app === 'radarr' && e.releaseType === 'physical'  && !showPhysical.value) return false;
  if (e.app === 'sonarr' && e.isSeasonPack && !showSpecials.value) return false;
  return true;
}));

const displayEntries = computed(() => {
  let list = [...filtered.value];

  // Bundle Episoden
  if (bundleEpisodes.value) {
    const sonarrGroups = new Map<string, CalendarEntry[]>();
    const rest: CalendarEntry[] = [];
    for (const e of list) {
      if (e.app === 'sonarr' && e.seriesTitle) {
        const key = `${e.dateKey}|${e.navPath}`;
        if (!sonarrGroups.has(key)) sonarrGroups.set(key, []);
        sonarrGroups.get(key)!.push(e);
      } else rest.push(e);
    }
    list = [...rest];
    for (const episodes of sonarrGroups.values()) {
      if (episodes.length === 1) { list.push(episodes[0]); continue; }
      list.push({
        ...episodes[0],
        title: `${episodes.length} Episoden`,
        episodeNumber: undefined,
        isFinale: episodes.some(e => e.isFinale),
        bundledCount: episodes.length,
      });
    }
    list.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }

  // Bundle Alben
  if (bundleAlbums.value) {
    const lidarrGroups = new Map<string, CalendarEntry[]>();
    const rest: CalendarEntry[] = list.filter(e => e.app !== 'lidarr');
    for (const e of list.filter(e => e.app === 'lidarr')) {
      const key = e.dateKey;
      if (!lidarrGroups.has(key)) lidarrGroups.set(key, []);
      lidarrGroups.get(key)!.push(e);
    }
    for (const albums of lidarrGroups.values()) {
      if (albums.length === 1) { rest.push(albums[0]); continue; }
      rest.push({ ...albums[0], title: `${albums.length} Alben`, bundledCount: albums.length });
    }
    list = rest.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }

  return list;
});

function entriesForDay(dateKey: string) {
  return displayEntries.value.filter(e => e.dateKey === dateKey);
}

// Listenansicht
const listGrouped = computed(() => {
  const map = new Map<string, CalendarEntry[]>();
  for (const e of displayEntries.value) {
    if (e.dateKey < fmtDate(listStart.value) || e.dateKey > fmtDate(listEnd.value)) continue;
    if (!map.has(e.dateKey)) map.set(e.dateKey, []);
    map.get(e.dateKey)!.push(e);
  }
  return map;
});
const listDates = computed(() => [...listGrouped.value.keys()].sort());

// ── Library-Lookup für reichhaltigen Tooltip ──────────────────────────────────

const hoverLibraryItem = computed(() => {
  const e = hoverEntry.value;
  if (!e || !e.hasFile) return null;
  if (e.app === 'radarr' && e.radarrId) {
    return moviesStore.movies.find(m => m.id === e.radarrId) ?? null;
  }
  if (e.app === 'sonarr' && e.seriesId) {
    return seriesStore.series.find(s => s.id === e.seriesId) ?? null;
  }
  return null;
});

const hoverPoster = computed(() => {
  const item = hoverLibraryItem.value as any;
  if (!item) return null;
  return (item.images as Array<{ coverType: string; remoteUrl: string }> | undefined)
    ?.find(i => i.coverType === 'poster')?.remoteUrl ?? null;
});

const hoverGenres = computed(() => {
  const item = hoverLibraryItem.value as any;
  return (item?.genres as string[] | undefined)?.slice(0, 4) ?? [];
});

const hoverRating = computed(() => {
  const item = hoverLibraryItem.value as any;
  if (!item) return null;
  const r = item.ratings;
  if (r?.imdb?.value) return { src: 'IMDb', val: r.imdb.value.toFixed(1) };
  if (r?.tmdb?.value) return { src: 'TMDB', val: r.tmdb.value.toFixed(1) };
  if (typeof r?.value === 'number') return { src: '★', val: r.value.toFixed(1) };
  return null;
});

// ── Range Label ───────────────────────────────────────────────────────────────

const rangeLabel = computed(() => {
  if (viewMode.value === 'week') {
    const s = weekDays.value[0].toLocaleDateString('de-DE', { day: 'numeric', month: 'short' });
    const e = weekDays.value[6].toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
    return `${s} – ${e}`;
  }
  if (viewMode.value === 'month')
    return anchor.value.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const s = listStart.value.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  const e = listEnd.value.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${s} – ${e}`;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAY_NAMES_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DAY_NAMES_FULL  = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function isPast(dk: string)  { return dk < todayKey; }
function isToday(dk: string) { return dk === todayKey; }
function isCurMonth(d: Date) { return d.getMonth() === anchor.value.getMonth(); }

function dayHeaderText(day: Date): { top: string; bot: string } {
  const fmt = colHeaderFmt.value;
  if (fmt === 'long') return { top: DAY_NAMES_FULL[day.getDay()], bot: '' };
  if (fmt === 'date') return { top: `${String(day.getDate()).padStart(2,'0')}.${String(day.getMonth()+1).padStart(2,'0')}.`, bot: '' };
  // default: short  = "Do\n2"
  return { top: DAY_NAMES_SHORT[day.getDay()], bot: String(day.getDate()) };
}

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
  if (t === 'inCinemas') return '🎬'; if (t === 'digital') return '💻'; if (t === 'physical') return '📀'; return '';
}
function episodeLabel(e: CalendarEntry) {
  if (e.seasonNumber !== undefined && e.episodeNumber !== undefined)
    return `S${String(e.seasonNumber).padStart(2,'0')}E${String(e.episodeNumber).padStart(2,'0')}`;
  return '';
}
function navigateTo(e: CalendarEntry) { if (e.navPath && e.navPath !== '/music') router.push(e.navPath); }
function appColor(app: CalendarEntry['app']) {
  return app === 'radarr' ? 'var(--radarr)' : app === 'sonarr' ? 'var(--sonarr)' : 'var(--lidarr)';
}
function cardStyle(e: CalendarEntry) {
  if (!fullColor.value) return '';
  const c = appColor(e.app);
  return `background:color-mix(in srgb,${c} 10%,var(--bg-surface));border-color:color-mix(in srgb,${c} 25%,transparent)`;
}

// ── Hover ──────────────────────────────────────────────────────────────────────

function onEnter(ev: MouseEvent, entry: CalendarEntry) { hoverEntry.value = entry; updatePos(ev); }
function onMove(ev: MouseEvent) { if (hoverEntry.value) updatePos(ev); }
function onLeave() { hoverEntry.value = null; }
function updatePos(ev: MouseEvent) {
  hoverPos.value = {
    x: Math.min(ev.clientX + 16, window.innerWidth - 310),
    y: Math.min(ev.clientY - 8,  window.innerHeight - 240),
  };
}
</script>

<template>
  <div class="calendar-view">

    <!-- ── Hover Tooltip ── -->
    <Teleport to="body">
      <div v-if="hoverEntry" class="hover-tooltip"
        :style="`left:${hoverPos.x}px;top:${hoverPos.y}px;--ec:${appColor(hoverEntry.app)}`">
        <!-- Rich: Poster + Daten aus Bibliothek -->
        <template v-if="hoverLibraryItem">
          <div class="ht-rich">
            <img v-if="hoverPoster" :src="hoverPoster" class="ht-poster" />
            <div class="ht-rich-info">
              <div class="ht-top">
                <span class="ht-badge" :style="`background:color-mix(in srgb,var(--ec) 12%,transparent);color:var(--ec);border:1px solid color-mix(in srgb,var(--ec) 25%,transparent)`">
                  {{ appLabel(hoverEntry.app) }}
                </span>
                <span v-if="episodeLabel(hoverEntry)" class="ht-ep">{{ episodeLabel(hoverEntry) }}</span>
                <span v-if="hoverEntry.isFinale && showFinaleSymbol" class="ht-finale">★ Finale</span>
                <span v-if="hoverEntry.airTime && showAirTime" class="ht-time">{{ hoverEntry.airTime }}</span>
              </div>
              <p class="ht-title">{{ hoverEntry.seriesTitle ?? hoverEntry.title }}</p>
              <p v-if="hoverEntry.seriesTitle" class="ht-sub">{{ hoverEntry.title }}</p>
              <div v-if="hoverGenres.length" class="ht-genres">
                <span v-for="g in hoverGenres" :key="g" class="ht-genre">{{ g }}</span>
              </div>
              <div v-if="hoverRating" class="ht-rating">
                ⭐ {{ hoverRating.val }} <span class="ht-rating-src">{{ hoverRating.src }}</span>
              </div>
            </div>
          </div>
          <p v-if="hoverEntry.overview" class="ht-overview">{{ hoverEntry.overview.slice(0, 160) }}{{ hoverEntry.overview.length > 160 ? '…' : '' }}</p>
          <div class="ht-status ht-ok">✓ In Bibliothek</div>
        </template>
        <!-- Standard: ohne Bibliotheks-Daten -->
        <template v-else>
          <div class="ht-top">
            <span class="ht-badge" :style="`background:color-mix(in srgb,var(--ec) 12%,transparent);color:var(--ec);border:1px solid color-mix(in srgb,var(--ec) 25%,transparent)`">
              {{ appLabel(hoverEntry.app) }}
            </span>
            <span v-if="episodeLabel(hoverEntry)" class="ht-ep">{{ episodeLabel(hoverEntry) }}</span>
            <span v-if="hoverEntry.isFinale && showFinaleSymbol" class="ht-finale">★ Finale</span>
            <span v-if="hoverEntry.airTime && showAirTime" class="ht-time">{{ hoverEntry.airTime }}</span>
          </div>
          <p class="ht-title">{{ hoverEntry.seriesTitle ?? hoverEntry.title }}</p>
          <p v-if="hoverEntry.seriesTitle" class="ht-sub">{{ hoverEntry.title }}</p>
          <p v-if="hoverEntry.overview" class="ht-overview">{{ hoverEntry.overview.slice(0, 180) }}{{ hoverEntry.overview.length > 180 ? '…' : '' }}</p>
          <div class="ht-status ht-miss">○ Ausstehend</div>
        </template>
      </div>
    </Teleport>

    <!-- ── Optionen-Drawer ── -->
    <Teleport to="body">
      <Transition name="drawer">
        <div v-if="showOptions" class="opt-drawer">
          <div class="opt-drawer-header">
            <span>Kalenderoptionen</span>
            <button class="opt-close" @click="showOptions = false">✕</button>
          </div>
          <div class="opt-drawer-body">

            <!-- FILME -->
            <div class="opt-section">
              <div class="opt-section-title" style="color:var(--radarr)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>
                Filme
              </div>
              <div class="opt-row"><div class="opt-row-text"><p>Kino-Starts anzeigen</p><span>Filme bei Kinostart im Kalender zeigen</span></div><button :class="['tog', {on: showCinemas}]" @click="showCinemas = !showCinemas"><span class="tog-knob" /></button></div>
              <div class="opt-row"><div class="opt-row-text"><p>Digital-Releases anzeigen</p><span>Filme bei Digital-Release im Kalender zeigen</span></div><button :class="['tog', {on: showDigital}]" @click="showDigital = !showDigital"><span class="tog-knob" /></button></div>
              <div class="opt-row"><div class="opt-row-text"><p>Physische Releases anzeigen</p><span>Filme bei Blu-ray/DVD-Veröffentlichung zeigen</span></div><button :class="['tog', {on: showPhysical}]" @click="showPhysical = !showPhysical"><span class="tog-knob" /></button></div>
            </div>

            <!-- SERIEN -->
            <div class="opt-section">
              <div class="opt-section-title" style="color:var(--sonarr)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>
                Serien
              </div>
              <div class="opt-row"><div class="opt-row-text"><p>Mehrere Episoden zusammenfassen</p><span>Serien mit mehreren Folgen am selben Tag zu einem Eintrag bündeln</span></div><button :class="['tog', {on: bundleEpisodes}]" @click="bundleEpisodes = !bundleEpisodes"><span class="tog-knob" /></button></div>
              <div class="opt-row"><div class="opt-row-text"><p>Episodeninformationen anzeigen</p><span>Titel und Nummer der Episode einblenden</span></div><button :class="['tog', {on: showEpInfo}]" @click="showEpInfo = !showEpInfo"><span class="tog-knob" /></button></div>
              <div class="opt-row"><div class="opt-row-text"><p>Symbol für Staffel-/Serienfinale</p><span>Zeigt ★ bei letzter Episode einer Staffel oder Serie</span></div><button :class="['tog', {on: showFinaleSymbol}]" @click="showFinaleSymbol = !showFinaleSymbol"><span class="tog-knob" /></button></div>
              <div class="opt-row"><div class="opt-row-text"><p>Symbol für Specials</p><span>Zeigt ★ bei Episoden aus Staffel 0</span></div><button :class="['tog', {on: showSpecials}]" @click="showSpecials = !showSpecials"><span class="tog-knob" /></button></div>
            </div>

            <!-- MUSIK -->
            <div class="opt-section">
              <div class="opt-section-title" style="color:var(--lidarr)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                Musik
              </div>
              <div class="opt-row"><div class="opt-row-text"><p>Mehrere Alben zusammenfassen</p><span>Alben desselben Künstlers am gleichen Tag bündeln</span></div><button :class="['tog', {on: bundleAlbums}]" @click="bundleAlbums = !bundleAlbums"><span class="tog-knob" /></button></div>
            </div>

            <!-- DESIGN -->
            <div class="opt-section">
              <div class="opt-section-title">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Design
              </div>
              <div class="opt-row"><div class="opt-row-text"><p>Vollfarbige Ereignisse</p><span>Ganze Event-Kachel in App-Farbe statt nur linker Rand</span></div><button :class="['tog', {on: fullColor}]" @click="fullColor = !fullColor"><span class="tog-knob" /></button></div>
              <div class="opt-row"><div class="opt-row-text"><p>Uhrzeiten anzeigen</p><span>Ausstrahlungszeit unter dem Episodentitel</span></div><button :class="['tog', {on: showAirTime}]" @click="showAirTime = !showAirTime"><span class="tog-knob" /></button></div>
            </div>

            <!-- WOCHENANSICHT -->
            <div class="opt-section">
              <div class="opt-section-title">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Wochenansicht
              </div>
              <div class="opt-field">
                <label class="opt-field-lbl">Erster Tag der Woche</label>
                <select class="opt-select" :value="weekStartMon ? 'mo' : 'so'" @change="weekStartMon = ($event.target as HTMLSelectElement).value === 'mo'">
                  <option value="mo">Montag</option>
                  <option value="so">Sonntag</option>
                </select>
              </div>
              <div class="opt-field">
                <label class="opt-field-lbl">Spaltenüberschrift</label>
                <select class="opt-select" v-model="colHeaderFmt">
                  <option value="short">Wochentag (Do)</option>
                  <option value="long">Wochentag ausgeschrieben</option>
                  <option value="date">Datum (Do.)</option>
                </select>
              </div>
            </div>

          </div>
        </div>
      </Transition>
      <Transition name="drawer-backdrop">
        <div v-if="showOptions" class="opt-backdrop" @click="showOptions = false" />
      </Transition>
    </Teleport>

    <!-- ── Header ── -->
    <div class="cal-header">
      <div class="header-left">
        <h1 class="view-title">Kalender</h1>
        <p class="view-sub">{{ rangeLabel }}</p>
      </div>
      <div class="header-right">
        <div class="view-tabs">
          <button v-for="m in (['week','month','list'] as const)" :key="m"
            :class="['vtab', { active: viewMode === m }]" @click="viewMode = m">
            {{ m === 'week' ? 'Woche' : m === 'month' ? 'Monat' : 'Liste' }}
          </button>
        </div>
        <div class="nav-group">
          <button class="nav-btn" @click="goPrev">‹</button>
          <button class="today-btn" @click="goToday">Heute</button>
          <button class="nav-btn" @click="goNext">›</button>
        </div>
        <!-- Filter Chips (kompakt, immer sichtbar) -->
        <div class="filter-chips">
          <button :class="['fchip', { active: showRadarr }]" :style="showRadarr ? 'border-color:var(--radarr);color:var(--radarr)' : ''" @click="showRadarr = !showRadarr">Film</button>
          <button :class="['fchip', { active: showSonarr }]" :style="showSonarr ? 'border-color:var(--sonarr);color:var(--sonarr)' : ''" @click="showSonarr = !showSonarr">Serie</button>
          <button :class="['fchip', { active: showLidarr }]" :style="showLidarr ? 'border-color:var(--lidarr);color:var(--lidarr)' : ''" @click="showLidarr = !showLidarr">Musik</button>
        </div>
        <button :class="['opt-toggle', { active: showOptions }]" @click="showOptions = !showOptions">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="18" y2="18"/></svg>
          Optionen
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-grid">
      <div v-for="i in 7" :key="i" class="skeleton-col">
        <div class="skeleton" style="height:36px;border-radius:6px" />
        <div v-if="i % 2 === 0" class="skeleton" style="height:52px;border-radius:8px;margin-top:6px" />
        <div v-if="i % 3 !== 0" class="skeleton" style="height:52px;border-radius:8px;margin-top:6px" />
      </div>
    </div>

    <!-- ── Wochenansicht ── -->
    <div v-else-if="viewMode === 'week'" class="week-view">
      <div class="week-header-row">
        <div v-for="day in weekDays" :key="fmtDate(day)"
          :class="['week-day-hdr', { 'wdh-today': isToday(fmtDate(day)) }]">
          <span class="wdh-name">{{ dayHeaderText(day).top }}</span>
          <span v-if="dayHeaderText(day).bot" class="wdh-num" :class="{ 'wdh-num-today': isToday(fmtDate(day)) }">{{ dayHeaderText(day).bot }}</span>
        </div>
      </div>
      <div class="week-body">
        <div v-for="day in weekDays" :key="'col-'+fmtDate(day)"
          :class="['week-col', { 'wcol-today': isToday(fmtDate(day)), 'wcol-past': isPast(fmtDate(day)) }]">
          <template v-if="entriesForDay(fmtDate(day)).length">
            <div v-for="entry in entriesForDay(fmtDate(day))" :key="`${entry.app}-${entry.id}-${entry.releaseType}`"
              class="week-event"
              :class="[`evt-${entry.app}`, { 'evt-clickable': entry.navPath !== '/music' }]"
              :style="cardStyle(entry)"
              @click="navigateTo(entry)"
              @mouseenter="(e) => onEnter(e, entry)"
              @mousemove="onMove"
              @mouseleave="onLeave">
              <div class="evt-accent" :style="`background:${appColor(entry.app)}`" />
              <div class="evt-body">
                <div class="evt-top">
                  <span class="evt-type-icon">{{ releaseTypeLabel(entry.releaseType) || (entry.app === 'sonarr' ? '📺' : entry.app === 'lidarr' ? '🎵' : '') }}</span>
                  <span v-if="entry.isFinale && showFinaleSymbol" class="evt-finale">★</span>
                  <span v-if="entry.isSeasonPack" class="evt-special">◈</span>
                  <span v-if="entry.airTime && showAirTime" class="evt-time">{{ entry.airTime }}</span>
                  <span v-if="entry.hasFile" class="evt-check">✓</span>
                </div>
                <p class="evt-title">{{ entry.seriesTitle ?? entry.title }}</p>
                <p v-if="entry.seriesTitle && showEpInfo" class="evt-ep">
                  {{ entry.bundledCount ? `${entry.bundledCount} Ep.` : episodeLabel(entry) }}
                  {{ !entry.bundledCount ? entry.title : '' }}
                </p>
              </div>
            </div>
          </template>
          <div v-else class="week-col-empty" />
        </div>
      </div>
    </div>

    <!-- ── Monatsansicht ── -->
    <div v-else-if="viewMode === 'month'" class="month-view">
      <div class="month-hdr-row">
        <div v-for="i in 7" :key="i" class="month-hdr-cell">
          {{ DAY_NAMES_SHORT[weekStartMon ? (i % 7) : (i - 1)] }}
        </div>
      </div>
      <div class="month-grid">
        <div v-for="day in monthDays" :key="fmtDate(day)"
          :class="['month-cell', {
            'mc-other': !isCurMonth(day),
            'mc-today': isToday(fmtDate(day)),
            'mc-past':  isPast(fmtDate(day)) && isCurMonth(day),
          }]">
          <div class="mc-num">{{ day.getDate() }}</div>
          <!-- ALLE Items anzeigen, kein Limit -->
          <div v-for="entry in entriesForDay(fmtDate(day))" :key="`${entry.app}-${entry.id}-${entry.releaseType}`"
            class="mc-event"
            :style="`background:color-mix(in srgb,${appColor(entry.app)} 15%,var(--bg-elevated));border-left:2px solid ${appColor(entry.app)}`"
            @click="navigateTo(entry)"
            @mouseenter="(e) => onEnter(e, entry)"
            @mousemove="onMove"
            @mouseleave="onLeave">
            <span v-if="entry.isFinale && showFinaleSymbol" class="mc-finale">★</span>
            <span v-if="entry.isSeasonPack" class="mc-special">◈</span>
            <span class="mc-evt-title">{{ entry.seriesTitle ?? entry.title }}</span>
            <span v-if="entry.hasFile" class="mc-check">✓</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Listenansicht ── -->
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
                  <span v-if="episodeLabel(entry) && showEpInfo" class="entry-episode">{{ episodeLabel(entry) }}</span>
                  <span v-if="entry.isFinale && showFinaleSymbol" class="entry-finale">★ Finale</span>
                  <span v-if="entry.airTime && showAirTime" class="entry-time">{{ entry.airTime }}</span>
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
.calendar-view { padding: var(--space-6); min-height: 100%; display: flex; flex-direction: column; gap: var(--space-4); }

/* ── Header ── */
.cal-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; }
.header-left { display: flex; flex-direction: column; gap: 3px; }
.view-title { font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); margin: 0; }
.view-sub { font-size: var(--text-sm); color: var(--text-muted); margin: 0; }
.header-right { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }

.view-tabs { display: flex; background: var(--bg-elevated); border: 1px solid var(--bg-border); border-radius: var(--radius-md); overflow: hidden; }
.vtab { padding: 5px 14px; font-size: var(--text-sm); font-weight: 500; color: var(--text-muted); cursor: pointer; transition: all .12s; background: none; border: none; }
.vtab:hover { color: var(--text-secondary); }
.vtab.active { background: var(--accent-muted); color: var(--accent); }

.nav-group { display: flex; align-items: center; gap: var(--space-1); }
.nav-btn { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md); background: var(--bg-elevated); border: 1px solid var(--bg-border); color: var(--text-secondary); cursor: pointer; font-size: 16px; transition: all .12s; }
.nav-btn:hover { background: var(--bg-overlay); color: var(--text-primary); }
.today-btn { padding: 5px 14px; border-radius: var(--radius-md); background: rgba(155,0,69,.1); border: 1px solid rgba(155,0,69,.25); color: var(--accent); font-size: var(--text-sm); font-weight: 600; cursor: pointer; transition: all .12s; }
.today-btn:hover { background: rgba(155,0,69,.2); }
.opt-toggle { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: var(--radius-md); background: var(--bg-elevated); border: 1px solid var(--bg-border); color: var(--text-muted); font-size: var(--text-sm); cursor: pointer; transition: all .12s; }
.opt-toggle:hover, .opt-toggle.active { border-color: var(--accent); color: var(--accent); background: rgba(155,0,69,.08); }

/* Filter Chips */
.filter-chips { display: flex; gap: 4px; }
.fchip { padding: 4px 10px; border-radius: 99px; font-size: var(--text-xs); font-weight: 600; background: transparent; border: 1px solid var(--bg-border); color: var(--text-muted); cursor: pointer; transition: all .12s; }
.fchip:hover { border-color: var(--bg-border-hover); color: var(--text-secondary); }

/* ── Optionen Drawer ── */
.opt-backdrop { position: fixed; inset: 0; z-index: 1998; background: rgba(0,0,0,.5); backdrop-filter: blur(2px); }
.opt-drawer { position: fixed; top: 0; right: 0; bottom: 0; z-index: 1999; width: 340px; background: #111; border-left: 1px solid var(--bg-border); display: flex; flex-direction: column; box-shadow: -8px 0 32px rgba(0,0,0,.6); }
.opt-drawer-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-5) var(--space-6); border-bottom: 1px solid var(--bg-border); font-size: var(--text-base); font-weight: 700; color: var(--text-primary); flex-shrink: 0; }
.opt-close { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 16px; padding: 4px; transition: color .12s; }
.opt-close:hover { color: var(--text-primary); }
.opt-drawer-body { flex: 1; overflow-y: auto; padding: var(--space-4) 0 var(--space-6); }

.opt-section { padding: var(--space-3) var(--space-6); }
.opt-section + .opt-section { border-top: 1px solid var(--bg-border); }
.opt-section-title { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--text-muted); margin-bottom: var(--space-3); }
.opt-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-2) 0; }
.opt-row-text { flex: 1; min-width: 0; }
.opt-row-text p { font-size: var(--text-sm); font-weight: 500; color: var(--text-secondary); margin: 0 0 2px; }
.opt-row-text span { font-size: var(--text-xs); color: var(--text-muted); line-height: 1.4; }

/* Toggle Switch */
.tog { position: relative; width: 44px; height: 24px; border-radius: 99px; background: var(--bg-elevated); border: 1px solid var(--bg-border); cursor: pointer; transition: background .2s, border-color .2s; flex-shrink: 0; }
.tog.on { background: var(--accent); border-color: var(--accent); }
.tog-knob { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform .2s; display: block; box-shadow: 0 1px 3px rgba(0,0,0,.3); }
.tog.on .tog-knob { transform: translateX(20px); }

/* Dropdown */
.opt-field { padding: var(--space-2) 0; }
.opt-field-lbl { display: block; font-size: var(--text-xs); color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 5px; }
.opt-select { width: 100%; background: var(--bg-elevated); border: 1px solid var(--bg-border); color: var(--text-secondary); padding: 8px 10px; border-radius: var(--radius-md); font-size: var(--text-sm); outline: none; cursor: pointer; }
.opt-select:focus { border-color: var(--accent); }

.drawer-enter-active, .drawer-leave-active { transition: transform .25s ease; }
.drawer-enter-from, .drawer-leave-to { transform: translateX(100%); }
.drawer-backdrop-enter-active, .drawer-backdrop-leave-active { transition: opacity .25s ease; }
.drawer-backdrop-enter-from, .drawer-backdrop-leave-to { opacity: 0; }

/* ── Loading ── */
.loading-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: var(--space-2); }
.skeleton-col { display: flex; flex-direction: column; gap: var(--space-2); }

/* ── Week View ── */
.week-view { border: 1px solid var(--bg-border); border-radius: var(--radius-lg); overflow: hidden; }
.week-header-row { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); border-bottom: 1px solid var(--bg-border); }
.week-day-hdr { display: flex; flex-direction: column; align-items: center; padding: var(--space-2) var(--space-1); gap: 2px; background: var(--bg-surface); border-right: 1px solid var(--bg-border); }
.week-day-hdr:last-child { border-right: none; }
.wdh-today { background: rgba(155,0,69,.06); }
.wdh-name { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: .07em; }
.wdh-num { font-size: var(--text-base); font-weight: 700; color: var(--text-secondary); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
.wdh-num-today { background: var(--accent); color: #fff; }

.week-body { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
.week-col { display: flex; flex-direction: column; gap: 3px; padding: var(--space-2) var(--space-1); border-right: 1px solid var(--bg-border); min-width: 0; overflow: hidden; }
.week-col:last-child { border-right: none; }
.wcol-today { background: rgba(155,0,69,.03); }
.wcol-past { opacity: .5; }
.week-col-empty { min-height: 80px; }
.week-event { display: flex; border-radius: var(--radius-sm); border: 1px solid var(--bg-border); overflow: hidden; transition: all .12s; background: var(--bg-surface); }
.week-event.evt-clickable { cursor: pointer; }
.week-event.evt-clickable:hover { border-color: rgba(255,255,255,.15); transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,.3); }
.evt-accent { width: 3px; flex-shrink: 0; }
.evt-body { flex: 1; min-width: 0; padding: 4px 5px; }
.evt-top { display: flex; align-items: center; gap: 3px; margin-bottom: 2px; }
.evt-type-icon { font-size: 10px; line-height: 1; }
.evt-finale { font-size: 10px; color: var(--sabnzbd); font-weight: 700; }
.evt-special { font-size: 10px; color: var(--text-muted); }
.evt-time { font-size: 9px; color: var(--text-muted); margin-left: auto; font-variant-numeric: tabular-nums; }
.evt-check { font-size: 9px; color: var(--status-success); }
.evt-title { font-size: 10px; font-weight: 600; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0; line-height: 1.3; }
.evt-ep { font-size: 9px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0; line-height: 1.3; }

/* ── Month View ── */
.month-view { border: 1px solid var(--bg-border); border-radius: var(--radius-lg); overflow: hidden; }
.month-hdr-row { display: grid; grid-template-columns: repeat(7, 1fr); border-bottom: 1px solid var(--bg-border); background: var(--bg-surface); }
.month-hdr-cell { padding: var(--space-2); text-align: center; font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: .07em; border-right: 1px solid var(--bg-border); }
.month-hdr-cell:last-child { border-right: none; }
.month-grid { display: grid; grid-template-columns: repeat(7, 1fr); }
.month-cell { min-height: 80px; padding: var(--space-1); border-right: 1px solid var(--bg-border); border-bottom: 1px solid var(--bg-border); display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
.month-cell:nth-child(7n) { border-right: none; }
.mc-other { opacity: .3; }
.mc-today .mc-num { background: var(--accent); color: #fff; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
.mc-past { opacity: .45; }
.mc-num { font-size: 11px; font-weight: 700; color: var(--text-muted); width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.mc-event { display: flex; align-items: center; gap: 3px; border-radius: 3px; padding: 1px 4px; cursor: pointer; overflow: hidden; transition: opacity .12s; flex-shrink: 0; }
.mc-event:hover { opacity: .75; }
.mc-finale { font-size: 9px; color: var(--sabnzbd); flex-shrink: 0; }
.mc-special { font-size: 9px; color: var(--text-muted); flex-shrink: 0; }
.mc-evt-title { font-size: 9px; font-weight: 600; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.mc-check { font-size: 9px; color: var(--status-success); flex-shrink: 0; }

/* ── List View ── */
.list-view { flex: 1; }
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

/* ── Hover Tooltip ── */
.hover-tooltip { position: fixed; z-index: 9999; width: 300px; background: var(--bg-elevated); border: 1px solid color-mix(in srgb, var(--ec) 30%, var(--bg-border)); border-radius: var(--radius-lg); padding: var(--space-3) var(--space-4); box-shadow: 0 8px 32px rgba(0,0,0,.7); pointer-events: none; }
.ht-rich { display: flex; gap: var(--space-3); margin-bottom: var(--space-3); }
.ht-poster { width: 60px; height: 90px; object-fit: cover; border-radius: var(--radius-md); flex-shrink: 0; border: 1px solid var(--bg-border); }
.ht-rich-info { flex: 1; min-width: 0; }
.ht-top    { display: flex; align-items: center; gap: 5px; margin-bottom: 5px; flex-wrap: wrap; }
.ht-badge  { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 3px; }
.ht-ep     { font-size: 10px; color: var(--text-muted); font-weight: 600; }
.ht-finale { font-size: 10px; color: var(--sabnzbd); font-weight: 700; }
.ht-time   { font-size: 10px; color: var(--text-muted); margin-left: auto; font-variant-numeric: tabular-nums; }
.ht-title  { font-size: var(--text-sm); font-weight: 700; color: var(--text-primary); margin: 0 0 2px; }
.ht-sub    { font-size: 11px; color: var(--text-tertiary); margin: 0 0 4px; }
.ht-genres { display: flex; gap: 3px; flex-wrap: wrap; margin-top: 4px; }
.ht-genre  { font-size: 9px; padding: 1px 6px; border-radius: 3px; background: var(--bg-surface); color: var(--text-muted); border: 1px solid var(--bg-border); }
.ht-rating { font-size: var(--text-xs); font-weight: 700; color: var(--sabnzbd); margin-top: 4px; }
.ht-rating-src { font-size: 10px; color: var(--text-muted); font-weight: 400; margin-left: 3px; }
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
