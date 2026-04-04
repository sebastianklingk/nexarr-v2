<script setup lang="ts">

defineProps<{
  user?: string;
  title?: string;
  mediaType?: string;
  state?: string;
  quality?: string;
  decision?: string;
  player?: string;
  platform?: string;
  progress?: number;
}>();
</script>

<template>
  <div class="ai-stream-card">
    <div class="stream-header">
      <span class="stream-user">{{ user }}</span>
      <span class="stream-state" :class="state">{{ state }}</span>
    </div>
    <div class="stream-title">{{ title }}</div>
    <div class="stream-badges">
      <span v-if="quality" class="stream-badge quality">{{ quality }}</span>
      <span v-if="decision" class="stream-badge" :class="decision?.toLowerCase().replace(' ', '-')">{{ decision }}</span>
      <span v-if="player" class="stream-badge">{{ player }}</span>
    </div>
    <div v-if="typeof progress === 'number'" class="stream-progress-bar">
      <div class="stream-progress-fill" :style="{ width: progress + '%' }"></div>
    </div>
  </div>
</template>

<style scoped>
.ai-stream-card {
  padding: var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.stream-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.stream-user {
  font-size: var(--text-xs);
  font-weight: 700;
  color: var(--text-primary);
}
.stream-state {
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 600;
}
.stream-state.playing { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
.stream-state.paused { background: rgba(234, 179, 8, 0.15); color: #eab308; }
.stream-state.buffering { background: rgba(168, 85, 247, 0.15); color: #a855f7; }
.stream-title {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
.stream-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.stream-badge {
  padding: 1px 6px;
  background: var(--bg-overlay);
  border-radius: var(--radius-sm);
  font-size: 10px;
  color: var(--text-secondary);
}
.stream-badge.quality { color: #60a5fa; }
.stream-badge.direct-play { color: #22c55e; }
.stream-badge.transcode { color: #f59e0b; }
.stream-progress-bar {
  height: 4px;
  background: var(--bg-overlay);
  border-radius: 2px;
  overflow: hidden;
}
.stream-progress-fill {
  height: 100%;
  background: var(--plex, #e5a00d);
  border-radius: 2px;
}
</style>
