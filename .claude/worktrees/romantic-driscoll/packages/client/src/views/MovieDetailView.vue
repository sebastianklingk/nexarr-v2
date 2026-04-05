<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMoviesStore } from '../stores/movies.store.js';
import { useApi } from '../composables/useApi.js';
import InteractiveSearchModal from '../components/ui/InteractiveSearchModal.vue';
import ConfirmDialog from '../components/ui/ConfirmDialog.vue';
import RatingPills from '../components/ui/RatingPills.vue';
import type { RadarrMovie, TMDBCredits, TMDBVideo } from '@nexarr/shared';
import { posterUrl as getPosterUrl, fanartUrl as getFanartUrl } from '../utils/images.js';
import MediaIcon from '../components/ui/MediaIcon.vue';

const route  = useRoute();
const router = useRouter();
const store  = useMoviesStore();
const { post, put, del } = useApi();

const movie     = ref<RadarrMovie | null>(null);
const isLoading = ref(true);
const activeTab = ref<'overview'|'files'|'bazarr'|'tautulli'>('overview');
const overviewExpanded = ref(false);

// ── Action Bar ────────────────────────────────────────────────────────────────
const isSearching       = ref(false);
const searchStatus      = ref<'idle'|'ok'|'error'>('idle');
const isRefreshing      = ref(false);
const refreshStatus     = ref<'idle'|'ok'|'error'>('idle');
const isMonitorToggling = ref(false);
const showDeleteConfirm = ref(false);
const showInteractive   = ref(false);

async function triggerSearch() {
  if (!movie.value || isSearching.value) return;
  isSearching.value = true; searchStatus.value = 'idle';
  try { await post('/api/radarr/command', { name: 'MoviesSearch', movieIds: [movie.value.id] }); searchStatus.value = 'ok'; }
  catch { searchStatus.value = 'error'; }
  finally { isSearching.value = false; setTimeout(() => { searchStatus.value = 'idle'; }, 3000); }
}

async function rescanMovie() {
  if (!movie.value || isRefreshing.value) return;
  isRefreshing.value = true; refreshStatus.value = 'idle';
  try { await post('/api/radarr/command', { name: 'RescanMovie', movieId: movie.value.id }); refreshStatus.value = 'ok'; }
  catch { refreshStatus.value = 'error'; }
  finally { isRefreshing.value = false; setTimeout(() => { refreshStatus.value = 'idle'; }, 3000); }
}

async function toggleMonitored() {
  if (!movie.value || isMonitorToggling.value) return;
  isMonitorToggling.value = true;
  try {
    const updated = await put<RadarrMovie>(`/api/radarr/movies/${movie.value.id}`, { ...movie.value, monitored: !movie.value.monitored });
    movie.value = updated;
  } catch { /* */ }
  finally { isMonitorToggling.value = false; }
}

async function confirmDelete() {
  if (!movie.value) return;
  await del(`/api/radarr/movies/${movie.value.id}?deleteFiles=true`);
  router.push('/movies');
}

// ── TMDB ──────────────────────────────────────────────────────────────────────
const tmdbCredits = ref<TMDBCredits|null>(null);
const tmdbTrailer = ref<TMDBVideo|null>(null);
const tmdbLoading = ref(false);

async function loadTmdb() {
  if (!movie.value?.tmdbId || tmdbCredits.value !== null) return;
  tmdbLoading.value = true;
  try {
    const [cr, vr] = await Promise.all([
      fetch(`/api/tmdb/movie/${movie.value.tmdbId}/credits`, { credentials: 'include' }),
      fetch(`/api/tmdb/movie/${movie.value.tmdbId}/videos`,  { credentials: 'include' }),
    ]);
    if (cr.ok) tmdbCredits.value = await cr.json();
    if (vr.ok) {
      const vd = await vr.json();
      tmdbTrailer.value = vd.results?.find((v: TMDBVideo) => v.type==='Trailer'&&v.official)
        ?? vd.results?.find((v: TMDBVideo) => v.type==='Trailer') ?? null;
    }
  } catch { /* */ }
  finally { tmdbLoading.value = false; }
}

// ── Bazarr Full ────────────────────────────────────────────────────────────────
interface BazarrSub { code2:string; name:string; path?:string; forced:boolean; hi:boolean; format?:string; provider_name?:string; file_size?:number; }
interface BazarrFull { radarrId:number; title:string; sceneName?:string; monitored:boolean; subtitles:BazarrSub[]; missing_subtitles:Array<{code2:string;name:string;forced:boolean;hi:boolean}>; audio_language:Array<{code2:string;name:string}>; }

const bazarr        = ref<BazarrFull|null>(null);
const bazarrLoading = ref(false);
const bazarrError   = ref('');
const bazarrDetail  = ref(false);
const bazarrSearching = ref(false);
const bazarrSearchOk  = ref(false);

async function loadBazarr() {
  if (!movie.value || bazarr.value !== null || bazarrLoading.value) return;
  bazarrLoading.value = true; bazarrError.value = '';
  try {
    const res = await fetch(`/api/bazarr/movies/${movie.value.id}/subtitles/full`, { credentials: 'include' });
    if (res.status === 503) { bazarrError.value = 'Bazarr nicht konfiguriert'; return; }
    if (res.status === 404) { bazarrError.value = 'Film in Bazarr nicht gefunden'; return; }
    if (!res.ok) { bazarrError.value = `Fehler ${res.status}`; return; }
    bazarr.value = await res.json();
  } catch { bazarrError.value = 'Verbindungsfehler'; }
  finally { bazarrLoading.value = false; }
}

