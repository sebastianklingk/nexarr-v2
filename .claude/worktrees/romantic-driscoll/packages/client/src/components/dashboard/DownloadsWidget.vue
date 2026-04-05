<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useQueueStore } from '../../stores/queue.store.js';

const router = useRouter();
const queue  = useQueueStore();

function nav(r: string) { router.push(r); }
const speedLabel = computed(() => {
  const s = queue.sabnzbd?.speedMbs ?? 0;
  if (s === 0) return queue.sabnzbd?.paused ? 'Pausiert' : 'Bereit';
  return s < 1 ? `${(s*1024).toFixed(0)} KB/s` : `${s.toFixed(1)} MB/s`;
});
</script>

<template>
  <div class="dl-widget">
    <div class="widget-head">
      <span class="widget-title">Downloads</span>
      <button class="wlink" @click="nav('/downloads')">Alle ›</button>
    </div>

    <div v-if="queue.sabnzbd" class="sab-header">
      <span class="sab-badge">SABnzbd</span>
      <span class="sab-speed">{{ speedLabel }}</span>
      <span v-if="queue.sabnzbd.paused" class="sab-pause">⏸</span>
      <span class="sab-jobs">{{ queue.sabnzbd.slotCount }} Jobs</span>
    </div>

    <div v-if="queue.sabnzbd?.slots.length" class="dl-list">
      <div v-for="s in queue.sabnzbd.slots.slice(0,5)" :key="s.nzo_id" class="dl-row">
        <div class="dl-top">
          <span class="dl-name">{{ s.filename }}</span>
          <span class="dl-eta">{{ s.timeleft }}</span>
        </div>
        <div class="dl-track"><div class="dl-fill" :style="{width:`${s.percentage}%`}" /></div>
      </div>
      <div v-if="(queue.sabnzbd?.slots.length??0)>5" class="dl-more" @click="nav('/downloads')">
        + {{ (queue.sabnzbd?.slots.length??0)-5 }} weitere →
      </div>
    </div>
    <div v-else class="w-empty">Keine aktiven Downloads</div>

    <div v-if="queue.arrItems.length" class="arr-row">
      <span v-if="queue.radarrItems.length" class="arr-c" style="color:var(--radarr)">🎬 {{ queue.radarrItems.length }}</span>
      <span v-if="queue.sonarrItems.length" class="arr-c" style="color:var(--sonarr)">📺 {{ queue.sonarrItems.length }}</span>
      <span v-if="queue.lidarrItems.length" class="arr-c" style="color:var(--lidarr)">🎵 {{ queue.lidarrItems.length }}</span>
    </div>
  </div>
</template>

<style scoped>
.dl-widget { display: flex; flex-direction: column; gap: var(--space-3); }
.widget-head { display: flex; align-items: center; justify-content: space-between; }
.widget-title { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); }
.wlink { font-size: var(--text-xs); color: var(--text-muted); transition: color .15s; }
.wlink:hover { color: var(--text-secondary); }
.w-empty { font-size: var(--text-sm); color: var(--text-muted); padding: var(--space-3) 0; }
.sab-header { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-3); background: var(--bg-elevated); border-radius: var(--radius-md); }
.sab-badge  { font-size: 10px; font-weight: 700; color: var(--sabnzbd); padding: 1px 6px; border: 1px solid rgba(245,197,24,.3); border-radius: 99px; background: rgba(245,197,24,.08); }
.sab-speed  { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); flex: 1; }
.sab-pause  { color: var(--sabnzbd); }
.sab-jobs   { font-size: var(--text-xs); color: var(--text-muted); }
.dl-list { display: flex; flex-direction: column; gap: 2px; }
.dl-row  { padding: var(--space-2) 0; border-bottom: 1px solid var(--bg-border); }
.dl-row:last-child { border-bottom: none; }
.dl-top  { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px; gap: var(--space-2); }
.dl-name { font-size: 11px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
.dl-eta  { font-size: 10px; color: var(--text-muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
.dl-track { height: 2px; background: var(--bg-elevated); border-radius: 99px; overflow: hidden; }
.dl-fill  { height: 100%; background: var(--sabnzbd); border-radius: 99px; transition: width .5s ease; }
.dl-more  { font-size: 11px; color: var(--text-muted); text-align: center; cursor: pointer; padding: var(--space-2) 0; }
.dl-more:hover { color: var(--text-secondary); }
.arr-row { display: flex; gap: var(--space-3); padding-top: var(--space-1); }
.arr-c   { font-size: var(--text-xs); font-weight: 600; }
</style>
