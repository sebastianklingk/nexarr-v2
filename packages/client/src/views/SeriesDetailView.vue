<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSeriesStore } from '../stores/series.store.js';
import { useApi } from '../composables/useApi.js';
import InteractiveSearchModal from '../components/ui/InteractiveSearchModal.vue';
import ConfirmDialog from '../components/ui/ConfirmDialog.vue';
import type { SonarrSeries, SonarrEpisode, SonarrSeason, TMDBCredits, TMDBVideo } from '@nexarr/shared';

const route  = useRoute();
const router = useRouter();
const store  = useSeriesStore();
const { post, put, del } = useApi();

const series        = ref<SonarrSeries|null>(null);
const episodes      = ref<SonarrEpisode[]>([]);
const episodeFiles  = ref<any[]>([]);
const bazarrEpMap   = ref<Record<number,{subtitles:any[];missing_subtitles:any[]}>>({});
const isLoading     = ref(true);
const activeTab     = ref<'seasons'|'overview'>('seasons');
const openSeasons   = ref<Set<number>>(new Set([1]));
const overviewExpanded = ref(false);

// ── Action Bar ────────────────────────────────────────────────────────────────
const isSearchingAll  = ref(false);
const searchAllStatus = ref<'idle'|'ok'|'error'>('idle');
const isRefreshing    = ref(false);
const isMonitorToggling = ref(false);
const showDeleteConfirm = ref(false);

async function searchAll() {
  if (!series.value || isSearchingAll.value) return;
  isSearchingAll.value = true; searchAllStatus.value = 'idle';
  try { await post('/api/sonarr/command', { name:'SeriesSearch', seriesId:series.value.id }); searchAllStatus.value='ok'; }
  catch { searchAllStatus.value='error'; }
  finally { isSearchingAll.value=false; setTimeout(()=>{searchAllStatus.value='idle';},3000); }
}

async function refreshSeries() {
  if (!series.value||isRefreshing.value) return;
  isRefreshing.value = true;
  try { await post('/api/sonarr/command', { name:'RefreshSeries', seriesId:series.value.id }); }
  catch { /* */ }
  finally { setTimeout(()=>{isRefreshing.value=false;},2000); }
}

async function toggleMonitored() {
  if (!series.value||isMonitorToggling.value) return;
  isMonitorToggling.value = true;
  try {
    const updated = await put<SonarrSeries>(`/api/sonarr/series/${series.value.id}`, { ...series.value, monitored:!series.value.monitored });
    series.value = updated;
  } catch { /* */ }
  finally { isMonitorToggling.value=false; }
}

async function confirmDelete() {
  if (!series.value) return;
  await del(`/api/sonarr/series/${series.value.id}?deleteFiles=true`);
  router.push('/series');
}

// ── Season / Episode Actions ──────────────────────────────────────────────────
const seasonSearching = ref<number|null>(null);
const seasonSearchStatus = ref<Record<number,'ok'|'error'>>({});
const seasonMonitorToggling = ref<number|null>(null);
const episodeSearching = ref<number|null>(null);
const episodeMonitorToggling = ref<number|null>(null);
const bazarrEpSearching = ref<number|null>(null);
const fileDeletePending = ref<number|null>(null);
const showFileDeleteConfirm = ref(false);
const fileDeleteEp = ref<SonarrEpisode|null>(null);
const interactiveEpId = ref(0);
const interactiveEpTitle = ref('');
const showInteractiveEp = ref(false);

async function searchSeason(seasonNumber:number) {
  if (!series.value||seasonSearching.value!==null) return;
  seasonSearching.value = seasonNumber;
  try { await post('/api/sonarr/command', { name:'SeasonSearch', seriesId:series.value.id, seasonNumber }); seasonSearchStatus.value[seasonNumber]='ok'; }
  catch { seasonSearchStatus.value[seasonNumber]='error'; }
  finally { seasonSearching.value=null; setTimeout(()=>delete seasonSearchStatus.value[seasonNumber],3000); }
}

async function toggleSeasonMonitor(s:SonarrSeason) {
  if (!series.value||seasonMonitorToggling.value!==null) return;
  seasonMonitorToggling.value = s.seasonNumber;
  try {
    const updated = await put<SonarrSeries>(`/api/sonarr/series/${series.value.id}/season-monitor`, { seasonNumber:s.seasonNumber, monitored:!s.monitored });
    series.value = updated;
  } catch { /* */ }
  finally { seasonMonitorToggling.value=null; }
}

async function searchEpisode(ep:SonarrEpisode) {
  if (episodeSearching.value!==null) return;
  episodeSearching.value = ep.id;
  try { await post('/api/sonarr/command', { name:'EpisodeSearch', episodeIds:[ep.id] }); }
  catch { /* */ }
  finally { setTimeout(()=>{episodeSearching.value=null;},2000); }
}

async function toggleEpisodeMonitor(ep:SonarrEpisode) {
  if (episodeMonitorToggling.value!==null) return;
  episodeMonitorToggling.value = ep.id;
  try {
    const updated = await put<SonarrEpisode>(`/api/sonarr/episode/${ep.id}`, { ...ep, monitored:!ep.monitored });
    const idx = episodes.value.findIndex(e=>e.id===ep.id);
    if (idx>=0) episodes.value[idx] = updated;
  } catch { /* */ }
  finally { episodeMonitorToggling.value=null; }
}

async function searchBazarrEpisode(ep:SonarrEpisode) {
  if (bazarrEpSearching.value!==null) return;
  bazarrEpSearching.value = ep.id;
  try { await post(`/api/bazarr/episodes/${ep.id}/subtitles/search`); }
  catch { /* */ }
  finally { setTimeout(()=>{bazarrEpSearching.value=null;},2500); }
}

function openFileDelete(ep:SonarrEpisode) {
  fileDeleteEp.value = ep;
  showFileDeleteConfirm.value = true;
}

async function confirmFileDelete() {
  if (!fileDeleteEp.value) return;
  const fileId = (fileDeleteEp.value as any).episodeFileId;
  if (!fileId) return;
  await del(`/api/sonarr/episodefile/${fileId}`);
  const ep = episodes.value.find(e=>e.id===fileDeleteEp.value!.id);
  if (ep) { (ep as any).hasFile=false; (ep as any).episodeFileId=undefined; }
}