async function searchAllSubtitles() {
  if (!movie.value || bazarrSearching.value) return;
  bazarrSearching.value = true;
  try {
    await post(`/api/bazarr/movies/${movie.value.id}/subtitles/search`);
    bazarrSearchOk.value = true; bazarr.value = null;
    setTimeout(() => { loadBazarr(); bazarrSearchOk.value = false; }, 2500);
  } catch { /* */ }
  finally { bazarrSearching.value = false; }
}

// ── Tautulli ──────────────────────────────────────────────────────────────────
interface TautulliPlay { date?:number; started?:number; friendly_name?:string; user_thumb?:string; product?:string; platform?:string; player?:string; transcode_decision?:string; paused_counter?:number; watched_status?:number; percent_complete?:number; play_duration?:number; }

const tautulliHistory = ref<TautulliPlay[]>([]);
const tautulliLoading = ref(false);
const tautulliLoaded  = ref(false);

async function loadTautulli() {
  if (tautulliLoaded.value || !movie.value?.tmdbId) return;
  tautulliLoading.value = true;
  try {
    const res = await fetch(`/api/tautulli/movie-history?tmdbId=${movie.value.tmdbId}&title=${encodeURIComponent(movie.value.title)}`, { credentials: 'include' });
    if (res.ok) tautulliHistory.value = await res.json();
  } catch { /* */ }
  finally { tautulliLoading.value = false; tautulliLoaded.value = true; }
}

// ── Computed / Helpers ────────────────────────────────────────────────────────
const movieId   = computed(() => Number(route.params.id));
const fanartUrl = computed(() => getFanartUrl(movie.value?.images));
const posterUrl = computed(() => getPosterUrl(movie.value?.images, 'w500'));
const plexUrl   = computed(() => movie.value ? `https://app.plex.tv/desktop#!/search?query=${encodeURIComponent(movie.value.title)}` : null);
const imdbUrl   = computed(() => movie.value?.imdbId ? `https://www.imdb.com/title/${movie.value.imdbId}` : null);
const tmdbUrl   = computed(() => movie.value?.tmdbId ? `https://www.themoviedb.org/movie/${movie.value.tmdbId}` : null);

const techBadges = computed(() => {
  const mi = movie.value?.movieFile?.mediaInfo as any;
  if (!mi) return [] as Array<{label:string;color:string;brand?:string;category?:string;iconValue?:string}>;
  const b: Array<{label:string;color:string;brand?:string;category?:string;iconValue?:string}> = [];
  const res = (mi.resolution??'').toLowerCase();
  if (res.includes('3840')||res.includes('2160')) b.push({label:'4K',color:'#35c5f4',category:'video_resolution',iconValue:'4k'});
  else if (res.includes('1920')||res.includes('1080')) b.push({label:'1080p',color:'#35c5f4',category:'video_resolution',iconValue:'1080'});
  else if (res.includes('720')) b.push({label:'720p',color:'#888',category:'video_resolution',iconValue:'720'});
  const hdr = (mi.videoDynamicRangeType??'').toUpperCase();
  if (hdr.includes('DOLBY')||hdr==='DV') b.push({label:'DV',color:'#bb86fc',brand:'dolby_vision'});
  else if (hdr.includes('HDR10+')) b.push({label:'HDR10+',color:'#f5c518',brand:'hdr10plus'});
  else if (hdr.includes('HDR')) b.push({label:'HDR',color:'#f5c518',brand:'hdr10'});
  const vc = (mi.videoCodec??'').toLowerCase();
  if (vc.includes('h265')||vc.includes('hevc')) b.push({label:'H.265',color:'#aaa'});
  else if (vc.includes('h264')||vc.includes('avc')) b.push({label:'H.264',color:'#aaa'});
  else if (vc.includes('av1')) b.push({label:'AV1',color:'#aaa'});
  const ac = (mi.audioCodec??'').toUpperCase();
  if (ac.includes('ATMOS')) b.push({label:'Atmos',color:'#22c65b',brand:'dolby_atmos'});
  else if (ac.includes('TRUEHD')) b.push({label:'TrueHD',color:'#22c65b',brand:'dolby_truehd'});
  else if (ac.includes('EAC3')||ac.includes('DDP')) b.push({label:'DD+',color:'#aaa',brand:'eac3'});
  else if (ac.includes('DTS-HD')||ac.includes('DCA-MA')) b.push({label:'DTS-HD MA',color:'#aaa',brand:'dts-hd_ma'});
  else if (ac.includes('DTS')) b.push({label:'DTS',color:'#aaa',brand:'dts'});
  else if (ac.includes('AC3')) b.push({label:'DD',color:'#aaa',brand:'ac3'});
  else if (ac.includes('FLAC')) b.push({label:'FLAC',color:'#aaa',brand:'flac'});
  const ch = parseFloat(String(mi.audioChannels??0));
  if (ch===7.1) b.push({label:'7.1',color:'#555'});
  else if (ch>=5) b.push({label:'5.1',color:'#555'});
  return b;
});

const qualityName = computed(() => (movie.value?.movieFile?.quality as any)?.quality?.name ?? '');

function fmtRuntime(m?:number){ if(!m) return ''; const h=Math.floor(m/60),mn=m%60; return h>0?`${h}h ${mn}m`:`${mn}m`; }
function fmtBytes(b?:number){ if(!b) return ''; const g=b/1024/1024/1024; return g>=1?`${g.toFixed(2)} GB`:`${(b/1024/1024).toFixed(0)} MB`; }
function fmtDate(iso?:string){ if(!iso) return ''; return new Date(iso).toLocaleDateString('de-DE'); }
function flagEmoji(c:string){ const m:Record<string,string>={de:'🇩🇪',en:'🇬🇧',fr:'🇫🇷',es:'🇪🇸',it:'🇮🇹',nl:'🇳🇱',pt:'🇵🇹',pl:'🇵🇱',ru:'🇷🇺',ja:'🇯🇵',ko:'🇰🇷',zh:'🇨🇳',tr:'🇹🇷',sv:'🇸🇪',da:'🇩🇰',fi:'🇫🇮',cs:'🇨🇿',hu:'🇭🇺'}; return m[c]??'🏳️'; }

