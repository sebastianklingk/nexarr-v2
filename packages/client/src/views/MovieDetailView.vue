<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMoviesStore } from '../stores/movies.store.js';
import { useApi } from '../composables/useApi.js';
import type { RadarrMovie, BazarrSubtitle, TMDBCredits, TMDBVideo } from '@nexarr/shared';

const route  = useRoute();
const router = useRouter();
const store  = useMoviesStore();
const { post } = useApi();

const movie     = ref<RadarrMovie | null>(null);
const isLoading = ref(true);
const activeTab = ref<'overview'|'files'|'subtitles'>('overview');
const overviewExpanded = ref(false);

// ── Actions ───────────────────────────────────────────────────────────────────
const isSearching  = ref(false);
const searchStatus = ref<'idle'|'ok'|'error'>('idle');

async function triggerSearch() {
  if (!movie.value || isSearching.value) return;
  isSearching.value = true; searchStatus.value = 'idle';
  try { await post(`/api/radarr/movies/${movie.value.id}/search`); searchStatus.value = 'ok'; }
  catch { searchStatus.value = 'error'; }
  finally { isSearching.value = false; setTimeout(() => { searchStatus.value = 'idle'; }, 3000); }
}

// ── Bazarr ────────────────────────────────────────────────────────────────────
const subtitles        = ref<{ available: BazarrSubtitle[]; missing: BazarrSubtitle[]; monitored: boolean }|null>(null);
const subtitlesLoading = ref(false);
const searchingLang    = ref<string|null>(null);
const subStatus        = ref<Record<string, 'ok'|'error'>>({});

async function loadSubtitles() {
  if (!movie.value || subtitles.value !== null) return;
  subtitlesLoading.value = true;
  try {
    const res = await fetch(`/api/bazarr/movies/${movie.value.id}/subtitles`, { credentials: 'include' });
    subtitles.value = res.status === 503 ? { available: [], missing: [], monitored: false } : await res.json();
  } catch { subtitles.value = { available: [], missing: [], monitored: false }; }
  finally  { subtitlesLoading.value = false; }
}

async function searchSubtitle(lang: string) {
  if (!movie.value || searchingLang.value) return;
  searchingLang.value = lang;
  try {
    await post(`/api/bazarr/movies/${movie.value.id}/subtitles/search`, { language: lang });
    subStatus.value[lang] = 'ok';
    subtitles.value = null;
    setTimeout(() => loadSubtitles(), 1500);
  } catch { subStatus.value[lang] = 'error'; }
  finally { searchingLang.value = null; setTimeout(() => { delete subStatus.value[lang]; }, 3000); }
}

async function deleteSubtitle(lang: string, path: string) {
  if (!movie.value) return;
  await fetch(`/api/bazarr/movies/${movie.value.id}/subtitles?language=${encodeURIComponent(lang)}&path=${encodeURIComponent(path)}`, { method: 'DELETE', credentials: 'include' });
  subtitles.value = null;
  await loadSubtitles();
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
      tmdbTrailer.value = vd.results.find((v: TMDBVideo) => v.type === 'Trailer' && v.official)
        ?? vd.results.find((v: TMDBVideo) => v.type === 'Trailer')
        ?? vd.results.find((v: TMDBVideo) => v.type === 'Teaser')
        ?? null;
    }
  } catch { /* optional */ }
  finally { tmdbLoading.value = false; }
}

// ── Plex ──────────────────────────────────────────────────────────────────────
const plexUrl = computed(() => movie.value ? `https://app.plex.tv/desktop#!/search?query=${encodeURIComponent(movie.value.title)}` : null);

// ── Computed ──────────────────────────────────────────────────────────────────
const movieId   = computed(() => Number(route.params.id));
const fanartUrl = computed(() => movie.value?.images?.find(i => i.coverType === 'fanart')?.remoteUrl);
const posterUrl = computed(() => movie.value?.images?.find(i => i.coverType === 'poster')?.remoteUrl);

function fmtRuntime(m?: number): string {
  if (!m) return ''; const h = Math.floor(m/60); const min = m%60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}
