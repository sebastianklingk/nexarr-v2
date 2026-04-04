<script setup lang="ts">
defineProps<{
  title?: string;
  year?: string;
  rating?: number;
  genres?: string[];
  posterUrl?: string;
  overview?: string;
  tmdbId?: number;
  mediaType?: string;
}>();
</script>

<template>
  <div class="ai-poster-card">
    <img
      v-if="posterUrl"
      :src="posterUrl"
      :alt="title"
      class="poster-img"
      loading="lazy"
    />
    <div v-else class="poster-placeholder">
      <span>{{ mediaType === 'tv' ? '📺' : '🎬' }}</span>
    </div>
    <div class="poster-info">
      <div class="poster-title">{{ title }}</div>
      <div class="poster-meta">
        <span v-if="year">{{ year }}</span>
        <span v-if="rating" class="poster-rating">★ {{ typeof rating === 'number' ? rating.toFixed(1) : rating }}</span>
      </div>
      <div v-if="genres?.length" class="poster-genres">
        <span v-for="g in genres.slice(0, 3)" :key="g" class="genre-pill">{{ g }}</span>
      </div>
      <div v-if="overview" class="poster-overview">{{ overview }}</div>
    </div>
  </div>
</template>

<style scoped>
.ai-poster-card {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.poster-img {
  width: 80px;
  height: 120px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}
.poster-placeholder {
  width: 80px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-overlay);
  border-radius: var(--radius-sm);
  font-size: 24px;
  flex-shrink: 0;
}
.poster-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}
.poster-title {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.poster-meta {
  display: flex;
  gap: var(--space-2);
  font-size: var(--text-xs);
  color: var(--text-tertiary);
}
.poster-rating {
  color: #f59e0b;
}
.poster-genres {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.genre-pill {
  padding: 1px 6px;
  background: var(--bg-overlay);
  border-radius: var(--radius-sm);
  font-size: 10px;
  color: var(--text-secondary);
}
.poster-overview {
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
