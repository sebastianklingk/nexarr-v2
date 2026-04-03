<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '../composables/useApi.js';
import { tmdbImageUrl } from '../utils/images.js';

const router  = useRouter();
const { get } = useApi();

// ── Types ─────────────────────────────────────────────────────────────────────

type TechBadge = { label: string; color: string };

interface CalendarEntry {
  id:             number;
  title:          string;
  overview?:      string;
  hasFile:        boolean;
  isFinale:       boolean;
  isPremiere:     boolean;
  isSeasonPack:   boolean;
  bundledCount?:  number;
  app:            'radarr' | 'sonarr' | 'lidarr';
  releaseType?:   'inCinemas' | 'digital' | 'physical';
  airTime?:       string;
  dateKey:        string;
  navPath:        string;

  // ── Film ──────────────────────────────────────────────────────────────────
  radarrId?:      number;
  moviePosterUrl?: string;
  movieYear?:     number;
  movieRuntime?:  number;
  movieGenres?:   string[];
  movieImdbRating?: number;
  movieTmdbRating?: number;
  movieQuality?:  string;
  movieTechBadges?: TechBadge[];

  // ── Serie ─────────────────────────────────────────────────────────────────
  seriesId?:      number;
  seriesTitle?:   string;
  seriesPosterUrl?: string;
  seriesYear?:    number;
  seriesGenres?:  string[];
  seriesNetwork?: string;
  seriesImdbRating?: number;
  seriesRatingValue?: number;
  seriesStatus?:  string;
  seriesSeasonCount?: number;
  seasonNumber?:  number;
  episodeNumber?: number;

  // ── Episode-File ──────────────────────────────────────────────────────────
  episodeQuality?: string;
  episodeQualityName?: string;
  episodeRuntime?: string;
  episodeSize?:   number;
  episodeLanguages?: string[];
  episodeReleaseGroup?: string;
  episodeCutoffNotMet?: boolean;
  episodeTechBadges?: TechBadge[];
  episodeFps?:    number;
  episodeBitDepth?: number;
}

// ── LocalStorage ──────────────────────────────────────────────────────────────

function ls<T>(k: string, d: T): T {
  try { const v = localStorage.getItem('cal_'+k); return v !== null ? JSON.parse(v) : d; } catch { return d; }
}
function lsSet(k: string, v: unknown) { try { localStorage.setItem('cal_'+k, JSON.stringify(v)); } catch {} }

// ── Optionen ──────────────────────────────────────────────────────────────────

type ViewMode = 'week' | 'month' | 'list';
const viewMode         = ref<ViewMode>(ls('view', 'week'));
const weekStartMon     = ref<boolean>(ls('weekStartMon', true));
const colHeaderFmt     = ref<string>(ls('colHdrFmt', 'short'));
const fullColor        = ref<boolean>(ls('fullColor', false));
const showAirTime      = ref<boolean>(ls('showAirTime', true));
const showRadarr       = ref<boolean>(ls('showRadarr', true));
const showSonarr       = ref<boolean>(ls('showSonarr', true));
const showLidarr       = ref<boolean>(ls('showLidarr', true));
const showCinemas      = ref<boolean>(ls('showCinemas', true));
const showDigital      = ref<boolean>(ls('showDigital', true));
const showPhysical     = ref<boolean>(ls('showPhysical', true));
const bundleEpisodes   = ref<boolean>(ls('bundleEp', false));
const showEpInfo       = ref<boolean>(ls('showEpInfo', true));
const showFinaleSymbol = ref<boolean>(ls('showFinale', true));
const showPremiereSymbol = ref<boolean>(ls('showPremiere', true));
const showSpecials     = ref<boolean>(ls('showSpecials', false));
const bundleAlbums     = ref<boolean>(ls('bundleAlb', false));
const showOptions      = ref(false);

const watchMap: Record<string, ReturnType<typeof ref>> = {
  view: viewMode, weekStartMon, colHdrFmt: colHeaderFmt, fullColor, showAirTime,
  showRadarr, showSonarr, showLidarr, showCinemas, showDigital, showPhysical,
  bundleEp: bundleEpisodes, showEpInfo, showFinale: showFinaleSymbol,
  showPremiere: showPremiereSymbol, showSpecials, bundleAlb: bundleAlbums,
};
for (const [k, r] of Object.entries(watchMap)) watch(r, v => lsSet(k, v));

// ── State ─────────────────────────────────────────────────────────────────────

const isLoading  = ref(true);
const entries    = ref<CalendarEntry[]>([]);
const hoverEntry = ref<CalendarEntry | null>(null);
const hoverPos   = ref({ x: 0, y: 0 });

const today = new Date(); today.setHours(0,0,0,0);
function fmtDate(d: Date) {
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

// ── Datum ─────────────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date); const dow = d.getDay();
  d.setDate(d.getDate() + (weekStartMon.value ? (dow===0 ? -6 : 1-dow) : -dow));
  d.setHours(0,0,0,0); return d;
}

const weekDays = computed(() => {
  const s = getWeekStart(anchor.value);
  return Array.from({length:7}, (_,i) => { const d=new Date(s); d.setDate(d.getDate()+i); return d; });
});

const monthDays = computed(() => {
  const s = getWeekStart(new Date(anchor.value.getFullYear(), anchor.value.getMonth(), 1));
  const days: Date[] = []; const cur = new Date(s);
  while (days.length < 42) { days.push(new Date(cur)); cur.setDate(cur.getDate()+1); }
  return days;
});

const listStart = computed(() => { const d=new Date(anchor.value); d.setDate(d.getDate()-3); return d; });
const listEnd   = computed(() => { const d=new Date(listStart.value); d.setDate(d.getDate()+36); return d; });

