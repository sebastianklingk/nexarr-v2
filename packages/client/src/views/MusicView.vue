<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useMusicStore } from '../stores/music.store.js';
import PosterCard from '../components/ui/PosterCard.vue';
import type { LidarrArtist } from '@nexarr/shared';

const router = useRouter();
const store  = useMusicStore();

const search  = ref('');
const sortBy  = ref<'name' | 'albums'>('name');
const sortDir = ref<'asc' | 'desc'>('asc');

const filtered = computed(() => {
  let list: LidarrArtist[] = [...store.artists];

  if (search.value.trim()) {
    const q = search.value.toLowerCase();
    list = list.filter(a => a.artistName.toLowerCase().includes(q));
  }

  list.sort((a, b) => {
    let cmp = 0;
    if (sortBy.value === 'name')   cmp = a.sortName.localeCompare(b.sortName);
    if (sortBy.value === 'albums') cmp = (a.albumCount ?? 0) - (b.albumCount ?? 0);
    return sortDir.value === 'asc' ? cmp : -cmp;
  });

  return list;
});

function posterUrl(a: LidarrArtist): string | undefined {
  return a.images?.find(i => i.coverType === 'poster')?.remoteUrl;
}

function toggleSort(field: typeof sortBy.value) {
  if (sortBy.value === field) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else { sortBy.value = field; sortDir.value = 'asc'; }
}

onMounted(() => store.fetchArtists());
</script>

<template>
  <div class="music-view page-context" style="--context-color: var(--lidarr)">

    <!-- Header -->
    <div class="view-header">
      <div class="header-left">
        <h1 class="view-title">
          <span class="title-bar" />
          Musik
          <span v-if="!store.isLoading" class="title-count">{{ store.stats.artists }} Künstler</span>
        </h1>
      </div>
      <div class="search-wrap">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input v-model="search" class="search-input" type="search" placeholder="Künstler suchen…" />
      </div>
    </div>

    <!-- Toolbar -->
    <div class="toolbar">
      <div class="sort-group">
        <button v-for="s in (['name','albums'] as const)" :key="s"
          :class="['sort-btn', { active: sortBy === s }]" @click="toggleSort(s)">
          {{ s === 'name' ? 'Name' : 'Alben' }}
          <span v-if="sortBy === s" class="sort-arrow">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
        </button>
      </div>
      <span class="results-count">{{ filtered.length }} Ergebnisse</span>
    </div>

    <div v-if="store.error" class="error-banner">{{ store.error }}</div>

    <!-- Skeleton -->
    <div v-if="store.isLoading" class="poster-grid">
      <div v-for="i in 24" :key="i" class="skeleton-card">
        <div class="skeleton skeleton-poster" />
        <div class="skeleton-info">
          <div class="skeleton skeleton-line" style="width:80%" />
          <div class="skeleton skeleton-line" style="width:50%;margin-top:4px" />
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="filtered.length === 0" class="empty-state">
      <div class="empty-icon">🎵</div>
      <p class="empty-title">Keine Künstler gefunden</p>
      <p class="empty-sub">{{ search ? `Keine Ergebnisse für „${search}"` : 'Lidarr enthält noch keine Künstler.' }}</p>
    </div>

    <!-- Grid -->
    <div v-else class="poster-grid">
      <PosterCard
        v-for="artist in filtered" :key="artist.id"
        :title="artist.artistName"
        :poster-url="posterUrl(artist)"
        :has-file="(artist.albumCount ?? 0) > 0"
        :monitored="artist.monitored"
        app-color="var(--lidarr)"
        @click="router.push(`/music/${artist.id}`)"
      />
    </div>

  </div>
</template>

<style scoped>
.music-view { padding: var(--space-6); min-height: 100%; }
.view-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-4); margin-bottom: var(--space-5); flex-wrap: wrap; }
.header-left { display: flex; flex-direction: column; gap: var(--space-2); }
.view-title  { display: flex; align-items: center; gap: var(--space-3); font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); }
.title-bar   { display: inline-block; width: 3px; height: 1.2em; background: var(--context-color); border-radius: 2px; flex-shrink: 0; }
.title-count { font-size: var(--text-base); font-weight: 400; color: var(--text-muted); }
.search-wrap { position: relative; flex-shrink: 0; }
.search-icon { position: absolute; left: var(--space-3); top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
.search-input { width: 260px; padding: var(--space-2) var(--space-3) var(--space-2) 36px; background: var(--bg-elevated); border: 1px solid var(--bg-border); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-sm); outline: none; transition: border-color .15s ease; }
.search-input:focus { border-color: var(--lidarr); }
.toolbar { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-5); flex-wrap: wrap; }
.sort-group { display: flex; gap: 2px; background: var(--bg-elevated); border-radius: var(--radius-md); padding: 2px; border: 1px solid var(--bg-border); }
.sort-btn { padding: var(--space-1) var(--space-3); border-radius: calc(var(--radius-md) - 2px); font-size: var(--text-sm); color: var(--text-tertiary); transition: background .15s ease, color .15s ease; white-space: nowrap; }
.sort-btn:hover { color: var(--text-secondary); }
.sort-btn.active { background: var(--bg-overlay); color: var(--text-primary); }
.sort-arrow { margin-left: 2px; opacity: .7; }
.results-count { font-size: var(--text-sm); color: var(--text-muted); margin-left: auto; }
.error-banner { padding: var(--space-4); background: rgba(248,113,113,.1); border: 1px solid rgba(248,113,113,.3); border-radius: var(--radius-md); color: var(--status-error); margin-bottom: var(--space-5); font-size: var(--text-sm); }
.poster-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: var(--space-3); }
.skeleton-card { border-radius: var(--radius-md); overflow: hidden; background: var(--bg-surface); border: 1px solid var(--bg-border); }
.skeleton-poster { aspect-ratio: 2/3; width: 100%; }
.skeleton-info { padding: var(--space-2); }
.skeleton-line { height: 12px; border-radius: 4px; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-12) var(--space-4); gap: var(--space-3); text-align: center; }
.empty-icon  { font-size: 48px; line-height: 1; }
.empty-title { font-size: var(--text-lg); color: var(--text-secondary); font-weight: 600; }
.empty-sub   { color: var(--text-muted); font-size: var(--text-sm); }
</style>
