<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '../../composables/useApi.js';

interface HistoryItem { row_id: number; title: string; parent_title?: string; grandparent_title?: string; full_title?: string; action: string; date: number; media_type: string; thumb?: string; quality?: string; file_size?: number; friendly_name?: string }

const router = useRouter();
const { get } = useApi();
const history = ref<HistoryItem[]>([]);

function nav(r: string) { router.push(r); }
function fmtDate(iso?: string): string { if (!iso) return ''; return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }); }
function fmtBytes(b?: number): string { if (!b) return ''; const g = b/1024/1024/1024; return g >= 1 ? `${g.toFixed(1)} GB` : `${(b/1024/1024).toFixed(0)} MB`; }
function historyIcon(type: string) { return type === 'movie' ? '🎬' : type === 'episode' ? '📺' : '🎵'; }

onMounted(async () => {
  try {
    const r = await get<any>('/api/tautulli/history');
    history.value = (r?.data?.data ?? r?.data ?? []).slice(0, 15);
  } catch { /* */ }
});
</script>

<template>
  <div class="history-widget">
    <div class="widget-head">
      <span class="widget-title">Letzte Aktivität</span>
      <button class="wlink" @click="nav('/tautulli')">Statistiken ›</button>
    </div>
    <div v-if="!history.length" class="w-empty">Keine Aktivität</div>
    <div v-else class="history-list">
      <div v-for="item in history" :key="item.row_id" class="history-row">
        <div class="h-icon">{{ historyIcon(item.media_type) }}</div>
        <div class="h-info">
          <p class="h-title">{{ item.grandparent_title ? item.grandparent_title+' – ' : '' }}{{ item.title }}</p>
          <div class="h-tags">
            <span class="h-tag" style="color:var(--status-success)">{{ item.action }}</span>
            <span v-if="item.quality" class="h-tag">{{ item.quality }}</span>
            <span v-if="item.file_size" class="h-tag">{{ fmtBytes(item.file_size) }}</span>
            <span v-if="item.friendly_name" class="h-tag" style="color:var(--tautulli)">{{ item.friendly_name }}</span>
          </div>
        </div>
        <span class="h-date">{{ fmtDate(new Date(item.date * 1000).toISOString()) }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-widget { display: flex; flex-direction: column; gap: var(--space-3); }
.widget-head { display: flex; align-items: center; justify-content: space-between; }
.widget-title { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); }
.wlink { font-size: var(--text-xs); color: var(--text-muted); transition: color .15s; }
.wlink:hover { color: var(--text-secondary); }
.w-empty { font-size: var(--text-sm); color: var(--text-muted); padding: var(--space-3) 0; }
.history-list { display: flex; flex-direction: column; gap: 2px; }
.history-row  { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-2) var(--space-2); background: var(--bg-elevated); border-radius: var(--radius-sm); }
.h-icon  { font-size: 16px; flex-shrink: 0; }
.h-info  { flex: 1; min-width: 0; }
.h-title { font-size: 11px; color: var(--text-secondary); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0 0 2px; }
.h-tags  { display: flex; gap: var(--space-2); align-items: center; }
.h-tag   { font-size: 10px; color: var(--text-muted); }
.h-date  { font-size: 10px; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }
</style>
