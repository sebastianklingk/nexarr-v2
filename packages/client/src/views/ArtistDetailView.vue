<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMusicStore } from '../stores/music.store.js';
import { useApi } from '../composables/useApi.js';
import type { LidarrArtist } from '@nexarr/shared';

const route  = useRoute();
const router = useRouter();
const store  = useMusicStore();

const artist    = ref<LidarrArtist | null>(null);
const isLoading    = ref(true);
const isSearching  = ref(false);
const searchStatus = ref<'idle' | 'ok' | 'error'>('idle');

const { post } = useApi();

async function triggerSearch() {
  if (!artist.value || isSearching.value) return;
  isSearching.value = true;
  searchStatus.value = 'idle';
  try {
    await post(`/api/lidarr/artists/${artist.value.id}/search`);
    searchStatus.value = 'ok';
  } catch {
    searchStatus.value = 'error';
  } finally {
    isSearching.value = false;
    setTimeout(() => { searchStatus.value = 'idle'; }, 3000);
  }
}

const artistId = computed(() => Number(route.params.id));

const fanartUrl = computed(() => artist.value?.images?.find(i => i.coverType === 'fanart')?.remoteUrl);
const posterUrl = computed(() => artist.value?.images?.find(i => i.coverType === 'poster')?.remoteUrl);

const artistAlbums = computed(() =>
  store.albums.filter(a => a.artistId === artistId.value)
    .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''))
);

onMounted(async () => {
  if (store.artists.length === 0) await store.fetchArtists();
  artist.value = await store.fetchArtist(artistId.value);
  await store.fetchAlbums();
  isLoading.value = false;
});
</script>

<template>
  <div class="detail-view">

    <div v-if="isLoading" class="detail-loading">
      <div class="skeleton skeleton-hero" />
      <div class="detail-body">
        <div class="skeleton skeleton-title" />
        <div class="skeleton skeleton-meta" />
      </div>
    </div>

    <div v-else-if="!artist" class="empty-state">
      <p class="empty-title">Künstler nicht gefunden</p>
      <button class="back-btn" @click="router.back()">← Zurück</button>
    </div>

    <template v-else>

      <!-- Hero -->
      <div class="hero" :style="fanartUrl ? `--fanart: url('${fanartUrl}')` : ''">
        <div class="hero-bg" />
        <div class="hero-gradient" />
        <div class="hero-content">
          <button class="back-btn" @click="router.back()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            Musik
          </button>
          <div class="hero-main">
            <img v-if="posterUrl" :src="posterUrl" :alt="artist.artistName" class="hero-poster" />
            <div v-else class="hero-poster hero-poster--placeholder">{{ artist.artistName[0] }}</div>
            <div class="hero-info">
              <div class="hero-app-indicator" />
              <h1 class="hero-title">{{ artist.artistName }}</h1>
              <div class="hero-meta">
                <span v-if="artist.genres?.length" class="meta-item">{{ artist.genres.slice(0,3).join(', ') }}</span>
              </div>
              <div class="hero-actions">
                <button
                  class="search-btn"
                  :class="{ 'search-btn--loading': isSearching, 'search-btn--ok': searchStatus === 'ok', 'search-btn--error': searchStatus === 'error' }"
                  :disabled="isSearching"
                  @click="triggerSearch"
                >
                  <svg v-if="isSearching" class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  <svg v-else-if="searchStatus === 'ok'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <svg v-else-if="searchStatus === 'error'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  {{ isSearching ? 'Suche läuft…' : searchStatus === 'ok' ? 'Gestartet!' : searchStatus === 'error' ? 'Fehler' : 'Jetzt suchen' }}
                </button>
              </div>
              <div class="hero-badges">
                <span v-if="artist.albumCount" class="status-badge badge-neutral">
                  {{ artist.albumCount }} Alben
                </span>
                <span v-if="artist.ratings?.value" class="status-badge badge-rating">
                  ★ {{ artist.ratings.value.toFixed(1) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Overview -->
      <div class="tab-content">
        <p v-if="artist.overview" class="overview-text">{{ artist.overview }}</p>

        <!-- Albums Grid -->
        <div v-if="artistAlbums.length" class="albums-section">
          <h2 class="section-title">Alben</h2>
          <div class="albums-grid">
            <div v-for="album in artistAlbums" :key="album.id" class="album-card">
              <div class="album-cover">
                <img
                  v-if="album.images?.find(i => i.coverType === 'cover')"
                  :src="album.images.find(i => i.coverType === 'cover')!.remoteUrl"
                  :alt="album.title"
                />
                <div v-else class="album-cover-placeholder">♪</div>
              </div>
              <div class="album-info">
                <p class="album-title">{{ album.title }}</p>
                <p v-if="album.releaseDate" class="album-year">
                  {{ new Date(album.releaseDate).getFullYear() }}
                </p>
                <p class="album-tracks">
                  {{ album.statistics?.trackFileCount ?? 0 }} /
                  {{ album.statistics?.trackCount ?? 0 }} Tracks
                </p>
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
.hero { position: relative; min-height: 380px; display: flex; flex-direction: column; justify-content: flex-end; }
.hero-bg { position: absolute; inset: 0; background-image: var(--fanart); background-size: cover; background-position: center top; z-index: 0; }
.hero-gradient { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(10,10,10,.2) 0%, rgba(10,10,10,.6) 50%, rgba(10,10,10,.97) 100%); z-index: 1; }
.hero-content { position: relative; z-index: 2; padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-4); }
.back-btn { display: inline-flex; align-items: center; gap: var(--space-1); color: var(--text-tertiary); font-size: var(--text-sm); transition: color .15s ease; align-self: flex-start; }
.back-btn:hover { color: var(--text-primary); }
.hero-main { display: flex; gap: var(--space-6); align-items: flex-end; }
.hero-poster { width: 120px; min-width: 120px; aspect-ratio: 1/1; object-fit: cover; border-radius: var(--radius-lg); border: 1px solid var(--bg-border); box-shadow: 0 8px 32px rgba(0,0,0,.5); flex-shrink: 0; }
.hero-poster--placeholder { display: flex; align-items: center; justify-content: center; background: var(--bg-elevated); font-size: 48px; font-weight: 700; color: var(--text-muted); border-radius: var(--radius-lg); }
.hero-info { display: flex; flex-direction: column; gap: var(--space-3); padding-bottom: var(--space-2); }
.hero-app-indicator { width: 32px; height: 3px; background: var(--lidarr); border-radius: 2px; }
.hero-title { font-size: var(--text-2xl); font-weight: 700; color: var(--text-primary); line-height: 1.2; }
.hero-meta { display: flex; gap: var(--space-2); color: var(--text-tertiary); font-size: var(--text-sm); }
.hero-badges { display: flex; gap: var(--space-2); }
.status-badge { padding: 2px 10px; border-radius: 99px; font-size: var(--text-xs); font-weight: 500; }
.badge-neutral { background: var(--bg-elevated); color: var(--text-tertiary); border: 1px solid var(--bg-border); }
.badge-rating  { background: rgba(245,197,24,.12); color: var(--sabnzbd); border: 1px solid rgba(245,197,24,.25); }

