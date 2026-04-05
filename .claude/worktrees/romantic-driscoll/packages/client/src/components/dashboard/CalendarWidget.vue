<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '../../composables/useApi.js';

interface CalItem { id: number; title: string; type: 'movie'|'episode'|'album'; date: string; seriesTitle?: string; posterUrl?: string }

const router = useRouter();
const { get } = useApi();
const upcoming = ref<CalItem[]>([]);

function nav(r: string) { router.push(r); }
function fmtDate(iso?: string): string { if (!iso) return ''; return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }); }

onMounted(async () => {
  try {
    const start = new Date().toISOString().slice(0, 10);
    const end   = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const d = await get<{ radarr: any[]; sonarr: any[]; lidarr: any[] }>(`/api/calendar?start=${start}&end=${end}`);
    const items: CalItem[] = [];
    for (const m of d.radarr ?? []) items.push({ id: m.id, title: m.title, type: 'movie', date: m.digitalRelease ?? m.physicalRelease ?? m.inCinemas ?? '', posterUrl: m.images?.find((i:any) => i.coverType === 'poster')?.remoteUrl });
    for (const e of d.sonarr ?? []) items.push({ id: e.seriesId ?? e.id, title: e.title, type: 'episode', date: e.airDate ?? '', seriesTitle: e.series?.title });
    for (const a of d.lidarr ?? []) items.push({ id: a.id, title: a.title, type: 'album', date: a.releaseDate ?? '' });
    upcoming.value = items.filter(i => i.date).sort((a,b) => a.date.localeCompare(b.date)).slice(0, 12);
  } catch { /* */ }
});
</script>

<template>
  <div class="cal-widget">
    <div class="widget-head">
      <span class="widget-title">Nächste 7 Tage</span>
      <button class="wlink" @click="nav('/calendar')">Kalender ›</button>
    </div>
    <div v-if="!upcoming.length" class="w-empty">Keine Releases</div>
    <div v-else class="cal-list">
      <div v-for="item in upcoming" :key="item.type+item.id" class="cal-row"
        :style="{'--cc': item.type==='movie' ? 'var(--radarr)' : item.type==='episode' ? 'var(--sonarr)' : 'var(--lidarr)'}">
        <span class="cal-date">{{ fmtDate(item.date) }}</span>
        <div class="cal-info">
          <p class="cal-title">{{ item.type==='episode' && item.seriesTitle ? item.seriesTitle+' – ' : '' }}{{ item.title }}</p>
          <span class="cal-type">{{ item.type==='movie' ? 'Film' : item.type==='episode' ? 'Episode' : 'Album' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cal-widget { display: flex; flex-direction: column; gap: var(--space-3); }
.widget-head { display: flex; align-items: center; justify-content: space-between; }
.widget-title { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); }
.wlink { font-size: var(--text-xs); color: var(--text-muted); transition: color .15s; }
.wlink:hover { color: var(--text-secondary); }
.w-empty { font-size: var(--text-sm); color: var(--text-muted); padding: var(--space-3) 0; }
.cal-list { display: flex; flex-direction: column; gap: 2px; overflow-y: auto; max-height: 280px; }
.cal-row  { display: flex; align-items: center; gap: var(--space-2); padding: 5px var(--space-2); border-left: 2px solid var(--cc); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; background: var(--bg-elevated); }
.cal-date { font-size: 10px; color: var(--text-muted); font-weight: 600; min-width: 32px; font-variant-numeric: tabular-nums; }
.cal-info { flex: 1; min-width: 0; }
.cal-title { font-size: 11px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0; font-weight: 500; }
.cal-type { font-size: 10px; color: var(--text-muted); }
</style>
