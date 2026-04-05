<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAbsStore } from '../stores/abs.store.js';
import type { ABSBookMetadata, ABSPodcastMetadata } from '@nexarr/shared';

const route  = useRoute();
const router = useRouter();
const store  = useAbsStore();
const { get } = (() => {
  const { useApi } = { useApi: () => ({ get: async <T>(url: string) => { const r = await fetch(url, { credentials: 'include' }); if (!r.ok) throw new Error(r.statusText); return r.json() as Promise<T>; } }) };
  return useApi();
})();

const itemId    = computed(() => route.params.id as string);
const item      = ref<any>(null);
const progress  = ref<any>(null);
const episodes  = ref<any[]>([]);
const isLoading = ref(true);

function coverUrl() { return `/api/abs/items/${itemId.value}/cover`; }

const meta = computed(() => {
  if (!item.value) return null;
  return item.value.mediaType === 'book'
    ? (item.value.media?.metadata as ABSBookMetadata)
    : (item.value.media?.metadata as ABSPodcastMetadata);
});

const bookMeta    = computed(() => item.value?.mediaType === 'book'    ? meta.value as ABSBookMetadata    : null);
const podcastMeta = computed(() => item.value?.mediaType === 'podcast' ? meta.value as ABSPodcastMetadata : null);

