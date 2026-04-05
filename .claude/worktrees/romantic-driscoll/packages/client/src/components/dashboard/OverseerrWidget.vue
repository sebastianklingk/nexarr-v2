<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '../../composables/useApi.js';
import type { OverseerrRequest } from '@nexarr/shared';

const router = useRouter();
const { get } = useApi();
const requests = ref<OverseerrRequest[]>([]);

function nav(r: string) { router.push(r); }

onMounted(async () => {
  try { requests.value = await get<OverseerrRequest[]>('/api/overseerr/requests?filter=pending&take=8'); } catch { /* */ }
});

defineExpose({ requests });
</script>

<template>
  <div class="overseerr-widget">
    <div class="widget-head">
      <span class="widget-title">Anfragen</span>
      <button class="wlink" @click="nav('/overseerr')">Alle ›</button>
    </div>
    <div v-if="!requests.length" class="w-empty">Keine offenen Anfragen</div>
    <div v-else class="req-list">
      <div v-for="r in requests.slice(0,6)" :key="r.id" class="req-row" @click="nav('/overseerr')">
        <span :class="['req-badge', r.type==='movie'?'r-movie':'r-tv']">{{ r.type==='movie'?'Film':'Serie' }}</span>
        <span class="req-title">{{ r.media?.title ?? `TMDB #${r.media?.tmdbId}` }}</span>
        <span class="req-by">{{ r.requestedBy?.displayName }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overseerr-widget { display: flex; flex-direction: column; gap: var(--space-3); }
.widget-head { display: flex; align-items: center; justify-content: space-between; }
.widget-title { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); }
.wlink { font-size: var(--text-xs); color: var(--text-muted); transition: color .15s; }
.wlink:hover { color: var(--text-secondary); }
.w-empty { font-size: var(--text-sm); color: var(--text-muted); padding: var(--space-3) 0; }
.req-list { display: flex; flex-direction: column; gap: 2px; }
.req-row  { display: flex; align-items: center; gap: var(--space-2); padding: 5px var(--space-2); background: var(--bg-elevated); border-radius: var(--radius-sm); cursor: pointer; transition: background .15s; }
.req-row:hover { background: var(--bg-overlay); }
.req-badge { font-size: 10px; font-weight: 600; padding: 1px 5px; border-radius: 3px; flex-shrink: 0; }
.r-movie { background: rgba(244,165,74,.12); color: var(--radarr); }
.r-tv    { background: rgba(53,197,244,.12); color: var(--sonarr); }
.req-title { font-size: 11px; color: var(--text-secondary); font-weight: 500; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.req-by   { font-size: 10px; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }
</style>
