<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useMusicStore } from '../stores/music.store.js';
import type { LidarrArtist } from '@nexarr/shared';
import { posterUrl } from '../utils/images.js';

const router = useRouter();
const store  = useMusicStore();

const search    = ref('');
const sortBy    = ref<'name' | 'rating' | 'albums'>('name');
const sortDir   = ref<'asc' | 'desc'>('asc');
const activeFilter = ref<'all' | 'active' | 'ended' | 'monitored' | 'unmonitored' | 'complete' | 'incomplete'>('all');
const hoverArtist = ref<LidarrArtist | null>(null);
const hoverPos    = ref({ x: 0, y: 0 });

// ── Filter + Sort ─────────────────────────────────────────────────────────────
const filtered = computed(() => {
  let list: LidarrArtist[] = [...store.artists];

  if (search.value.trim()) {
    const q = search.value.toLowerCase();
    list = list.filter(a => a.artistName.toLowerCase().includes(q));
  }

  // Status/Monitor/Vollständigkeit Filter
  if (activeFilter.value === 'active')      list = list.filter(a => a.status === 'continuing');
  if (activeFilter.value === 'ended')       list = list.filter(a => a.status === 'ended');
  if (activeFilter.value === 'monitored')   list = list.filter(a => a.monitored);
  if (activeFilter.value === 'unmonitored') list = list.filter(a => !a.monitored);
  if (activeFilter.value === 'complete') {
    list = list.filter(a => {
      const stats = (a as any).statistics;
      return stats && stats.trackCount > 0 && stats.trackFileCount >= stats.trackCount;
    });
  }
  if (activeFilter.value === 'incomplete') {
    list = list.filter(a => {
      const stats = (a as any).statistics;
      return !stats || stats.trackCount === 0 || stats.trackFileCount < stats.trackCount;
    });
  }

  list.sort((a, b) => {
    let cmp = 0;
    if (sortBy.value === 'name')   cmp = a.sortName.localeCompare(b.sortName);
    if (sortBy.value === 'albums') cmp = (a.albumCount ?? 0) - (b.albumCount ?? 0);
    if (sortBy.value === 'rating') cmp = ((a.ratings?.value ?? 0)) - ((b.ratings?.value ?? 0));
    return sortDir.value === 'asc' ? cmp : -cmp;
  });

  return list;
});

// ── Alphabetische Gruppen ─────────────────────────────────────────────────────
interface AlphaGroup { letter: string; items: LidarrArtist[] }
const alphaGroups = computed((): AlphaGroup[] => {
  if (search.value.trim() || activeFilter.value !== 'all') {
    return [{ letter: '', items: filtered.value }];
  }
  const groups: Record<string, LidarrArtist[]> = {};
  for (const a of filtered.value) {
    const first = a.sortName?.[0]?.toUpperCase() ?? '#';
    const key = /[A-Z]/.test(first) ? first : '#';
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b))
    .map(([letter, items]) => ({ letter, items }));
});

// Alphabet-Navigations-Keys (nur Buchstaben die vorkommen)
const alphaKeys = computed(() =>
  alphaGroups.value.map(g => g.letter).filter(l => l !== '')
);