const tPlayCount    = computed(() => tautulliHistory.value.length);
const tTotalMin     = computed(() => { const s=tautulliHistory.value.reduce((a,h)=>a+(h.play_duration??0),0); if(!s) return ''; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h>0?`${h}h ${m}m`:`${m}m`; });
const tLastWatched  = computed(() => tautulliHistory.value.length ? [...tautulliHistory.value].sort((a,b)=>(b.date??0)-(a.date??0))[0] : null);

function tcColor(d?:string){ if(!d) return 'var(--text-muted)'; return d==='direct play'?'#22c55e':d==='copy'?'#35c5f4':'#f59e0b'; }

onMounted(async () => {
  if (store.movies.length===0) await store.fetchMovies();
  movie.value = await store.fetchMovie(movieId.value);
  isLoading.value = false;
  loadTmdb();
});
</script>

<template>
  <div class="detail-view">

    <div v-if="isLoading" class="detail-loading">
      <div class="skeleton skeleton-hero"/>
      <div class="detail-body">
        <div class="skeleton" style="height:36px;width:50%;border-radius:8px"/>
        <div class="skeleton" style="height:18px;width:30%;border-radius:6px;margin-top:8px"/>
      </div>
    </div>

    <div v-else-if="!movie" class="empty-state">
      <p class="empty-title">Film nicht gefunden</p>
      <button class="back-btn" @click="router.back()">← Zurück</button>
    </div>

    <template v-else>

      <!-- ── Hero ── -->
      <div class="hero" :style="fanartUrl?`--fanart: url('${fanartUrl}')`:''">
        <div class="hero-bg"/><div class="hero-gradient"/>
        <div class="hero-content">

          <button class="back-btn" @click="router.back()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Filme
          </button>

          <div class="hero-main">
            <div class="hero-poster-wrap">
              <img v-if="posterUrl" :src="posterUrl" :alt="movie.title" class="hero-poster"/>
              <div v-else class="hero-poster hero-ph">{{ movie.title[0] }}</div>
            </div>

            <div class="hero-info">
              <div class="app-bar"/>

              <!-- Status-Badges VOR dem Titel -->
              <div class="hero-top-badges">
                <span :class="['htb', movie.hasFile ? 'htb-ok' : 'htb-miss']">
                  {{ movie.hasFile ? '✓ Vorhanden' : '✗ Fehlt' }}
                </span>
                <span v-if="movie.monitored" class="htb htb-watch">Überwacht</span>
                <span v-if="!movie.monitored" class="htb htb-unwatch">Nicht überwacht</span>
                <span class="htb htb-app">Filme</span>
              </div>

              <h1 class="hero-title">{{ movie.title }}</h1>

              <!-- Meta-Zeile: 18 · 2026 · 1h 49m · 4K HDR H.265 5.1 -->
              <div class="hero-meta">
                <span v-if="(movie as any).certification" class="cert-badge">{{ (movie as any).certification }}</span>
                <span v-if="movie.year">{{ movie.year }}</span>
                <span v-if="movie.runtime" class="sep">·</span>
                <span v-if="movie.runtime">{{ fmtRuntime(movie.runtime) }}</span>
                <template v-if="techBadges.length">
                  <span class="sep">·</span>
                  <template v-for="b in techBadges" :key="b.label">
                    <MediaIcon v-if="b.brand" :brand="b.brand" :height="13" />
                    <MediaIcon v-else-if="b.category && b.iconValue" :category="b.category" :value="b.iconValue" :height="13" />
                    <span v-else class="tech-inline" :style="{color:b.color}">{{ b.label }}</span>
                  </template>
                </template>
              </div>

              <!-- Genres -->
              <div v-if="movie.genres?.length" class="hero-genres">
                <span v-for="g in movie.genres.slice(0,5)" :key="g" class="genre-chip">{{ g }}</span>
              </div>

              <!-- Ratings Pills -->
              <RatingPills
                :ratings="(movie as any).ratings"
                :imdb-id="movie.imdbId"
                :tmdb-id="movie.tmdbId"
                tmdb-type="movie"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- ── Action Bar ── -->
      <div class="detail-action-bar">
        <a v-if="tmdbTrailer" :href="`https://www.youtube.com/watch?v=${tmdbTrailer.key}`" target="_blank" rel="noopener" class="dab-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          <span>Trailer</span>
        </a>
        <button class="dab-btn" @click="showInteractive=true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><circle cx="11" cy="11" r="3"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span>Interaktiv</span>
        </button>
        <button class="dab-btn" :class="{'dab-ok':searchStatus==='ok','dab-err':searchStatus==='error'}" :disabled="isSearching" @click="triggerSearch">
          <svg v-if="isSearching" class="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span>{{ isSearching ? '…' : searchStatus==='ok' ? 'Gesucht ✓' : 'Suchen' }}</span>
        </button>
        <a v-if="plexUrl" :href="plexUrl" target="_blank" rel="noopener" class="dab-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span>Plex</span>
        </a>
        <button class="dab-btn" :class="{'dab-ok':refreshStatus==='ok'}" :disabled="isRefreshing" @click="rescanMovie">
          <svg :class="{spin:isRefreshing}" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.02-7.36"/></svg>
          <span>{{ refreshStatus==='ok' ? 'Fertig ✓' : 'Aktualisieren' }}</span>
        </button>
        <button class="dab-btn" :class="{'dab-active':movie.monitored}" :disabled="isMonitorToggling" @click="toggleMonitored">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span>{{ movie.monitored ? 'Überwacht' : 'Ignoriert' }}</span>
        </button>
        <div class="dab-sep" />
        <button class="dab-btn dab-danger" @click="showDeleteConfirm=true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          <span>Löschen</span>
        </button>
      </div>

      <!-- ── Tabs ── -->
      <div class="tabs-bar">
        <button v-for="tab in (['overview','files','bazarr','tautulli'] as const)" :key="tab"
          :class="['tab-btn',{active:activeTab===tab}]"
          @click="activeTab=tab; if(tab==='overview') loadTmdb(); if(tab==='bazarr') loadBazarr(); if(tab==='tautulli') loadTautulli()">
          {{ tab==='overview'?'Übersicht':tab==='files'?'Datei':tab==='bazarr'?'Untertitel':'Tautulli' }}
          <span v-if="tab==='bazarr'&&bazarr?.subtitles.length" class="tab-count">{{ bazarr.subtitles.length }}</span>
          <span v-if="tab==='tautulli'&&tPlayCount>0" class="tab-count">{{ tPlayCount }}</span>
        </button>
      </div>

      <!-- ── Tab: Übersicht ── -->
      <div v-if="activeTab==='overview'" class="tab-content">
        <div v-if="movie.overview" class="overview-wrap">
          <p class="overview-text" :class="{collapsed:!overviewExpanded}">{{ movie.overview }}</p>
          <button v-if="movie.overview.length>280" class="overview-toggle" @click="overviewExpanded=!overviewExpanded">{{ overviewExpanded?'Weniger':'Mehr anzeigen' }}</button>
        </div>

        <div class="details-grid">
          <div v-if="movie.inCinemas" class="di"><span class="dl">Kinostart</span><span class="dv">{{ fmtDate(movie.inCinemas) }}</span></div>
          <div v-if="(movie as any).digitalRelease" class="di"><span class="dl">Digital</span><span class="dv">{{ fmtDate((movie as any).digitalRelease) }}</span></div>
          <div v-if="(movie as any).physicalRelease" class="di"><span class="dl">Physisch</span><span class="dv">{{ fmtDate((movie as any).physicalRelease) }}</span></div>
          <div v-if="movie.added" class="di"><span class="dl">Hinzugefügt</span><span class="dv">{{ fmtDate(movie.added) }}</span></div>
          <div v-if="movie.status" class="di"><span class="dl">Status</span><span class="dv">{{ movie.status }}</span></div>
          <div v-if="(movie as any).studio" class="di"><span class="dl">Studio</span><span class="dv">{{ (movie as any).studio }}</span></div>
          <div v-if="(movie as any).popularity" class="di"><span class="dl">Popularität</span><span class="dv">{{ Math.round((movie as any).popularity) }}</span></div>
          <div v-if="(movie as any).sizeOnDisk" class="di"><span class="dl">Größe</span><span class="dv">{{ fmtBytes((movie as any).sizeOnDisk) }}</span></div>
          <div v-if="movie.imdbId" class="di"><span class="dl">IMDb</span><a :href="`https://www.imdb.com/title/${movie.imdbId}`" target="_blank" rel="noopener" class="dlink">{{ movie.imdbId }}</a></div>
          <div v-if="movie.tmdbId" class="di"><span class="dl">TMDb</span><a :href="`https://www.themoviedb.org/movie/${movie.tmdbId}`" target="_blank" rel="noopener" class="dlink">{{ movie.tmdbId }}</a></div>
          <div v-if="movie.path" class="di di-full"><span class="dl">Pfad</span><span class="dv dv-mono">{{ movie.path }}</span></div>
        </div>

        <div v-if="movie.genres?.length" class="tags-wrap">
          <span v-for="g in movie.genres" :key="g" class="tag">{{ g }}</span>
        </div>

        <div v-if="tmdbCredits?.crew.length" class="section-block">
          <h3 class="section-head">Crew</h3>
          <div class="crew-list">
            <div v-for="m in tmdbCredits.crew" :key="m.id+m.job" class="crew-row">
              <span class="crew-name">{{ m.name }}</span><span class="crew-job">{{ m.job }}</span>
            </div>
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

      <!-- ── Tab: Datei ── -->
      <div v-if="activeTab==='files'" class="tab-content">
        <div v-if="movie.movieFile">
          <div class="file-grid">
            <div v-if="qualityName" class="fi"><span class="fl">Qualität</span><span class="fv">{{ qualityName }}</span></div>
            <div v-if="(movie.movieFile.mediaInfo as any)?.resolution" class="fi"><span class="fl">Auflösung</span><span class="fv">{{ (movie.movieFile.mediaInfo as any).resolution }}</span></div>
            <div v-if="(movie.movieFile.mediaInfo as any)?.videoCodec" class="fi"><span class="fl">Video Codec</span><span class="fv">{{ (movie.movieFile.mediaInfo as any).videoCodec }}</span></div>
            <div v-if="(movie.movieFile.mediaInfo as any)?.videoDynamicRangeType" class="fi"><span class="fl">HDR</span><span class="fv">{{ (movie.movieFile.mediaInfo as any).videoDynamicRangeType }}</span></div>
            <div v-if="(movie.movieFile.mediaInfo as any)?.audioCodec" class="fi"><span class="fl">Audio Codec</span><span class="fv">{{ (movie.movieFile.mediaInfo as any).audioCodec }}</span></div>
            <div v-if="(movie.movieFile.mediaInfo as any)?.audioChannels" class="fi"><span class="fl">Audio Kanäle</span><span class="fv">{{ (movie.movieFile.mediaInfo as any).audioChannels }}</span></div>
            <div v-if="(movie.movieFile as any)?.languages?.length" class="fi"><span class="fl">Audiosprachen</span><span class="fv">{{ ((movie.movieFile as any).languages as Array<{name:string}>).map(l=>l.name).join(', ') }}</span></div>
            <div v-if="(movie.movieFile as any)?.releaseGroup" class="fi"><span class="fl">Release Group</span><span class="fv">{{ (movie.movieFile as any).releaseGroup }}</span></div>
            <div v-if="(movie.movieFile as any)?.size" class="fi"><span class="fl">Dateigröße</span><span class="fv">{{ fmtBytes((movie.movieFile as any).size) }}</span></div>
            <div v-if="(movie.movieFile as any)?.dateAdded" class="fi"><span class="fl">Hinzugefügt</span><span class="fv">{{ fmtDate((movie.movieFile as any).dateAdded) }}</span></div>
            <div v-if="(movie.movieFile as any)?.relativePath||(movie.movieFile as any)?.path" class="fi fi-full">
              <span class="fl">Dateiname</span>
              <span class="fv fv-mono">{{ (movie.movieFile as any).relativePath ?? (movie.movieFile as any).path }}</span>
            </div>
          </div>
        </div>
        <div v-else class="no-file">
          <p>Keine Datei vorhanden.</p>
          <button style="margin-top:12px" @click="triggerSearch">Jetzt suchen</button>
        </div>
      </div>

      <!-- ── Tab: Bazarr ── -->
      <div v-if="activeTab==='bazarr'" class="tab-content">
        <div v-if="bazarrLoading" class="bz-loading">
          <div class="skeleton" style="height:18px;width:55%;border-radius:6px"/>
          <div class="skeleton" style="height:18px;width:40%;border-radius:6px"/>
        </div>
        <div v-else-if="bazarrError" class="bz-error">{{ bazarrError }}</div>
        <template v-else-if="bazarr">
          <div class="bz-header">
            <div class="bz-stats">
              <span class="bz-stat bz-stat-ok">{{ bazarr.subtitles.length }} Untertitel</span>
              <span v-if="bazarr.missing_subtitles.length" class="bz-stat bz-stat-miss">{{ bazarr.missing_subtitles.length }} fehlend</span>
              <span v-if="!bazarr.missing_subtitles.length&&bazarr.subtitles.length" class="bz-stat bz-stat-full">✓ Vollständig</span>
              <span v-if="!bazarr.monitored" class="bz-stat bz-stat-warn">⚠ Nicht überwacht</span>
            </div>
            <div class="bz-actions">
              <button class="bz-btn" :disabled="bazarrSearching" @click="searchAllSubtitles">
                <svg v-if="bazarrSearching" class="spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                {{ bazarrSearchOk?'✓':bazarrSearching?'Sucht…':'Suchen' }}
              </button>
              <button class="bz-btn bz-detail-btn" @click="bazarrDetail=!bazarrDetail">{{ bazarrDetail?'Weniger':'Details' }}</button>
            </div>
          </div>
          <p v-if="bazarr.sceneName" class="bz-scene">{{ bazarr.sceneName }}</p>
          <div v-if="bazarr.audio_language.length" class="bz-row">
            <span class="bz-row-label">Audio</span>
            <div class="bz-badges">
              <span v-for="al in bazarr.audio_language" :key="al.code2" class="bz-badge bz-audio">{{ flagEmoji(al.code2) }} {{ al.name }}</span>
            </div>
          </div>
          <div v-if="bazarr.subtitles.length" class="bz-row">
            <span class="bz-row-label">Vorhanden</span>
            <div class="bz-badges">
              <span v-for="s in bazarr.subtitles" :key="s.code2+(s.forced?'-f':'')" class="bz-badge bz-sub">
                {{ flagEmoji(s.code2) }} {{ s.name }}
                <span v-if="s.forced" class="bz-tag">F</span>
                <span v-if="s.hi" class="bz-tag">HI</span>
              </span>
            </div>
          </div>
          <div v-if="bazarr.missing_subtitles.length" class="bz-row">
            <span class="bz-row-label">Fehlend</span>
            <div class="bz-badges">
              <span v-for="s in bazarr.missing_subtitles" :key="'m-'+s.code2" class="bz-badge bz-miss">
                ✗ {{ flagEmoji(s.code2) }} {{ s.name }}
                <span v-if="s.forced" class="bz-tag">F</span>
                <span v-if="s.hi" class="bz-tag">HI</span>
              </span>
            </div>
          </div>
          <div v-if="bazarrDetail" class="bz-details">
            <div v-for="s in bazarr.subtitles" :key="'d-'+s.code2" class="bz-detail-row">
              <span class="bz-di-icon">◆</span>
              <span class="bz-di-flag">{{ flagEmoji(s.code2) }}</span>
              <span class="bz-di-name">{{ s.name }}</span>
              <span v-if="s.forced" class="bz-di-tag">Forced</span>
              <span v-if="s.hi" class="bz-di-tag">HI</span>
              <span v-if="s.provider_name" class="bz-di-prov">{{ s.provider_name }}</span>
              <span v-if="s.file_size" class="bz-di-size">{{ (s.file_size/1024).toFixed(0) }}KB</span>
              <span v-if="s.path" class="bz-di-path">{{ s.path }}</span>
            </div>
          </div>
        </template>
        <div v-else class="bz-error">Bazarr-Daten werden geladen…</div>
      </div>

      <!-- ── Tab: Tautulli ── -->
      <div v-if="activeTab==='tautulli'" class="tab-content">
        <div v-if="tautulliLoading" class="tt-loading">
          <div class="skeleton" style="height:16px;width:60%;border-radius:6px"/>
          <div class="skeleton" style="height:80px;border-radius:8px;margin-top:12px"/>
        </div>
        <template v-else>
          <div class="tt-stats-bar">
            <template v-if="tPlayCount>0">
              <span class="tt-stat">{{ tPlayCount }} Wiedergabe{{ tPlayCount!==1?'n':'' }}</span>
              <span v-if="tTotalMin" class="tt-sep">·</span>
              <span v-if="tTotalMin" class="tt-stat">{{ tTotalMin }} gesamt</span>
              <span v-if="tLastWatched" class="tt-sep">·</span>
              <span v-if="tLastWatched" class="tt-stat">Zuletzt {{ fmtDate(tLastWatched.date ? new Date(tLastWatched.date*1000).toISOString() : '') }} · {{ tLastWatched.friendly_name }}</span>
            </template>
            <span v-else class="tt-stat tt-unwatched">Noch nicht angeschaut</span>
          </div>
          <div v-if="tautulliHistory.length===0" class="tt-empty">Keine Wiedergabe-History vorhanden.</div>
          <div v-else class="tt-table-wrap">
            <table class="tt-table">
              <thead><tr><th>Datum</th><th>Uhrzeit</th><th>Benutzer</th><th>App</th><th>Transcode</th><th>Pause</th><th>%</th></tr></thead>
              <tbody>
                <tr v-for="(h,i) in tautulliHistory" :key="i">
                  <td>{{ h.date?new Date(h.date*1000).toLocaleDateString('de-DE'):'' }}</td>
                  <td>{{ h.started?new Date(h.started*1000).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}):'' }}</td>
                  <td class="tt-user">
                    <img v-if="h.user_thumb" :src="h.user_thumb" class="tt-avatar" loading="lazy" :alt="h.friendly_name"/>
                    {{ h.friendly_name }}
                  </td>
                  <td>{{ h.product }}</td>
                  <td :style="{color:tcColor(h.transcode_decision)}">{{ h.transcode_decision }}</td>
                  <td>{{ h.paused_counter?`${Math.round(h.paused_counter/60)}m`:'' }}</td>
                  <td>
                    <div class="tt-prog">
                      <div class="tt-prog-bar" :style="{width:(h.percent_complete??0)+'%'}"/>
                      <span>{{ h.percent_complete ?? 0 }}%</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>

    </template>

    <!-- Modals -->
    <InteractiveSearchModal v-if="movie" v-model="showInteractive" source="radarr" :entityId="movie.id" :title="movie.title"/>
    <ConfirmDialog v-model="showDeleteConfirm" title="Film löschen?" :message="`'${movie?.title}' und alle Dateien unwiderruflich aus Radarr entfernen?`" confirm-label="Löschen" @confirm="confirmDelete"/>
  </div>
