<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAbsStore } from '../stores/abs.store.js';
import type { ABSLibraryItem, ABSBookMetadata, ABSPodcastMetadata } from '@nexarr/shared';

const router = useRouter();
const store = useAbsStore();
const searchInput = ref('');
let   searchTimer: ReturnType<typeof setTimeout> | null = null;

onMounted(async () => {
  await store.fetchLibraries();
  if (store.activeLibId) await store.loadItems();
});

watch(searchInput, (val) => {
  if (searchTimer) clearTimeout(searchTimer);
  store.searchQuery = val;
  if (!val.trim()) { store.searchResults = []; return; }
  searchTimer = setTimeout(() => store.search(val), 350);
});

const displayItems = () =>
  searchInput.value.trim() ? store.searchResults : store.items;

function bookMeta(item: ABSLibraryItem): ABSBookMetadata | null {
  return item.mediaType === 'book'
    ? (item.media.metadata as ABSBookMetadata)
    : null;
}

function podcastMeta(item: ABSLibraryItem): ABSPodcastMetadata | null {
  return item.mediaType === 'podcast'
    ? (item.media.metadata as ABSPodcastMetadata)
    : null;
}

function formatDuration(secs?: number): string {
  if (!secs) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function absDeepLink(itemId: string): string {
  return `audiobookshelf://item/${itemId}`;
}
</script>

<template>
  <div class="abs-view">

    <!-- Header -->
    <div class="view-header">
      <div class="header-left">
        <div class="app-indicator" />
        <h1 class="view-title">Audiobookshelf</h1>
        <span v-if="!store.isLoading && store.totalItems" class="count-badge">
          {{ store.totalItems }}
        </span>
      </div>

      <!-- Library Switcher -->
      <div v-if="store.libraries.length > 1" class="lib-tabs">
        <button
          v-for="lib in store.libraries"
          :key="lib.id"
          :class="['lib-tab', { active: store.activeLibId === lib.id }]"
          @click="store.loadItems(lib.id)"
        >
          {{ lib.name }}
        </button>
      </div>
    </div>

    <!-- Nicht konfiguriert -->
    <div v-if="!store.configured" class="empty-state">
      <div class="empty-icon">📚</div>
      <p class="empty-title">Audiobookshelf nicht konfiguriert</p>
      <p class="empty-sub">ABS_URL und ABS_TOKEN in der .env setzen</p>
    </div>

    <!-- Fehler -->
    <div v-else-if="store.error && !store.items.length" class="empty-state">
      <div class="empty-icon">⚠️</div>
      <p class="empty-title">{{ store.error }}</p>
    </div>

    <template v-else>
      <!-- Suchfeld -->
      <div class="search-bar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          v-model="searchInput"
          class="search-input"
          type="text"
          placeholder="Bücher & Podcasts suchen…"
        />
        <button v-if="searchInput" class="search-clear" @click="searchInput = ''">×</button>
      </div>

      <!-- Grid -->
      <div v-if="store.isLoading" class="items-grid">
        <div v-for="i in 16" :key="i" class="skeleton item-skeleton" />
      </div>

      <div v-else-if="!displayItems().length" class="empty-state">
        <div class="empty-icon">🔍</div>
        <p class="empty-title">Keine Ergebnisse</p>
      </div>

      <div v-else class="items-grid">
        <div
          v-for="item in displayItems()"
          :key="item.id"
          class="item-card"
          :class="item.mediaType"
          @click="router.push(`/audiobookshelf/${item.id}`)"
        >
          <!-- Cover -->
          <div class="item-cover">
            <img
              :src="store.coverUrl(item.id)"
              :alt="bookMeta(item)?.title ?? podcastMeta(item)?.title ?? ''"
              loading="lazy"
              @error="($event.target as HTMLImageElement).style.display='none'"
            />
            <div class="cover-placeholder">
              {{ item.mediaType === 'book' ? '📖' : '🎙️' }}
            </div>
          </div>

          <!-- Info -->
          <div class="item-info">
            <p class="item-title">
              {{ bookMeta(item)?.title ?? podcastMeta(item)?.title ?? '–' }}
            </p>
            <p v-if="bookMeta(item)?.authorName" class="item-sub">
              {{ bookMeta(item)!.authorName }}
            </p>
            <p v-else-if="podcastMeta(item)?.author" class="item-sub">
              {{ podcastMeta(item)!.author }}
            </p>
            <div class="item-meta">
              <span v-if="item.media.duration" class="meta-pill">
                {{ formatDuration(item.media.duration) }}
              </span>
              <span v-if="bookMeta(item)?.seriesName" class="meta-pill meta-series">
                {{ bookMeta(item)!.seriesName }}
              </span>
              <span v-if="item.mediaType === 'podcast' && item.media.numEpisodes" class="meta-pill">
                {{ item.media.numEpisodes }} Folgen
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Load More -->
      <div v-if="store.hasMore && !searchInput" class="load-more-wrap">
        <button
          class="load-more-btn"
          :disabled="store.isLoadingMore"
          @click="store.loadMore()"
        >
          <svg v-if="store.isLoadingMore" class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          {{ store.isLoadingMore ? 'Lade…' : `Mehr laden (${store.totalItems - store.items.length} weitere)` }}
        </button>
      </div>
    </template>

  </div>
</template>

<style scoped>
.abs-view {
  padding: var(--space-6);
}

/* Header */
.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.app-indicator {
  width: 4px;
  height: 28px;
  background: var(--abs, #F0A500);
  border-radius: 2px;
}

.view-title {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-primary);
}

.count-badge {
  background: var(--abs, #F0A500);
  color: #000;
  font-size: var(--text-xs);
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 99px;
}

/* Library Tabs */
.lib-tabs {
  display: flex;
  gap: var(--space-1);
  background: var(--bg-elevated);
  border-radius: var(--radius-md);
  padding: 3px;
  border: 1px solid var(--bg-border);
}

.lib-tab {
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: all .15s ease;
  background: none;
  border: none;
}

.lib-tab.active {
  background: var(--abs, #F0A500);
  color: #000;
  font-weight: 600;
}

/* Search */
.search-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  background: var(--bg-elevated);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  margin-bottom: var(--space-5);
  color: var(--text-muted);
  transition: border-color .15s ease;
}

.search-bar:focus-within {
  border-color: var(--abs, #F0A500);
  color: var(--text-secondary);
}

.search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  font-size: var(--text-sm);
  color: var(--text-primary);
}

.search-input::placeholder { color: var(--text-muted); }

.search-clear {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0 2px;
}

/* Grid */
.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: var(--space-4);
}

.item-skeleton {
  aspect-ratio: 2/3;
  border-radius: var(--radius-md);
}

/* Item Card */
.item-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  cursor: pointer;
  transition: transform .15s;
}
.item-card:hover { transform: translateY(-2px); }
.item-card:hover .item-cover { border-color: rgba(240,165,0,.4); }