function scrollToLetter(letter: string) {
  const el = document.getElementById(`alpha-${letter}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Poster / Stats helpers ────────────────────────────────────────────────────
// posterUrl imported from @/utils/images

function completionPct(a: LidarrArtist): number {
  const stats = (a as any).statistics;
  if (!stats || !stats.trackCount) return 0;
  return Math.round((stats.trackFileCount / stats.trackCount) * 100);
}

function statusColor(a: LidarrArtist): string {
  if (!a.monitored) return 'var(--text-muted)';
  const pct = completionPct(a);
  if (pct === 100) return '#22c55e';
  if (pct > 0)     return 'var(--lidarr)';
  return '#ef4444';
}

function rating(a: LidarrArtist): string {
  const v = a.ratings?.value;
  return v ? `★ ${v.toFixed(1)}` : '';
}

// ── Hover Tooltip ─────────────────────────────────────────────────────────────
function onMouseEnter(a: LidarrArtist, e: MouseEvent) {
  hoverArtist.value = a;
  updatePos(e);
}
function onMouseMove(e: MouseEvent) {
  if (hoverArtist.value) updatePos(e);
}
function onMouseLeave() {
  hoverArtist.value = null;
}
function updatePos(e: MouseEvent) {
  const x = e.clientX + 16;
  const y = e.clientY - 8;
  hoverPos.value = {
    x: Math.min(x, window.innerWidth - 280),
    y: Math.min(y, window.innerHeight - 200),
  };
}

function toggleSort(field: typeof sortBy.value) {
  if (sortBy.value === field) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else { sortBy.value = field; sortDir.value = 'asc'; }
}

onMounted(() => store.fetchArtists());
</script>

<template>
  <div class="music-view page-context" style="--context-color: var(--lidarr)">

    <!-- Hover Tooltip -->
    <Teleport to="body">
      <div v-if="hoverArtist" class="hover-tooltip"
        :style="{ left: hoverPos.x + 'px', top: hoverPos.y + 'px' }">
        <p class="ht-name">{{ hoverArtist.artistName }}</p>
        <p v-if="hoverArtist.genres?.length" class="ht-genres">{{ hoverArtist.genres.slice(0,4).join(' · ') }}</p>
        <p v-if="hoverArtist.overview" class="ht-overview">{{ hoverArtist.overview.slice(0, 200) }}{{ hoverArtist.overview.length > 200 ? '…' : '' }}</p>
        <div class="ht-stats">
          <span>{{ hoverArtist.albumCount ?? 0 }} Alben</span>
          <span class="ht-sep">·</span>
          <span>{{ completionPct(hoverArtist) }}% vollständig</span>
          <template v-if="rating(hoverArtist)">
            <span class="ht-sep">·</span>
            <span>{{ rating(hoverArtist) }}</span>
          </template>
        </div>
      </div>
    </Teleport>

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
      <!-- Filter Chips -->
      <div class="filter-chips">
        <button v-for="f in (['all','active','ended','monitored','unmonitored','complete','incomplete'] as const)"
          :key="f" :class="['filter-chip', { active: activeFilter===f }]"
          @click="activeFilter = f">
          {{ f==='all'?'Alle':f==='active'?'Aktiv':f==='ended'?'Inaktiv':f==='monitored'?'Überwacht':f==='unmonitored'?'Ignoriert':f==='complete'?'Vollständig':'Unvollständig' }}
        </button>
      </div>

      <!-- Sort -->
      <div class="sort-group">
        <button v-for="s in (['name','albums','rating'] as const)" :key="s"
          :class="['sort-btn', { active: sortBy === s }]" @click="toggleSort(s)">
          {{ s === 'name' ? 'A–Z' : s === 'albums' ? 'Alben' : 'Bewertung' }}
          <span v-if="sortBy === s" class="sort-arrow">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
        </button>
      </div>

      <span class="results-count">{{ filtered.length }} Ergebnisse</span>
    </div>

    <div v-if="store.error" class="error-banner">{{ store.error }}</div>

    <!-- Alphabet Nav -->
    <div v-if="alphaKeys.length > 1 && !search.trim()" class="alpha-nav">
      <button v-for="l in alphaKeys" :key="l" class="alpha-btn" @click="scrollToLetter(l)">{{ l }}</button>
    </div>

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
      <p class="empty-sub">{{ search ? `Keine Ergebnisse für „${search}"` : 'Kein Künstler entspricht diesem Filter.' }}</p>
    </div>

    <!-- Alphabetische Gruppen -->
    <template v-else>
      <div v-for="group in alphaGroups" :key="group.letter">
        <!-- Gruppen-Kopf (nur wenn Alpha-Modus aktiv) -->
        <div v-if="group.letter" :id="`alpha-${group.letter}`" class="alpha-group-head">
          {{ group.letter }}
        </div>

        <div class="poster-grid">
          <div v-for="artist in group.items" :key="artist.id"
            class="artist-card"
            @click="router.push(`/music/${artist.id}`)"
            @mouseenter="(e) => onMouseEnter(artist, e)"
            @mousemove="onMouseMove"
            @mouseleave="onMouseLeave">

            <!-- Poster mit Status-Dot + Progress -->
            <div class="poster-wrap">
              <img v-if="posterUrl(artist.images)" :src="posterUrl(artist.images)" :alt="artist.artistName" class="poster-img" loading="lazy" />
              <div v-else class="poster-ph">{{ artist.artistName[0] }}</div>

              <!-- Status-Dot -->
              <span class="status-dot" :style="{ background: statusColor(artist) }" />

              <!-- Progress-Bar (unten) -->
              <div class="progress-wrap">
                <div class="progress-bar" :style="{ width: completionPct(artist)+'%', background: completionPct(artist)===100 ? '#22c55e' : 'var(--lidarr)' }" />
              </div>
            </div>

            <!-- Name + Info -->
            <div class="card-info">
              <p class="card-name">{{ artist.artistName }}</p>
              <p v-if="rating(artist)" class="card-rating">{{ rating(artist) }}</p>
              <p v-else class="card-albums">{{ artist.albumCount ?? 0 }} Alben</p>
            </div>

          </div>
        </div>
      </div>
    </template>

  </div>
</template>

<style scoped>
.music-view { padding: var(--space-6); min-height: 100%; position: relative; }
.view-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-4); margin-bottom: var(--space-5); flex-wrap: wrap; }
.header-left { display: flex; flex-direction: column; gap: var(--space-2); }
.view-title  { display: flex; align-items: center; gap: var(--space-3); font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); }
.title-bar   { display: inline-block; width: 3px; height: 1.2em; background: var(--context-color); border-radius: 2px; flex-shrink: 0; }
.title-count { font-size: var(--text-base); font-weight: 400; color: var(--text-muted); }
.search-wrap { position: relative; flex-shrink: 0; }
.search-icon { position: absolute; left: var(--space-3); top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
.search-input { width: 260px; padding: var(--space-2) var(--space-3) var(--space-2) 36px; background: var(--bg-elevated); border: 1px solid var(--bg-border); border-radius: var(--radius-md); color: var(--text-primary); font-size: var(--text-sm); outline: none; transition: border-color .15s ease; }
.search-input:focus { border-color: var(--lidarr); }

/* Toolbar */
.toolbar { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-4); flex-wrap: wrap; }
.filter-chips { display: flex; gap: 4px; flex-wrap: wrap; }
.filter-chip { font-size: 11px; font-weight: 500; padding: 3px 9px; border-radius: 99px; background: var(--bg-elevated); border: 1px solid var(--bg-border); color: var(--text-muted); cursor: pointer; transition: all .12s; }
.filter-chip:hover { color: var(--text-secondary); border-color: rgba(255,255,255,.15); }
.filter-chip.active { background: rgba(34,198,91,.12); border-color: rgba(34,198,91,.3); color: var(--lidarr); }
.sort-group { display: flex; gap: 2px; background: var(--bg-elevated); border-radius: var(--radius-md); padding: 2px; border: 1px solid var(--bg-border); margin-left: auto; }
.sort-btn { padding: var(--space-1) var(--space-3); border-radius: calc(var(--radius-md) - 2px); font-size: var(--text-sm); color: var(--text-tertiary); transition: all .15s ease; white-space: nowrap; }
.sort-btn:hover { color: var(--text-secondary); }
.sort-btn.active { background: var(--bg-overlay); color: var(--text-primary); }
.sort-arrow { margin-left: 2px; opacity: .7; }
.results-count { font-size: var(--text-sm); color: var(--text-muted); }