</template>

<style scoped>
.detail-view { min-height: 100%; }

.hero { position:relative; min-height:440px; display:flex; flex-direction:column; justify-content:flex-end; }
.hero-bg { position:absolute; inset:0; background-image:var(--fanart); background-size:cover; background-position:center top; z-index:0; }
.hero-gradient { position:absolute; inset:0; background:linear-gradient(to bottom, rgba(10,10,10,.15) 0%, rgba(10,10,10,.55) 45%, rgba(10,10,10,.97) 100%); z-index:1; }
.hero-content { position:relative; z-index:2; padding: var(--space-5) var(--space-6) var(--space-6); display:flex; flex-direction:column; gap:var(--space-4); }
.back-btn { display:inline-flex; align-items:center; gap:5px; color:var(--text-tertiary); font-size:var(--text-sm); transition:color .15s; align-self:flex-start; }
.back-btn:hover { color:var(--text-primary); }
.hero-main { display:flex; gap:var(--space-5); align-items:flex-end; }

.hero-poster-wrap { flex-shrink:0; }
.hero-poster { width:140px; min-width:140px; aspect-ratio:2/3; object-fit:cover; border-radius:var(--radius-lg); border:1px solid rgba(255,255,255,.1); box-shadow:0 12px 40px rgba(0,0,0,.6); }
.hero-ph { display:flex; align-items:center; justify-content:center; background:var(--bg-elevated); font-size:52px; font-weight:700; color:var(--text-muted); }

