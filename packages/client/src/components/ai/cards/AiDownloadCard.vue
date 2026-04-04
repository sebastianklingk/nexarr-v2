<script setup lang="ts">

defineProps<{
  filename?: string;
  downloader?: string;
  status?: string;
  percentage?: number;
  speedMbs?: number;
  timeleft?: string;
}>();
</script>

<template>
  <div class="ai-download-card">
    <div class="dl-header">
      <span class="dl-filename">{{ filename }}</span>
      <span v-if="downloader" class="dl-badge" :class="downloader">{{ downloader === 'sabnzbd' ? 'SAB' : 'TR' }}</span>
    </div>
    <div class="dl-progress-bar">
      <div class="dl-progress-fill" :style="{ width: (percentage ?? 0) + '%' }"></div>
    </div>
    <div class="dl-meta">
      <span>{{ (percentage ?? 0).toFixed(1) }}%</span>
      <span v-if="speedMbs">{{ speedMbs.toFixed(1) }} MB/s</span>
      <span v-if="timeleft">{{ timeleft }}</span>
      <span v-if="status" class="dl-status">{{ status }}</span>
    </div>
  </div>
</template>

<style scoped>
.ai-download-card {
  padding: var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.dl-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.dl-filename {
  font-size: var(--text-xs);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}
.dl-badge {
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}
.dl-badge.sabnzbd { background: rgba(255, 202, 40, 0.2); color: #ffca28; }
.dl-badge.transmission { background: rgba(193, 3, 3, 0.2); color: #ef4444; }
.dl-progress-bar {
  height: 6px;
  background: var(--bg-overlay);
  border-radius: 3px;
  overflow: hidden;
}
.dl-progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 0.3s ease;
}
.dl-meta {
  display: flex;
  gap: var(--space-2);
  font-size: 10px;
  color: var(--text-tertiary);
}
.dl-status {
  text-transform: capitalize;
}
</style>