function openInteractiveEp(ep:SonarrEpisode) {
  interactiveEpId.value = ep.id;
  interactiveEpTitle.value = `S${String(ep.seasonNumber).padStart(2,'0')}E${String(ep.episodeNumber).padStart(2,'0')} · ${ep.title}`;
  showInteractiveEp.value = true;
}

// ── Batch Selection ───────────────────────────────────────────────────────────
const selectedEps = ref<Set<number>>(new Set());
const showBatchDeleteConfirm = ref(false);
const batchSearching = ref(false);

function toggleEpSelect(id:number) {
  if (selectedEps.value.has(id)) selectedEps.value.delete(id);
  else selectedEps.value.add(id);
}

function selectAllInSeason(sn:number) {
  const eps = episodesBySeason.value.get(sn)??[];
  eps.forEach(e=>selectedEps.value.add(e.id));
}

async function batchSearch() {
  if (batchSearching.value) return;
  batchSearching.value = true;
  try {
    await post('/api/sonarr/command', { name:'EpisodeSearch', episodeIds:[...selectedEps.value] });
    selectedEps.value.clear();
  } catch { /* */ }
  finally { batchSearching.value=false; }
}

async function batchDeleteFiles() {
  const ids = episodes.value
    .filter(e=>selectedEps.value.has(e.id)&&e.hasFile)
    .map(e=>(e as any).episodeFileId)
    .filter(Boolean);
  await Promise.allSettled(ids.map((id:number)=>del(`/api/sonarr/episodefile/${id}`)));
  for (const ep of episodes.value) {
    if (selectedEps.value.has(ep.id)) { (ep as any).hasFile=false; (ep as any).episodeFileId=undefined; }
  }
  selectedEps.value.clear();
}

// ── TMDB ──────────────────────────────────────────────────────────────────────
const tmdbCredits = ref<TMDBCredits|null>(null);
const tmdbTrailer = ref<TMDBVideo|null>(null);
const tmdbLoading = ref(false);

async function loadTmdb() {
  if (!series.value?.tvdbId||tmdbCredits.value!==null) return;
  tmdbLoading.value = true;
  try {
    const res = await fetch(`/api/tmdb/find/tvdb/${series.value.tvdbId}`, { credentials:'include' });
    if (!res.ok) return;
    const data = await res.json();
    tmdbCredits.value = data.credits ?? null;
    const vids: TMDBVideo[] = data.videos?.results ?? [];
    tmdbTrailer.value = vids.find(v=>v.type==='Trailer'&&v.official) ?? vids.find(v=>v.type==='Trailer') ?? null;
  } catch { /* */ }
  finally { tmdbLoading.value=false; }
}

// ── Computed ──────────────────────────────────────────────────────────────────
const seriesId  = computed(() => Number(route.params.id));
const fanartUrl = computed(() => series.value?.images?.find(i=>i.coverType==='fanart')?.remoteUrl);
const posterUrl = computed(() => series.value?.images?.find(i=>i.coverType==='poster')?.remoteUrl);
const plexUrl   = computed(() => series.value ? `https://app.plex.tv/desktop#!/search?query=${encodeURIComponent(series.value.title)}` : null);

const totalSeasons  = computed(() => (series.value?.seasons??[]).filter(s=>s.seasonNumber>0).length);
const totalEpisodes = computed(() => (series.value?.seasons??[]).reduce((s,ss)=>s+(ss.statistics?.totalEpisodeCount??0),0)||series.value?.episodeCount||0);
const fileEpisodes  = computed(() => (series.value?.seasons??[]).reduce((s,ss)=>s+(ss.statistics?.episodeFileCount??0),0)||series.value?.episodeFileCount||0);
const completionPct = computed(() => totalEpisodes.value>0?Math.round(fileEpisodes.value/totalEpisodes.value*100):0);
const totalSize     = computed(() => (series.value?.seasons??[]).reduce((s,ss)=>s+(ss.statistics?.sizeOnDisk??0),0)||series.value?.sizeOnDisk||0);

const sortedSeasons = computed((): SonarrSeason[] =>
  [...(series.value?.seasons??[])].filter(s=>s.seasonNumber>0).sort((a,b)=>b.seasonNumber-a.seasonNumber)
);
const episodesBySeason = computed(() => {
  const map = new Map<number,SonarrEpisode[]>();
  for (const ep of episodes.value) {
    if (!map.has(ep.seasonNumber)) map.set(ep.seasonNumber,[]);
    map.get(ep.seasonNumber)!.push(ep);
  }
  for (const eps of map.values()) eps.sort((a,b)=>a.episodeNumber-b.episodeNumber);
  return map;
});
const episodeFileMap = computed(() => {
  const m = new Map<number,any>();
  for (const f of episodeFiles.value) m.set(f.id,f);
  return m;
});

function seasonProgress(s:SonarrSeason){ const t=s.statistics?.totalEpisodeCount??0,h=s.statistics?.episodeFileCount??0; return t>0?Math.round(h/t*100):0; }
function toggleSeason(n:number){ if(openSeasons.value.has(n)) openSeasons.value.delete(n); else openSeasons.value.add(n); }
function fmtDate(iso?:string){ if(!iso) return ''; return new Date(iso).toLocaleDateString('de-DE'); }
function fmtBytes(b?:number){ if(!b) return ''; const g=b/1024/1024/1024; return g>=1?`${g.toFixed(2)} GB`:`${(b/1024/1024).toFixed(0)} MB`; }
function flagEmoji(c:string){ const m:Record<string,string>={de:'🇩🇪',en:'🇬🇧',fr:'🇫🇷',es:'🇪🇸',it:'🇮🇹',nl:'🇳🇱',pt:'🇵🇹',pl:'🇵🇱',ru:'🇷🇺',ja:'🇯🇵',ko:'🇰🇷',zh:'🇨🇳'}; return m[c]??'🏳️'; }

