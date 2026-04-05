<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useMoviesStore } from '../../stores/movies.store.js';
import { useSeriesStore } from '../../stores/series.store.js';
import { useMusicStore } from '../../stores/music.store.js';

const router = useRouter();
const movies = useMoviesStore();
const series = useSeriesStore();
const music  = useMusicStore();

const recentFilter = ref<'all'|'movies'|'series'|'music'>('all');

const recentlyAdded = computed(() => {
  const items: Array<{ id: number; title: string; type: string; added: string; posterUrl?: string; color: string; route: string }> = [];
  if (recentFilter.value !== 'series' && recentFilter.value !== 'music') {
    for (const m of movies.movies) if (m.added) items.push({ id: m.id, title: m.title, type: 'movie', added: m.added, posterUrl: m.images?.find(i => i.coverType === 'poster')?.remoteUrl, color: 'var(--radarr)', route: `/movies/${m.id}` });
  }
  if (recentFilter.value !== 'movies' && recentFilter.value !== 'music') {
    for (const s of series.series) if (s.added) items.push({ id: s.id, title: s.title, type: 'series', added: s.added, posterUrl: s.images?.find(i => i.coverType === 'poster')?.remoteUrl, color: 'var(--sonarr)', route: `/series/${s.id}` });
  }
  if (recentFilter.value !== 'movies' && recentFilter.value !== 'series') {
    for (const a of music.artists) if (a.added) items.push({ id: a.id, title: a.artistName, type: 'music', added: a.added, posterUrl: a.images?.find(i => i.coverType === 'poster')?.remoteUrl, color: 'var(--lidarr)', route: `/music/${a.id}` });
  }
  return items.sort((a,b) => b.added.localeCompare(a.added)).slice(0, 28);
});

function nav(r: string) { router.push(r); }
function fmtDate(iso?: string): string { if (!iso) return ''; return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }); }
</script>

<template>
  <div class="recent-widget">
    <div class="widget-head">
      <span class="widget-title">Zuletzt hinzugefügt</span>
      <div class="ftabs">
        <button :class="['ftab', recentFilter==='all' && 'ftab-on']" @click="recentFilter='all'">Alle</button>
        <button :class="['ftab', recentFilter==='movies' && 'ftab-on']" style="--ftc:var(--radarr)" @click="recentFilter='movies'">Filme</button>
        <button :class="['ftab', recentFilter==='series' && 'ftab-on']" style="--ftc:var(--sonarr)" @click="recentFilter='series'">Serien</button>
        <button :class="['ftab', recentFilter==='music' && 'ftab-on']" style="--ftc:var(--lidarr)" @click="recentFilter='music'">Musik</button>
      </div>
    </div>
    <div v-if="movies.isLoading && series.isLoading" class="poster-row">
      <div v-for="i in 12" :key="i" class="poster skeleton" />
    </div>
    <div v-else class="poster-row">
      <div v-for="item in recentlyAdded" :key="item.type+item.id" class="poster" @click="nav(item.route)">
        <div class="poster-img">
          <img v-if="item.posterUrl" :src="item.posterUrl" :alt="item.title" loading="lazy" />
          <div v-else class="poster-ph">{{ item.title[0] }}</div>
          <div class="poster-dot" :style="{ background: item.color }" />
        </div>
        <p class="poster-name">{{ item.title }}</p>
        <p class="poster-date">{{ fmtDate(item.added) }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.recent-widget { display: flex; flex-direction: column; gap: var(--space-3); }
.widget-head { display: flex; align-items: center; justify-content: space-between; }
.widget-title { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); }
.ftabs { display: flex; gap: 3px; }
.ftab { padding: 2px 8px; border-radius: var(--radius-sm); font-size: 11px; color: var(--text-muted); border: 1px solid transparent; cursor: pointer; transition: all .15s; }
.ftab:hover { color: var(--text-secondary); background: var(--bg-elevated); }
.ftab-on { background: var(--bg-elevated); color: var(--ftc, var(--text-primary)); border-color: var(--bg-border); font-weight: 600; }
.poster-row {
  display: flex; gap: var(--space-3); overflow-x: auto; padding-bottom: var(--space-1);
  scrollbar-width: thin; scrollbar-color: var(--bg-border) transparent;
}
.poster-row::-webkit-scrollbar { height: 3px; }
.poster-row::-webkit-scrollbar-thumb { background: var(--bg-border); border-radius: 2px; }
.poster { flex-shrink: 0; width: 90px; cursor: pointer; }
.poster.skeleton { height: 135px; border-radius: var(--radius-md); animation: shimmer 1.5s infinite; }
.poster-img { position: relative; aspect-ratio: 2/3; border-radius: var(--radius-md); overflow: hidden; background: var(--bg-elevated); border: 1px solid var(--bg-border); margin-bottom: 4px; transition: transform .15s; }
.poster:hover .poster-img { transform: scale(1.04); }
.poster-img img { width: 100%; height: 100%; object-fit: cover; }
.poster-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; color: var(--text-muted); }
.poster-dot { position: absolute; bottom: 3px; right: 3px; width: 7px; height: 7px; border-radius: 50%; border: 1px solid rgba(0,0,0,.5); }
.poster-name { font-size: 10px; color: var(--text-secondary); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0; }
.poster-date { font-size: 10px; color: var(--text-muted); margin: 0; }
@keyframes shimmer { 0%, 100% { opacity: .4; } 50% { opacity: .9; } }
</style>