/* Alphabet Nav */
.alpha-nav { display: flex; flex-wrap: wrap; gap: 2px; margin-bottom: var(--space-4); }
.alpha-btn { width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; border-radius: var(--radius-sm); background: var(--bg-elevated); border: 1px solid var(--bg-border); color: var(--text-muted); cursor: pointer; transition: all .12s; }
.alpha-btn:hover { background: rgba(34,198,91,.12); color: var(--lidarr); border-color: rgba(34,198,91,.3); }

/* Alpha Group Head */
.alpha-group-head { font-size: var(--text-xl); font-weight: 700; color: var(--lidarr); padding: var(--space-4) 0 var(--space-2); border-bottom: 2px solid rgba(34,198,91,.2); margin-bottom: var(--space-3); letter-spacing: .05em; }

.error-banner { padding: var(--space-4); background: rgba(248,113,113,.1); border: 1px solid rgba(248,113,113,.3); border-radius: var(--radius-md); color: var(--status-error); margin-bottom: var(--space-5); font-size: var(--text-sm); }

/* Poster Grid + Cards */
.poster-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: var(--space-3); margin-bottom: var(--space-3); }

.artist-card { cursor: pointer; border-radius: var(--radius-md); overflow: hidden; background: var(--bg-surface); border: 1px solid var(--bg-border); transition: transform .15s, box-shadow .15s; }
.artist-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.4); border-color: rgba(34,198,91,.25); }