function fmtBytes(b?: number): string {
  if (!b) return ''; const g = b/1024/1024/1024;
  return g >= 1 ? `${g.toFixed(2)} GB` : `${(b/1024/1024).toFixed(0)} MB`;
}
function fmtDate(iso?: string): string {
  if (!iso) return ''; return new Date(iso).toLocaleDateString('de-DE');
}
function flagEmoji(c: string): string {
  const m: Record<string,string> = { de:'🇩🇪',en:'🇬🇧',fr:'🇫🇷',es:'🇪🇸',it:'🇮🇹',nl:'🇳🇱',pt:'🇵🇹',pl:'🇵🇱',ru:'🇷🇺',ja:'🇯🇵',ko:'🇰🇷',zh:'🇨🇳',ar:'🇸🇦',tr:'🇹🇷',sv:'🇸🇪',da:'🇩🇰',fi:'🇫🇮',nb:'🇳🇴',cs:'🇨🇿',hu:'🇭🇺' };
  return m[c] ?? '🏳️';
}

// Tech-Badges aus mediaInfo
const techBadges = computed(() => {
  const mi = movie.value?.movieFile?.mediaInfo;
  if (!mi) return [];
  const badges: Array<{ label: string; color: string }> = [];
  const res = (mi.resolution ?? '').toLowerCase();
  if (res.includes('3840')||res.includes('2160')) badges.push({ label: '4K', color: '#35c5f4' });
  else if (res.includes('1920')||res.includes('1080')) badges.push({ label: '1080p', color: '#35c5f4' });
  else if (res.includes('720')) badges.push({ label: '720p', color: '#888' });
  const hdr = (mi.videoDynamicRangeType ?? '').toUpperCase();
  if (hdr.includes('DOLBY')||hdr==='DV') badges.push({ label: 'DV', color: '#bb86fc' });
  else if (hdr.includes('HDR')) badges.push({ label: 'HDR', color: '#f5c518' });
  const vc = (mi.videoCodec ?? '').toLowerCase();
  if (vc.includes('h265')||vc.includes('hevc')) badges.push({ label: 'H.265', color: '#aaa' });
  else if (vc.includes('h264')||vc.includes('avc')) badges.push({ label: 'H.264', color: '#aaa' });
  const ac = (mi.audioCodec ?? '').toUpperCase();
  if (ac.includes('ATMOS')) badges.push({ label: 'Atmos', color: '#22c65b' });
  else if (ac.includes('TRUEHD')) badges.push({ label: 'TrueHD', color: '#22c65b' });
  else if (ac.includes('EAC3')||ac.includes('DDP')) badges.push({ label: 'DD+', color: '#aaa' });
  else if (ac.includes('DTS')) badges.push({ label: 'DTS', color: '#aaa' });
  const ch = parseFloat(String(mi.audioChannels??0));
  if (ch===7.1) badges.push({ label: '7.1', color: '#555' });
  else if (ch===5.1) badges.push({ label: '5.1', color: '#555' });
  return badges;
});

const qualityName = computed(() => movie.value?.movieFile?.quality?.quality?.name ?? '');

onMounted(async () => {
  if (store.movies.length === 0) await store.fetchMovies();
  movie.value = await store.fetchMovie(movieId.value);
  isLoading.value = false;
  loadTmdb();
});
</script>