.item-cover {
  position: relative;
  aspect-ratio: 2/3;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-elevated);
  border: 1px solid var(--bg-border);
}

.item-card.podcast .item-cover {
  aspect-ratio: 1/1;
}

.item-cover img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 1;
}

.cover-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  z-index: 0;
}

.item-info { display: flex; flex-direction: column; gap: 2px; }

.item-title {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--text-secondary);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-sub {
  font-size: var(--text-xs);
  color: var(--text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
}

.meta-pill {
  font-size: 10px;
  padding: 1px 6px;
  background: var(--bg-elevated);
  border: 1px solid var(--bg-border);
  border-radius: 99px;
  color: var(--text-muted);
  white-space: nowrap;
}

.meta-series {
  background: rgba(240,165,0,.1);
  border-color: rgba(240,165,0,.25);
  color: var(--abs, #F0A500);
}

/* Empty */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  gap: var(--space-3);
  text-align: center;
}

.empty-icon { font-size: 48px; }
.empty-title { font-size: var(--text-lg); font-weight: 600; color: var(--text-secondary); }
.empty-sub   { font-size: var(--text-sm); color: var(--text-muted); }

/* Load More */
.load-more-wrap {
  display: flex;
  justify-content: center;
  margin-top: var(--space-6);
}

.load-more-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 8px 20px;
  background: var(--bg-elevated);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: all .15s ease;
}

.load-more-btn:hover:not(:disabled) {
  border-color: var(--abs, #F0A500);
  color: var(--text-primary);
}

.load-more-btn:disabled { opacity: .6; cursor: not-allowed; }

@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin .8s linear infinite; }
</style>
