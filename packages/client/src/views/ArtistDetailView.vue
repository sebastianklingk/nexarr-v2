<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMusicStore } from '../stores/music.store.js';
import { useApi } from '../composables/useApi.js';
import type { LidarrArtist, LidarrAlbum } from '@nexarr/shared';

const route  = useRoute();
const router = useRouter();
const store  = useMusicStore();
const { post, get } = useApi();

const artist    = ref<LidarrArtist | null>(null);
const isLoading = ref(true);
const overviewExpanded = ref(false);

// Track data per album
interface Track { id: number; title: string; trackNumber: number; duration?: number; hasFile: boolean }
const tracksMap   = ref<Map<number, Track[]>>(new Map());
const loadingTracks = ref<Set<number>>(new Set());
const openAlbums  = ref<Set<number>>(new Set());

// ── Actions ───────────────────────────────────────────────────────────────────
const isSearching  = ref(false);
const searchStatus = ref<'idle'|'ok'|'error'>('idle');

async function triggerSearch() {
  if (!artist.value || isSearching.value) return;
  isSearching.value = true; searchStatus.value = 'idle';
  try { await post(`/api/lidarr/artists/${artist.value.id}/search`); searchStatus.value = 'ok'; }
  catch { searchStatus.value = 'error'; }
  finally { isSearching.value = false; setTimeout(() => { searchStatus.value = 'idle'; }, 3000); }
}

// ── Album Logic ───────────────────────────────────────────────────────────────
const artistId = computed(() => Number(route.params.id));

const artistAlbums = computed((): LidarrAlbum[] =>
  store.albums
    .filter(a => a.artistId === artistId.value)
    .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''))
);

async function toggleAlbum(album: LidarrAlbum) {
  if (openAlbums.value.has(album.id)) {
    openAlbums.value.delete(album.id);
    return;
  }
  openAlbums.value.add(album.id);
  // Tracks laden falls noch nicht da
  if (!tracksMap.value.has(album.id)) {
    loadingTracks.value.add(album.id);
    try {
      const data = await get<Track[]>(`/api/lidarr/albums/${album.id}/tracks`);
      tracksMap.value.set(album.id, (data ?? []).sort((a, b) => a.trackNumber - b.trackNumber));
    } catch { tracksMap.value.set(album.id, []); }
    finally { loadingTracks.value.delete(album.id); }
  }
}

// ── Stats ─────────────────────────────────────────────────────────────────────
const totalAlbums = computed(() => artistAlbums.value.length);
const totalTracks = computed(() => artistAlbums.value.reduce((s, a) => s + (a.statistics?.trackCount ?? 0), 0));
const filesTracks = computed(() => artistAlbums.value.reduce((s, a) => s + (a.statistics?.trackFileCount ?? 0), 0));
const completionPct = computed(() => totalTracks.value > 0 ? Math.round((filesTracks.value / totalTracks.value) * 100) : 0);
const totalSize     = computed(() => artistAlbums.value.reduce((s, a) => s + (a.statistics?.sizeOnDisk ?? 0), 0));

// ── Computed ──────────────────────────────────────────────────────────────────
const fanartUrl = computed(() => artist.value?.images?.find(i => i.coverType === 'fanart')?.remoteUrl);
const posterUrl = computed(() => artist.value?.images?.find(i => i.coverType === 'poster')?.remoteUrl);

function albumProgress(album: LidarrAlbum): number {
  const total = album.statistics?.trackCount ?? 0;
  const has   = album.statistics?.trackFileCount ?? 0;
  return total > 0 ? Math.round((has / total) * 100) : 0;
}

function albumCover(album: LidarrAlbum): string | undefined {
  return album.images?.find(i => i.coverType === 'cover')?.remoteUrl;
}

function fmtBytes(b: number): string {
  if (!b) return ''; const g = b/1024/1024/1024;
  return g >= 1 ? `${g.toFixed(2)} GB` : `${(b/1024/1024).toFixed(0)} MB`;
}

function fmtDuration(sec?: number): string {
  if (!sec) return '';
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function fmtDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('de-DE', { year: 'numeric', month: 'short' });
}