<template>
  <div class="detail-view">

    <!-- Loading -->
    <div v-if="isLoading" class="detail-loading">
      <div class="skeleton skeleton-hero" />
      <div class="detail-body">
        <div class="skeleton" style="height:36px;width:50%;border-radius:8px" />
        <div class="skeleton" style="height:18px;width:30%;border-radius:6px;margin-top:8px" />
      </div>
    </div>

    <div v-else-if="!movie" class="empty-state">
      <p class="empty-title">Film nicht gefunden</p>
      <button class="back-btn" @click="router.back()">← Zurück</button>
    </div>

    <template v-else>

      <!-- ── Hero ── -->
      <div class="hero" :style="fanartUrl ? `--fanart: url('${fanartUrl}')` : ''">
        <div class="hero-bg" />
        <div class="hero-gradient" />
        <div class="hero-content">

          <button class="back-btn" @click="router.back()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Filme
          </button>

          <div class="hero-main">
            <!-- Poster -->
            <img v-if="posterUrl" :src="posterUrl" :alt="movie.title" class="hero-poster" />
            <div v-else class="hero-poster hero-ph">{{ movie.title[0] }}</div>

            <!-- Info -->
            <div class="hero-info">
              <div class="app-bar" />

              <h1 class="hero-title">{{ movie.title }}</h1>

              <!-- Meta row -->
              <div class="hero-meta">
                <span v-if="movie.year">{{ movie.year }}</span>
                <span v-if="movie.runtime" class="sep">·</span>
                <span v-if="movie.runtime">{{ fmtRuntime(movie.runtime) }}</span>
                <span v-if="movie.genres?.length" class="sep">·</span>
                <span v-if="movie.genres?.length">{{ movie.genres.slice(0,3).join(', ') }}</span>
              </div>

              <!-- Tech Badges -->
              <div v-if="techBadges.length" class="tech-badges">
                <span v-for="b in techBadges" :key="b.label" class="tech-badge" :style="{ color: b.color, borderColor: b.color+'44' }">{{ b.label }}</span>
              </div>

              <!-- Ratings -->
              <div class="hero-ratings">
                <div v-if="movie.ratings?.imdb?.value" class="r-chip r-imdb">
                  <span class="r-src">IMDb</span>
                  <span class="r-val">{{ movie.ratings.imdb.value.toFixed(1) }}</span>
                  <span v-if="movie.ratings.imdb.votes" class="r-votes">{{ (movie.ratings.imdb.votes/1000).toFixed(0) }}k</span>
                </div>
                <div v-if="movie.ratings?.tmdb?.value" class="r-chip r-tmdb">
                  <span class="r-src">TMDb</span>
                  <span class="r-val">{{ (movie.ratings.tmdb.value * 10).toFixed(0) }}%</span>
                </div>
                <div v-if="movie.ratings?.rottenTomatoes?.value" class="r-chip r-rt">
                  <span class="r-src">RT</span>
                  <span class="r-val">{{ movie.ratings.rottenTomatoes.value }}%</span>
                </div>
              </div>

              <!-- Actions -->
              <div class="hero-actions">
                <a v-if="tmdbTrailer" :href="`https://www.youtube.com/watch?v=${tmdbTrailer.key}`" target="_blank" rel="noopener" class="act-btn act-trailer">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Trailer
                </a>
                <a v-if="plexUrl" :href="plexUrl" target="_blank" rel="noopener" class="act-btn act-plex">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8l7 4-7 4z"/></svg> In Plex
                </a>
                <button class="act-btn act-search"
                  :class="{ 'act-ok': searchStatus==='ok', 'act-err': searchStatus==='error' }"
                  :disabled="isSearching" @click="triggerSearch">
                  <svg v-if="isSearching" class="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  {{ isSearching ? 'Suche…' : searchStatus==='ok' ? 'Gestartet!' : searchStatus==='error' ? 'Fehler' : 'Jetzt suchen' }}
                </button>
              </div>

              <!-- Status Badges -->
              <div class="hero-badges">
                <span :class="['badge', movie.hasFile ? 'badge-ok' : 'badge-miss']">{{ movie.hasFile ? '✓ Vorhanden' : '✗ Fehlt' }}</span>
                <span v-if="!movie.monitored" class="badge badge-off">Nicht überwacht</span>
                <span v-if="qualityName" class="badge badge-qual">{{ qualityName }}</span>
                <span v-if="movie.movieFile" class="badge badge-size">{{ fmtBytes(movie.movieFile.size) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Tabs ── -->
      <div class="tabs-bar">
        <button v-for="tab in (['overview','files','subtitles'] as const)" :key="tab"
          :class="['tab-btn', { active: activeTab===tab }]"
          @click="activeTab=tab; if(tab==='subtitles') loadSubtitles(); if(tab==='overview') loadTmdb()">
          {{ tab==='overview' ? 'Übersicht' : tab==='files' ? 'Datei' : 'Untertitel' }}
          <span v-if="tab==='subtitles' && subtitles?.available.length" class="tab-count">{{ subtitles.available.length }}</span>
        </button>
      </div>

      <!-- ── Tab: Übersicht ── -->
      <div v-if="activeTab==='overview'" class="tab-content">

        <!-- Overview -->
        <div v-if="movie.overview" class="overview-wrap">
          <p class="overview-text" :class="{ collapsed: !overviewExpanded }">{{ movie.overview }}</p>
          <button v-if="movie.overview.length > 300" class="overview-toggle" @click="overviewExpanded = !overviewExpanded">
            {{ overviewExpanded ? 'Weniger anzeigen' : 'Mehr anzeigen' }}
          </button>
        </div>

        <!-- Details Grid -->
        <div class="details-grid">
          <div v-if="movie.inCinemas" class="di"><span class="dl">Kinostart</span><span class="dv">{{ fmtDate(movie.inCinemas) }}</span></div>
          <div v-if="movie.digitalRelease" class="di"><span class="dl">Digital</span><span class="dv">{{ fmtDate(movie.digitalRelease) }}</span></div>
          <div v-if="movie.physicalRelease" class="di"><span class="dl">Physisch</span><span class="dv">{{ fmtDate(movie.physicalRelease) }}</span></div>
          <div v-if="movie.added" class="di"><span class="dl">Hinzugefügt</span><span class="dv">{{ fmtDate(movie.added) }}</span></div>
          <div v-if="movie.runtime" class="di"><span class="dl">Laufzeit</span><span class="dv">{{ fmtRuntime(movie.runtime) }}</span></div>
          <div v-if="movie.imdbId" class="di"><span class="dl">IMDb</span><a :href="`https://www.imdb.com/title/${movie.imdbId}`" target="_blank" rel="noopener" class="dlink">{{ movie.imdbId }}</a></div>
          <div v-if="movie.tmdbId" class="di"><span class="dl">TMDb ID</span><a :href="`https://www.themoviedb.org/movie/${movie.tmdbId}`" target="_blank" rel="noopener" class="dlink">{{ movie.tmdbId }}</a></div>
          <div v-if="movie.status" class="di"><span class="dl">Status</span><span class="dv">{{ movie.status }}</span></div>
          <div v-if="(movie as any).originalLanguage" class="di"><span class="dl">Originalsprache</span><span class="dv">{{ (movie as any).originalLanguage }}</span></div>
          <div v-if="movie.originalTitle && movie.originalTitle !== movie.title" class="di"><span class="dl">Originaltitel</span><span class="dv">{{ movie.originalTitle }}</span></div>
        </div>

        <!-- Genres -->
        <div v-if="movie.genres?.length" class="tags-wrap">
          <span v-for="g in movie.genres" :key="g" class="tag">{{ g }}</span>
        </div>

        <!-- Crew -->
        <div v-if="tmdbCredits?.crew.length" class="section-block">
          <h3 class="section-head">Crew</h3>
          <div class="crew-list">
            <div v-for="m in tmdbCredits.crew" :key="m.id+m.job" class="crew-row">
              <span class="crew-name">{{ m.name }}</span>
              <span class="crew-job">{{ m.job }}</span>
            </div>
          </div>
        </div>

        <!-- Cast -->
        <div v-if="tmdbCredits?.cast.length" class="section-block">
          <h3 class="section-head">Besetzung</h3>
          <div class="cast-grid">
            <div v-for="a in tmdbCredits.cast" :key="a.id" class="cast-card">
              <div class="cast-photo">
                <img v-if="a.profile_path" :src="`https://image.tmdb.org/t/p/w185${a.profile_path}`" :alt="a.name" loading="lazy" />
                <div v-else class="cast-ph">{{ a.name[0] }}</div>
              </div>
              <p class="cast-name">{{ a.name }}</p>
              <p class="cast-char">{{ a.character }}</p>
            </div>
          </div>
        </div>

        <div v-if="tmdbLoading" class="cast-grid cast-skel">
          <div v-for="i in 8" :key="i" class="skeleton" style="aspect-ratio:2/3;border-radius:8px" />
        </div>
      </div>

      <!-- ── Tab: Datei ── -->
      <div v-if="activeTab==='files'" class="tab-content">
        <div v-if="movie.movieFile">

          <!-- Tech Badges groß -->
          <div class="file-tech-row">
            <span v-for="b in techBadges" :key="b.label" class="ftech" :style="{ color: b.color, borderColor: b.color+'55', background: b.color+'11' }">{{ b.label }}</span>
          </div>

          <!-- Details Grid -->
          <div class="file-grid">
            <div class="fi"><span class="fl">Qualität</span><span class="fv">{{ movie.movieFile.quality?.quality?.name }}</span></div>
            <div v-if="movie.movieFile.mediaInfo?.resolution" class="fi"><span class="fl">Auflösung</span><span class="fv">{{ movie.movieFile.mediaInfo.resolution }}</span></div>
            <div v-if="movie.movieFile.mediaInfo?.videoCodec" class="fi"><span class="fl">Video Codec</span><span class="fv">{{ movie.movieFile.mediaInfo.videoCodec }}</span></div>
            <div v-if="movie.movieFile.mediaInfo?.videoDynamicRangeType" class="fi"><span class="fl">HDR</span><span class="fv">{{ movie.movieFile.mediaInfo.videoDynamicRangeType }}</span></div>
            <div v-if="movie.movieFile.mediaInfo?.audioCodec" class="fi"><span class="fl">Audio Codec</span><span class="fv">{{ movie.movieFile.mediaInfo.audioCodec }}</span></div>
            <div v-if="movie.movieFile.mediaInfo?.audioChannels" class="fi"><span class="fl">Audio Kanäle</span><span class="fv">{{ movie.movieFile.mediaInfo.audioChannels }}</span></div>
            <div v-if="movie.movieFile.size" class="fi"><span class="fl">Dateigröße</span><span class="fv">{{ fmtBytes(movie.movieFile.size) }}</span></div>
            <div v-if="(movie.movieFile as any).relativePath || (movie.movieFile as any).path" class="fi fi-full">
              <span class="fl">Dateipfad</span>
              <span class="fv fv-mono">{{ (movie.movieFile as any).relativePath ?? (movie.movieFile as any).path }}</span>
            </div>
          </div>
        </div>
        <div v-else class="no-file">
          <p>Keine Datei vorhanden.</p>
          <button class="act-btn act-search" style="margin-top:var(--space-3)" @click="triggerSearch">Jetzt suchen</button>
        </div>
      </div>

      <!-- ── Tab: Untertitel ── -->
      <div v-if="activeTab==='subtitles'" class="tab-content">
        <div v-if="subtitlesLoading" class="subs-loading">
          <div class="skeleton" style="height:20px;width:60%;border-radius:6px" />
          <div class="skeleton" style="height:20px;width:40%;border-radius:6px;margin-top:8px" />
        </div>
        <template v-else-if="subtitles">
          <div v-if="subtitles.available.length" class="subs-section">
            <h3 class="subs-head">Vorhanden <span class="subs-count">{{ subtitles.available.length }}</span></h3>
            <div class="subs-list">
              <div v-for="s in subtitles.available" :key="s.code2+(s.forced?'-f':'')" class="sub-row">
                <span class="sub-flag">{{ flagEmoji(s.code2) }}</span>
                <span class="sub-name">{{ s.name }}</span>
                <span v-if="s.forced" class="sub-tag">Forced</span>
                <span v-if="s.hi" class="sub-tag">HI</span>
                <span v-if="s.format" class="sub-fmt">.{{ s.format }}</span>
                <button v-if="s.path" class="sub-del" title="Löschen" @click="deleteSubtitle(s.code2, s.path!)">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                </button>
              </div>
            </div>
          </div>

          <div v-if="subtitles.missing.length" class="subs-section subs-miss">
            <h3 class="subs-head subs-head-miss">Fehlend <span class="subs-count">{{ subtitles.missing.length }}</span></h3>
            <div class="subs-list">
              <div v-for="s in subtitles.missing" :key="'m-'+s.code2" class="sub-row">
                <span class="sub-flag">{{ flagEmoji(s.code2) }}</span>
                <span class="sub-name">{{ s.name }}</span>
                <span v-if="s.forced" class="sub-tag">Forced</span>
                <span v-if="s.hi" class="sub-tag">HI</span>
                <button class="sub-search-btn"
                  :disabled="searchingLang===s.code2"
                  :class="{ 'ss-ok': subStatus[s.code2]==='ok', 'ss-err': subStatus[s.code2]==='error' }"
                  @click="searchSubtitle(s.code2)">
                  <svg v-if="searchingLang===s.code2" class="spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  {{ searchingLang===s.code2 ? 'Suche…' : subStatus[s.code2]==='ok' ? '✓' : 'Suchen' }}
                </button>
              </div>
            </div>
          </div>

          <p v-if="!subtitles.monitored" class="sub-warn">⚠ Film ist in Bazarr nicht überwacht</p>
          <p v-if="!subtitles.available.length && !subtitles.missing.length" class="sub-empty">Bazarr nicht konfiguriert oder Film unbekannt</p>
        </template>
      </div>

    </template>
  </div>
</template>

<style scoped>
.detail-view { min-height: 100%; }

/* Hero */
.hero { position: relative; min-height: 440px; display: flex; flex-direction: column; justify-content: flex-end; }
.hero-bg { position: absolute; inset: 0; background-image: var(--fanart); background-size: cover; background-position: center top; z-index: 0; }
.hero-gradient { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(10,10,10,.15) 0%, rgba(10,10,10,.55) 45%, rgba(10,10,10,.97) 100%); z-index: 1; }
.hero-content { position: relative; z-index: 2; padding: var(--space-5) var(--space-6) var(--space-6); display: flex; flex-direction: column; gap: var(--space-4); }
.back-btn { display: inline-flex; align-items: center; gap: 5px; color: var(--text-tertiary); font-size: var(--text-sm); transition: color .15s; align-self: flex-start; }
.back-btn:hover { color: var(--text-primary); }
.hero-main { display: flex; gap: var(--space-6); align-items: flex-end; }
.hero-poster { width: 130px; min-width: 130px; aspect-ratio: 2/3; object-fit: cover; border-radius: var(--radius-lg); border: 1px solid rgba(255,255,255,.1); box-shadow: 0 12px 40px rgba(0,0,0,.6); flex-shrink: 0; }
.hero-ph { display: flex; align-items: center; justify-content: center; background: var(--bg-elevated); font-size: 52px; font-weight: 700; color: var(--text-muted); }
.hero-info { flex: 1; display: flex; flex-direction: column; gap: var(--space-3); padding-bottom: var(--space-1); }
.app-bar { width: 32px; height: 3px; background: var(--radarr); border-radius: 2px; }
.hero-title { font-size: clamp(20px, 3vw, 32px); font-weight: 700; color: var(--text-primary); line-height: 1.2; margin: 0; }
.hero-meta { display: flex; align-items: center; gap: var(--space-2); color: var(--text-tertiary); font-size: var(--text-sm); flex-wrap: wrap; }
.sep { color: var(--text-muted); }

/* Tech Badges */
.tech-badges { display: flex; gap: 5px; flex-wrap: wrap; }
.tech-badge { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 4px; border: 1px solid; letter-spacing: .03em; }

/* Ratings */
.hero-ratings { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.r-chip { display: flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: var(--radius-sm); font-size: var(--text-xs); font-weight: 600; border: 1px solid; }
.r-imdb { background: rgba(245,197,24,.1); border-color: rgba(245,197,24,.3); }
.r-tmdb { background: rgba(1,180,228,.1); border-color: rgba(1,180,228,.3); }
.r-rt   { background: rgba(250,60,60,.1); border-color: rgba(250,60,60,.3); }
.r-src  { color: var(--text-muted); font-weight: 400; }
.r-val  { color: var(--text-primary); }
.r-votes { color: var(--text-muted); font-size: 10px; }

/* Actions */
.hero-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.act-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: 500; cursor: pointer; transition: all .15s; white-space: nowrap; }
.act-btn:disabled { opacity: .6; cursor: not-allowed; }
.act-trailer { background: rgba(255,0,0,.1); border: 1px solid rgba(255,0,0,.25); color: var(--text-secondary); text-decoration: none; }
.act-trailer:hover { background: rgba(255,0,0,.2); color: var(--text-primary); }
.act-plex { background: rgba(229,160,13,.1); border: 1px solid rgba(229,160,13,.25); color: var(--text-secondary); text-decoration: none; }
.act-plex:hover { background: rgba(229,160,13,.2); color: var(--text-primary); }
.act-search { background: rgba(244,165,74,.12); border: 1px solid rgba(244,165,74,.3); color: var(--text-secondary); }
.act-search:not(:disabled):hover { background: rgba(244,165,74,.22); color: var(--text-primary); }
.act-ok  { background: rgba(34,197,94,.15); border-color: rgba(34,197,94,.35); }
.act-err { background: rgba(248,113,113,.15); border-color: rgba(248,113,113,.35); }

/* Badges */
.hero-badges { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.badge { padding: 2px 10px; border-radius: 99px; font-size: var(--text-xs); font-weight: 500; }
.badge-ok   { background: rgba(34,197,94,.12); color: #22c55e; border: 1px solid rgba(34,197,94,.25); }
.badge-miss { background: rgba(239,68,68,.12); color: #ef4444; border: 1px solid rgba(239,68,68,.25); }
.badge-off  { background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--bg-border); }
.badge-qual { background: rgba(244,165,74,.12); color: var(--radarr); border: 1px solid rgba(244,165,74,.25); }
.badge-size { background: var(--bg-elevated); color: var(--text-tertiary); border: 1px solid var(--bg-border); }

/* Tabs */
.tabs-bar { display: flex; border-bottom: 1px solid var(--bg-border); padding: 0 var(--space-6); background: var(--bg-surface); position: sticky; top: 0; z-index: 10; }
.tab-btn { display: flex; align-items: center; gap: 6px; padding: var(--space-3) var(--space-5); font-size: var(--text-sm); color: var(--text-muted); border-bottom: 2px solid transparent; transition: color .15s, border-color .15s; margin-bottom: -1px; cursor: pointer; }
.tab-btn:hover { color: var(--text-secondary); }
.tab-btn.active { color: var(--text-primary); border-bottom-color: var(--radarr); }
.tab-count { background: var(--radarr); color: #000; font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 99px; }

/* Tab Content */
.tab-content { padding: var(--space-6); max-width: 900px; }

/* Overview */
.overview-wrap { margin-bottom: var(--space-6); }
.overview-text { color: var(--text-tertiary); line-height: 1.75; font-size: var(--text-base); }
.overview-text.collapsed { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.overview-toggle { color: var(--radarr); font-size: var(--text-sm); cursor: pointer; margin-top: var(--space-2); background: none; border: none; padding: 0; }

/* Details Grid */
.details-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-5); }
.di { display: flex; flex-direction: column; gap: 3px; }
.dl { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .06em; }
.dv { font-size: var(--text-sm); color: var(--text-secondary); }
.dlink { font-size: var(--text-sm); color: var(--tmdb); text-decoration: underline; }

/* Tags */
.tags-wrap { display: flex; gap: var(--space-2); flex-wrap: wrap; margin-bottom: var(--space-6); }
.tag { font-size: 11px; padding: 3px 10px; background: var(--bg-elevated); border: 1px solid var(--bg-border); border-radius: 99px; color: var(--text-muted); }

/* Section Block */
.section-block { margin-top: var(--space-6); }
.section-head { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); border-left: 3px solid var(--tmdb); padding-left: var(--space-3); margin-bottom: var(--space-4); }

/* Crew */
.crew-list { display: flex; flex-direction: column; gap: var(--space-2); }
.crew-row  { display: flex; align-items: baseline; gap: var(--space-3); }
.crew-name { font-size: var(--text-sm); color: var(--text-secondary); font-weight: 500; min-width: 160px; }
.crew-job  { font-size: var(--text-xs); color: var(--text-muted); }

/* Cast */
.cast-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(85px, 1fr)); gap: var(--space-3); }
.cast-card { display: flex; flex-direction: column; gap: 3px; }
.cast-photo { aspect-ratio: 2/3; border-radius: var(--radius-md); overflow: hidden; background: var(--bg-elevated); border: 1px solid var(--bg-border); }
.cast-photo img { width: 100%; height: 100%; object-fit: cover; }
.cast-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; color: var(--text-muted); }
.cast-name { font-size: 10px; color: var(--text-secondary); font-weight: 600; line-height: 1.3; }
.cast-char { font-size: 10px; color: var(--text-muted); line-height: 1.3; }