.hero-info { flex:1; display:flex; flex-direction:column; gap:var(--space-2); padding-bottom:var(--space-1); }
.app-bar { width:32px; height:3px; background:var(--radarr); border-radius:2px; margin-bottom:var(--space-1); }

.hero-top-badges { display:flex; gap:6px; flex-wrap:wrap; }
.htb { display:inline-flex; align-items:center; padding:3px 9px; border-radius:5px; font-size:10px; font-weight:700; white-space:nowrap; }
.htb-ok      { background:rgba(34,197,94,.12);  color:#22c55e;       border:1px solid rgba(34,197,94,.25); }
.htb-miss    { background:rgba(239,68,68,.12);  color:#ef4444;       border:1px solid rgba(239,68,68,.25); }
.htb-watch   { background:rgba(33,147,181,.12); color:var(--sonarr); border:1px solid rgba(33,147,181,.25); }
.htb-unwatch { background:var(--bg-elevated);   color:var(--text-muted); border:1px solid var(--bg-border); }
.htb-app     { background:rgba(244,165,74,.12); color:var(--radarr); border:1px solid rgba(244,165,74,.25); }

.hero-title { font-size:clamp(20px,3vw,32px); font-weight:700; color:var(--text-primary); line-height:1.2; margin:0; }

.hero-meta { display:flex; align-items:center; gap:6px; color:var(--text-tertiary); font-size:var(--text-sm); flex-wrap:wrap; }
.sep { color:var(--text-muted); }
.cert-badge { font-size:10px; font-weight:700; padding:1px 6px; background:rgba(244,165,74,.15); border:1px solid rgba(244,165,74,.3); border-radius:3px; color:var(--radarr); }
.tech-inline { font-size:var(--text-sm); font-weight:700; }

.hero-genres { display:flex; gap:6px; flex-wrap:wrap; }
.genre-chip { font-size:11px; padding:3px 10px; background:var(--bg-elevated); border:1px solid var(--bg-border); border-radius:99px; color:var(--text-muted); }

/* Action Bar */
.detail-action-bar { display:flex; align-items:center; gap:4px; flex-wrap:wrap; padding: var(--space-3) var(--space-6); background:rgba(0,0,0,.3); border-bottom:1px solid var(--bg-border); backdrop-filter:blur(8px); }
.dab-btn { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; border-radius:var(--radius-md); font-size:12px; font-weight:500; white-space:nowrap; cursor:pointer; background:var(--bg-elevated); border:1px solid rgba(255,255,255,.07); color:var(--text-tertiary); text-decoration:none; transition:all .15s; }
.dab-btn:hover:not(:disabled) { background:var(--bg-overlay); color:var(--text-primary); border-color:rgba(255,255,255,.14); }
.dab-btn:disabled { opacity:.45; cursor:not-allowed; }
.dab-btn.dab-active { color:var(--radarr); border-color:rgba(244,165,74,.3); background:rgba(244,165,74,.08); }
.dab-btn.dab-ok { color:#22c55e; }
.dab-btn.dab-err { color:#ef4444; }
.dab-btn.dab-danger:hover:not(:disabled) { color:#ef4444; border-color:rgba(239,68,68,.35); background:rgba(239,68,68,.08); }
.dab-sep { width:1px; height:18px; background:rgba(255,255,255,.08); margin:0 2px; flex-shrink:0; }

/* Tabs */
.tabs-bar { display:flex; border-bottom:1px solid var(--bg-border); padding:0 var(--space-6); background:var(--bg-surface); position:sticky; top:0; z-index:10; }
.tab-btn { display:flex; align-items:center; gap:6px; padding:var(--space-3) var(--space-5); font-size:var(--text-sm); color:var(--text-muted); border-bottom:2px solid transparent; transition:color .15s,border-color .15s; margin-bottom:-1px; cursor:pointer; }
.tab-btn:hover { color:var(--text-secondary); }
.tab-btn.active { color:var(--text-primary); border-bottom-color:var(--radarr); }
.tab-count { background:var(--radarr); color:#000; font-size:10px; font-weight:700; padding:1px 5px; border-radius:99px; }
.tab-content { padding:var(--space-6); max-width:900px; }

/* Overview */
.overview-wrap { margin-bottom:var(--space-6); }
.overview-text { color:var(--text-tertiary); line-height:1.75; font-size:var(--text-base); margin:0; }
.overview-text.collapsed { display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden; }
.overview-toggle { color:var(--radarr); font-size:var(--text-sm); cursor:pointer; margin-top:var(--space-2); background:none; border:none; padding:0; }
.details-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:var(--space-4); margin-bottom:var(--space-5); }
.di { display:flex; flex-direction:column; gap:3px; } .di-full { grid-column:1/-1; }
.dl { font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.06em; }
.dv { font-size:var(--text-sm); color:var(--text-secondary); } .dv-mono { font-family:monospace; font-size:var(--text-xs); word-break:break-all; }
.dlink { font-size:var(--text-sm); color:var(--tmdb); text-decoration:underline; }
.tags-wrap { display:flex; gap:var(--space-2); flex-wrap:wrap; margin-bottom:var(--space-6); }
.tag { font-size:11px; padding:3px 10px; background:var(--bg-elevated); border:1px solid var(--bg-border); border-radius:99px; color:var(--text-muted); }
.section-block { margin-top:var(--space-6); }
.section-head { font-size:var(--text-sm); font-weight:600; color:var(--text-secondary); border-left:3px solid var(--tmdb); padding-left:var(--space-3); margin-bottom:var(--space-4); }
.crew-list { display:flex; flex-direction:column; gap:var(--space-2); } .crew-row { display:flex; align-items:baseline; gap:var(--space-3); }
.crew-name { font-size:var(--text-sm); color:var(--text-secondary); font-weight:500; min-width:160px; } .crew-job { font-size:var(--text-xs); color:var(--text-muted); }
.cast-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(85px,1fr)); gap:var(--space-3); }
.cast-card { display:flex; flex-direction:column; gap:3px; }
.cast-photo { aspect-ratio:2/3; border-radius:var(--radius-md); overflow:hidden; background:var(--bg-elevated); border:1px solid var(--bg-border); }
.cast-photo img { width:100%; height:100%; object-fit:cover; }
.cast-ph { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:24px; font-weight:700; color:var(--text-muted); }
.cast-name { font-size:10px; color:var(--text-secondary); font-weight:600; line-height:1.3; margin:0; }
.cast-char { font-size:10px; color:var(--text-muted); line-height:1.3; margin:0; }

/* Datei */
.file-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:var(--space-4); }
.fi { display:flex; flex-direction:column; gap:3px; } .fi-full { grid-column:1/-1; }
.fl { font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.06em; }
.fv { font-size:var(--text-sm); color:var(--text-secondary); } .fv-mono { font-family:monospace; font-size:var(--text-xs); word-break:break-all; }
.no-file { color:var(--text-muted); font-size:var(--text-sm); padding:var(--space-4) 0; }

/* Bazarr */
.bz-loading,.bz-error { padding:var(--space-4) 0; display:flex; flex-direction:column; gap:var(--space-2); }
.bz-error { color:var(--text-muted); font-size:var(--text-sm); }
.bz-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:var(--space-4); flex-wrap:wrap; gap:var(--space-3); }
.bz-stats { display:flex; gap:var(--space-2); flex-wrap:wrap; }
.bz-stat { font-size:12px; font-weight:600; padding:3px 10px; border-radius:99px; }
.bz-stat-ok   { background:rgba(167,139,250,.12); color:var(--bazarr); border:1px solid rgba(167,139,250,.25); }
.bz-stat-miss { background:rgba(239,68,68,.1);    color:#ef4444;       border:1px dashed rgba(239,68,68,.25); }
.bz-stat-full { background:rgba(34,197,94,.1);    color:#22c55e;       border:1px solid rgba(34,197,94,.25); }
.bz-stat-warn { background:rgba(245,158,11,.1);   color:#f59e0b;       border:1px solid rgba(245,158,11,.25); }
.bz-actions { display:flex; gap:var(--space-2); }
.bz-btn { font-size:11px; font-weight:500; padding:4px 12px; border-radius:var(--radius-sm); cursor:pointer; transition:all .15s; display:inline-flex; align-items:center; gap:5px; background:rgba(167,139,250,.1); border:1px solid rgba(167,139,250,.25); color:var(--bazarr); }
.bz-btn:hover:not(:disabled) { background:rgba(167,139,250,.2); } .bz-btn:disabled { opacity:.6; cursor:not-allowed; }
.bz-detail-btn { background:var(--bg-elevated); border-color:var(--bg-border); color:var(--text-muted); }
.bz-detail-btn:hover { background:var(--bg-overlay); color:var(--text-secondary); }
.bz-scene { font-family:monospace; font-size:11px; color:var(--text-muted); background:var(--bg-elevated); padding:6px 10px; border-radius:var(--radius-sm); margin-bottom:var(--space-4); word-break:break-all; }
.bz-row { display:flex; align-items:flex-start; gap:var(--space-3); margin-bottom:var(--space-3); }
.bz-row-label { font-size:10px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.06em; min-width:64px; padding-top:4px; flex-shrink:0; }
.bz-badges { display:flex; gap:5px; flex-wrap:wrap; }
.bz-badge { display:inline-flex; align-items:center; gap:3px; font-size:11px; font-weight:500; padding:3px 8px; border-radius:99px; }
.bz-audio { background:rgba(53,197,244,.08);  color:var(--sonarr); border:1px solid rgba(53,197,244,.2); }
.bz-sub   { background:rgba(167,139,250,.1);  color:var(--bazarr); border:1px solid rgba(167,139,250,.25); }
.bz-miss  { background:rgba(239,68,68,.08);   color:#ef4444;       border:1px dashed rgba(239,68,68,.3); }
.bz-tag   { font-size:9px; font-weight:700; padding:0 4px; background:rgba(255,255,255,.1); border-radius:2px; }
.bz-details { margin-top:var(--space-4); border-top:1px solid var(--bg-border); padding-top:var(--space-4); display:flex; flex-direction:column; gap:var(--space-2); }
.bz-detail-row { display:flex; align-items:center; gap:var(--space-2); padding:6px var(--space-3); background:var(--bg-elevated); border:1px solid var(--bg-border); border-radius:var(--radius-md); font-size:11px; flex-wrap:wrap; }
.bz-di-icon { color:var(--bazarr); font-size:8px; flex-shrink:0; }
.bz-di-flag { font-size:13px; flex-shrink:0; }
.bz-di-name { color:var(--text-secondary); font-weight:500; }
.bz-di-tag  { font-size:9px; padding:1px 5px; background:rgba(167,139,250,.12); color:var(--bazarr); border:1px solid rgba(167,139,250,.25); border-radius:99px; }
.bz-di-prov { color:var(--text-muted); font-size:10px; }
.bz-di-size { color:var(--text-muted); font-size:10px; margin-left:auto; }
.bz-di-path { font-family:monospace; font-size:9px; color:var(--text-muted); word-break:break-all; width:100%; margin-top:2px; }

/* Tautulli */
.tt-loading { display:flex; flex-direction:column; gap:var(--space-2); }
.tt-stats-bar { display:flex; align-items:center; gap:var(--space-2); flex-wrap:wrap; padding:var(--space-3) var(--space-4); background:var(--bg-elevated); border:1px solid var(--bg-border); border-radius:var(--radius-md); margin-bottom:var(--space-4); font-size:var(--text-sm); }
.tt-stat { color:var(--text-secondary); } .tt-unwatched { color:var(--text-muted); font-style:italic; } .tt-sep { color:var(--text-muted); }
.tt-empty { color:var(--text-muted); font-size:var(--text-sm); font-style:italic; }
.tt-table-wrap { overflow-x:auto; border:1px solid var(--bg-border); border-radius:var(--radius-lg); }
.tt-table { width:100%; border-collapse:collapse; font-size:12px; }
.tt-table th { padding:8px 12px; color:var(--text-muted); font-weight:500; font-size:10px; text-transform:uppercase; letter-spacing:.06em; text-align:left; border-bottom:1px solid var(--bg-border); background:var(--bg-surface); white-space:nowrap; }
.tt-table td { padding:8px 12px; color:var(--text-secondary); border-bottom:1px solid rgba(255,255,255,.03); vertical-align:middle; white-space:nowrap; }
.tt-table tr:last-child td { border-bottom:none; }
.tt-table tr:hover td { background:var(--bg-elevated); }
.tt-user { display:flex; align-items:center; gap:6px; }
.tt-avatar { width:18px; height:18px; border-radius:50%; object-fit:cover; }
.tt-prog { display:flex; align-items:center; gap:6px; }
.tt-prog-bar { height:4px; background:var(--tautulli); border-radius:2px; flex-shrink:0; }
.tt-prog span { font-size:10px; color:var(--text-muted); }

/* Misc */
.detail-loading { display:flex; flex-direction:column; }
.skeleton-hero { height:440px; width:100%; border-radius:0; }
.detail-body { padding:var(--space-6); display:flex; flex-direction:column; gap:var(--space-3); }
.empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:60vh; gap:var(--space-4); }
.empty-title { font-size:var(--text-lg); color:var(--text-secondary); font-weight:600; }
@keyframes spin { to { transform:rotate(360deg); } }
.spin { animation:spin .8s linear infinite; }
</style>