function fmtDuration(secs?: number): string {
  if (!secs) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtProgress(p?: any): { pct: number; label: string } {
  if (!p) return { pct: 0, label: 'Nicht gestartet' };
  if (p.isFinished) return { pct: 100, label: 'Abgeschlossen' };
  const pct = Math.round((p.currentTime / p.duration) * 100);
  const remaining = fmtDuration((p.duration ?? 0) - (p.currentTime ?? 0));
  return { pct, label: `${pct}% · ${remaining} verbleibend` };
}

function fmtEpDuration(ms?: number): string {
  if (!ms) return '';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

onMounted(async () => {
  try {
    const [itemData, progressData] = await Promise.allSettled([
      fetch(`/api/abs/items/${itemId.value}`, { credentials: 'include' }).then(r => r.json()),
      fetch(`/api/abs/items/${itemId.value}/progress`, { credentials: 'include' }).then(r => r.ok ? r.json() : null),
    ]);
    if (itemData.status === 'fulfilled') item.value = itemData.value;
    if (progressData.status === 'fulfilled') progress.value = progressData.value;

    if (item.value?.mediaType === 'podcast') {
      const epRes = await fetch(`/api/abs/items/${itemId.value}/episodes`, { credentials: 'include' });
      if (epRes.ok) {
        const data = await epRes.json();
        episodes.value = Array.isArray(data) ? data : (data?.episodes ?? []);
      }
    }
  } catch { /* */ }
  finally { isLoading.value = false; }
});
</script>

<template>
  <div class="abs-detail">

    <!-- Loading -->
    <div v-if="isLoading" class="loading-state">
      <div class="skeleton" style="width:160px;aspect-ratio:2/3;border-radius:var(--radius-lg);flex-shrink:0" />
      <div style="flex:1;display:flex;flex-direction:column;gap:var(--space-3)">
        <div class="skeleton" style="height:28px;width:60%;border-radius:8px" />
        <div class="skeleton" style="height:16px;width:40%;border-radius:6px" />
        <div class="skeleton" style="height:60px;border-radius:8px;margin-top:var(--space-2)" />
      </div>
    </div>

    <!-- Not found -->
    <div v-else-if="!item" class="empty-state">
      <p class="empty-title">Item nicht gefunden</p>
      <button class="back-btn" @click="router.back()">← Zurück</button>
    </div>

    <template v-else>
      <!-- Back -->
      <button class="back-btn" @click="router.back()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        Audiobookshelf
      </button>

      <!-- Hero -->
      <div class="hero">
        <div class="cover-wrap">
          <img :src="coverUrl()" :alt="bookMeta?.title ?? podcastMeta?.title ?? ''" class="cover-img"
            @error="($event.target as HTMLImageElement).style.display='none'" />
          <div class="cover-ph">{{ item.mediaType === 'book' ? '📖' : '🎙️' }}</div>
        </div>

        <div class="hero-info">
          <span class="media-type-badge" :class="item.mediaType">
            {{ item.mediaType === 'book' ? 'Hörbuch' : 'Podcast' }}
          </span>

          <h1 class="item-title">{{ bookMeta?.title ?? podcastMeta?.title ?? '–' }}</h1>

          <div v-if="bookMeta?.authorName" class="item-author">von {{ bookMeta.authorName }}</div>
          <div v-else-if="podcastMeta?.author" class="item-author">von {{ podcastMeta.author }}</div>

          <div v-if="bookMeta?.narratorName" class="item-narrator">Gesprochen von {{ bookMeta.narratorName }}</div>

          <!-- Meta Pills -->
          <div class="meta-pills">
            <span v-if="item.media?.duration" class="meta-pill">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {{ fmtDuration(item.media.duration) }}
            </span>
            <span v-if="bookMeta?.language" class="meta-pill">{{ bookMeta.language }}</span>
            <span v-if="bookMeta?.publishedYear" class="meta-pill">{{ bookMeta.publishedYear }}</span>
            <span v-if="item.media?.numEpisodes" class="meta-pill">{{ item.media.numEpisodes }} Episoden</span>
          </div>

          <!-- Genres -->
          <div v-if="bookMeta?.genres?.length" class="genres">
            <span v-for="g in bookMeta.genres" :key="g" class="genre-tag">{{ g }}</span>
          </div>

          <!-- Series -->
          <div v-if="bookMeta?.seriesName" class="series-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>
            {{ bookMeta.seriesName }}
          </div>

          <!-- Progress -->
          <div v-if="progress !== null" class="progress-section">
            <div class="progress-bar-wrap">
              <div class="progress-bar-fill" :style="{ width: fmtProgress(progress).pct + '%' }" />
            </div>
            <span class="progress-label">{{ fmtProgress(progress).label }}</span>
          </div>
        </div>
      </div>

      <!-- Description -->
      <div v-if="bookMeta?.description ?? podcastMeta?.description" class="description">
        <p>{{ bookMeta?.description ?? podcastMeta?.description }}</p>
      </div>

      <!-- Chapters (Bücher) -->
      <div v-if="item.media?.chapters?.length" class="section">
        <h2 class="section-title">
          Kapitel
          <span class="section-count">{{ item.media.chapters.length }}</span>
        </h2>
        <div class="chapters-list">
          <div v-for="(ch, i) in item.media.chapters" :key="ch.id ?? i" class="chapter-row">
            <span class="ch-num">{{ i + 1 }}</span>
            <span class="ch-title">{{ ch.title }}</span>
            <span class="ch-time">{{ fmtDuration(ch.start) }}</span>
          </div>
        </div>
      </div>

      <!-- Episodes (Podcasts) -->
      <div v-if="episodes.length" class="section">
        <h2 class="section-title">
          Episoden
          <span class="section-count">{{ episodes.length }}</span>
        </h2>
        <div class="episodes-list">
          <div v-for="ep in episodes" :key="ep.id" class="ep-row">
            <div class="ep-info">
              <p class="ep-title">{{ ep.title }}</p>
              <div class="ep-meta">
                <span v-if="ep.pubDate" class="ep-date">{{ fmtDate(ep.pubDate) }}</span>
                <span v-if="ep.duration" class="ep-dur">{{ fmtEpDuration(ep.duration * 1000) }}</span>
              </div>
              <p v-if="ep.description" class="ep-desc">{{ ep.description?.slice(0, 160) }}{{ ep.description?.length > 160 ? '…' : '' }}</p>
            </div>
          </div>
        </div>
      </div>

    </template>
  </div>
</template>

<style scoped>
.abs-detail { padding: var(--space-6); min-height: 100%; display: flex; flex-direction: column; gap: var(--space-6); max-width: 900px; }

/* Back */
.back-btn { display: inline-flex; align-items: center; gap: 5px; color: var(--text-tertiary); font-size: var(--text-sm); transition: color .15s; align-self: flex-start; }
.back-btn:hover { color: var(--text-primary); }

/* Hero */
.hero { display: flex; gap: var(--space-6); align-items: flex-start; flex-wrap: wrap; }

.cover-wrap { position: relative; flex-shrink: 0; width: 160px; }
.cover-img { width: 100%; aspect-ratio: 2/3; object-fit: cover; border-radius: var(--radius-lg); border: 1px solid var(--bg-border); box-shadow: 0 8px 32px rgba(0,0,0,.5); }
.cover-ph { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 48px; background: var(--bg-elevated); border-radius: var(--radius-lg); border: 1px solid var(--bg-border); z-index: -1; }

.hero-info { flex: 1; min-width: 260px; display: flex; flex-direction: column; gap: var(--space-3); }

.media-type-badge { display: inline-flex; align-items: center; font-size: var(--text-xs); font-weight: 700; padding: 2px 9px; border-radius: 99px; align-self: flex-start; }
.media-type-badge.book    { background: rgba(240,165,0,.12); color: #F0A500; border: 1px solid rgba(240,165,0,.25); }
.media-type-badge.podcast { background: rgba(155,0,69,.12); color: var(--accent); border: 1px solid rgba(155,0,69,.25); }

.item-title  { font-size: clamp(18px, 3vw, 26px); font-weight: 700; color: var(--text-primary); line-height: 1.25; margin: 0; }
.item-author { font-size: var(--text-sm); color: var(--text-secondary); font-weight: 500; }
.item-narrator { font-size: var(--text-sm); color: var(--text-muted); font-style: italic; }

.meta-pills { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.meta-pill { display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-xs); padding: 2px 9px; background: var(--bg-elevated); border: 1px solid var(--bg-border); border-radius: 99px; color: var(--text-muted); }

.genres { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.genre-tag { font-size: 11px; padding: 2px 9px; background: rgba(240,165,0,.08); border: 1px solid rgba(240,165,0,.2); border-radius: 99px; color: #c07800; }

.series-badge { display: inline-flex; align-items: center; gap: 5px; font-size: var(--text-xs); color: var(--text-muted); background: var(--bg-elevated); border: 1px solid var(--bg-border); border-radius: var(--radius-sm); padding: 3px 9px; align-self: flex-start; }

/* Progress */
.progress-section { display: flex; flex-direction: column; gap: var(--space-1); margin-top: var(--space-1); }
.progress-bar-wrap { height: 5px; background: var(--bg-border); border-radius: 3px; overflow: hidden; }
.progress-bar-fill { height: 100%; background: #F0A500; border-radius: 3px; transition: width .5s ease; }
.progress-label { font-size: var(--text-xs); color: var(--text-muted); }

/* Description */
.description { background: var(--bg-surface); border: 1px solid var(--bg-border); border-radius: var(--radius-lg); padding: var(--space-4) var(--space-5); }
.description p { font-size: var(--text-sm); color: var(--text-tertiary); line-height: 1.75; margin: 0; }

/* Section */
.section { display: flex; flex-direction: column; gap: var(--space-3); }
.section-title { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); border-left: 3px solid #F0A500; padding-left: var(--space-3); margin: 0; }
.section-count { font-size: var(--text-xs); font-weight: 400; color: var(--text-muted); }

/* Chapters */
.chapters-list { display: flex; flex-direction: column; background: var(--bg-surface); border: 1px solid var(--bg-border); border-radius: var(--radius-lg); overflow: hidden; }
.chapter-row { display: flex; align-items: center; gap: var(--space-3); padding: 8px var(--space-4); border-bottom: 1px solid rgba(255,255,255,.03); transition: background .12s; }
.chapter-row:last-child { border-bottom: none; }
.chapter-row:hover { background: var(--bg-elevated); }
.ch-num { font-size: 11px; color: var(--text-muted); min-width: 24px; font-variant-numeric: tabular-nums; text-align: right; flex-shrink: 0; }
.ch-title { flex: 1; font-size: var(--text-sm); color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ch-time { font-size: 11px; color: var(--text-muted); font-variant-numeric: tabular-nums; flex-shrink: 0; }

/* Episodes */
.episodes-list { display: flex; flex-direction: column; gap: var(--space-2); }
.ep-row { background: var(--bg-surface); border: 1px solid var(--bg-border); border-radius: var(--radius-md); padding: var(--space-3) var(--space-4); transition: border-color .12s; }
.ep-row:hover { border-color: rgba(240,165,0,.3); }
.ep-info { display: flex; flex-direction: column; gap: 4px; }
.ep-title { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); margin: 0; }
.ep-meta { display: flex; gap: var(--space-3); }
.ep-date, .ep-dur { font-size: var(--text-xs); color: var(--text-muted); }
.ep-desc { font-size: var(--text-xs); color: var(--text-muted); line-height: 1.5; margin: 0; }

/* Loading */
.loading-state { display: flex; gap: var(--space-5); padding-top: var(--space-4); flex-wrap: wrap; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: var(--space-4); }
.empty-title { font-size: var(--text-lg); color: var(--text-secondary); font-weight: 600; }
</style>
