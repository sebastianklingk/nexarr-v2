<script setup lang="ts">
withDefaults(defineProps<{
  title:       string;
  year?:       number;
  posterUrl?:  string;
  rating?:     number;
  hasFile?:    boolean;
  monitored?:  boolean;
  appColor?:   string;   // CSS var z.B. 'var(--radarr)'
  size?:       'sm' | 'md' | 'lg';
}>(), {
  size:      'md',
  hasFile:   false,
  monitored: true,
  appColor:  'var(--accent)',
});

const emit = defineEmits<{ click: [] }>();
</script>

<template>
  <div
    :class="['poster-card', `poster-card--${size}`, { 'has-file': hasFile, 'missing': !hasFile && monitored }]"
    :style="`--card-color: ${appColor}`"
    role="button"
    tabindex="0"
    @click="emit('click')"
    @keydown.enter="emit('click')"
  >
    <!-- Poster Image -->
    <div class="poster-wrap">
      <img
        v-if="posterUrl"
        :src="posterUrl"
        :alt="title"
        class="poster-img"
        loading="lazy"
      />
      <div v-else class="poster-placeholder">
        <span class="placeholder-letter">{{ title[0] }}</span>
      </div>

      <!-- Rating Badge -->
      <div v-if="rating" class="rating-badge">
        {{ rating.toFixed(1) }}
      </div>

      <!-- Status Indicator -->
      <div v-if="!hasFile && monitored" class="missing-indicator" />
    </div>

    <!-- Info -->
    <div class="poster-info">
      <p class="poster-title">{{ title }}</p>
      <p v-if="year" class="poster-year">{{ year }}</p>
    </div>
  </div>
</template>

<style scoped>
.poster-card {
  cursor: pointer;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  transition:
    transform 0.2s var(--ease-standard),
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  outline: none;
}

.poster-card:hover,
.poster-card:focus-visible {
  transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--card-color) 40%, transparent);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

/* Poster wrap */
.poster-wrap {
  position: relative;
  aspect-ratio: 2 / 3;
  background: var(--bg-elevated);
  overflow: hidden;
}

.poster-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.poster-card:hover .poster-img {
  transform: scale(1.04);
}

/* Placeholder */
.poster-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-overlay);
}

.placeholder-letter {
  font-size: 48px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
}

/* Rating */
.rating-badge {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  background: rgba(0, 0, 0, 0.75);
  color: var(--text-primary);
  font-size: var(--text-xs);
  font-weight: 600;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  backdrop-filter: blur(4px);
}

/* Missing indicator – roter Dot */
.missing-indicator {
  position: absolute;
  bottom: var(--space-2);
  left: var(--space-2);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--status-error);
  box-shadow: 0 0 6px var(--status-error);
}

/* Info */
.poster-info {
  padding: var(--space-2) var(--space-2) var(--space-3);
}

.poster-title {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.poster-year {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin-top: 2px;
}

/* Size variants */
.poster-card--sm .placeholder-letter { font-size: 32px; }
.poster-card--lg .placeholder-letter { font-size: 64px; }
</style>
