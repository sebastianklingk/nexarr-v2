<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useSeriesStore } from '../stores/series.store.js';
import PosterCard from '../components/ui/PosterCard.vue';
import type { SonarrSeries } from '@nexarr/shared';

const router = useRouter();
const store  = useSeriesStore();

const search  = ref('');
const filter  = ref<'all' | 'continuing' | 'ended'>('all');
const sortBy  = ref<'title' | 'year' | 'episodes'>('title');
const sortDir = ref<'asc' | 'desc'>('asc');

const filtered = computed(() => {
  let list: SonarrSeries[] = [...store.series];

  if (search.value.trim()) {
    const q = search.value.toLowerCase();
    list = list.filter(s => s.title.toLowerCase().includes(q));
  }

  if (filter.value === 'continuing') list = list.filter(s => s.status === 'continuing');
  if (filter.value === 'ended')      list = list.filter(s => s.status === 'ended');

  list.sort((a, b) => {
    let cmp = 0;
    if (sortBy.value === 'title')    cmp = a.sortTitle.localeCompare(b.sortTitle);
    if (sortBy.value === 'year')     cmp = (a.year ?? 0) - (b.year ?? 0);
    if (sortBy.value === 'episodes') cmp = (a.episodeCount ?? 0) - (b.episodeCount ?? 0);
    return sortDir.value === 'asc' ? cmp : -cmp;
  });

  return list;
});

function posterUrl(s: SonarrSeries): string | undefined {
  return s.images?.find(i => i.coverType === 'poster')?.remoteUrl;
}

function toggleSort(field: typeof sortBy.value) {
  if (sortBy.value === field) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else { sortBy.value = field; sortDir.value = 'asc'; }
}

onMounted(() => store.fetchSeries());
</script>

<template>
  <div class="series-view page-context" style="--context-color: var(--sonarr)">

    <!-- Header -->
    <div class="view-header">
      <div class="header-left">
        <h1 class="view-title">
          <span class="title-bar" />
          Serien
          <span v-if="!store.isLoading" class="title-count">{{ store.stats.total }}</span>
        </h1>
        <div class="header-stats">
          <span class="stat-chip stat-continuing">{{ store.stats.continuing }} laufend</span>
          <span class="stat-chip stat-ended">{{ store.stats.ended }} beendet</span>
        </div>
      </div>

      <div class="search-wrap">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input v-model="search" class="search-input" type="search" placeholder="Serien suchen…" />
      </div>
    </div>

    <!-- Toolbar -->
    <div class="toolbar">
      <div class="filter-group">
        <button v-for="f in (['all','continuing','ended'] as const)" :key="f"
          :class="['filter-btn', { active: filter === f }]" @click="filter = f">
          {{ f === 'all' ? 'Alle' : f === 'continuing' ? 'Laufend' : 'Beendet' }}
        </button>
      </div>
      <div class="sort-group">
        <button v-for="s in (['title','year','episodes'] as const)" :key="s"
          :class="['sort-btn', { active: sortBy === s }]" @click="toggleSort(s)">
          {{ s === 'title' ? 'Titel' : s === 'year' ? 'Jahr' : 'Episoden' }}
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
          <div class="skeleton skeleton-line" style="width:40%;margin-top:4px" />
        </div>
      </div>
    </div>

    <!-- Empty -->
    <div v-else-if="filtered.length === 0" class="empty-state">
      <div class="empty-icon">📺</div>
      <p class="empty-title">Keine Serien gefunden</p>
      <p class="empty-sub">{{ search ? `Keine Ergebnisse für „${search}"` : 'Sonarr enthält noch keine Serien.' }}</p>
    </div>

    <!-- Grid -->
    <div v-else class="poster-grid">
      <PosterCard
        v-for="s in filtered" :key="s.id"
        :title="s.title" :year="s.year"
        :poster-url="posterUrl(s)"
        :has-file="(s.episodeFileCount ?? 0) > 0"
        :monitored="s.monitored"
        app-color="var(--sonarr)"
        @click="router.push(`/series/${s.id}`)"
      />
    </div>

  </div>
</template>

<style scoped>
.series-view { padding: var(--space-6); min-height: 100%; }
.view-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-4); margin-bottom: var(--space-5); flex-wrap: wrap; }
.header-left { display: flex; flex-direction: column; gap: var(--space-2); }
.view-title  { display: flex; align-items: center; gap: var(--space-3); font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); }
.title-bar   { display: inline-block; width: 3px; height: 1.2em; background: var(--context-color); border-radius: 2px; flex-shrink: 0; }
.title-count { font-size: var(--text-base); font-weight: 400; color: var(--text-muted); }
.header-stats { display: flex; gap: var(--space-2); }
.stat-chip { font-size: var(--text-xs); padding: 2px 8px; border-radius: 99px; font-weight: 500; }
.stat-continuing { background: rgba(53,197,244,0.12); color: var(--sonarr); border: 1px solid rgba(53,197,244,0.25); }
.stat-ended      { background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--bg-border); }
.search-wrap  { position: relative; flex-shrink: 0; }
.search-icon  { position: absolute; left: var(--space-3); top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
.search-input { width: 260px; padding: var(--space-2) var(--space-3) var(--space-2) 36px; background: var(--bg-elevated); border: 1px solid var(--bg-border); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-sm); outline: none; transition: border-color .15s ease; }
.search-input:focus { border-color: var(--sonarr); }
.toolbar { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-5); flex-wrap: wrap; }
.filter-group, .sort-group { display: flex; gap: 2px; background: var(--bg-elevated); border-radius: var(--radius-md); padding: 2px; border: 1px solid var(--bg-border); }
.filter-btn, .sort-btn { padding: var(--space-1) var(--space-3); border-radius: calc(var(--radius-md) - 2px); font-size: var(--text-sm); color: var(--text-tertiary); transition: background .15s ease, color .15s ease; white-space: nowrap; }
.filter-btn:hover, .sort-btn:hover { color: var(--text-secondary); }
.filter-btn.active, .sort-btn.active { background: var(--bg-overlay); color: var(--text-primary); }
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