.poster-wrap { position: relative; aspect-ratio: 2/3; overflow: hidden; background: var(--bg-elevated); }
.poster-img { width: 100%; height: 100%; object-fit: cover; }
.poster-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 36px; font-weight: 700; color: var(--text-muted); }

/* Status-Dot */
.status-dot { position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 50%; border: 1px solid rgba(0,0,0,.4); }

/* Progress-Bar (unten im Poster) */
.progress-wrap { position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: rgba(0,0,0,.4); }
.progress-bar { height: 100%; border-radius: 0; transition: width .3s; }

/* Card Info */
.card-info { padding: 6px 8px 8px; }
.card-name { font-size: 12px; font-weight: 600; color: var(--text-secondary); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.3; }
.card-rating { font-size: 10px; color: var(--lidarr); margin: 2px 0 0; }
.card-albums { font-size: 10px; color: var(--text-muted); margin: 2px 0 0; }

/* Hover Tooltip */
.hover-tooltip {
  position: fixed; z-index: 9999;
  width: 260px; pointer-events: none;
  background: var(--bg-elevated); border: 1px solid var(--bg-border);
  border-radius: var(--radius-lg); padding: var(--space-3) var(--space-4);
  box-shadow: 0 8px 32px rgba(0,0,0,.7);
  animation: ht-in .1s ease;
}
@keyframes ht-in { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
.ht-name { font-size: var(--text-sm); font-weight: 700; color: var(--text-primary); margin: 0 0 3px; }
.ht-genres { font-size: 10px; color: var(--lidarr); margin: 0 0 var(--space-2); }
.ht-overview { font-size: 11px; color: var(--text-muted); line-height: 1.5; margin: 0 0 var(--space-2); display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.ht-stats { display: flex; align-items: center; gap: 5px; font-size: 10px; color: var(--text-secondary); flex-wrap: wrap; }
.ht-sep { color: var(--text-muted); }

/* Skeleton */
.skeleton-card { border-radius: var(--radius-md); overflow: hidden; background: var(--bg-surface); border: 1px solid var(--bg-border); }
.skeleton-poster { aspect-ratio: 2/3; width: 100%; }
.skeleton-info { padding: var(--space-2); }
.skeleton-line { height: 12px; border-radius: 4px; }

.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-12) var(--space-4); gap: var(--space-3); text-align: center; }
.empty-icon  { font-size: 48px; line-height: 1; }
.empty-title { font-size: var(--text-lg); color: var(--text-secondary); font-weight: 600; }
.empty-sub   { color: var(--text-muted); font-size: var(--text-sm); }
</style>
