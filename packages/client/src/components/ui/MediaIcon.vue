<script setup lang="ts">
import { computed } from 'vue';
import { getMediaIcon, getBrandIcon, type MediaIconResult } from '../../utils/mediaIcons.js';
import type { MediaIconCategory } from '../../utils/mediaIcons.js';

const props = defineProps<{
  /** Use category + value for codec/resolution/channel lookups */
  category?: string;
  value?: string;
  /** OR use brand for standalone brand icons (dolby_vision, hdr10, etc.) */
  brand?: string;
  /** Icon height in px (default 16). Width scales automatically to preserve aspect ratio. */
  height?: number;
  /** If true, keep original icon colors. Default: white (for dark UI). */
  colorful?: boolean;
  /** Optional fallback label shown when no icon found */
  fallbackLabel?: string;
}>();

const h = computed(() => props.height ?? 16);

const icon = computed<MediaIconResult | null>(() => {
  if (props.brand) return getBrandIcon(props.brand);
  if (props.category && props.value) return getMediaIcon(props.category as MediaIconCategory, props.value);
  return null;
});
</script>

<template>
  <img
    v-if="icon"
    :src="icon.src"
    :alt="icon.label"
    :title="icon.label"
    :height="h"
    :class="['media-icon', { 'mi-white': !colorful }]"
    loading="lazy"
    decoding="async"
  />
  <span
    v-else-if="fallbackLabel || value"
    class="media-icon-fallback"
    :title="fallbackLabel || value"
  >{{ fallbackLabel || value }}</span>
</template>

<style scoped>
.media-icon {
  display: inline-block;
  width: auto;
  object-fit: contain;
  vertical-align: middle;
  flex-shrink: 0;
}

/* Force white on dark UI – works for any colored SVG/PNG */
.mi-white {
  filter: brightness(0) invert(1);
}

.media-icon-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  border-radius: var(--radius-sm, 4px);
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary, #ccc);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
