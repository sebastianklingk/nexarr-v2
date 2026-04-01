<script setup lang="ts">
withDefaults(defineProps<{
  title:       string;
  year?:       number;
  posterUrl?:  string;
  rating?:     number;
  hasFile?:    boolean;
  monitored?:  boolean;
  appColor?:   string;
  quality?:    string;      // '4K', '1080p', '720p', etc.
  progress?:   number;      // 0-100 für Serien-Completion
  episodes?:   string;      // z.B. '42 Ep.' für Serien
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
    :class="['poster-card', `poster-card--${size}`]"
    :style="`--card-color: ${appColor}`"
    role="button"
    tabindex="0"
    @click="emit('click')"
    @keydown.enter="emit('click')"
  >
    <div class="poster-wrap">
      <img v-if="posterUrl" :src="posterUrl" :alt="title" class="poster-img" loading="lazy" />
      <div v-else class="poster-placeholder">
        <span class="placeholder-letter">{{ title[0] }}</span>
      </div>

      <!-- Status Dot (top-right) -->
      <div
        :class="['status-dot', hasFile ? 'dot-ok' : monitored ? 'dot-miss' : 'dot-unmon']"
        :title="hasFile ? 'Vorhanden' : monitored ? 'Fehlt' : 'Nicht überwacht'"
      />

      <!-- Quality Badge (top-left) -->
      <div v-if="quality" class="quality-badge">{{ quality }}</div>

      <!-- Rating (bottom-right) -->
      <div v-if="rating && rating > 0" class="rating-badge">★ {{ rating.toFixed(1) }}</div>

      <!-- Progress bar (bottom, für Serien) -->
      <div v-if="progress !== undefined && progress < 100" class="progress-bar">
        <div class="progress-fill" :style="{ width: `${progress}%` }" />
      </div>
    </div>

    <div class="poster-info">
      <p class="poster-title">{{ title }}</p>
      <div class="poster-meta">
        <span v-if="year" class="poster-year">{{ year }}</span>
        <span v-if="episodes" class="poster-eps">· {{ episodes }}</span>
      </div>
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
  transition: transform 0.18s var(--ease-standard), border-color 0.18s ease, box-shadow 0.18s ease;
  outline: none;
}

.poster-card:hover,
.poster-card:focus-visible {
  transform: translateY(-3px) scale(1.01);
  border-color: color-mix(in srgb, var(--card-color) 50%, transparent);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  z-index: 2;
  position: relative;
}

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
.poster-card:hover .poster-img { transform: scale(1.05); }

.poster-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-overlay);
}
.placeholder-letter { font-size: 48px; font-weight: 700; color: var(--text-muted); }

/* Status Dot */
.status-dot {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1.5px solid rgba(0,0,0,0.5);
  z-index: 3;
}
.dot-ok   { background: #22c55e; box-shadow: 0 0 4px rgba(34,197,94,.6); }
.dot-miss { background: #ef4444; box-shadow: 0 0 4px rgba(239,68,68,.6); }
.dot-unmon { background: #666; }

/* Quality Badge */
.quality-badge {
  position: absolute;
  top: 5px;
  left: 5px;
  background: rgba(0,0,0,.75);
  color: var(--text-primary);
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  backdrop-filter: blur(4px);
  letter-spacing: .02em;
  z-index: 3;
}

/* Rating */
.rating-badge {
  position: absolute;
  bottom: 22px;
  right: 5px;
  background: rgba(0,0,0,.75);
  color: #facc15;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 5px;
  border-radius: 3px;
  backdrop-filter: blur(4px);
  z-index: 3;
}

/* Progress Bar */
.progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(0,0,0,.5);
  z-index: 3;
}
.progress-fill {
  height: 100%;
  background: var(--card-color);
  border-radius: 0 2px 2px 0;
  transition: width .3s ease;
}

/* Info */
.poster-info { padding: var(--space-2) var(--space-2) var(--space-2); }
.poster-title {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
  font-weight: 500;
}
.poster-meta  { display: flex; gap: 4px; margin-top: 1px; }
.poster-year  { font-size: 10px; color: var(--text-muted); }
.poster-eps   { font-size: 10px; color: var(--text-muted); }

/* Sizes */
.poster-card--sm .placeholder-letter { font-size: 32px; }
.poster-card--lg .placeholder-letter { font-size: 64px; }
</style>
