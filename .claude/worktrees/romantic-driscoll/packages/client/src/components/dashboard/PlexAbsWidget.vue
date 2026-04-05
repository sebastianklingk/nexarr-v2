<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '../../composables/useApi.js';

interface PlexSession { key: string; title: string; grandparentTitle?: string; type: string; User?: { title: string }; Player?: { title: string; platform: string }; viewOffset?: number; duration?: number; thumb?: string }
interface ABSLib { id: string; name: string; mediaType: string }

const router = useRouter();
const { get } = useApi();
const plexSessions = ref<PlexSession[]>([]);
const plexConfigured = ref(true);
const absLibs = ref<ABSLib[]>([]);
const absConfigured = ref(true);

function nav(r: string) { router.push(r); }
function plexProgress(s: PlexSession): number { if (!s.duration || !s.viewOffset) return 0; return Math.round((s.viewOffset / s.duration) * 100); }

onMounted(async () => {
  try {
    const r = await get<PlexSession[]>('/api/plex/sessions');
    plexSessions.value = r ?? [];
  } catch (e: any) {
    if (e?.status === 503) plexConfigured.value = false;
  }
  try {
    const r = await get<ABSLib[]>('/api/abs/libraries');
    absLibs.value = r ?? [];
  } catch (e: any) {
    if (e?.status === 503) absConfigured.value = false;
  }
});
</script>

<template>
  <div class="plexabs-widget">
    <div class="widget-head">
      <span class="widget-title">Plex & Audiobookshelf</span>
    </div>

    <!-- Plex -->
    <div class="plex-section">
      <div class="mini-head">
        <span style="color:var(--plex)">Plex</span>
        <button class="wlink" @click="nav('/settings')">›</button>
      </div>
      <div v-if="!plexConfigured" class="w-empty-sm">Nicht konfiguriert</div>
      <div v-else-if="!plexSessions.length" class="w-empty-sm">Keine aktiven Sessions</div>
      <div v-else class="plex-list">
        <div v-for="s in plexSessions" :key="s.key" class="plex-row">
          <div class="plex-info">
            <p class="plex-title">{{ s.grandparentTitle ? s.grandparentTitle+' – ' : '' }}{{ s.title }}</p>
            <p class="plex-meta">{{ s.User?.title }} · {{ s.Player?.platform }}</p>
          </div>
          <span class="plex-pct">{{ plexProgress(s) }}%</span>
        </div>
      </div>
    </div>

    <div class="mini-sep" />

    <!-- ABS -->
    <div class="abs-section">
      <div class="mini-head">
        <span style="color:#F0A500">Audiobookshelf</span>
        <button class="wlink" @click="nav('/audiobookshelf')">›</button>
      </div>
      <div v-if="!absConfigured" class="w-empty-sm">Nicht konfiguriert</div>
      <div v-else-if="!absLibs.length" class="w-empty-sm">Keine Libraries</div>
      <div v-else class="abs-libs">
        <div v-for="lib in absLibs" :key="lib.id" class="abs-lib" @click="nav('/audiobookshelf')">
          <span class="abs-icon">{{ lib.mediaType==='book'?'📖':'🎙️' }}</span>
          <span class="abs-name">{{ lib.name }}</span>
          <span class="abs-type">{{ lib.mediaType==='book'?'Hörbücher':'Podcasts' }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plexabs-widget { display: flex; flex-direction: column; gap: var(--space-3); }
.widget-head { display: flex; align-items: center; justify-content: space-between; }
.widget-title { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); }
.wlink { font-size: var(--text-xs); color: var(--text-muted); transition: color .15s; }
.wlink:hover { color: var(--text-secondary); }
.w-empty-sm { font-size: var(--text-xs); color: var(--text-muted); }
.plex-section, .abs-section { display: flex; flex-direction: column; gap: var(--space-2); }
.mini-head { display: flex; align-items: center; justify-content: space-between; font-size: var(--text-xs); font-weight: 600; }
.mini-sep  { height: 1px; background: var(--bg-border); margin: var(--space-1) 0; }
.plex-list { display: flex; flex-direction: column; gap: 4px; }
.plex-row  { display: flex; align-items: center; gap: var(--space-2); }
.plex-info { flex: 1; min-width: 0; }
.plex-title { font-size: 11px; color: var(--text-secondary); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 0; }
.plex-meta  { font-size: 10px; color: var(--text-muted); margin: 0; }
.plex-pct   { font-size: 10px; color: var(--plex); font-weight: 600; }
.abs-libs { display: flex; flex-direction: column; gap: 4px; }
.abs-lib  { display: flex; align-items: center; gap: var(--space-2); padding: 4px var(--space-2); background: var(--bg-elevated); border-radius: var(--radius-sm); cursor: pointer; transition: background .15s; }
.abs-lib:hover { background: var(--bg-overlay); }
.abs-icon { font-size: 14px; }
.abs-name { font-size: 11px; color: var(--text-secondary); font-weight: 500; flex: 1; }
.abs-type { font-size: 10px; color: var(--text-muted); }
</style>
