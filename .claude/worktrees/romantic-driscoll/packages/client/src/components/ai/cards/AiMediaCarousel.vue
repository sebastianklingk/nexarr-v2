<script setup lang="ts">
import AiPosterCard from './AiPosterCard.vue';

defineProps<{
  items?: Array<Record<string, unknown>>;
  title?: string;
}>();
</script>

<template>
  <div class="ai-carousel">
    <div v-if="title" class="carousel-title">{{ title }}</div>
    <div class="carousel-scroll">
      <div
        v-for="(item, idx) in (items ?? []).slice(0, 10)"
        :key="idx"
        class="carousel-item"
      >
        <AiPosterCard
          :title="String(item.title || item.name || '')"
          :year="String(item.year || '')"
          :rating="typeof item.rating === 'number' ? item.rating : undefined"
          :poster-url="typeof item.posterUrl === 'string' ? item.posterUrl : undefined"
          :overview="typeof item.overview === 'string' ? item.overview : undefined"
          :media-type="String(item.mediaType || 'movie')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-carousel {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.carousel-title {
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.carousel-scroll {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-height: 400px;
  overflow-y: auto;
}
.carousel-item {
  flex-shrink: 0;
}
</style>