function epFileBadges(fileId?:number):Array<{label:string;color:string}> {
  if (!fileId) return [];
  const f = episodeFileMap.value.get(fileId);
  if (!f) return [];
  const mi = f.mediaInfo;
  const b:Array<{label:string;color:string}>=[];
  if (mi) {
    const res=(mi.resolution??'').toLowerCase();
    if(res.includes('2160')) b.push({label:'4K',color:'#35c5f4'});
    else if(res.includes('1080')) b.push({label:'1080p',color:'#35c5f4'});
    else if(res.includes('720')) b.push({label:'720p',color:'#888'});
    const hdr=(mi.videoDynamicRangeType??'').toUpperCase();
    if(hdr.includes('DOLBY')||hdr==='DV') b.push({label:'DV',color:'#bb86fc'});
    else if(hdr.includes('HDR')) b.push({label:'HDR',color:'#f5c518'});
    const vc=(mi.videoCodec??'').toLowerCase();
    if(vc.includes('h265')||vc.includes('hevc')) b.push({label:'H.265',color:'#aaa'});
    else if(vc.includes('h264')||vc.includes('avc')) b.push({label:'H.264',color:'#aaa'});
    const ac=(mi.audioCodec??'').toUpperCase();
    if(ac.includes('ATMOS')) b.push({label:'Atmos',color:'#22c65b'});
    else if(ac.includes('TRUEHD')) b.push({label:'TrueHD',color:'#22c65b'});
    else if(ac.includes('EAC3')||ac.includes('DDP')) b.push({label:'DD+',color:'#aaa'});
    else if(ac.includes('DTS')) b.push({label:'DTS',color:'#aaa'});
    const ch=parseFloat(String(mi.audioChannels??0));
    if(ch>=7) b.push({label:'7.1',color:'#555'}); else if(ch>=5) b.push({label:'5.1',color:'#555'});
  }
  const qn=f.quality?.quality?.name;
  if(qn&&!b.find(x=>x.label==='4K'||x.label==='1080p'||x.label==='720p')) b.unshift({label:qn,color:'var(--sonarr)'});
  const langs:any[]=(f.languages??[]);
  for(const l of langs.slice(0,3)) b.push({label:l.name?.slice(0,2)?.toUpperCase()??'',color:'#555'});
  return b.filter(x=>x.label);
}

function epRuntime(fileId?:number):string {
  if (!fileId) return '';
  const f = episodeFileMap.value.get(fileId);
  const rt = f?.mediaInfo?.runTime as string|undefined;
  if (!rt) return '';
  const parts = rt.split(':');
  if(parts.length===3) return `${parts[0]}:${parts[1]}`;
  return rt.slice(0,5);
}

function epSize(fileId?:number):string {
  if(!fileId) return '';
  const f=episodeFileMap.value.get(fileId);
  return fmtBytes(f?.size);
}

onMounted(async () => {
  if (store.series.length===0) await store.fetchSeries();
  series.value = await store.fetchSeriesById(seriesId.value);
  if (series.value) {
    [episodes.value, episodeFiles.value] = await Promise.all([
      store.fetchEpisodes(seriesId.value),
      fetch(`/api/sonarr/series/${seriesId.value}/episodefiles`,{credentials:'include'}).then(r=>r.ok?r.json():[]).catch(()=>[]),
    ]);
    // Bazarr episode subs
    fetch(`/api/bazarr/series/${seriesId.value}/episodes`,{credentials:'include'})
      .then(r=>r.ok?r.json():null).then((data:any[])=>{
        if(!data) return;
        const m:Record<number,any>={};
        for(const d of data) m[d.sonarrEpisodeId]=d;
        bazarrEpMap.value=m;
      }).catch(()=>{/* bazarr not configured */});
  }
  isLoading.value = false;
  loadTmdb();
});
</script>