const loadStart = computed(() =>
  viewMode.value==='week' ? weekDays.value[0] : viewMode.value==='month' ? monthDays.value[0] : listStart.value
);
const loadEnd = computed(() => {
  const b = viewMode.value==='week' ? weekDays.value[6] : viewMode.value==='month' ? monthDays.value[41] : listEnd.value;
  const d = new Date(b); d.setDate(d.getDate()+1); return d;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildTechBadges(mi: any): TechBadge[] {
  if (!mi) return [];
  const b: TechBadge[] = [];
  const res = String(mi.resolution ?? '').toLowerCase();
  if (res.includes('3840')||res.includes('2160'))     b.push({label:'4K',    color:'#35c5f4'});
  else if (res.includes('1920')||res.includes('1080')) b.push({label:'1080p', color:'#35c5f4'});
  else if (res.includes('720'))                        b.push({label:'720p',  color:'#35c5f4'});
  const hdr = String(mi.videoDynamicRangeType ?? mi.videoDynamicRange ?? '').toUpperCase();
  if (hdr.includes('DOLBY')||hdr==='DV') b.push({label:'DV',  color:'#bb86fc'});
  else if (hdr.includes('HDR'))          b.push({label:'HDR', color:'#f5c518'});
  const vc = String(mi.videoCodec ?? '').toLowerCase();
  if (vc.includes('h265')||vc.includes('hevc'))      b.push({label:'H.265', color:'#888'});
  else if (vc.includes('h264')||vc.includes('avc'))  b.push({label:'H.264', color:'#888'});
  const ac = String(mi.audioCodec ?? '').toUpperCase();
  if (ac.includes('ATMOS'))                          b.push({label:'Atmos',  color:'#22c65b'});
  else if (ac.includes('TRUEHD'))                    b.push({label:'TrueHD', color:'#22c65b'});
  else if (ac.includes('EAC3')||ac.includes('DDP'))  b.push({label:'DD+',   color:'#aaa'});
  else if (ac.includes('DTS'))                       b.push({label:'DTS',   color:'#aaa'});
  const ch = parseFloat(String(mi.audioChannels ?? 0));
  if (ch>=7)      b.push({label:'7.1', color:'#666'});
  else if (ch>=5) b.push({label:'5.1', color:'#666'});
  return b;
}

function qualityLbl(res: number, name: string): string | undefined {
  if (res===2160) return '4K';
  if (res===1080) return '1080p';
  if (res===720)  return '720p';
  return name?.split('-')[0] || undefined;
}

function fmtSize(bytes?: number): string | undefined {
  if (!bytes) return undefined;
  if (bytes>=1e9) return `${(bytes/1e9).toFixed(2)} GB`;
  if (bytes>=1e6) return `${(bytes/1e6).toFixed(0)} MB`;
  return `${(bytes/1e3).toFixed(0)} KB`;
}

function posterFromImages(imgs: any[]): string | null {
  if (!imgs?.length) return null;
  const p = imgs.find(i => i.coverType==='poster' || i.type==='poster');
  const url = p?.remoteUrl ?? p?.url ?? null;
  return url ? (tmdbImageUrl(url, 'w342') ?? url) : null;
}

// ── Laden ─────────────────────────────────────────────────────────────────────

async function load() {
  isLoading.value = true;
  try {
    const data = await get<{
      radarr: Record<string,unknown>[];
      sonarr: Record<string,unknown>[];
      lidarr: Record<string,unknown>[];
    }>(`/api/calendar?start=${fmtDate(loadStart.value)}&end=${fmtDate(loadEnd.value)}`);

    const mapped: CalendarEntry[] = [];

    // ── Radarr ────────────────────────────────────────────────────────────────
    for (const m of data.radarr) {
      const types: { type: 'inCinemas'|'digital'|'physical'; date: string }[] = [];
      if (m.inCinemas)       types.push({type:'inCinemas', date: m.inCinemas as string});
      if (m.digitalRelease)  types.push({type:'digital',   date: m.digitalRelease as string});
      if (m.physicalRelease) types.push({type:'physical',  date: m.physicalRelease as string});
      if (!types.length) continue;

      const mi = m.images as any[];
      const mf = m.movieFile as any;
      const mfQi = mf?.quality?.quality;
      const ratings = m.ratings as any;

      const base: Partial<CalendarEntry> = {
        id: m.id as number, title: m.title as string, hasFile: m.hasFile as boolean,
        isFinale: false, isPremiere: false, isSeasonPack: false, radarrId: m.id as number, app: 'radarr',
        overview: m.overview as string | undefined,
        moviePosterUrl: posterFromImages(mi) ?? undefined,
        movieYear:     m.year as number | undefined,
        movieRuntime:  m.runtime as number | undefined,
        movieGenres:   (m.genres as string[]|undefined)?.slice(0,4),
        movieImdbRating: ratings?.imdb?.value,
        movieTmdbRating: ratings?.tmdb?.value,
        movieQuality:  mf ? qualityLbl(mfQi?.resolution??0, mfQi?.name??'') : undefined,
        movieTechBadges: buildTechBadges(mf?.mediaInfo),
      };

      for (const {type, date} of types) {
        mapped.push({...base, releaseType: type, dateKey: date.slice(0,10), navPath: `/movies/${m.id}`} as CalendarEntry);
      }
    }

    // ── Sonarr ────────────────────────────────────────────────────────────────
    for (const e of data.sonarr) {
      const dateUtc = (e.airDateUtc ?? e.airDate) as string | undefined;
      if (!dateUtc) continue;
      const ser = e.series as any;
      // Sonarr finaleType values: 'season', 'series', 'midSeason' (NOT 'seasonFinale' etc.)
      const finaleType = ((e.finaleType as string) ?? '').toLowerCase();
      const isFinale = ['season','series','midseason'].includes(finaleType);
      const sn = e.seasonNumber as number;
      const en = e.episodeNumber as number;
      const isPremiere = en === 1;
      const localDate = new Date(dateUtc);
      const serRatings = ser?.ratings as any;

      const epFile = e.episodeFile as any;
      let episodeQuality: string|undefined, episodeQualityName: string|undefined;
      let episodeRuntime: string|undefined, episodeSize: number|undefined;
      let episodeLanguages: string[] = [];
      let episodeReleaseGroup: string|undefined, episodeCutoffNotMet = false;
      let episodeTechBadges: TechBadge[] = [];
      let episodeFps: number|undefined, episodeBitDepth: number|undefined;

      if (epFile) {
        const qi = epFile.quality?.quality;
        episodeQuality     = qualityLbl(qi?.resolution??0, qi?.name??'');
        episodeQualityName = qi?.name;
        episodeTechBadges  = buildTechBadges(epFile.mediaInfo);
        episodeRuntime     = epFile.mediaInfo?.runTime;
        episodeSize        = epFile.size;
        episodeLanguages   = (epFile.languages ?? []).map((l: any) => l.name);
        episodeReleaseGroup= epFile.releaseGroup;
        episodeCutoffNotMet= epFile.qualityCutoffNotMet ?? false;
        episodeFps         = epFile.mediaInfo?.videoFps;
        episodeBitDepth    = epFile.mediaInfo?.videoBitDepth;
      }

      mapped.push({
        id: e.id as number, title: e.title as string, hasFile: e.hasFile as boolean,
        isFinale, isPremiere, isSeasonPack: sn===0, app: 'sonarr',
        seriesId:    ser?.id,
        seriesTitle: ser?.title,
        seriesPosterUrl: posterFromImages(ser?.images) ?? undefined,
        seriesYear:  ser?.year,
        seriesGenres: (ser?.genres as string[]|undefined)?.slice(0,4),
        seriesNetwork: ser?.network,
        seriesImdbRating:  serRatings?.imdb?.value,
        seriesRatingValue: serRatings?.value,
        seriesStatus: ser?.status,
        seriesSeasonCount: (ser?.seasons as any[])?.filter((s:any)=>s.seasonNumber>0).length,
        seasonNumber: sn, episodeNumber: en,
        overview: e.overview as string | undefined,
        airTime: dateUtc.includes('T') ? localDate.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}) : undefined,
        dateKey: fmtDate(localDate),
        navPath: `/series/${ser?.id??0}`,
        episodeQuality, episodeQualityName, episodeTechBadges,
        episodeRuntime, episodeSize, episodeLanguages, episodeReleaseGroup,
        episodeCutoffNotMet, episodeFps, episodeBitDepth,
      });
    }

    // ── Lidarr ────────────────────────────────────────────────────────────────
    for (const a of data.lidarr) {
      const date = a.releaseDate as string|undefined;
      if (!date) continue;
      mapped.push({
        id: a.id as number, title: a.title as string,
        hasFile: ((a.statistics as any)?.trackFileCount ?? 0) > 0,
        isFinale: false, isPremiere: false, isSeasonPack: false, app: 'lidarr',
        dateKey: date.slice(0,10), navPath: `/music`,
      });
    }

    mapped.sort((a,b) => a.dateKey.localeCompare(b.dateKey));
    entries.value = mapped;
  } catch { entries.value = []; }
  finally { isLoading.value = false; }
}

onMounted(load);
watch([anchor, viewMode, weekStartMon], load);

// ── Filter + Bundle ───────────────────────────────────────────────────────────