.tab-content { padding: var(--space-6); }
.overview-text { color: var(--text-tertiary); line-height: 1.7; font-size: var(--text-base); margin-bottom: var(--space-6); }

.albums-section { margin-top: var(--space-6); }
.section-title { font-size: var(--text-md); font-weight: 600; color: var(--text-secondary); margin-bottom: var(--space-4); border-left: 3px solid var(--lidarr); padding-left: var(--space-3); }

.albums-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: var(--space-4); }

.album-card { cursor: default; }
.album-cover { aspect-ratio: 1/1; border-radius: var(--radius-md); overflow: hidden; background: var(--bg-elevated); border: 1px solid var(--bg-border); margin-bottom: var(--space-2); }
.album-cover img { width: 100%; height: 100%; object-fit: cover; }
.album-cover-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 40px; color: var(--text-muted); }
.album-title { font-size: var(--text-sm); color: var(--text-secondary); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.album-year  { font-size: var(--text-xs); color: var(--text-muted); margin-top: 2px; }
.album-tracks { font-size: var(--text-xs); color: var(--text-muted); margin-top: 1px; }

.hero-actions { margin-bottom: var(--space-1); }
.search-btn { display: inline-flex; align-items: center; gap: var(--space-2); padding: 6px 14px; border-radius: var(--radius-md); background: rgba(34,198,91,.12); border: 1px solid rgba(34,198,91,.3); color: var(--lidarr); font-size: var(--text-sm); font-weight: 500; cursor: pointer; transition: all .15s ease; }
.search-btn:hover:not(:disabled) { background: rgba(34,198,91,.2); border-color: rgba(34,198,91,.5); }
.search-btn:disabled { opacity: .6; cursor: not-allowed; }
.search-btn--ok { background: rgba(34,198,91,.2); border-color: rgba(34,198,91,.5); }
.search-btn--error { background: rgba(239,68,68,.12); border-color: rgba(239,68,68,.3); color: #ef4444; }
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin .8s linear infinite; }

.detail-loading { display: flex; flex-direction: column; }
.skeleton-hero  { height: 380px; width: 100%; border-radius: 0; }
.detail-body    { padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-3); }
.skeleton-title { height: 36px; width: 50%; border-radius: var(--radius-md); }
.skeleton-meta  { height: 18px; width: 30%; border-radius: var(--radius-md); }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: var(--space-4); }
.empty-title { font-size: var(--text-lg); color: var(--text-secondary); font-weight: 600; }
</style>