<template>
  <div class="detail-view">

    <div v-if="isLoading" class="detail-loading">
      <div class="skeleton skeleton-hero"/><div class="detail-body"><div class="skeleton" style="height:36px;width:50%;border-radius:8px"/></div>
    </div>

    <div v-else-if="!series" class="empty-state">
      <p class="empty-title">Serie nicht gefunden</p>
      <button class="back-btn" @click="router.back()">← Zurück</button>
    </div>

    <template v-else>

      <!-- ── Hero ── -->
      <div class="hero" :style="fanartUrl?`--fanart: url('${fanartUrl}')`:''">
        <div class="hero-bg"/><div class="hero-gradient"/>
        <div class="hero-content">
          <button class="back-btn" @click="router.back()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>Serien
          </button>
          <div class="hero-main">
            <div class="hero-poster-wrap">
              <img v-if="posterUrl" :src="posterUrl" :alt="series.title" class="hero-poster"/>
              <div v-else class="hero-poster hero-ph">{{ series.title[0] }}</div>

              <!-- Action bar -->
              <div class="action-bar">
                <button class="act-btn act-search" :class="{'act-ok':searchAllStatus==='ok','act-err':searchAllStatus==='error'}" :disabled="isSearchingAll" @click="searchAll">
                  <svg v-if="isSearchingAll" class="spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  {{ isSearchingAll?'…':searchAllStatus==='ok'?'✓':'Alle suchen' }}
                </button>
                <button class="act-btn act-refresh" :disabled="isRefreshing" @click="refreshSeries">
                  <svg :class="{spin:isRefreshing}" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.02-7.36"/></svg>
                  {{ isRefreshing?'…':'↺ Aktualisieren' }}
                </button>
                <a v-if="plexUrl" :href="plexUrl" target="_blank" rel="noopener" class="act-btn act-plex">▶ Plex</a>
                <button class="act-btn" :class="series.monitored?'act-monitored-on':'act-monitored-off'" :disabled="isMonitorToggling" @click="toggleMonitored">
                  {{ series.monitored?'👁 Überwacht':'👁 Ignoriert' }}
                </button>
                <button class="act-btn act-delete" @click="showDeleteConfirm=true">🗑 Entfernen</button>
              </div>
            </div>

            <div class="hero-info">
              <div class="app-bar"/>
              <h1 class="hero-title">{{ series.title }}</h1>
              <div class="hero-meta">
                <span v-if="series.year">{{ series.year }}</span>
                <span v-if="series.network" class="sep">·</span>
                <span v-if="series.network">{{ series.network }}</span>
                <span v-if="series.runtime" class="sep">·</span>
                <span v-if="series.runtime">{{ series.runtime }} min</span>
                <span v-if="(series as any).nextAiring" class="next-air">
                  🕒 {{ new Date((series as any).nextAiring).toLocaleDateString('de-DE') }}
                </span>
              </div>
              <div class="hero-ratings">
                <div v-if="series.ratings?.value" class="r-chip">
                  <span class="r-src">IMDb</span>
                  <span class="r-val">★ {{ series.ratings.value.toFixed(1) }}</span>
                  <span v-if="series.ratings.votes" class="r-votes">{{ (series.ratings.votes/1000).toFixed(0) }}k</span>
                </div>
              </div>
              <div v-if="tmdbTrailer" class="hero-trailer">
                <a :href="`https://www.youtube.com/watch?v=${tmdbTrailer.key}`" target="_blank" rel="noopener" class="act-btn act-trailer-sm">▶ Trailer</a>
              </div>
              <div class="hero-badges">
                <span :class="['badge',series.status==='continuing'?'badge-on':'badge-off']">{{ series.status==='continuing'?'● Laufend':'■ Beendet' }}</span>
                <span v-if="!series.monitored" class="badge badge-unmon">Nicht überwacht</span>
                <span v-if="series.imdbId" class="badge badge-neu"><a :href="`https://www.imdb.com/title/${series.imdbId}`" target="_blank" rel="noopener" class="badge-link">{{ series.imdbId }}</a></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stats Bar -->
      <div class="stats-bar">
        <div class="stat-item"><span class="stat-num">{{ totalEpisodes.toLocaleString('de-DE') }}</span><span class="stat-label">Episoden</span></div>
        <div class="stat-divider"/>
        <div class="stat-item"><span class="stat-num">{{ totalSeasons }}</span><span class="stat-label">Staffeln</span></div>
        <div class="stat-divider"/>
        <div class="stat-item stat-pct">
          <span class="stat-num">{{ completionPct }}%</span><span class="stat-label">Vollständig</span>
          <div class="stat-bar-wrap"><div class="stat-bar" :style="{width:completionPct+'%'}" :class="{'bar-full':completionPct===100}"/></div>
        </div>
        <div class="stat-divider"/>
        <div class="stat-item"><span class="stat-num">{{ fmtBytes(totalSize) }}</span><span class="stat-label">Dateigröße</span></div>
      </div>

      <div v-if="series.genres?.length" class="genre-bar">
        <span v-for="g in series.genres" :key="g" class="genre-tag">{{ g }}</span>
      </div>

      <!-- Tabs -->
      <div class="tabs-bar">
        <button v-for="tab in (['seasons','overview'] as const)" :key="tab"
          :class="['tab-btn',{active:activeTab===tab}]"
          @click="activeTab=tab; if(tab==='overview') loadTmdb()">
          {{ tab==='seasons'?'Staffeln & Episoden':'Übersicht & Cast' }}
        </button>
      </div>

      <!-- ── Tab: Staffeln ── -->
      <div v-if="activeTab==='seasons'" class="tab-content">
        <div class="seasons-list">
          <div v-for="season in sortedSeasons" :key="season.seasonNumber" class="season-block">

            <div class="season-header" @click="toggleSeason(season.seasonNumber)">
              <span class="season-chevron" :class="{open:openSeasons.has(season.seasonNumber)}">›</span>
              <div class="season-title-wrap">
                <span class="season-label" :style="{color:'var(--sonarr)'}">S{{ String(season.seasonNumber).padStart(2,'0') }}</span>
                <span class="season-ep-count">{{ season.statistics?.episodeFileCount??0 }}/{{ season.statistics?.totalEpisodeCount??0 }} Ep.
                  <span v-if="season.statistics?.sizeOnDisk" class="season-size">· {{ fmtBytes(season.statistics.sizeOnDisk) }}</span>
                </span>
              </div>
              <div class="season-prog-wrap"><div class="season-prog" :style="{width:seasonProgress(season)+'%'}" :class="{'prog-full':seasonProgress(season)===100}"/></div>
              <span class="season-pct" :style="{color:seasonProgress(season)===100?'#22c55e':seasonProgress(season)>0?'var(--sonarr)':'var(--text-muted)'}">{{ seasonProgress(season) }}%</span>

              <!-- Season actions (rechts) -->
              <button class="s-act-btn" title="Alle wählen" @click.stop="selectAllInSeason(season.seasonNumber)">☑</button>
              <button class="s-act-btn" :class="{'ss-ok':seasonSearchStatus[season.seasonNumber]==='ok'}" :disabled="seasonSearching===season.seasonNumber" title="Staffel suchen" @click.stop="searchSeason(season.seasonNumber)">
                <svg v-if="seasonSearching===season.seasonNumber" class="spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <svg v-else width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </button>
              <button class="s-act-btn" :class="season.monitored?'s-mon-on':'s-mon-off'" :disabled="seasonMonitorToggling===season.seasonNumber" title="Überwachung toggle" @click.stop="toggleSeasonMonitor(season)">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
            </div>

            <!-- Episodes -->
            <div v-if="openSeasons.has(season.seasonNumber)" class="episodes-list">
              <div v-if="!episodesBySeason.get(season.seasonNumber)?.length" class="ep-loading">Keine Episoden…</div>

              <div v-for="ep in episodesBySeason.get(season.seasonNumber)" :key="ep.id" class="ep-block">
                <div :class="['ep-row', ep.hasFile?'ep-has':ep.monitored?'ep-miss':'ep-unmon']">
                  <!-- Checkbox -->
                  <label class="ep-checkbox" @click.stop>
                    <input type="checkbox" :checked="selectedEps.has(ep.id)" @change="toggleEpSelect(ep.id)" @click.stop/>
                  </label>
                  <!-- Status -->
                  <span :class="['ep-status',ep.hasFile?'ico-ok':ep.monitored?'ico-miss':'ico-off']">
                    {{ ep.hasFile?'✓':ep.monitored?'–':'○' }}
                  </span>
                  <!-- Ep# -->
                  <span class="ep-num">{{ String(ep.episodeNumber).padStart(2,'0') }}</span>
                  <!-- Monitor toggle -->
                  <button class="ep-mon-btn" :class="ep.monitored?'ep-mon-on':'ep-mon-off'" :disabled="episodeMonitorToggling===ep.id" title="Überwachung toggle" @click.stop="toggleEpisodeMonitor(ep)">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                  <!-- Title -->
                  <span :class="['ep-title',ep.hasFile?'ep-t-ok':'ep-t-miss']">{{ ep.title }}</span>
                  <!-- Runtime -->
                  <span v-if="ep.hasFile&&(ep as any).episodeFileId" class="ep-runtime">{{ epRuntime((ep as any).episodeFileId) }}</span>
                  <!-- Date -->
                  <span v-if="ep.airDate" class="ep-date">{{ fmtDate(ep.airDate) }}</span>
                  <!-- Size -->
                  <span v-if="ep.hasFile&&(ep as any).episodeFileId" class="ep-size">{{ epSize((ep as any).episodeFileId) }}</span>
                  <!-- Hover actions -->
                  <div class="ep-actions">
                    <button class="ep-act" title="Interaktive Suche" @click.stop="openInteractiveEp(ep)">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><circle cx="11" cy="11" r="3"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </button>
                    <button class="ep-act ep-act-search" title="Auto-Suche" :disabled="episodeSearching===ep.id" @click.stop="searchEpisode(ep)">
                      <svg :class="{spin:episodeSearching===ep.id}" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </button>
                    <button class="ep-act ep-act-bazarr" title="Bazarr-Suche" :disabled="bazarrEpSearching===ep.id" @click.stop="searchBazarrEpisode(ep)">
                      <svg :class="{spin:bazarrEpSearching===ep.id}" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    </button>
                    <button v-if="ep.hasFile" class="ep-act ep-act-del" title="Datei löschen" @click.stop="openFileDelete(ep)">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                    </button>
                  </div>
                </div>

                <!-- Tech badges unter Episode -->
                <div v-if="ep.hasFile&&(ep as any).episodeFileId" class="ep-tech-row">
                  <span v-for="b in epFileBadges((ep as any).episodeFileId)" :key="b.label" class="ep-tech" :style="{color:b.color,borderColor:b.color+'44'}">{{ b.label }}</span>
                  <!-- Bazarr badges -->
                  <template v-if="bazarrEpMap[ep.id]">
                    <span v-for="s in bazarrEpMap[ep.id].subtitles" :key="'bs-'+s.code2" class="ep-tech ep-bz-ok">{{ flagEmoji(s.code2) }}</span>
                    <span v-if="bazarrEpMap[ep.id].missing_subtitles.length" class="ep-tech ep-bz-miss">✗{{ bazarrEpMap[ep.id].missing_subtitles.length }}</span>
                  </template>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <!-- ── Tab: Übersicht ── -->
      <div v-if="activeTab==='overview'" class="tab-content">
        <div v-if="series.overview" class="overview-wrap">
          <p class="overview-text" :class="{collapsed:!overviewExpanded}">{{ series.overview }}</p>
          <button v-if="series.overview.length>280" class="overview-toggle" @click="overviewExpanded=!overviewExpanded">{{ overviewExpanded?'Weniger':'Mehr' }}</button>
        </div>
        <div class="details-grid">
          <div v-if="series.network" class="di"><span class="dl">Sender</span><span class="dv">{{ series.network }}</span></div>
          <div v-if="series.seriesType" class="di"><span class="dl">Typ</span><span class="dv">{{ series.seriesType }}</span></div>
          <div v-if="series.status" class="di"><span class="dl">Status</span><span class="dv">{{ series.status==='continuing'?'Laufend':'Beendet' }}</span></div>
          <div v-if="series.runtime" class="di"><span class="dl">Laufzeit</span><span class="dv">{{ series.runtime }} min</span></div>
          <div v-if="series.added" class="di"><span class="dl">Hinzugefügt</span><span class="dv">{{ fmtDate(series.added) }}</span></div>
          <div v-if="(series as any).firstAired" class="di"><span class="dl">Erstausstrahlung</span><span class="dv">{{ fmtDate((series as any).firstAired) }}</span></div>
          <div v-if="series.imdbId" class="di"><span class="dl">IMDb</span><a :href="`https://www.imdb.com/title/${series.imdbId}`" target="_blank" rel="noopener" class="dlink">{{ series.imdbId }}</a></div>
          <div v-if="series.tvdbId" class="di"><span class="dl">TVDB</span><a :href="`https://www.thetvdb.com/?id=${series.tvdbId}`" target="_blank" rel="noopener" class="dlink">{{ series.tvdbId }}</a></div>
          <div v-if="series.path" class="di di-full"><span class="dl">Pfad</span><span class="dv dv-mono">{{ series.path }}</span></div>
        </div>
        <div v-if="tmdbCredits?.crew.length" class="section-block">
          <h3 class="section-head">Crew</h3>
          <div class="crew-list">
            <div v-for="m in tmdbCredits.crew" :key="m.id+m.job" class="crew-row"><span class="crew-name">{{ m.name }}</span><span class="crew-job">{{ m.job }}</span></div>
          </div>
        </div>
        <div v-if="tmdbCredits?.cast.length" class="section-block">
          <h3 class="section-head">Besetzung</h3>
          <div class="cast-grid">
            <div v-for="a in tmdbCredits.cast" :key="a.id" class="cast-card">
              <div class="cast-photo">
                <img v-if="a.profile_path" :src="`https://image.tmdb.org/t/p/w185${a.profile_path}`" :alt="a.name" loading="lazy"/>
                <div v-else class="cast-ph">{{ a.name[0] }}</div>
              </div>
              <p class="cast-name">{{ a.name }}</p>
              <p class="cast-char">{{ a.character }}</p>
            </div>
          </div>
        </div>
        <div v-if="tmdbLoading" class="cast-grid">
          <div v-for="i in 8" :key="i" class="skeleton" style="aspect-ratio:2/3;border-radius:8px"/>
        </div>
      </div>

    </template>

    <!-- Batch Selection Toolbar (fixed bottom) -->
    <Teleport to="body">
      <div v-if="selectedEps.size>0" class="batch-toolbar">
        <span class="batch-count">{{ selectedEps.size }} Episode(n) ausgewählt</span>
        <div class="batch-divider"/>
        <button class="batch-btn" :disabled="batchSearching" @click="batchSearch">
          <svg :class="{spin:batchSearching}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          Alle suchen
        </button>
        <button class="batch-btn batch-del-btn" @click="showBatchDeleteConfirm=true">🗑 Dateien löschen</button>
        <div class="batch-divider"/>
        <button class="batch-btn batch-clear" @click="selectedEps.clear()">✕ Aufheben</button>
      </div>
    </Teleport>

    <!-- Modals -->
    <InteractiveSearchModal v-model="showInteractiveEp" source="sonarr" :entityId="interactiveEpId" :title="interactiveEpTitle"/>
    <ConfirmDialog v-model="showDeleteConfirm" title="Serie entfernen?" :message="`'${series?.title}' und alle Dateien aus Sonarr entfernen?`" confirm-label="Entfernen" @confirm="confirmDelete"/>
    <ConfirmDialog v-model="showFileDeleteConfirm" title="Datei löschen?" :message="`Datei für '${fileDeleteEp?.title}' unwiderruflich löschen?`" confirm-label="Löschen" @confirm="confirmFileDelete"/>
    <ConfirmDialog v-model="showBatchDeleteConfirm" title="Dateien löschen?" :message="`Dateien für ${selectedEps.size} Episoden löschen?`" confirm-label="Löschen" @confirm="batchDeleteFiles"/>
  </div>
