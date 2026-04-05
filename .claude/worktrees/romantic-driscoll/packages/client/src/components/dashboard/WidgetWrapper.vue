<script setup lang="ts">
import { ref, computed } from 'vue';
import { useDashboardStore } from '../../stores/dashboard.store.js';

const props = defineProps<{
  widgetId: string;
  index: number;
  colSpan: 1 | 2 | 3;
}>();

const emit = defineEmits<{
  'drag-start': [index: number];
  'drag-over': [index: number];
  'drag-end': [];
  'touch-start': [index: number, event: TouchEvent];
}>();

const dash = useDashboardStore();
const el = ref<HTMLElement | null>(null);
const isDragOver = ref(false);

const def = computed(() => dash.widgetDef(props.widgetId));

// HTML5 Drag & Drop
function onDragStart(e: DragEvent) {
  if (!dash.editMode) return;
  e.dataTransfer!.effectAllowed = 'move';
  e.dataTransfer!.setData('text/plain', String(props.index));
  emit('drag-start', props.index);
}

function onDragOver(e: DragEvent) {
  if (!dash.editMode) return;
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'move';
  isDragOver.value = true;
  emit('drag-over', props.index);
}

function onDragLeave() {
  isDragOver.value = false;
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  isDragOver.value = false;
  emit('drag-end');
}

function onDragEnd() {
  isDragOver.value = false;
  emit('drag-end');
}

// Touch DnD
function onTouchStart(e: TouchEvent) {
  if (!dash.editMode) return;
  emit('touch-start', props.index, e);
}
</script>

<template>
  <div
    ref="el"
    class="widget-wrapper"
    :class="{
      'widget-wrapper--edit': dash.editMode,
      'widget-wrapper--drag-over': isDragOver,
      [`widget-wrapper--span-${colSpan}`]: true,
    }"
    :draggable="dash.editMode"
    @dragstart="onDragStart"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
    @dragend="onDragEnd"
    @touchstart.passive="onTouchStart"
  >
    <!-- Edit mode chrome -->
    <div v-if="dash.editMode" class="widget-handle">
      <span class="handle-grip">⠿</span>
      <span class="handle-label">{{ def?.icon }} {{ def?.label }}</span>
      <button class="handle-hide" title="Ausblenden" @click.stop="dash.toggleWidget(widgetId)">✕</button>
    </div>

    <!-- Widget content -->
    <div class="widget-body" :class="{ 'widget-body--no-events': dash.editMode }">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.widget-wrapper {
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  display: flex; flex-direction: column; gap: var(--space-3);
  transition: box-shadow .2s, border-color .2s, transform .15s;
  min-width: 0;
}

/* Column span classes */
.widget-wrapper--span-3 { grid-column: 1 / -1; }
.widget-wrapper--span-2 { grid-column: span 2; }
.widget-wrapper--span-1 { grid-column: span 1; }

/* Edit mode */
.widget-wrapper--edit {
  cursor: grab;
  border: 1px dashed var(--bg-border-hover);
}
.widget-wrapper--edit:active { cursor: grabbing; }

/* Drag over feedback */
.widget-wrapper--drag-over {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(var(--accent-rgb), .3);
}

/* Handle bar */
.widget-handle {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-1) var(--space-2);
  margin: calc(-1 * var(--space-2)) calc(-1 * var(--space-2)) 0;
  background: var(--bg-elevated);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  user-select: none;
}
.handle-grip { color: var(--text-muted); font-size: 14px; cursor: grab; }
.handle-label { flex: 1; font-size: 11px; font-weight: 600; color: var(--text-tertiary); }
.handle-hide {
  font-size: 14px; color: var(--text-muted); cursor: pointer;
  background: none; border: none; line-height: 1;
  padding: 2px 4px; border-radius: var(--radius-sm);
  transition: all .15s;
}
.handle-hide:hover { color: var(--status-error); background: rgba(248,113,113,.1); }

/* Prevent interaction with widget content during drag */
.widget-body--no-events { pointer-events: none; }

@media (max-width: 700px) {
  .widget-wrapper--span-2,
  .widget-wrapper--span-3 {
    grid-column: 1 / -1;
  }
}
</style>