const filtered = computed(() => entries.value.filter(e => {
  if (e.app==='radarr' && !showRadarr.value) return false;
  if (e.app==='sonarr' && !showSonarr.value) return false;
  if (e.app==='lidarr' && !showLidarr.value) return false;
  if (e.app==='radarr' && e.releaseType==='inCinemas' && !showCinemas.value) return false;
  if (e.app==='radarr' && e.releaseType==='digital'   && !showDigital.value) return false;
  if (e.app==='radarr' && e.releaseType==='physical'  && !showPhysical.value) return false;
  if (e.app==='sonarr' && e.isSeasonPack && !showSpecials.value) return false;
  return true;
}));

const displayEntries = computed(() => {
  let list = [...filtered.value];
  if (bundleEpisodes.value) {
    const groups = new Map<string,CalendarEntry[]>();
    const rest: CalendarEntry[] = [];
    for (const e of list) {
      if (e.app==='sonarr' && e.seriesTitle) {
        const k = `${e.dateKey}|${e.navPath}`;
        if (!groups.has(k)) groups.set(k,[]);
        groups.get(k)!.push(e);
      } else rest.push(e);
    }
    list = [...rest];
    for (const eps of groups.values()) {
      if (eps.length===1) { list.push(eps[0]); continue; }
      list.push({...eps[0], title:`${eps.length} Episoden`, episodeNumber:undefined,
        isFinale:eps.some(e=>e.isFinale), isPremiere:eps.some(e=>e.isPremiere), bundledCount:eps.length});
    }
    list.sort((a,b)=>a.dateKey.localeCompare(b.dateKey));
  }
  if (bundleAlbums.value) {
    const groups = new Map<string,CalendarEntry[]>();
    const rest = list.filter(e=>e.app!=='lidarr');
    for (const e of list.filter(e=>e.app==='lidarr')) {
      if (!groups.has(e.dateKey)) groups.set(e.dateKey,[]);
      groups.get(e.dateKey)!.push(e);
    }
    for (const albs of groups.values()) {
      if (albs.length===1) { rest.push(albs[0]); continue; }
      rest.push({...albs[0], title:`${albs.length} Alben`, bundledCount:albs.length});
    }
    list = rest.sort((a,b)=>a.dateKey.localeCompare(b.dateKey));
  }
  return list;
});

function entriesForDay(dk: string) { return displayEntries.value.filter(e=>e.dateKey===dk); }

const listGrouped = computed(() => {
  const map = new Map<string,CalendarEntry[]>();
  for (const e of displayEntries.value) {
    if (e.dateKey < fmtDate(listStart.value) || e.dateKey > fmtDate(listEnd.value)) continue;
    if (!map.has(e.dateKey)) map.set(e.dateKey,[]);
    map.get(e.dateKey)!.push(e);
  }
  return map;
});
const listDates = computed(() => [...listGrouped.value.keys()].sort());

// ── Tooltip-Typ ───────────────────────────────────────────────────────────────

type TType = 'movie'|'episode'|'series'|'standard';
const tooltipType = computed((): TType => {
  const e = hoverEntry.value;
  if (!e?.hasFile) return 'standard';
  if (e.app==='radarr') return 'movie';
  if (e.app==='sonarr') return (bundleEpisodes.value || e.bundledCount) ? 'series' : 'episode';
  return 'standard';
});

// ── Range Label ───────────────────────────────────────────────────────────────

const rangeLabel = computed(() => {
  if (viewMode.value==='week') {
    const s = weekDays.value[0].toLocaleDateString('de-DE',{day:'numeric',month:'short'});
    const e = weekDays.value[6].toLocaleDateString('de-DE',{day:'numeric',month:'short',year:'numeric'});
    return `${s} – ${e}`;
  }
  if (viewMode.value==='month')
    return anchor.value.toLocaleDateString('de-DE',{month:'long',year:'numeric'});
  const s = listStart.value.toLocaleDateString('de-DE',{day:'2-digit',month:'short'});
  const e = listEnd.value.toLocaleDateString('de-DE',{day:'2-digit',month:'short',year:'numeric'});
  return `${s} – ${e}`;
});

// ── UI Helpers ────────────────────────────────────────────────────────────────

const DAY_NAMES_S = ['So','Mo','Di','Mi','Do','Fr','Sa'];
const DAY_NAMES_L = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
function isPast(dk: string)  { return dk < todayKey; }
function isToday(dk: string) { return dk === todayKey; }
function isCurMonth(d: Date) { return d.getMonth()===anchor.value.getMonth(); }

function dayHdr(day: Date): {top:string;bot:string} {
  const f = colHeaderFmt.value;
  if (f==='long') return {top:DAY_NAMES_L[day.getDay()], bot:''};
  if (f==='date') return {top:`${String(day.getDate()).padStart(2,'0')}.${String(day.getMonth()+1).padStart(2,'0')}.`, bot:''};
  return {top:DAY_NAMES_S[day.getDay()], bot:String(day.getDate())};
}

function formatDateHeader(dk: string): string {
  const d = new Date(dk+'T12:00:00');
  const diff = Math.round((d.getTime()-today.getTime())/86400000);
  if (diff===0) return 'Heute'; if (diff===1) return 'Morgen'; if (diff===-1) return 'Gestern';
  return d.toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'});
}

function appLabel(app: CalendarEntry['app']) { return app==='radarr'?'Film':app==='sonarr'?'Serie':'Album'; }
function relTypeLabel(t?: string) { return t==='inCinemas'?'🎬':t==='digital'?'💻':t==='physical'?'📀':''; }
function epLabel(e: CalendarEntry) {
  if (e.seasonNumber!==undefined && e.episodeNumber!==undefined)
    return `S${String(e.seasonNumber).padStart(2,'0')}E${String(e.episodeNumber).padStart(2,'0')}`;
  return '';
}
function navTo(e: CalendarEntry) { if (e.navPath && e.navPath!=='/music') router.push(e.navPath); }
function appColor(app: CalendarEntry['app']) {
  return app==='radarr'?'var(--radarr)':app==='sonarr'?'var(--sonarr)':'var(--lidarr)';
}
function cardStyle(e: CalendarEntry) {
  if (!fullColor.value) return '';
  const c = appColor(e.app);
  return `background:color-mix(in srgb,${c} 10%,var(--bg-surface));border-color:color-mix(in srgb,${c} 25%,transparent)`;
}

// ── Hover ──────────────────────────────────────────────────────────────────────

function onEnter(ev: MouseEvent, entry: CalendarEntry) { hoverEntry.value=entry; updatePos(ev); }
function onMove(ev: MouseEvent)  { if (hoverEntry.value) updatePos(ev); }
function onLeave()                { hoverEntry.value=null; }
function updatePos(ev: MouseEvent) {
  hoverPos.value = {
    x: Math.min(ev.clientX+16, window.innerWidth -280),
    y: Math.min(ev.clientY-8,  window.innerHeight-320),
  };
}
</script>

