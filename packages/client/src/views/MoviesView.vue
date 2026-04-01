<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useMoviesStore } from '../stores/movies.store.js';
import PosterCard from '../components/ui/PosterCard.vue';
import type { RadarrMovie } from '@nexarr/shared';

const router = useRouter();
const store  = useMoviesStore();

// ── State ─────────────────────────────────────────────────────────────────────
const search   = ref('');
const filter   = ref<'all' | 'available' | 'missing' | 'monitored' | 'unmonitored'>('all');
const sortBy   = ref<'title' | 'year' | 'added' | 'rating'>('title');
const sortDir  = ref<'asc' | 'desc'>('asc');
const groupBy  = ref<'alpha' | 'none'>('alpha');

// ── Filtered + Sorted ─────────────────────────────────────────────────────────
const filtered = computed((): RadarrMovie[] => {
  let list = [...store.movies];

  if (search.value.trim()) {
    const q = search.value.toLowerCase();
    list = list.filter(m => m.title.toLowerCase().includes(q) || m.originalTitle?.toLowerCase().includes(q));
  }

  switch (filter.value) {
    case 'available':   list = list.filter(m => m.hasFile); break;
    case 'missing':     list = list.filter(m => !m.hasFile && m.monitored); break;
    case 'monitored':   list = list.filter(m => m.monitored); break;
    case 'unmonitored': list = list.filter(m => !m.monitored); break;
  }

  list.sort((a, b) => {
    let cmp = 0;
    if (sortBy.value === 'title')  cmp = a.sortTitle.localeCompare(b.sortTitle);
    if (sortBy.value === 'year')   cmp = (a.year ?? 0) - (b.year ?? 0);
    if (sortBy.value === 'added')  cmp = a.added.localeCompare(b.added);
    if (sortBy.value === 'rating') cmp = (a.ratings?.tmdb?.value ?? 0) - (b.ratings?.tmdb?.value ?? 0);
    return sortDir.value === 'asc' ? cmp : -cmp;
  });

  return list;
});