/* File Tab */
.file-tech-row { display: flex; gap: var(--space-2); flex-wrap: wrap; margin-bottom: var(--space-5); }
.ftech { font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: var(--radius-md); border: 1px solid; }
.file-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--space-4); }
.fi { display: flex; flex-direction: column; gap: 3px; }
.fi-full { grid-column: 1/-1; }
.fl { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .06em; }
.fv { font-size: var(--text-sm); color: var(--text-secondary); }
.fv-mono { font-family: monospace; font-size: var(--text-xs); word-break: break-all; }
.no-file { color: var(--text-muted); font-size: var(--text-sm); padding: var(--space-4) 0; }

/* Subtitles */
.subs-loading { display: flex; flex-direction: column; gap: var(--space-2); padding: var(--space-4) 0; }
.subs-section { margin-bottom: var(--space-5); }
.subs-miss { border-top: 1px solid var(--bg-border); padding-top: var(--space-4); }
.subs-head { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); border-left: 3px solid var(--bazarr); padding-left: var(--space-3); margin-bottom: var(--space-3); display: flex; align-items: center; gap: var(--space-2); }
.subs-head-miss { border-left-color: #f59e0b; }
.subs-count { background: var(--bg-elevated); color: var(--text-muted); font-size: 10px; padding: 1px 6px; border-radius: 99px; border: 1px solid var(--bg-border); }
.subs-list { display: flex; flex-direction: column; gap: var(--space-2); }
.sub-row { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: var(--bg-elevated); border: 1px solid var(--bg-border); border-radius: var(--radius-md); }
.sub-flag { font-size: 15px; flex-shrink: 0; }
.sub-name { font-size: var(--text-sm); color: var(--text-secondary); font-weight: 500; flex: 1; }
.sub-fmt  { font-size: 10px; color: var(--text-muted); font-family: monospace; }
.sub-tag  { font-size: 10px; font-weight: 600; padding: 1px 5px; background: rgba(167,139,250,.12); color: var(--bazarr); border: 1px solid rgba(167,139,250,.25); border-radius: 99px; }
.sub-del  { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 3px; border-radius: var(--radius-sm); display: flex; align-items: center; transition: color .15s; }
.sub-del:hover { color: #ef4444; }
.sub-search-btn { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; font-size: 11px; font-weight: 500; background: rgba(167,139,250,.1); border: 1px solid rgba(167,139,250,.25); color: var(--bazarr); border-radius: var(--radius-sm); cursor: pointer; transition: all .15s; flex-shrink: 0; }
.sub-search-btn:hover:not(:disabled) { background: rgba(167,139,250,.2); }
.sub-search-btn:disabled { opacity: .6; cursor: not-allowed; }
.ss-ok  { background: rgba(34,197,94,.12); border-color: rgba(34,197,94,.3); color: #22c55e; }
.ss-err { background: rgba(239,68,68,.12); border-color: rgba(239,68,68,.3); color: #ef4444; }
.sub-warn  { color: #f59e0b; font-size: var(--text-sm); margin-top: var(--space-4); }
.sub-empty { color: var(--text-muted); font-size: var(--text-sm); font-style: italic; }

/* Misc */
.detail-loading { display: flex; flex-direction: column; }
.skeleton-hero  { height: 440px; width: 100%; border-radius: 0; }
.detail-body    { padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-3); }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: var(--space-4); }
.empty-title { font-size: var(--text-lg); color: var(--text-secondary); font-weight: 600; }

@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin .8s linear infinite; }
</style>
