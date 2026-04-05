<script setup lang="ts">

defineProps<{
  items?: Array<{
    title?: string;
    date?: string;
    mediaType?: string;
    status?: string;
  }>;
  title?: string;
}>();
</script>

<template>
  <div class="ai-calendar-preview">
    <div v-if="title" class="cal-title">{{ title }}</div>
    <div class="cal-list">
      <div
        v-for="(item, idx) in (items ?? []).slice(0, 14)"
        :key="idx"
        class="cal-item"
      >
        <span class="cal-date">{{ item.date }}</span>
        <span class="cal-media-type">{{ item.mediaType === 'tv' ? '📺' : '🎬' }}</span>
        <span class="cal-item-title">{{ item.title }}</span>
        <span v-if="item.status" class="cal-status" :class="item.status">{{ item.status }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-calendar-preview {
  padding: var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.cal-title {
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.cal-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cal-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-xs);
  padding: 4px 0;
  border-bottom: 1px solid var(--bg-border);
}
.cal-item:last-child {
  border-bottom: none;
}
.cal-date {
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
  min-width: 60px;
  flex-shrink: 0;
}
.cal-media-type {
  font-size: 12px;
  flex-shrink: 0;
}
.cal-item-title {
  color: var(--text-primary);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cal-status {
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 600;
  flex-shrink: 0;
}
.cal-status.released { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.cal-status.upcoming { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.cal-status.missing { background: rgba(234, 179, 8, 0.15); color: #eab308; }
</style>
