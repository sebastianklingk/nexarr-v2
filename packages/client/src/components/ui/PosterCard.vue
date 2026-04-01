<script setup lang="ts">
import { ref, computed } from 'vue';

const props = withDefaults(defineProps<{
  title:        string;
  year?:        number;
  posterUrl?:   string;
  rating?:      number;
  hasFile?:     boolean;
  monitored?:   boolean;
  appColor?:    string;
  quality?:     string;
  progress?:    number;
  episodes?:    string;
  overview?:    string;
  genres?:      string[];
  runtime?:     number;
  imdbRating?:  number;
  tmdbRating?:  number;
  techBadges?:  Array<{ label: string; color: string }>;
  network?:     string;
  seasons?:     number;
  size?:        'sm' | 'md' | 'lg';
}>(), {
  size:      'md',
  hasFile:   false,
  monitored: true,
  appColor:  'var(--accent)',
  genres:    () => [],
  techBadges: () => [],
});

const emit = defineEmits<{ click: [] }>();

// Tooltip state
const showTooltip = ref(false);
const tooltipX    = ref(0);
const tooltipY    = ref(0);
let   hoverTimer: ReturnType<typeof setTimeout> | null = null;

// Globale Mausposition – immer aktuell (wie v1's _mx/_my)
let _mx = 0;
let _my = 0;

function onMouseEnter() {
  if (hoverTimer) clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => {
    // Nutze die AKTUELLE Mausposition, nicht die 260ms alte
    setPos(_mx, _my);
    showTooltip.value = true;
  }, 260);
}

function onMouseMove(e: MouseEvent) {
  _mx = e.clientX;
  _my = e.clientY;
  if (showTooltip.value) setPos(_mx, _my);
}

function onMouseLeave() {
  if (hoverTimer) clearTimeout(hoverTimer);
  showTooltip.value = false;
}

function setPos(cx: number, cy: number) {
  const x = cx + 16;
  const y = cy - 16;
  tooltipX.value = x + 250 > window.innerWidth  - 8 ? cx - 266 : x;
  tooltipY.value = Math.max(8, Math.min(y, window.innerHeight - 300));
}

// Statusfarbe
const barColor = computed(() => {
  if (props.hasFile) return '#22c55e';
  if (props.monitored) return '#f59e0b';
  return '#555';
});
</script>

<template>
  <div
    :class="['poster-card', `poster-card--${size}`]"
    :style="`--card-color: ${appColor}`"
    role="button"
    tabindex="0"
    @click="emit('click')"
    @keydown.enter="emit('click')"
    @mouseenter="onMouseEnter"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <!-- Poster Image -->
    <div class="poster-wrap">
      <img v-if="posterUrl" :src="posterUrl" :alt="title" class="poster-img" loading="lazy" />
      <div v-else class="poster-placeholder">
        <span class="ph-letter">{{ title[0] }}</span>
      </div>

      <!-- Status Dot (oben rechts) -->
      <div :class="['status-dot', hasFile ? 'dot-ok' : monitored ? 'dot-miss' : 'dot-unmon']"
        :title="hasFile ? 'Vorhanden' : monitored ? 'Fehlt' : 'Nicht überwacht'" />

      <!-- Quality Badge (oben links) -->
      <div v-if="quality" class="quality-badge">{{ quality }}</div>

      <!-- Progress bar (unten, für Serien) -->
      <div v-if="progress !== undefined && progress >= 0" class="progress-bar">
        <div class="progress-fill" :style="{ width: `${progress}%` }" />
      </div>
    </div>

    <!-- Info unter dem Poster -->
    <div class="poster-info">
      <p class="poster-title">{{ title }}</p>
      <div class="poster-meta-row">
        <span v-if="year" class="poster-year">{{ year }}</span>
        <span v-if="episodes" class="poster-eps">{{ episodes }}</span>
        <span v-if="rating && rating > 0" class="poster-rating">★ {{ rating.toFixed(1) }}</span>
      </div>
    </div>

    <!-- Hover Tooltip (Teleport to body um Overflow zu vermeiden) -->
    <Teleport to="body">
      <div
        v-if="showTooltip"
        class="poster-tooltip"
        :style="{ left: tooltipX + 'px', top: tooltipY + 'px' }"
      >
        <!-- Farbbalken oben -->
        <div class="tt-bar" :style="{ background: barColor }" />

        <div class="tt-body">
          <!-- Titel + Jahr -->
          <div class="tt-title">
            {{ title }}
            <span v-if="year" class="tt-year">({{ year }})</span>
          </div>

          <!-- Meta (Runtime, Quality, %) -->
          <div class="tt-meta">
            <span v-if="runtime">{{ runtime }} min</span>
            <span v-if="quality">{{ quality }}</span>
            <span v-if="seasons">{{ seasons }} Staffel{{ seasons > 1 ? 'n' : '' }}</span>
            <span v-if="progress !== undefined && progress > 0">{{ progress }}%</span>
            <span v-if="hasFile" class="tt-have">✓ Vorhanden</span>
          </div>

          <!-- Overview -->
          <p v-if="overview" class="tt-overview">
            {{ overview.length > 200 ? overview.substring(0, 200) + '…' : overview }}
          </p>

          <!-- Genres -->
          <div v-if="genres && genres.length" class="tt-genres">
            <span v-for="g in genres.slice(0,4)" :key="g" class="tt-genre">{{ g }}</span>
          </div>

          <!-- Network -->
          <div v-if="network" class="tt-network">{{ network }}</div>

          <!-- Ratings -->
          <div v-if="imdbRating || tmdbRating || rating" class="tt-ratings">
            <span v-if="imdbRating" class="tt-imdb">★ {{ imdbRating.toFixed(1) }}</span>
            <span v-else-if="rating" class="tt-imdb">★ {{ rating.toFixed(1) }}</span>
            <span v-if="tmdbRating" class="tt-tmdb">TMDb {{ tmdbRating.toFixed(0) }}%</span>
          </div>

          <!-- Tech Badges -->
          <div v-if="techBadges && techBadges.length" class="tt-tech">
            <span
              v-for="b in techBadges"
              :key="b.label"
              class="tt-badge"
              :style="{ color: b.color, borderColor: b.color + '44' }"
            >{{ b.label }}</span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.poster-card {
  cursor: pointer;
  border-radius: var(--radius-md);
  overflow: visible;
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  transition: transform 0.18s var(--ease-standard), border-color 0.18s ease, box-shadow 0.18s ease;
  outline: none;
  position: relative;
}