function albumYear(album: LidarrAlbum): string {
  return album.releaseDate ? new Date(album.releaseDate).getFullYear().toString() : '';
}

onMounted(async () => {
  if (store.artists.length === 0) await store.fetchArtists();
  artist.value = await store.fetchArtist(artistId.value);
  await store.fetchAlbums();
  isLoading.value = false;
  // Ersten Album automatisch öffnen
  if (artistAlbums.value.length) toggleAlbum(artistAlbums.value[0]);
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

    <div v-else-if="!artist" class="empty-state">
      <p class="empty-title">Künstler nicht gefunden</p>
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
            Musik
          </button>

          <div class="hero-main">
            <!-- Artist Photo (rund) -->
            <div class="artist-photo-wrap">
              <img v-if="posterUrl" :src="posterUrl" :alt="artist.artistName" class="artist-photo" />
              <div v-else class="artist-photo artist-ph">{{ artist.artistName[0] }}</div>
            </div>

            <div class="hero-info">
              <div class="app-bar" />
              <h1 class="hero-title">{{ artist.artistName }}</h1>

              <div class="hero-meta">
                <span v-if="artist.status" class="meta-status" :class="artist.status==='ended' ? 'meta-ended' : 'meta-active'">
                  {{ artist.status === 'ended' ? 'Inaktiv' : 'Aktiv' }}
                </span>
                <span v-if="artist.genres?.length" class="sep">·</span>
                <span v-if="artist.genres?.length" class="meta-genres">{{ artist.genres.slice(0,4).join(', ') }}</span>
              </div>

              <!-- Rating -->
              <div v-if="artist.ratings?.value" class="hero-ratings">
                <div class="r-chip r-lidarr">
                  <span class="r-src">Bewertung</span>
                  <span class="r-val">★ {{ artist.ratings.value.toFixed(1) }}</span>
                </div>
              </div>

              <!-- Overview kurz -->
              <div v-if="artist.overview" class="hero-overview">
                <p class="hero-ov-text" :class="{ 'ov-collapsed': !overviewExpanded }">{{ artist.overview }}</p>
                <button v-if="artist.overview.length > 180" class="ov-toggle" @click="overviewExpanded = !overviewExpanded">
                  {{ overviewExpanded ? '–' : 'Mehr' }}
                </button>
              </div>

              <!-- Actions -->
              <div class="hero-actions">
                <button class="act-btn act-search"
                  :class="{ 'act-ok': searchStatus==='ok', 'act-err': searchStatus==='error' }"
                  :disabled="isSearching" @click="triggerSearch">
                  <svg v-if="isSearching" class="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  {{ isSearching ? 'Suche…' : searchStatus==='ok' ? 'Gestartet!' : 'Jetzt suchen' }}
                </button>
              </div>

              <!-- Badges -->
              <div class="hero-badges">
                <span v-if="!artist.monitored" class="badge badge-off">Nicht überwacht</span>
                <span v-if="artist.added" class="badge badge-neu">Hinzugefügt {{ fmtDate(artist.added) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── Stats Bar ── -->
      <div class="stats-bar">
        <div class="stat-item">
          <span class="stat-num">{{ totalAlbums }}</span>
          <span class="stat-label">Alben</span>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <span class="stat-num">{{ filesTracks }}</span>
          <span class="stat-label">Tracks vorhanden</span>
        </div>
        <div class="stat-divider" />
        <div class="stat-item stat-pct">
          <span class="stat-num">{{ completionPct }}%</span>
          <span class="stat-label">Vollständigkeit</span>
          <div class="stat-bar-wrap">
            <div class="stat-bar" :style="{ width: completionPct+'%' }" :class="{ 'bar-full': completionPct===100 }" />
          </div>
        </div>
        <div class="stat-divider" />
        <div class="stat-item">
          <span class="stat-num">{{ fmtBytes(totalSize) }}</span>
          <span class="stat-label">Auf Disk</span>
        </div>
      </div>

      <!-- ── Genre Tags ── -->
      <div v-if="artist.genres?.length" class="genre-bar">
        <span v-for="g in artist.genres" :key="g" class="genre-tag">{{ g }}</span>
      </div>

      <!-- ── Album Liste ── -->
      <div class="albums-section">

        <div v-if="!artistAlbums.length" class="no-albums">Keine Alben gefunden</div>

        <div v-for="album in artistAlbums" :key="album.id" class="album-block">

          <!-- Album Header (klickbar) -->
          <button class="album-header" @click="toggleAlbum(album)">
            <!-- Cover -->
            <div class="album-cover">
              <img v-if="albumCover(album)" :src="albumCover(album)" :alt="album.title" loading="lazy" />
              <div v-else class="album-cover-ph">♪</div>
            </div>

            <!-- Info -->
            <div class="album-info">
              <div class="album-title-row">
                <span class="album-title">{{ album.title }}</span>
                <span class="album-type-badge">{{ album.albumType }}</span>
              </div>
              <div class="album-meta">
                <span v-if="albumYear(album)">{{ albumYear(album) }}</span>
                <span class="sep">·</span>
                <span>{{ album.statistics?.trackFileCount ?? 0 }}/{{ album.statistics?.trackCount ?? 0 }} Tracks</span>
                <span v-if="album.statistics?.sizeOnDisk" class="sep">·</span>
                <span v-if="album.statistics?.sizeOnDisk">{{ fmtBytes(album.statistics.sizeOnDisk) }}</span>
              </div>
            </div>

            <!-- Progress -->
            <div class="album-prog-wrap">
              <div class="album-prog" :style="{ width: albumProgress(album)+'%' }" :class="{ 'prog-full': albumProgress(album)===100 }" />
            </div>
            <span class="album-pct">{{ albumProgress(album) }}%</span>

            <!-- Monitored -->
            <span :class="['album-mon', album.monitored ? 'mon-on' : 'mon-off']">
              {{ album.monitored ? 'Überwacht' : 'Ignoriert' }}
            </span>

            <!-- Chevron -->
            <span class="album-chevron" :class="{ open: openAlbums.has(album.id) }">›</span>
          </button>

          <!-- Track List -->
          <div v-if="openAlbums.has(album.id)" class="track-list">
            <div v-if="loadingTracks.has(album.id)" class="track-loading">
              Tracks werden geladen…
            </div>
            <div v-else-if="!tracksMap.get(album.id)?.length" class="track-loading">
              Keine Tracks gefunden
            </div>
            <div v-else>
              <div
                v-for="track in tracksMap.get(album.id)"
                :key="track.id"
                :class="['track-row', track.hasFile ? 'tr-ok' : 'tr-miss']"
              >
                <span :class="['tr-icon', track.hasFile ? 'ti-ok' : 'ti-miss']">{{ track.hasFile ? '✓' : '○' }}</span>
                <span class="tr-num">{{ track.trackNumber }}</span>
                <span class="tr-title">{{ track.title }}</span>
                <span v-if="track.duration" class="tr-dur">{{ fmtDuration(track.duration) }}</span>
              </div>
            </div>
          </div>

        </div>
      </div>

    </template>
  </div>
</template>

<style scoped>
.detail-view { min-height: 100%; }

/* Hero */
.hero { position: relative; min-height: 380px; display: flex; flex-direction: column; justify-content: flex-end; }
.hero-bg { position: absolute; inset: 0; background-image: var(--fanart); background-size: cover; background-position: center top; z-index: 0; }
.hero-gradient { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(10,10,10,.15) 0%, rgba(10,10,10,.55) 40%, rgba(10,10,10,.97) 100%); z-index: 1; }
.hero-content { position: relative; z-index: 2; padding: var(--space-5) var(--space-6) var(--space-6); display: flex; flex-direction: column; gap: var(--space-4); }
.back-btn { display: inline-flex; align-items: center; gap: 5px; color: var(--text-tertiary); font-size: var(--text-sm); transition: color .15s; align-self: flex-start; }
.back-btn:hover { color: var(--text-primary); }
.hero-main { display: flex; gap: var(--space-6); align-items: flex-end; }

/* Artist Photo – rund wie v1 */
.artist-photo-wrap { flex-shrink: 0; }
.artist-photo { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(255,255,255,.15); box-shadow: 0 8px 32px rgba(0,0,0,.5); }
.artist-ph { display: flex; align-items: center; justify-content: center; background: var(--bg-elevated); font-size: 48px; font-weight: 700; color: var(--text-muted); }

.hero-info { flex: 1; display: flex; flex-direction: column; gap: var(--space-3); padding-bottom: var(--space-1); }
.app-bar { width: 32px; height: 3px; background: var(--lidarr); border-radius: 2px; }
.hero-title { font-size: clamp(22px, 3vw, 34px); font-weight: 700; color: var(--text-primary); line-height: 1.2; margin: 0; }

.hero-meta { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.meta-status { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 99px; }
.meta-active { background: rgba(34,198,91,.12); color: var(--lidarr); border: 1px solid rgba(34,198,91,.25); }
.meta-ended  { background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--bg-border); }
.meta-genres { font-size: var(--text-sm); color: var(--text-tertiary); }
.sep { color: var(--text-muted); font-size: var(--text-sm); }

/* Rating */
.hero-ratings { display: flex; gap: var(--space-2); }
.r-chip { display: flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: var(--radius-sm); font-size: var(--text-xs); font-weight: 600; border: 1px solid; }
.r-lidarr { background: rgba(34,198,91,.1); border-color: rgba(34,198,91,.3); }
.r-src { color: var(--text-muted); font-weight: 400; }
.r-val { color: var(--text-primary); }

/* Hero Overview */
.hero-overview { max-width: 600px; }
.hero-ov-text { color: var(--text-muted); font-size: var(--text-sm); line-height: 1.6; margin: 0; }
.ov-collapsed { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.ov-toggle { color: var(--lidarr); font-size: var(--text-xs); cursor: pointer; background: none; border: none; padding: 0; margin-top: 3px; }

/* Actions */
.hero-actions { display: flex; gap: var(--space-2); }
.act-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: 500; cursor: pointer; transition: all .15s; white-space: nowrap; }
.act-btn:disabled { opacity: .6; cursor: not-allowed; }
.act-search { background: rgba(34,198,91,.12); border: 1px solid rgba(34,198,91,.3); color: var(--lidarr); }
.act-search:not(:disabled):hover { background: rgba(34,198,91,.22); }
.act-ok  { background: rgba(34,197,94,.2) !important; border-color: rgba(34,197,94,.4) !important; }
.act-err { background: rgba(248,113,113,.15) !important; border-color: rgba(248,113,113,.35) !important; color: #ef4444 !important; }

/* Badges */
.hero-badges { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.badge { padding: 2px 10px; border-radius: 99px; font-size: var(--text-xs); font-weight: 500; }
.badge-off { background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--bg-border); }
.badge-neu { background: var(--bg-elevated); color: var(--text-tertiary); border: 1px solid var(--bg-border); }

/* Stats Bar */
.stats-bar { display: flex; align-items: center; background: var(--bg-surface); border-bottom: 1px solid var(--bg-border); padding: var(--space-4) var(--space-6); }
.stat-item { display: flex; flex-direction: column; gap: 2px; padding: 0 var(--space-5); flex: 1; }
.stat-item:first-child { padding-left: 0; }
.stat-num  { font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.stat-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .06em; }
.stat-pct  { flex: 2; }
.stat-bar-wrap { height: 4px; background: var(--bg-elevated); border-radius: 2px; overflow: hidden; margin-top: 4px; max-width: 200px; }
.stat-bar  { height: 100%; background: var(--lidarr); border-radius: 2px; }
.bar-full  { background: var(--status-success); }
.stat-divider { width: 1px; height: 40px; background: var(--bg-border); flex-shrink: 0; }

/* Genre Bar */
.genre-bar { display: flex; gap: var(--space-2); flex-wrap: wrap; padding: var(--space-3) var(--space-6); border-bottom: 1px solid var(--bg-border); background: var(--bg-surface); }
.genre-tag { font-size: 11px; padding: 3px 10px; background: var(--bg-elevated); border: 1px solid var(--bg-border); border-radius: 99px; color: var(--text-muted); }

/* Albums Section */
.albums-section { padding: var(--space-4) var(--space-6) var(--space-6); display: flex; flex-direction: column; gap: var(--space-2); }
.no-albums { color: var(--text-muted); font-size: var(--text-sm); padding: var(--space-6) 0; text-align: center; }

.album-block { border: 1px solid var(--bg-border); border-radius: var(--radius-lg); overflow: hidden; background: var(--bg-surface); }

.album-header {
  width: 100%; display: flex; align-items: center; gap: var(--space-4);
  padding: var(--space-3) var(--space-4); cursor: pointer; transition: background .15s;
}
.album-header:hover { background: var(--bg-elevated); }

.album-cover {
  width: 52px; height: 52px; border-radius: var(--radius-md); overflow: hidden;
  background: var(--bg-elevated); border: 1px solid var(--bg-border); flex-shrink: 0;
}
.album-cover img { width: 100%; height: 100%; object-fit: cover; }
.album-cover-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 22px; color: var(--text-muted); }

.album-info { flex: 1; min-width: 0; text-align: left; display: flex; flex-direction: column; gap: 3px; }
.album-title-row { display: flex; align-items: center; gap: var(--space-2); }
.album-title { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.album-type-badge { font-size: 10px; font-weight: 600; padding: 1px 6px; background: rgba(34,198,91,.1); color: var(--lidarr); border: 1px solid rgba(34,198,91,.25); border-radius: 99px; white-space: nowrap; flex-shrink: 0; }
.album-meta { font-size: 11px; color: var(--text-muted); display: flex; gap: 5px; align-items: center; flex-wrap: wrap; }
.sep { color: var(--text-muted); }

.album-prog-wrap { width: 80px; height: 3px; background: var(--bg-border); border-radius: 2px; overflow: hidden; flex-shrink: 0; }
.album-prog { height: 100%; background: var(--lidarr); border-radius: 2px; transition: width .3s; }
.prog-full { background: var(--status-success); }
.album-pct { font-size: 11px; color: var(--text-muted); min-width: 32px; text-align: right; flex-shrink: 0; }

.album-mon { font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 99px; flex-shrink: 0; }
.mon-on { background: rgba(34,198,91,.1); color: var(--lidarr); border: 1px solid rgba(34,198,91,.25); }
.mon-off { background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--bg-border); }

.album-chevron { font-size: 18px; color: var(--text-muted); transition: transform .2s; line-height: 1; flex-shrink: 0; }
.album-chevron.open { transform: rotate(90deg); }

/* Track List */
.track-list { border-top: 1px solid var(--bg-border); }
.track-loading { padding: var(--space-3) var(--space-4); font-size: var(--text-sm); color: var(--text-muted); text-align: center; }

.track-row {
  display: flex; align-items: center; gap: var(--space-3);
  padding: 6px var(--space-4);
  border-bottom: 1px solid rgba(255,255,255,.03);
  transition: background .12s;
}
.track-row:last-child { border-bottom: none; }
.track-row:hover { background: var(--bg-elevated); }

.tr-icon { font-size: 11px; font-weight: 700; flex-shrink: 0; width: 14px; text-align: center; }
.ti-ok   { color: var(--lidarr); }
.ti-miss { color: var(--text-muted); }
.tr-num  { font-size: 11px; color: var(--text-muted); min-width: 22px; font-variant-numeric: tabular-nums; text-align: right; flex-shrink: 0; }
.tr-title { flex: 1; font-size: var(--text-sm); color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tr-dur  { font-size: 11px; color: var(--text-muted); flex-shrink: 0; font-variant-numeric: tabular-nums; }

/* Misc */
.detail-loading { display: flex; flex-direction: column; }
.skeleton-hero { height: 380px; width: 100%; border-radius: 0; }
.detail-body { padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-3); }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: var(--space-4); }
.empty-title { font-size: var(--text-lg); color: var(--text-secondary); font-weight: 600; }

@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin .8s linear infinite; }
</style>