// ── Alphabetische Gruppen ─────────────────────────────────────────────────────
const grouped = computed((): Array<{ letter: string; items: RadarrMovie[] }> => {
  if (groupBy.value === 'none') return [{ letter: '', items: filtered.value }];

  const map = new Map<string, RadarrMovie[]>();
  for (const m of filtered.value) {
    const first = m.sortTitle[0]?.toUpperCase() ?? '#';
    const key   = /[A-Z]/.test(first) ? first : '#';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  // Sortierte Keys: # zuerst, dann A-Z
  const sorted = [...map.keys()].sort((a, b) => {
    if (a === '#') return -1;
    if (b === '#') return 1;
    return a.localeCompare(b);
  });
  return sorted.map(letter => ({ letter, items: map.get(letter)! }));
});

// Alle vorhandenen Buchstaben für die Alphabet-Navigation
const availableLetters = computed(() => new Set(grouped.value.map(g => g.letter)));

// ── Helpers ───────────────────────────────────────────────────────────────────
function posterUrl(m: RadarrMovie): string | undefined {
  return m.images?.find(i => i.coverType === 'poster')?.remoteUrl;
}

function qualityLabel(m: RadarrMovie): string | undefined {
  if (!m.movieFile) return undefined;
  const res = m.movieFile.quality?.quality?.resolution;
  if (res === 2160) return '4K';
  if (res === 1080) return '1080p';
  if (res === 720)  return '720p';
  return m.movieFile.quality?.quality?.name?.split('-')[0];
}

function toggleSort(field: typeof sortBy.value) {
  if (sortBy.value === field) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  else { sortBy.value = field; sortDir.value = 'asc'; }
}

function scrollToLetter(letter: string) {
  const el = document.getElementById(`alpha-${letter}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openMovie(m: RadarrMovie) { router.push(`/movies/${m.id}`); }

onMounted(() => store.fetchMovies());

const ALPHABET = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
</script>

<template>
  <div class="movies-view">

    <!-- ── Header ── -->
    <div class="view-header">
      <div class="header-left">
        <div class="header-title-row">
          <div class="app-bar" style="background: var(--radarr)" />
          <h1 class="view-title">Filme</h1>
          <span v-if="!store.isLoading" class="total-count">
            {{ filtered.length.toLocaleString('de-DE') }} von {{ store.stats.total.toLocaleString('de-DE') }}
          </span>
        </div>
        <div class="header-chips">
          <span class="chip chip-ok">✓ {{ store.stats.available.toLocaleString('de-DE') }} vorhanden</span>
          <span v-if="store.stats.missing > 0" class="chip chip-miss">✗ {{ store.stats.missing.toLocaleString('de-DE') }} fehlen</span>
          <span class="chip chip-neutral">{{ store.stats.total - store.stats.available - store.stats.missing }} nicht überwacht</span>
        </div>
      </div>

      <div class="header-right">
        <!-- Suche -->
        <div class="search-box">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input v-model="search" type="search" class="search-input" placeholder="Filme suchen…" />
          <button v-if="search" class="search-clear" @click="search = ''">×</button>
        </div>
        <!-- Hinzufügen -->
        <button class="add-btn" @click="router.push('/search')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Film hinzufügen
        </button>
      </div>
    </div>

    <!-- ── Toolbar ── -->
    <div class="toolbar">
      <!-- Filter -->
      <div class="btn-group">
        <button :class="['tbtn', filter==='all' && 'tbtn-on']" @click="filter='all'">Alle</button>
        <button :class="['tbtn', filter==='available' && 'tbtn-on']" @click="filter='available'">Vorhanden</button>
        <button :class="['tbtn', filter==='missing' && 'tbtn-on']" @click="filter='missing'">Fehlend</button>
        <button :class="['tbtn', filter==='monitored' && 'tbtn-on']" @click="filter='monitored'">Überwacht</button>
        <button :class="['tbtn', filter==='unmonitored' && 'tbtn-on']" @click="filter='unmonitored'">Nicht überwacht</button>
      </div>

      <div class="toolbar-sep" />

      <!-- Sortierung -->
      <div class="btn-group">
        <button v-for="s in (['title','year','added','rating'] as const)" :key="s"
          :class="['tbtn', sortBy===s && 'tbtn-on']" @click="toggleSort(s)">
          {{ s==='title' ? 'A–Z' : s==='year' ? 'Jahr' : s==='added' ? 'Neu' : 'Bewertung' }}
          <span v-if="sortBy===s">{{ sortDir==='asc' ? '↑' : '↓' }}</span>
        </button>
      </div>

      <div class="toolbar-sep" />

      <!-- Gruppierung -->
      <div class="btn-group">
        <button :class="['tbtn', groupBy==='alpha' && 'tbtn-on']" @click="groupBy='alpha'">A–Z Gruppen</button>
        <button :class="['tbtn', groupBy==='none' && 'tbtn-on']" @click="groupBy='none'">Alle</button>
      </div>

      <span class="result-count">{{ filtered.length.toLocaleString('de-DE') }} Filme</span>
    </div>

    <!-- ── Error ── -->
    <div v-if="store.error" class="error-banner">{{ store.error }}</div>

    <!-- ── Loading ── -->
    <div v-if="store.isLoading" class="poster-grid">
      <div v-for="i in 32" :key="i" class="skel-card">
        <div class="skel-img skeleton" />
        <div class="skel-line skeleton" style="width:75%;margin-top:6px" />
        <div class="skel-line skeleton" style="width:40%;margin-top:4px" />
      </div>
    </div>

    <!-- ── Empty ── -->
    <div v-else-if="filtered.length === 0" class="empty-state">
      <div class="empty-icon">🎬</div>
      <p class="empty-title">Keine Filme gefunden</p>
      <p class="empty-sub">{{ search ? `Keine Treffer für „${search}"` : 'Kein Film entspricht dem Filter.' }}</p>
      <button v-if="filter !== 'all' || search" class="reset-btn" @click="filter='all'; search=''">Filter zurücksetzen</button>
    </div>

    <!-- ── Content ── -->
    <template v-else>
      <div class="content-wrap">

        <!-- Poster Grid mit Alphabet-Gruppen -->
        <div class="groups-wrap">
          <template v-for="group in grouped" :key="group.letter">
            <!-- Letter Header -->
            <div v-if="group.letter" :id="`alpha-${group.letter}`" class="alpha-header">
              {{ group.letter }}
            </div>

            <!-- Grid -->
            <div class="poster-grid">
              <PosterCard
                v-for="m in group.items"
                :key="m.id"
                :title="m.title"
                :year="m.year"
                :poster-url="posterUrl(m)"
                :rating="m.ratings?.tmdb?.value ?? m.ratings?.imdb?.value"
                :has-file="m.hasFile"
                :monitored="m.monitored"
                :quality="qualityLabel(m)"
                app-color="var(--radarr)"
                @click="openMovie(m)"
              />
            </div>
          </template>
        </div>

        <!-- Alphabet-Navigation (rechts) -->
        <nav v-if="groupBy === 'alpha'" class="alpha-nav">
          <button
            v-for="letter in ALPHABET"
            :key="letter"
            :class="['alpha-btn', availableLetters.has(letter) ? 'alpha-btn-on' : 'alpha-btn-off']"
            :disabled="!availableLetters.has(letter)"
            @click="scrollToLetter(letter)"
          >
            {{ letter }}
          </button>
        </nav>
      </div>
    </template>

  </div>
</template>

<style scoped>
.movies-view {
  padding: var(--space-5) var(--space-6) var(--space-6);
  min-height: 100%;
  position: relative;
}

/* Header */
.view-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: var(--space-4); margin-bottom: var(--space-4); flex-wrap: wrap;
}
.header-left { display: flex; flex-direction: column; gap: var(--space-2); }
.header-title-row { display: flex; align-items: center; gap: var(--space-3); }
.app-bar { width: 3px; height: 24px; border-radius: 2px; flex-shrink: 0; }
.view-title { font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); margin: 0; }
.total-count { font-size: var(--text-sm); color: var(--text-muted); font-weight: 400; }
.header-chips { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.chip { font-size: 11px; padding: 2px 8px; border-radius: 99px; font-weight: 500; }
.chip-ok      { background: rgba(34,197,94,.1); color: #22c55e; border: 1px solid rgba(34,197,94,.25); }
.chip-miss    { background: rgba(239,68,68,.1); color: #ef4444; border: 1px solid rgba(239,68,68,.25); }
.chip-neutral { background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--bg-border); }

.header-right { display: flex; align-items: center; gap: var(--space-3); flex-shrink: 0; }

.search-box {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--bg-elevated); border: 1px solid var(--bg-border);
  border-radius: var(--radius-md); color: var(--text-muted);
  transition: border-color .15s;
}
.search-box:focus-within { border-color: var(--radarr); color: var(--text-secondary); }
.search-input { background: none; border: none; outline: none; font-size: var(--text-sm); color: var(--text-primary); width: 200px; }
.search-input::placeholder { color: var(--text-muted); }
.search-clear { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 16px; padding: 0; }

.add-btn {
  display: inline-flex; align-items: center; gap: var(--space-2);
  padding: 7px 14px; background: var(--radarr); border: none;
  border-radius: var(--radius-md); color: #000; font-size: var(--text-sm);
  font-weight: 600; cursor: pointer; transition: opacity .15s;
}
.add-btn:hover { opacity: .85; }

/* Toolbar */
.toolbar {
  display: flex; align-items: center; gap: var(--space-3);
  margin-bottom: var(--space-5); flex-wrap: wrap;
}
.btn-group {
  display: flex; gap: 2px;
  background: var(--bg-elevated); border: 1px solid var(--bg-border);
  border-radius: var(--radius-md); padding: 2px;
}
.tbtn {
  padding: 5px 12px; border-radius: calc(var(--radius-md) - 2px);
  font-size: var(--text-xs); color: var(--text-muted);
  transition: background .12s, color .12s; white-space: nowrap; cursor: pointer;
}
.tbtn:hover { color: var(--text-secondary); }
.tbtn-on { background: var(--bg-overlay); color: var(--text-primary); font-weight: 500; }
.toolbar-sep { width: 1px; height: 20px; background: var(--bg-border); flex-shrink: 0; }
.result-count { font-size: var(--text-xs); color: var(--text-muted); margin-left: auto; }

/* Error */
.error-banner {
  padding: var(--space-4); background: rgba(239,68,68,.08);
  border: 1px solid rgba(239,68,68,.25); border-radius: var(--radius-md);
  color: #ef4444; margin-bottom: var(--space-5); font-size: var(--text-sm);
}

/* Content Wrap */
.content-wrap { display: flex; gap: var(--space-4); align-items: flex-start; }
.groups-wrap  { flex: 1; min-width: 0; }

/* Alpha Header */
.alpha-header {
  font-size: var(--text-sm); font-weight: 700; color: var(--text-muted);
  padding: var(--space-3) 0 var(--space-2);
  border-bottom: 1px solid var(--bg-border); margin-bottom: var(--space-3);
  scroll-margin-top: 80px;
}

/* Poster Grid */
.poster-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

/* Alphabet Nav (rechts) */
.alpha-nav {
  position: sticky; top: var(--space-4);
  display: flex; flex-direction: column; gap: 1px;
  flex-shrink: 0;
}
.alpha-btn {
  width: 22px; height: 22px; border-radius: var(--radius-sm);
  font-size: 11px; font-weight: 600; text-align: center;
  transition: background .1s, color .1s; cursor: pointer;
  line-height: 22px; padding: 0;
}
.alpha-btn-on  { color: var(--text-secondary); }
.alpha-btn-on:hover { background: var(--bg-elevated); color: var(--radarr); }
.alpha-btn-off { color: var(--text-muted); opacity: .35; cursor: default; }

/* Skeleton */
.skel-card { border-radius: var(--radius-md); overflow: hidden; background: var(--bg-surface); border: 1px solid var(--bg-border); padding: 0 0 var(--space-2); }
.skel-img  { aspect-ratio: 2/3; width: 100%; }
.skel-line { height: 10px; border-radius: 3px; margin: 0 var(--space-2); }

/* Empty */
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: var(--space-12) var(--space-4); gap: var(--space-3); text-align: center; min-height: 40vh; }
.empty-icon  { font-size: 48px; }
.empty-title { font-size: var(--text-lg); color: var(--text-secondary); font-weight: 600; margin: 0; }
.empty-sub   { color: var(--text-muted); font-size: var(--text-sm); margin: 0; }
.reset-btn   { padding: 7px 16px; background: var(--bg-elevated); border: 1px solid var(--bg-border); border-radius: var(--radius-md); color: var(--text-secondary); font-size: var(--text-sm); cursor: pointer; transition: background .15s; }
.reset-btn:hover { background: var(--bg-overlay); }
</style>