.poster-card:hover,
.poster-card:focus-visible {
  transform: translateY(-3px) scale(1.01);
  border-color: color-mix(in srgb, var(--card-color) 50%, transparent);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  z-index: 2;
}

/* Poster Image */
.poster-wrap {
  position: relative;
  aspect-ratio: 2 / 3;
  background: var(--bg-elevated);
  overflow: hidden;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
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
.ph-letter { font-size: 40px; font-weight: 700; color: var(--text-muted); }

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
  flex-shrink: 0;
}
.dot-ok   { background: #22c55e; box-shadow: 0 0 5px rgba(34,197,94,.7); }
.dot-miss { background: #ef4444; box-shadow: 0 0 5px rgba(239,68,68,.7); }
.dot-unmon { background: #555; }

/* Quality Badge */
.quality-badge {
  position: absolute;
  top: 5px;
  left: 5px;
  background: rgba(0,0,0,.8);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  backdrop-filter: blur(4px);
  letter-spacing: .03em;
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
  min-width: 2px;
}

/* Info below poster */
.poster-info { padding: 6px 6px 7px; }

.poster-title {
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
  font-weight: 500;
  margin: 0 0 2px;
}

.poster-meta-row {
  display: flex;
  align-items: center;
  gap: 5px;
}

.poster-year  { font-size: 10px; color: var(--text-muted); }
.poster-eps   { font-size: 10px; color: var(--text-muted); }
.poster-rating {
  font-size: 10px;
  color: #facc15;
  font-weight: 600;
  margin-left: auto;
}

/* Tooltip */
.poster-tooltip {
  position: fixed;
  z-index: 99999;
  width: 250px;
  background: #111;
  border: 1px solid #222;
  border-radius: 10px;
  box-shadow: 0 16px 48px rgba(0,0,0,.9);
  overflow: hidden;
  pointer-events: none;
  font-family: -apple-system, system-ui, sans-serif;
  animation: tt-in .12s ease;
}

@keyframes tt-in {
  from { opacity: 0; transform: scale(.97) translateY(4px); }
  to   { opacity: 1; transform: scale(1)   translateY(0); }
}

.tt-bar  { height: 3px; width: 100%; }
.tt-body { padding: 10px 12px 12px; }

.tt-title {
  font-size: 12px;
  font-weight: 700;
  color: #e8e8e8;
  line-height: 1.3;
  margin-bottom: 3px;
}
.tt-year { color: #444; font-weight: 400; font-size: 11px; }

.tt-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
  font-size: 10px;
  color: #555;
  margin-bottom: 6px;
}
.tt-have { color: #1db954; font-weight: 700; font-size: 9px; text-transform: uppercase; letter-spacing: .5px; }

.tt-overview {
  font-size: 10.5px;
  color: #777;
  line-height: 1.5;
  margin: 0 0 7px;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tt-genres {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.tt-genre {
  font-size: 9px;
  padding: 2px 6px;
  background: rgba(255,255,255,.04);
  border: 1px solid #1a1a1a;
  border-radius: 10px;
  color: #555;
  font-weight: 600;
}

.tt-network {
  font-size: 10px;
  color: #444;
  margin-bottom: 4px;
}

.tt-ratings {
  display: flex;
  gap: 10px;
  margin-bottom: 6px;
  font-size: 10px;
  font-weight: 700;
}
.tt-imdb { color: #f5c518; }
.tt-tmdb { color: #01d277; }

.tt-tech {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.tt-badge {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(0,0,0,.4);
  font-weight: 700;
  border: 1px solid;
}

/* Sizes */
.poster-card--sm .ph-letter { font-size: 28px; }
.poster-card--lg .ph-letter { font-size: 56px; }
</style>