</template>

<style scoped>
.detail-view { min-height: 100%; }
.hero { position:relative; min-height:420px; display:flex; flex-direction:column; justify-content:flex-end; }
.hero-bg { position:absolute; inset:0; background-image:var(--fanart); background-size:cover; background-position:center top; z-index:0; }
.hero-gradient { position:absolute; inset:0; background:linear-gradient(to bottom, rgba(10,10,10,.15) 0%, rgba(10,10,10,.55) 45%, rgba(10,10,10,.97) 100%); z-index:1; }
.hero-content { position:relative; z-index:2; padding: var(--space-5) var(--space-6) var(--space-6); display:flex; flex-direction:column; gap:var(--space-4); }
.back-btn { display:inline-flex; align-items:center; gap:5px; color:var(--text-tertiary); font-size:var(--text-sm); transition:color .15s; align-self:flex-start; }
.back-btn:hover { color:var(--text-primary); }
.hero-main { display:flex; gap:var(--space-5); align-items:flex-end; }
.hero-poster-wrap { display:flex; flex-direction:column; gap:var(--space-2); flex-shrink:0; }
.hero-poster { width:130px; min-width:130px; aspect-ratio:2/3; object-fit:cover; border-radius:var(--radius-lg); border:1px solid rgba(255,255,255,.1); box-shadow:0 12px 40px rgba(0,0,0,.6); }
.hero-ph { display:flex; align-items:center; justify-content:center; background:var(--bg-elevated); font-size:52px; font-weight:700; color:var(--text-muted); }
.action-bar { display:flex; flex-direction:column; gap:4px; width:130px; }
.act-btn { display:inline-flex; align-items:center; justify-content:center; gap:5px; padding:5px 8px; border-radius:var(--radius-sm); font-size:11px; font-weight:500; cursor:pointer; transition:all .15s; width:100%; white-space:nowrap; }
.act-btn:disabled { opacity:.6; cursor:not-allowed; }
.act-search { background:rgba(53,197,244,.1); border:1px solid rgba(53,197,244,.25); color:var(--text-secondary); }
.act-search:not(:disabled):hover { background:rgba(53,197,244,.2); }
.act-refresh { background:var(--bg-elevated); border:1px solid var(--bg-border); color:var(--text-tertiary); }
.act-plex { background:rgba(229,160,13,.1); border:1px solid rgba(229,160,13,.25); color:var(--text-secondary); text-decoration:none; }
.act-monitored-on { background:rgba(53,197,244,.12); border:1px solid rgba(53,197,244,.3); color:var(--sonarr); }
.act-monitored-off { background:var(--bg-elevated); border:1px solid var(--bg-border); color:var(--text-muted); }
.act-delete { background:rgba(239,68,68,.08); border:1px solid rgba(239,68,68,.2); color:var(--text-muted); }
.act-delete:hover { background:rgba(239,68,68,.18); color:#ef4444; }
.act-ok { background:rgba(34,197,94,.12); border-color:rgba(34,197,94,.3); color:#22c55e; }
.act-err { background:rgba(239,68,68,.12); border-color:rgba(239,68,68,.3); color:#ef4444; }
.hero-info { flex:1; display:flex; flex-direction:column; gap:var(--space-3); padding-bottom:var(--space-1); }
.app-bar { width:32px; height:3px; background:var(--sonarr); border-radius:2px; }
.hero-title { font-size:clamp(20px,3vw,32px); font-weight:700; color:var(--text-primary); line-height:1.2; margin:0; }
.hero-meta { display:flex; align-items:center; gap:var(--space-2); color:var(--text-tertiary); font-size:var(--text-sm); flex-wrap:wrap; }
.sep { color:var(--text-muted); }
.next-air { color:var(--sonarr); font-size:var(--text-xs); }
.r-chip { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:var(--radius-sm); font-size:var(--text-xs); font-weight:600; border:1px solid; background:rgba(245,197,24,.1); border-color:rgba(245,197,24,.3); }
.r-src { color:var(--text-muted); font-weight:400; } .r-val { color:var(--text-primary); } .r-votes { color:var(--text-muted); font-size:10px; }
.hero-trailer { margin-top:var(--space-1); }
.act-trailer-sm { display:inline-flex; align-items:center; gap:5px; padding:4px 12px; border-radius:var(--radius-sm); font-size:11px; font-weight:500; cursor:pointer; background:rgba(255,0,0,.1); border:1px solid rgba(255,0,0,.25); color:var(--text-secondary); text-decoration:none; }
.hero-badges { display:flex; gap:var(--space-2); flex-wrap:wrap; }
.badge { padding:2px 10px; border-radius:99px; font-size:var(--text-xs); font-weight:500; }
.badge-on { background:rgba(53,197,244,.12); color:var(--sonarr); border:1px solid rgba(53,197,244,.25); }
.badge-off { background:var(--bg-elevated); color:var(--text-muted); border:1px solid var(--bg-border); }
.badge-unmon { background:var(--bg-elevated); color:var(--text-muted); border:1px solid var(--bg-border); }
.badge-neu { background:var(--bg-elevated); color:var(--text-tertiary); border:1px solid var(--bg-border); }
.badge-link { color:inherit; text-decoration:none; }
.stats-bar { display:flex; align-items:center; background:var(--bg-surface); border-bottom:1px solid var(--bg-border); padding: var(--space-4) var(--space-6); }
.stat-item { display:flex; flex-direction:column; gap:2px; padding:0 var(--space-5); flex:1; }
.stat-item:first-child { padding-left:0; }
.stat-num { font-size:var(--text-xl); font-weight:700; color:var(--text-primary); font-variant-numeric:tabular-nums; }
.stat-label { font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.06em; }
.stat-pct { flex:2; }
.stat-bar-wrap { height:4px; background:var(--bg-elevated); border-radius:2px; margin-top:4px; max-width:200px; }
.stat-bar { height:100%; background:var(--sonarr); border-radius:2px; transition:width .3s; }
.bar-full { background:var(--status-success); }
.stat-divider { width:1px; height:40px; background:var(--bg-border); flex-shrink:0; }
.genre-bar { display:flex; gap:var(--space-2); flex-wrap:wrap; padding: var(--space-3) var(--space-6); border-bottom:1px solid var(--bg-border); background:var(--bg-surface); }
.genre-tag { font-size:11px; padding:3px 10px; background:var(--bg-elevated); border:1px solid var(--bg-border); border-radius:99px; color:var(--text-muted); }
.tabs-bar { display:flex; border-bottom:1px solid var(--bg-border); padding:0 var(--space-6); background:var(--bg-surface); position:sticky; top:0; z-index:10; }
.tab-btn { padding: var(--space-3) var(--space-5); font-size:var(--text-sm); color:var(--text-muted); border-bottom:2px solid transparent; transition:color .15s,border-color .15s; margin-bottom:-1px; cursor:pointer; }
.tab-btn:hover { color:var(--text-secondary); }
.tab-btn.active { color:var(--text-primary); border-bottom-color:var(--sonarr); }
.tab-content { padding: var(--space-5) var(--space-6); }
.seasons-list { display:flex; flex-direction:column; gap:var(--space-2); }
.season-block { border:1px solid var(--bg-border); border-radius:var(--radius-lg); overflow:hidden; background:var(--bg-surface); }
.season-header { width:100%; display:flex; align-items:center; gap:var(--space-3); padding: var(--space-3) var(--space-4); cursor:pointer; transition:background .15s; }
.season-header:hover { background:var(--bg-elevated); }
.season-chevron { font-size:18px; color:var(--text-muted); transition:transform .2s; line-height:1; flex-shrink:0; }
.season-chevron.open { transform:rotate(90deg); }
.season-title-wrap { flex:1; display:flex; flex-direction:column; gap:1px; text-align:left; }
.season-label { font-size:var(--text-sm); font-weight:700; }
.season-ep-count { font-size:10px; color:var(--text-muted); } .season-size { color:var(--text-muted); }
.season-prog-wrap { width:80px; height:3px; background:var(--bg-border); border-radius:2px; overflow:hidden; flex-shrink:0; }
.season-prog { height:100%; background:var(--sonarr); border-radius:2px; transition:width .3s; }
.prog-full { background:var(--status-success); }
.season-pct { font-size:11px; min-width:30px; text-align:right; flex-shrink:0; }
.s-act-btn { display:flex; align-items:center; justify-content:center; width:24px; height:24px; border-radius:var(--radius-sm); background:var(--bg-elevated); border:1px solid var(--bg-border); color:var(--text-muted); cursor:pointer; transition:all .15s; flex-shrink:0; font-size:11px; }
.s-act-btn:hover:not(:disabled) { background:var(--bg-overlay); color:var(--sonarr); border-color:rgba(53,197,244,.35); }
.s-act-btn:disabled { opacity:.6; cursor:not-allowed; }
.s-mon-on { color:var(--sonarr); border-color:rgba(53,197,244,.3); }
.s-mon-off { color:var(--text-muted); }
.ss-ok { background:rgba(34,197,94,.1); border-color:rgba(34,197,94,.3); color:#22c55e; }
.episodes-list { border-top:1px solid var(--bg-border); }
.ep-loading { padding:var(--space-4); color:var(--text-muted); font-size:var(--text-sm); text-align:center; }
.ep-block { border-bottom:1px solid rgba(255,255,255,.03); }
.ep-block:last-child { border-bottom:none; }
.ep-row { display:flex; align-items:center; gap:8px; padding:6px var(--space-4); transition:background .12s; position:relative; }
.ep-row:hover { background:var(--bg-elevated); }
.ep-row:hover .ep-actions { opacity:1; }
.ep-checkbox { display:flex; align-items:center; flex-shrink:0; }
.ep-checkbox input { width:13px; height:13px; cursor:pointer; accent-color:var(--sonarr); }
.ep-status { font-size:10px; font-weight:700; flex-shrink:0; width:13px; text-align:center; }
.ico-ok { color:var(--status-success); } .ico-miss { color:var(--text-muted); } .ico-off { color:var(--text-muted); }
.ep-num { font-size:11px; color:var(--text-muted); min-width:20px; font-variant-numeric:tabular-nums; flex-shrink:0; }
.ep-mon-btn { display:flex; align-items:center; justify-content:center; width:16px; height:16px; border-radius:3px; cursor:pointer; transition:all .12s; flex-shrink:0; background:transparent; border:none; }
.ep-mon-on { color:var(--sonarr); } .ep-mon-off { color:var(--text-muted); } .ep-mon-btn:hover { opacity:.7; }
.ep-title { font-size:var(--text-sm); flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ep-t-ok { color:var(--text-secondary); } .ep-t-miss { color:var(--text-muted); }
.ep-runtime { font-size:10px; color:var(--text-muted); flex-shrink:0; }
.ep-date { font-size:10px; color:var(--text-muted); white-space:nowrap; flex-shrink:0; }
.ep-size { font-size:10px; color:var(--text-muted); white-space:nowrap; flex-shrink:0; }
.ep-actions { display:flex; gap:3px; flex-shrink:0; opacity:0; transition:opacity .15s; }
.ep-act { display:flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:var(--radius-sm); background:var(--bg-overlay); border:1px solid var(--bg-border); color:var(--text-muted); cursor:pointer; transition:all .12s; }
.ep-act:hover:not(:disabled) { color:var(--sonarr); border-color:rgba(53,197,244,.35); }
.ep-act:disabled { opacity:.5; cursor:not-allowed; }
.ep-act-search:hover { color:var(--sonarr); }
.ep-act-bazarr:hover { color:var(--bazarr); border-color:rgba(167,139,250,.35); }
.ep-act-del:hover { color:#ef4444; border-color:rgba(239,68,68,.35); }
.ep-tech-row { display:flex; gap:3px; flex-wrap:wrap; padding:3px var(--space-4) 5px calc(var(--space-4) + 60px); }
.ep-tech { font-size:9px; font-weight:700; padding:1px 5px; border-radius:3px; border:1px solid; letter-spacing:.02em; }
.ep-bz-ok { background:rgba(167,139,250,.1); color:var(--bazarr); border-color:rgba(167,139,250,.2); }
.ep-bz-miss { background:rgba(239,68,68,.08); color:#ef4444; border-color:rgba(239,68,68,.2); border-style:dashed; }

/* Overview Tab */
.overview-wrap { margin-bottom:var(--space-6); }
.overview-text { color:var(--text-tertiary); line-height:1.75; font-size:var(--text-base); margin:0; }
.overview-text.collapsed { display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden; }
.overview-toggle { color:var(--sonarr); font-size:var(--text-sm); cursor:pointer; margin-top:var(--space-2); background:none; border:none; padding:0; }
.details-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:var(--space-4); margin-bottom:var(--space-6); }
.di { display:flex; flex-direction:column; gap:3px; } .di-full { grid-column:1/-1; }
.dl { font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.06em; }
.dv { font-size:var(--text-sm); color:var(--text-secondary); } .dv-mono { font-family:monospace; font-size:var(--text-xs); word-break:break-all; }
.dlink { font-size:var(--text-sm); color:var(--tmdb); text-decoration:underline; }
.section-block { margin-top:var(--space-6); }
.section-head { font-size:var(--text-sm); font-weight:600; color:var(--text-secondary); border-left:3px solid var(--tmdb); padding-left:var(--space-3); margin-bottom:var(--space-4); }
.crew-list { display:flex; flex-direction:column; gap:var(--space-2); } .crew-row { display:flex; align-items:baseline; gap:var(--space-3); }
.crew-name { font-size:var(--text-sm); color:var(--text-secondary); font-weight:500; min-width:160px; } .crew-job { font-size:var(--text-xs); color:var(--text-muted); }
.cast-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(85px,1fr)); gap:var(--space-3); }
.cast-card { display:flex; flex-direction:column; gap:3px; }
.cast-photo { aspect-ratio:2/3; border-radius:var(--radius-md); overflow:hidden; background:var(--bg-elevated); border:1px solid var(--bg-border); }
.cast-photo img { width:100%; height:100%; object-fit:cover; } .cast-ph { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:700; color:var(--text-muted); }
.cast-name { font-size:10px; color:var(--text-secondary); font-weight:600; line-height:1.3; margin:0; } .cast-char { font-size:10px; color:var(--text-muted); line-height:1.3; margin:0; }

/* Batch Toolbar */
.batch-toolbar { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:var(--space-3); padding: var(--space-3) var(--space-5); background:var(--bg-elevated); border:1px solid var(--bg-border); border-radius:var(--radius-xl); box-shadow:0 8px 32px rgba(0,0,0,.7); z-index:1000; animation:bt-in .2s ease; white-space:nowrap; }
@keyframes bt-in { from { opacity:0; transform:translateX(-50%) translateY(8px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
.batch-count { font-size:var(--text-sm); color:var(--text-primary); font-weight:600; }
.batch-divider { width:1px; height:20px; background:var(--bg-border); }
.batch-btn { font-size:12px; font-weight:500; padding:5px 12px; border-radius:var(--radius-sm); cursor:pointer; transition:all .15s; display:inline-flex; align-items:center; gap:5px; background:rgba(53,197,244,.1); border:1px solid rgba(53,197,244,.25); color:var(--sonarr); }
.batch-btn:hover:not(:disabled) { background:rgba(53,197,244,.2); }
.batch-btn:disabled { opacity:.6; cursor:not-allowed; }
.batch-del-btn { background:rgba(239,68,68,.1); border-color:rgba(239,68,68,.25); color:#ef4444; }
.batch-del-btn:hover { background:rgba(239,68,68,.2); }
.batch-clear { background:var(--bg-overlay); border-color:var(--bg-border); color:var(--text-muted); }
.batch-clear:hover { color:var(--text-secondary); }

/* Misc */
.detail-loading { display:flex; flex-direction:column; }
.skeleton-hero { height:420px; width:100%; border-radius:0; }
.detail-body { padding:var(--space-6); display:flex; flex-direction:column; gap:var(--space-3); }
.empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:60vh; gap:var(--space-4); }
.empty-title { font-size:var(--text-lg); color:var(--text-secondary); font-weight:600; }
@keyframes spin { to { transform:rotate(360deg); } }
.spin { animation:spin .8s linear infinite; }
</style>