<template>
  <div class="calendar-view">

    <!-- ══════════════════════════════════════════════════════════════
         HOVER TOOLTIP
         ══════════════════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div v-if="hoverEntry" class="poster-tooltip"
        :style="`left:${hoverPos.x}px;top:${hoverPos.y}px`">

        <!-- ── FILM ── exakter PosterCard-Klon ── -->
        <template v-if="tooltipType==='movie'">
          <div class="tt-bar" style="background:#22c55e"/>
          <div class="tt-body">
            <div class="tt-row-header">
              <img v-if="hoverEntry.moviePosterUrl" :src="hoverEntry.moviePosterUrl" class="tt-poster"/>
              <div class="tt-header-info">
                <div class="tt-title">{{ hoverEntry.title }}<span v-if="hoverEntry.movieYear" class="tt-year">({{ hoverEntry.movieYear }})</span></div>
                <div class="tt-meta">
                  <span v-if="hoverEntry.movieQuality" class="tt-badge-quality">{{ hoverEntry.movieQuality }}</span>
                  <span v-if="hoverEntry.movieRuntime">{{ hoverEntry.movieRuntime }} min</span>
                  <span class="tt-have">✓ Vorhanden</span>
                </div>
                <div v-if="hoverEntry.movieGenres?.length" class="tt-genres">
                  <span v-for="g in hoverEntry.movieGenres" :key="g" class="tt-genre">{{ g }}</span>
                </div>
                <div v-if="hoverEntry.movieImdbRating || hoverEntry.movieTmdbRating" class="tt-ratings">
                  <span v-if="hoverEntry.movieImdbRating" class="tt-imdb">★ {{ hoverEntry.movieImdbRating.toFixed(1) }}</span>
                  <span v-if="hoverEntry.movieTmdbRating" class="tt-tmdb">TMDb {{ (hoverEntry.movieTmdbRating*10).toFixed(0) }}%</span>
                </div>
              </div>
            </div>
            <p v-if="hoverEntry.overview" class="tt-overview">{{ hoverEntry.overview.length>200?hoverEntry.overview.substring(0,200)+'…':hoverEntry.overview }}</p>
            <div v-if="hoverEntry.movieTechBadges?.length" class="tt-tech">
              <span v-for="b in hoverEntry.movieTechBadges" :key="b.label" class="tt-tbadge" :style="`color:${b.color};border-color:${b.color}55`">{{ b.label }}</span>
            </div>
          </div>
        </template>

        <!-- ── EINZELNE EPISODE ── -->
        <template v-else-if="tooltipType==='episode'">
          <div class="tt-bar" style="background:#22c55e"/>
          <div class="tt-body">
            <div class="tt-row-header">
              <img v-if="hoverEntry.seriesPosterUrl" :src="hoverEntry.seriesPosterUrl" class="tt-poster"/>
              <div class="tt-header-info">
                <div class="tt-series-lbl">{{ hoverEntry.seriesTitle }}</div>
                <div class="tt-ep-row">
                  <span class="tt-ep-badge">{{ epLabel(hoverEntry) }}</span>
                  <span class="tt-ep-title">{{ hoverEntry.title }}</span>
                </div>
                <div v-if="hoverEntry.seriesGenres?.length" class="tt-genres tt-genres-sm">
                  <span v-for="g in hoverEntry.seriesGenres" :key="g" class="tt-genre">{{ g }}</span>
                </div>
              </div>
            </div>
            <p v-if="hoverEntry.overview" class="tt-overview">{{ hoverEntry.overview.length>200?hoverEntry.overview.substring(0,200)+'…':hoverEntry.overview }}</p>
            <div class="tt-meta">
              <span v-if="hoverEntry.episodeQualityName" class="tt-badge-quality">{{ hoverEntry.episodeQualityName }}</span>
              <span v-else-if="hoverEntry.episodeQuality" class="tt-badge-quality">{{ hoverEntry.episodeQuality }}</span>
              <span v-if="hoverEntry.episodeRuntime">{{ hoverEntry.episodeRuntime }}</span>
              <span v-if="hoverEntry.airTime && showAirTime">🕐 {{ hoverEntry.airTime }}</span>
              <span class="tt-have">✓ Vorhanden</span>
            </div>
            <div class="tt-file-info">
              <span v-if="fmtSize(hoverEntry.episodeSize)" class="tt-file-size">💾 {{ fmtSize(hoverEntry.episodeSize) }}</span>
              <span v-if="hoverEntry.episodeLanguages?.length" class="tt-langs">🌐 {{ hoverEntry.episodeLanguages.join(' / ') }}</span>
              <span v-if="hoverEntry.episodeReleaseGroup" class="tt-relgrp">{{ hoverEntry.episodeReleaseGroup }}</span>
              <span v-if="hoverEntry.episodeCutoffNotMet" class="tt-cutoff">⚠ Cutoff</span>
            </div>
            <div class="tt-bottom-row">
              <span v-if="hoverEntry.seriesNetwork" class="tt-network">{{ hoverEntry.seriesNetwork }}</span>
              <div v-if="hoverEntry.seriesImdbRating || hoverEntry.seriesRatingValue" class="tt-ratings">
                <span v-if="hoverEntry.seriesImdbRating" class="tt-imdb">★ {{ hoverEntry.seriesImdbRating.toFixed(1) }}</span>
                <span v-else-if="hoverEntry.seriesRatingValue" class="tt-imdb">★ {{ hoverEntry.seriesRatingValue.toFixed(1) }}</span>
              </div>
            </div>
            <div v-if="hoverEntry.episodeTechBadges?.length" class="tt-tech">
              <span v-for="b in hoverEntry.episodeTechBadges" :key="b.label"
                class="tt-tbadge" :style="`color:${b.color};border-color:${b.color}55`">{{ b.label }}</span>
              <span v-if="hoverEntry.episodeFps" class="tt-tbadge" style="color:#666;border-color:#66666655">{{ hoverEntry.episodeFps?.toFixed(3) }} fps</span>
              <span v-if="hoverEntry.episodeBitDepth && hoverEntry.episodeBitDepth!==8" class="tt-tbadge" style="color:#bb86fc;border-color:#bb86fc55">{{ hoverEntry.episodeBitDepth }}-bit</span>
            </div>
            <div v-if="hoverEntry.isFinale && showFinaleSymbol" class="tt-finale-tag">★ Staffelfinale</div>
            <div v-if="hoverEntry.isPremiere && showPremiereSymbol" class="tt-premiere-tag">▶ Staffelstart</div>
          </div>
        </template>

        <!-- ── GEBÜNDELTE SERIE ── -->
        <template v-else-if="tooltipType==='series'">
          <div class="tt-bar" style="background:#22c55e"/>
          <div class="tt-body">
            <div class="tt-row-header">
              <img v-if="hoverEntry.seriesPosterUrl" :src="hoverEntry.seriesPosterUrl" class="tt-poster"/>
              <div class="tt-header-info">
                <div class="tt-title">{{ hoverEntry.seriesTitle }}<span v-if="hoverEntry.seriesYear" class="tt-year">({{ hoverEntry.seriesYear }})</span></div>
                <div class="tt-meta">
                  <span v-if="hoverEntry.seriesSeasonCount">{{ hoverEntry.seriesSeasonCount }} Staffel{{ hoverEntry.seriesSeasonCount! > 1 ? 'n' : '' }}</span>
                  <span class="tt-have">✓ {{ hoverEntry.bundledCount ?? '' }} Ep. heute</span>
                </div>
                <div v-if="hoverEntry.seriesGenres?.length" class="tt-genres tt-genres-sm">
                  <span v-for="g in hoverEntry.seriesGenres" :key="g" class="tt-genre">{{ g }}</span>
                </div>
                <div v-if="hoverEntry.seriesImdbRating || hoverEntry.seriesRatingValue" class="tt-ratings">
                  <span v-if="hoverEntry.seriesImdbRating" class="tt-imdb">★ {{ hoverEntry.seriesImdbRating.toFixed(1) }}</span>
                  <span v-else-if="hoverEntry.seriesRatingValue" class="tt-imdb">★ {{ hoverEntry.seriesRatingValue.toFixed(1) }}</span>
                </div>
              </div>
            </div>
            <p v-if="hoverEntry.overview" class="tt-overview">{{ hoverEntry.overview.length>200?hoverEntry.overview.substring(0,200)+'…':hoverEntry.overview }}</p>
            <div class="tt-tech">
              <span class="tt-tbadge" :style="`color:${hoverEntry.seriesStatus==='continuing'?'#35c5f4':'#666'};border-color:${hoverEntry.seriesStatus==='continuing'?'#35c5f455':'#66666655'}`">
                {{ hoverEntry.seriesStatus==='continuing'?'Laufend':'Beendet' }}
              </span>
              <span v-if="hoverEntry.seriesNetwork" class="tt-tbadge" style="color:#555;border-color:#55555555">{{ hoverEntry.seriesNetwork }}</span>
            </div>
          </div>
        </template>

        <!-- ── STANDARD (ausstehend / Musik) ── -->
        <template v-else>
          <div class="tt-bar" :style="`background:${hoverEntry.hasFile?'#22c55e':appColor(hoverEntry.app)+'88'}`"/>
          <div class="tt-body">
            <div class="tt-title">{{ hoverEntry.seriesTitle ?? hoverEntry.title }}</div>
            <div class="tt-meta">
              <span v-if="hoverEntry.app==='sonarr'" class="tt-ep-badge-sm">{{ epLabel(hoverEntry) }}</span>
              <span v-if="hoverEntry.airTime && showAirTime">{{ hoverEntry.airTime }}</span>
              <span v-if="hoverEntry.isFinale && showFinaleSymbol" style="color:#f5c518">★ Finale</span>
              <span v-if="hoverEntry.isPremiere && showPremiereSymbol" style="color:#22c65b">▶ Start</span>
            </div>
            <p v-if="hoverEntry.seriesTitle" class="tt-sub">{{ hoverEntry.title }}</p>
            <p v-if="hoverEntry.overview" class="tt-overview">{{ hoverEntry.overview.length>200?hoverEntry.overview.substring(0,200)+'…':hoverEntry.overview }}</p>
          </div>
        </template>

      </div>
    </Teleport>

    <!-- ── Optionen-Drawer ── -->
    <Teleport to="body">
      <Transition name="drawer">
        <div v-if="showOptions" class="opt-drawer">
          <div class="opt-drawer-header">
            <span>Kalenderoptionen</span>
            <button class="opt-close" @click="showOptions=false">✕</button>
          </div>
          <div class="opt-drawer-body">
            <div class="opt-section">
              <div class="opt-section-title" style="color:var(--radarr)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg> Filme
              </div>
              <div class="opt-row"><div class="opt-row-text"><p>Kino-Starts anzeigen</p><span>Filme bei Kinostart im Kalender zeigen</span></div><button :class="['tog',{on:showCinemas}]" @click="showCinemas=!showCinemas"><span class="tog-knob"/></button></div>
              <div class="opt-row"><div class="opt-row-text"><p>Digital-Releases anzeigen</p><span>Filme bei Digital-Release im Kalender zeigen</span></div><button :class="['tog',{on:showDigital}]" @click="showDigital=!showDigital"><span class="tog-knob"/></button></div>
              <div class="opt-row"><div class="opt-row-text"><p>Physische Releases anzeigen</p><span>Filme bei Blu-ray/DVD-Veröffentlichung zeigen</span></div><button :class="['tog',{on:showPhysical}]" @click="showPhysical=!showPhysical"><span class="tog-knob"/></button></div>
            </div>
            <div class="opt-section">
              <div class="opt-section-title" style="color:var(--sonarr)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg> Serien
              </div>
              <div class="opt-row"><div class="opt-row-text"><p>Mehrere Episoden zusammenfassen</p><span>Serien mit mehreren Folgen am selben Tag bündeln</span></div><button :class="['tog',{on:bundleEpisodes}]" @click="bundleEpisodes=!bundleEpisodes"><span class="tog-knob"/></button></div>
              <div class="opt-row"><div class="opt-row-text"><p>Episodeninformationen anzeigen</p><span>Titel und Nummer der Episode einblenden</span></div><button :class="['tog',{on:showEpInfo}]" @click="showEpInfo=!showEpInfo"><span class="tog-knob"/></button></div>
              <div class="opt-row"><div class="opt-row-text"><p>Symbol für Staffel-/Serienfinale</p><span>Zeigt ★ bei letzter Episode einer Staffel oder Serie</span></div><button :class="['tog',{on:showFinaleSymbol}]" @click="showFinaleSymbol=!showFinaleSymbol"><span class="tog-knob"/></button></div>
              <div class="opt-row"><div class="opt-row-text"><p>Symbol für Staffel-/Serienstart</p><span>Zeigt ▶ bei erster Episode einer Staffel (z.B. S01E01, S04E01)</span></div><button :class="['tog',{on:showPremiereSymbol}]" @click="showPremiereSymbol=!showPremiereSymbol"><span class="tog-knob"/></button></div>
              <div class="opt-row"><div class="opt-row-text"><p>Symbol für Specials</p><span>Zeigt ◈ bei Episoden aus Staffel 0</span></div><button :class="['tog',{on:showSpecials}]" @click="showSpecials=!showSpecials"><span class="tog-knob"/></button></div>
            </div>
            <div class="opt-section">
              <div class="opt-section-title" style="color:var(--lidarr)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> Musik
              </div>
              <div class="opt-row"><div class="opt-row-text"><p>Mehrere Alben zusammenfassen</p><span>Alben desselben Künstlers am gleichen Tag bündeln</span></div><button :class="['tog',{on:bundleAlbums}]" @click="bundleAlbums=!bundleAlbums"><span class="tog-knob"/></button></div>
            </div>
            <div class="opt-section">
              <div class="opt-section-title">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> Design
              </div>
              <div class="opt-row"><div class="opt-row-text"><p>Vollfarbige Ereignisse</p><span>Ganze Kachel in App-Farbe statt nur linker Rand</span></div><button :class="['tog',{on:fullColor}]" @click="fullColor=!fullColor"><span class="tog-knob"/></button></div>
              <div class="opt-row"><div class="opt-row-text"><p>Uhrzeiten anzeigen</p><span>Ausstrahlungszeit unter dem Episodentitel</span></div><button :class="['tog',{on:showAirTime}]" @click="showAirTime=!showAirTime"><span class="tog-knob"/></button></div>
            </div>
            <div class="opt-section">
              <div class="opt-section-title">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Wochenansicht
              </div>
              <div class="opt-field">
                <label class="opt-field-lbl">Erster Tag der Woche</label>
                <select class="opt-select" :value="weekStartMon?'mo':'so'" @change="weekStartMon=($event.target as HTMLSelectElement).value==='mo'">
                  <option value="mo">Montag</option><option value="so">Sonntag</option>
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
        <div v-if="showOptions" class="opt-backdrop" @click="showOptions=false"/>
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
            :class="['vtab',{active:viewMode===m}]" @click="viewMode=m">
            {{ m==='week'?'Woche':m==='month'?'Monat':'Liste' }}
          </button>
        </div>
        <div class="nav-group">
          <button class="nav-btn" @click="goPrev">‹</button>
          <button class="today-btn" @click="goToday">Heute</button>
          <button class="nav-btn" @click="goNext">›</button>
        </div>
        <div class="filter-chips">
          <button :class="['fchip',{active:showRadarr}]" :style="showRadarr?'border-color:var(--radarr);color:var(--radarr)':''" @click="showRadarr=!showRadarr">Film</button>
          <button :class="['fchip',{active:showSonarr}]" :style="showSonarr?'border-color:var(--sonarr);color:var(--sonarr)':''" @click="showSonarr=!showSonarr">Serie</button>
          <button :class="['fchip',{active:showLidarr}]" :style="showLidarr?'border-color:var(--lidarr);color:var(--lidarr)':''" @click="showLidarr=!showLidarr">Musik</button>
        </div>
        <button :class="['opt-toggle',{active:showOptions}]" @click="showOptions=!showOptions">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="14" y2="12"/><line x1="4" y1="18" x2="18" y2="18"/></svg>
          Optionen
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-grid">
      <div v-for="i in 7" :key="i" class="skeleton-col">
        <div class="skeleton" style="height:36px;border-radius:6px"/>
        <div v-if="i%2===0" class="skeleton" style="height:52px;border-radius:8px;margin-top:6px"/>
        <div v-if="i%3!==0" class="skeleton" style="height:52px;border-radius:8px;margin-top:6px"/>
      </div>
    </div>

    <!-- ── Wochenansicht ── -->
    <div v-else-if="viewMode==='week'" class="week-view">
      <div class="week-header-row">
        <div v-for="day in weekDays" :key="fmtDate(day)"
          :class="['week-day-hdr',{'wdh-today':isToday(fmtDate(day))}]">
          <span class="wdh-name">{{ dayHdr(day).top }}</span>
          <span v-if="dayHdr(day).bot" class="wdh-num" :class="{'wdh-num-today':isToday(fmtDate(day))}">{{ dayHdr(day).bot }}</span>
        </div>
      </div>
      <div class="week-body">
        <div v-for="day in weekDays" :key="'c'+fmtDate(day)"
          :class="['week-col',{'wcol-today':isToday(fmtDate(day)),'wcol-past':isPast(fmtDate(day))}]">
          <template v-if="entriesForDay(fmtDate(day)).length">
            <div v-for="entry in entriesForDay(fmtDate(day))" :key="`${entry.app}-${entry.id}-${entry.releaseType}`"
              class="week-event"
              :class="[`evt-${entry.app}`,{'evt-clickable':entry.navPath!=='/music','evt-has':entry.hasFile}]"
              :style="cardStyle(entry)"
              @click="navTo(entry)" @mouseenter="(e)=>onEnter(e,entry)" @mousemove="onMove" @mouseleave="onLeave">
              <div class="evt-accent" :style="`background:${appColor(entry.app)}`"/>
              <div class="evt-body">
                <!-- Top row: Icon + Symbols + Content name (left) · Time (right) -->
                <div class="evt-top">
                  <span class="evt-icon">{{ relTypeLabel(entry.releaseType)||(entry.app==='sonarr'?'📺':entry.app==='lidarr'?'🎵':'') }}</span>
                  <span v-if="entry.isFinale&&showFinaleSymbol" class="evt-finale">★</span>
                  <span v-if="entry.isPremiere&&showPremiereSymbol" class="evt-premiere">▶</span>
                  <span v-if="entry.isSeasonPack" class="evt-special">◈</span>
                  <span class="evt-name">{{ entry.seriesTitle??entry.title }}</span>
                  <span v-if="entry.airTime&&showAirTime" class="evt-time">{{ entry.airTime }}</span>
                </div>
                <!-- Bottom row: Episode name (left) · Episode number (right) -->
                <div v-if="entry.app==='sonarr'&&showEpInfo" class="evt-bottom">
                  <span class="evt-ep">{{ entry.bundledCount?`${entry.bundledCount} Ep.`:entry.title }}</span>
                  <span v-if="epLabel(entry)" class="evt-epnum">{{ epLabel(entry) }}</span>
                </div>
              </div>
            </div>
          </template>
          <div v-else class="week-col-empty"/>
        </div>
      </div>
    </div>

    <!-- ── Monatsansicht ── -->
    <div v-else-if="viewMode==='month'" class="month-view">
      <div class="month-hdr-row">
        <div v-for="i in 7" :key="i" class="month-hdr-cell">{{ DAY_NAMES_S[weekStartMon?(i%7):(i-1)] }}</div>
      </div>
      <div class="month-grid">
        <div v-for="day in monthDays" :key="fmtDate(day)"
          :class="['month-cell',{'mc-other':!isCurMonth(day),'mc-today':isToday(fmtDate(day)),'mc-past':isPast(fmtDate(day))&&isCurMonth(day)}]">
          <div class="mc-num">{{ day.getDate() }}</div>
          <div v-for="entry in entriesForDay(fmtDate(day))" :key="`${entry.app}-${entry.id}-${entry.releaseType}`"
            class="mc-event"
            :style="`background:color-mix(in srgb,${appColor(entry.app)} 15%,var(--bg-elevated));border-left:2px solid ${appColor(entry.app)}${entry.hasFile?';border-right:1px solid rgba(34,197,94,.45)':''}`"
            @click="navTo(entry)" @mouseenter="(e)=>onEnter(e,entry)" @mousemove="onMove" @mouseleave="onLeave">
            <span v-if="entry.isFinale&&showFinaleSymbol" class="mc-finale">★</span>
            <span v-if="entry.isPremiere&&showPremiereSymbol" class="mc-premiere">▶</span>
            <span class="mc-evt-title">{{ entry.seriesTitle??entry.title }}</span>
            <span v-if="entry.app==='sonarr'&&epLabel(entry)" class="mc-evt-ep">{{ epLabel(entry) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Listenansicht ── -->
    <div v-else class="list-view">
      <div v-if="listDates.length===0" class="empty-state">
        <div class="empty-icon">📅</div>
        <p class="empty-title">Keine Einträge</p>
        <p class="empty-sub">Keine Releases im gewählten Zeitraum gefunden.</p>
      </div>
      <div v-else class="cal-list">
        <div v-for="dk in listDates" :key="dk" :class="['date-group',{'is-past':isPast(dk),'is-today':isToday(dk)}]">
          <div class="date-header">
            <span class="date-label">{{ formatDateHeader(dk) }}</span>
            <span class="date-count">{{ listGrouped.get(dk)?.length }}</span>
          </div>
          <div class="entries">
            <div v-for="entry in listGrouped.get(dk)" :key="`${entry.app}-${entry.id}-${entry.releaseType}`"
              :class="['entry-card',{'entry-clickable':entry.navPath!=='/music','entry-has':entry.hasFile}]"
              :style="[`--ec:${appColor(entry.app)}`,cardStyle(entry)]"
              @click="navTo(entry)" @mouseenter="(e)=>onEnter(e,entry)" @mousemove="onMove" @mouseleave="onLeave">
              <div class="entry-accent" :style="`background:${appColor(entry.app)}`"/>
              <div class="entry-body">
                <div class="entry-top">
                  <span class="entry-badge" :style="`background:color-mix(in srgb,var(--ec) 12%,transparent);color:var(--ec);border:1px solid color-mix(in srgb,var(--ec) 25%,transparent)`">{{ appLabel(entry.app) }}</span>
                  <span v-if="relTypeLabel(entry.releaseType)" class="entry-reltype">{{ relTypeLabel(entry.releaseType) }}</span>
                  <span v-if="entry.seriesTitle" class="entry-series">{{ entry.seriesTitle }}</span>
                  <span v-if="epLabel(entry)&&showEpInfo" class="entry-episode">{{ epLabel(entry) }}</span>
                  <span v-if="entry.isFinale&&showFinaleSymbol" class="entry-finale">★ Finale</span>
                  <span v-if="entry.isPremiere&&showPremiereSymbol" class="entry-premiere">▶ Start</span>
                  <span v-if="entry.airTime&&showAirTime" class="entry-time">{{ entry.airTime }}</span>
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
.nav-btn { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-md); background: var(--bg-elevated); border: 1px solid var(--bg-border); color: var(--text-secondary); cursor: pointer; font-size: 16px; }
.nav-btn:hover { background: var(--bg-overlay); color: var(--text-primary); }
.today-btn { padding: 5px 14px; border-radius: var(--radius-md); background: rgba(155,0,69,.1); border: 1px solid rgba(155,0,69,.25); color: var(--accent); font-size: var(--text-sm); font-weight: 600; cursor: pointer; }
.today-btn:hover { background: rgba(155,0,69,.2); }
.opt-toggle { display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; border-radius: var(--radius-md); background: var(--bg-elevated); border: 1px solid var(--bg-border); color: var(--text-muted); font-size: var(--text-sm); cursor: pointer; transition: all .12s; }
.opt-toggle:hover, .opt-toggle.active { border-color: var(--accent); color: var(--accent); background: rgba(155,0,69,.08); }
.filter-chips { display: flex; gap: 4px; }
.fchip { padding: 4px 10px; border-radius: 99px; font-size: var(--text-xs); font-weight: 600; background: transparent; border: 1px solid var(--bg-border); color: var(--text-muted); cursor: pointer; transition: all .12s; }

/* ── Options Drawer ── */
.opt-backdrop { position: fixed; inset: 0; z-index: 1998; background: rgba(0,0,0,.5); backdrop-filter: blur(2px); }
.opt-drawer { position: fixed; top: 0; right: 0; bottom: 0; z-index: 1999; width: 340px; background: #111; border-left: 1px solid var(--bg-border); display: flex; flex-direction: column; box-shadow: -8px 0 32px rgba(0,0,0,.6); }
.opt-drawer-header { display: flex; align-items: center; justify-content: space-between; padding: var(--space-5) var(--space-6); border-bottom: 1px solid var(--bg-border); font-size: var(--text-base); font-weight: 700; color: var(--text-primary); flex-shrink: 0; }
.opt-close { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 16px; padding: 4px; }
.opt-close:hover { color: var(--text-primary); }
.opt-drawer-body { flex: 1; overflow-y: auto; padding: var(--space-4) 0 var(--space-6); }
.opt-section { padding: var(--space-3) var(--space-6); }
.opt-section + .opt-section { border-top: 1px solid var(--bg-border); }
.opt-section-title { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: var(--text-muted); margin-bottom: var(--space-3); }
.opt-row { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); padding: var(--space-2) 0; }
.opt-row-text { flex: 1; min-width: 0; }
.opt-row-text p { font-size: var(--text-sm); font-weight: 500; color: var(--text-secondary); margin: 0 0 2px; }
.opt-row-text span { font-size: var(--text-xs); color: var(--text-muted); line-height: 1.4; }
.tog { position: relative; width: 44px; height: 24px; border-radius: 99px; background: var(--bg-elevated); border: 1px solid var(--bg-border); cursor: pointer; transition: background .2s, border-color .2s; flex-shrink: 0; }
.tog.on { background: var(--accent); border-color: var(--accent); }
.tog-knob { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform .2s; display: block; box-shadow: 0 1px 3px rgba(0,0,0,.3); }
.tog.on .tog-knob { transform: translateX(20px); }
.opt-field { padding: var(--space-2) 0; }
.opt-field-lbl { display: block; font-size: var(--text-xs); color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 5px; }
.opt-select { width: 100%; background: var(--bg-elevated); border: 1px solid var(--bg-border); color: var(--text-secondary); padding: 8px 10px; border-radius: var(--radius-md); font-size: var(--text-sm); outline: none; cursor: pointer; }
.opt-select:focus { border-color: var(--accent); }
.drawer-enter-active, .drawer-leave-active { transition: transform .25s ease; }
.drawer-enter-from, .drawer-leave-to { transform: translateX(100%); }
.drawer-backdrop-enter-active, .drawer-backdrop-leave-active { transition: opacity .25s ease; }
.drawer-backdrop-enter-from, .drawer-backdrop-leave-to { opacity: 0; }

/* ── Loading ── */
.loading-grid { display: grid; grid-template-columns: repeat(7,1fr); gap: var(--space-2); }
.skeleton-col { display: flex; flex-direction: column; gap: var(--space-2); }

/* ── Week View ── */
.week-view { border: 1px solid var(--bg-border); border-radius: var(--radius-lg); overflow: hidden; }
.week-header-row { display: grid; grid-template-columns: repeat(7,minmax(0,1fr)); border-bottom: 1px solid var(--bg-border); }
.week-day-hdr { display: flex; flex-direction: column; align-items: center; padding: var(--space-2) var(--space-1); gap: 2px; background: var(--bg-surface); border-right: 1px solid var(--bg-border); }
.week-day-hdr:last-child { border-right: none; }
.wdh-today { background: rgba(155,0,69,.06); }
.wdh-name { font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: .07em; }
.wdh-num { font-size: var(--text-base); font-weight: 700; color: var(--text-secondary); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }
.wdh-num-today { background: var(--accent); color: #fff; }
.week-body { display: grid; grid-template-columns: repeat(7,minmax(0,1fr)); }
.week-col { display: flex; flex-direction: column; gap: 4px; padding: var(--space-2) var(--space-1); border-right: 1px solid var(--bg-border); min-width: 0; overflow: hidden; }
.week-col:last-child { border-right: none; }
.wcol-today { background: rgba(155,0,69,.03); }
.wcol-past { opacity: .5; }
.week-col-empty { min-height: 80px; }

/* Week event card */
.week-event { display: flex; border-radius: var(--radius-sm); border: 1px solid var(--bg-border); overflow: hidden; transition: all .12s; background: var(--bg-surface); }
.week-event.evt-has { border-right: 2px solid rgba(34,197,94,.55); }
.week-event.evt-clickable { cursor: pointer; }
.week-event.evt-clickable:hover { border-color: rgba(255,255,255,.15); transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,.3); }
.week-event.evt-has.evt-clickable:hover { border-right-color: rgba(34,197,94,.85); }
.evt-accent { width: 3px; flex-shrink: 0; }
.evt-body { flex: 1; min-width: 0; padding: 5px 6px; display: flex; flex-direction: column; gap: 2px; }

/* Top row: icon + symbols + content name */
.evt-top { display: flex; align-items: center; gap: 3px; min-width: 0; }
.evt-icon { font-size: 11px; line-height: 1; flex-shrink: 0; }
.evt-finale { font-size: 11px; color: var(--sabnzbd); font-weight: 700; flex-shrink: 0; }
.evt-premiere { font-size: 9px; color: #22c65b; font-weight: 700; flex-shrink: 0; }
.evt-special { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.evt-name { font-size: 11.5px; font-weight: 600; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.3; flex: 1; min-width: 0; }

/* Bottom row: episode name (left) · episode number (right) */
.evt-bottom { display: flex; align-items: baseline; gap: 4px; min-width: 0; }
.evt-ep { font-size: 10.5px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; margin: 0; line-height: 1.3; }
.evt-time { font-size: 10px; color: var(--text-muted); font-variant-numeric: tabular-nums; white-space: nowrap; margin-left: auto; flex-shrink: 0; }
.evt-epnum { font-size: 10.5px; font-weight: 600; color: var(--text-secondary); font-variant-numeric: tabular-nums; white-space: nowrap; flex-shrink: 0; }

/* ── Month View ── */
.month-view { border: 1px solid var(--bg-border); border-radius: var(--radius-lg); overflow: hidden; }
.month-hdr-row { display: grid; grid-template-columns: repeat(7,1fr); border-bottom: 1px solid var(--bg-border); background: var(--bg-surface); }
.month-hdr-cell { padding: var(--space-2); text-align: center; font-size: 10px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); border-right: 1px solid var(--bg-border); }
.month-hdr-cell:last-child { border-right: none; }
.month-grid { display: grid; grid-template-columns: repeat(7,1fr); }
.month-cell { min-height: 80px; padding: var(--space-1); border-right: 1px solid var(--bg-border); border-bottom: 1px solid var(--bg-border); display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
.month-cell:nth-child(7n) { border-right: none; }
.mc-other { opacity: .3; }
.mc-today .mc-num { background: var(--accent); color: #fff; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
.mc-past { opacity: .45; }
.mc-num { font-size: 11px; font-weight: 700; color: var(--text-muted); width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.mc-event { display: flex; align-items: center; gap: 3px; border-radius: 3px; padding: 1px 4px; cursor: pointer; overflow: hidden; flex-shrink: 0; }
.mc-event:hover { opacity: .75; }
.mc-finale { font-size: 9px; color: var(--sabnzbd); flex-shrink: 0; }
.mc-premiere { font-size: 8px; color: #22c65b; flex-shrink: 0; }
.mc-evt-title { font-size: 10px; font-weight: 600; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
.mc-evt-ep { font-size: 10px; font-weight: 600; color: var(--text-secondary); flex-shrink: 0; white-space: nowrap; font-variant-numeric: tabular-nums; }

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
.entry-card.entry-has { border-right: 2px solid rgba(34,197,94,.5); }
.entry-clickable { cursor: pointer; }
.entry-clickable:hover { background: var(--bg-elevated); border-color: var(--bg-border-hover); }
.entry-accent { width: 3px; flex-shrink: 0; }
.entry-body { flex: 1; padding: var(--space-3) var(--space-4) var(--space-3) var(--space-2); }
.entry-top { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; margin-bottom: 3px; }
.entry-badge { font-size: var(--text-xs); font-weight: 600; padding: 1px 6px; border-radius: 4px; }
.entry-reltype { font-size: 12px; line-height: 1; }
.entry-series  { font-size: var(--text-xs); color: var(--text-tertiary); font-weight: 500; }
.entry-episode { font-size: var(--text-xs); color: var(--text-muted); font-variant-numeric: tabular-nums; font-weight: 600; }
.entry-finale  { font-size: var(--text-xs); color: var(--sabnzbd); font-weight: 700; }
.entry-premiere { font-size: var(--text-xs); color: #22c65b; font-weight: 700; }
.entry-time    { font-size: var(--text-xs); color: var(--text-muted); margin-left: auto; }
.entry-available { font-size: var(--text-xs); color: var(--status-success); font-weight: 700; }
.entry-title   { font-size: var(--text-sm); color: var(--text-secondary); font-weight: 500; margin: 0; }

/* ══════════════════════════════════════════════════════════════════
   HOVER TOOLTIP – PosterCard-Klon (exakt wie MoviesView)
   ══════════════════════════════════════════════════════════════════ */
.poster-tooltip {
  position: fixed; z-index: 99999; width: 265px;
  background: #111; border: 1px solid #222; border-radius: 10px;
  box-shadow: 0 16px 48px rgba(0,0,0,.9); overflow: hidden;
  pointer-events: none; font-family: -apple-system, system-ui, sans-serif;
  animation: tt-in .12s ease;
}
@keyframes tt-in { from { opacity:0; transform:scale(.97) translateY(4px); } to { opacity:1; transform:none; } }

.tt-bar { height: 3px; width: 100%; }
.tt-body { padding: 10px 12px 12px; }

/* Header mit Poster */
.tt-row-header { display: flex; gap: 10px; margin-bottom: 8px; }
.tt-poster { width: 60px; height: 90px; object-fit: cover; border-radius: 6px; flex-shrink: 0; border: 1px solid #222; }
.tt-header-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }

.tt-title { font-size: 12px; font-weight: 700; color: #e8e8e8; line-height: 1.3; }
.tt-year  { color: #444; font-weight: 400; font-size: 11px; margin-left: 3px; }

.tt-series-lbl { font-size: 12px; font-weight: 700; color: #e8e8e8; line-height: 1.3; }
.tt-ep-row { display: flex; align-items: baseline; gap: 5px; flex-wrap: wrap; }
.tt-ep-badge { font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px; background: rgba(33,147,181,.15); color: var(--sonarr); border: 1px solid rgba(33,147,181,.3); flex-shrink: 0; white-space: nowrap; }
.tt-ep-badge-sm { font-size: 9px; font-weight: 700; color: #555; }
.tt-ep-title { font-size: 10px; color: #999; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.tt-meta { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; font-size: 10px; color: #555; margin-bottom: 5px; }
.tt-have { color: #1db954; font-weight: 700; font-size: 9px; text-transform: uppercase; letter-spacing: .5px; }
.tt-badge-quality { background: rgba(255,255,255,.06); border: 1px solid #2a2a2a; border-radius: 3px; padding: 0 5px; font-size: 9px; font-weight: 700; color: #aaa; }

.tt-file-info { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; font-size: 10px; color: #555; margin-bottom: 5px; }
.tt-file-size { color: #666; }
.tt-langs { color: #555; }
.tt-relgrp { font-size: 9px; color: #3a3a3a; background: #1a1a1a; border-radius: 3px; padding: 0 5px; }
.tt-cutoff { font-size: 9px; color: #f59e0b; font-weight: 700; }

.tt-bottom-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 5px; }
.tt-network { font-size: 10px; color: #444; }

.tt-genres { display: flex; gap: 4px; flex-wrap: wrap; }
.tt-genres-sm { margin-top: 2px; }
.tt-genre { font-size: 9px; padding: 2px 6px; background: rgba(255,255,255,.04); border: 1px solid #1a1a1a; border-radius: 10px; color: #555; font-weight: 600; }

.tt-ratings { display: flex; gap: 10px; font-size: 10px; font-weight: 700; }
.tt-imdb { color: #f5c518; }
.tt-tmdb { color: #01d277; }

.tt-overview { font-size: 10.5px; color: #777; line-height: 1.5; margin: 0 0 7px; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.tt-sub { font-size: 10.5px; color: #888; margin: 0 0 5px; }

.tt-tech { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 5px; }
.tt-tbadge { font-size: 9px; padding: 1px 6px; border-radius: 4px; background: rgba(0,0,0,.4); font-weight: 700; border: 1px solid; }

.tt-finale-tag { display: inline-flex; margin-top: 5px; font-size: 9px; font-weight: 700; padding: 1px 7px; border-radius: 99px; background: rgba(251,191,36,.1); color: #f5c518; border: 1px solid rgba(251,191,36,.2); }
.tt-premiere-tag { display: inline-flex; margin-top: 5px; font-size: 9px; font-weight: 700; padding: 1px 7px; border-radius: 99px; background: rgba(34,198,91,.1); color: #22c65b; border: 1px solid rgba(34,198,91,.2); }

/* Empty */
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-12) var(--space-4); gap: var(--space-3); text-align: center; }
.empty-icon { font-size: 48px; }
.empty-title { font-size: var(--text-lg); color: var(--text-secondary); font-weight: 600; margin: 0; }
.empty-sub { color: var(--text-muted); font-size: var(--text-sm); margin: 0; }
</style>
