<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useMoviesStore } from '../../stores/movies.store.js';
import { useSeriesStore } from '../../stores/series.store.js';
import { useMusicStore } from '../../stores/music.store.js';
import { useQueueStore } from '../../stores/queue.store.js';
import { useGotifyStore } from '../../stores/gotify.store.js';

const router  = useRouter();
const movies  = useMoviesStore();
const series  = useSeriesStore();
const music   = useMusicStore();
const queue   = useQueueStore();
const gotify  = useGotifyStore();

const props = defineProps<{
  streamCount?: number;
  requestCount?: number;
  enabledIndexers?: number;
}>();

function nav(r: string) { router.push(r); }
const speedLabel = computed(() => {
  const s = queue.sabnzbd?.speedMbs ?? 0;
  if (s === 0) return queue.sabnzbd?.paused ? 'Pausiert' : 'Bereit';
  return s < 1 ? `${(s*1024).toFixed(0)} KB/s` : `${s.toFixed(1)} MB/s`;
});
</script>

<template>
  <div class="stats-grid">
    <button class="stat-card" style="--c:var(--radarr)" @click="nav('/movies')">
      <div class="sc-icon">🎬</div>
      <div class="sc-body">
        <div class="sc-label">Filme</div>
        <div class="sc-num">
          <span v-if="movies.isLoading" class="skel" />
          <span v-else>{{ movies.stats.total.toLocaleString('de-DE') }}</span>
        </div>
        <div class="sc-meta">
          <span class="sc-ok">{{ movies.stats.available.toLocaleString('de-DE') }} ✓</span>
          <span class="sc-miss">{{ movies.stats.missing.toLocaleString('de-DE') }} ✗</span>
        </div>
      </div>
      <span class="sc-arr">›</span>
    </button>

    <button class="stat-card" style="--c:var(--sonarr)" @click="nav('/series')">
      <div class="sc-icon">📺</div>
      <div class="sc-body">
        <div class="sc-label">Serien</div>
        <div class="sc-num">
          <span v-if="series.isLoading" class="skel" />
          <span v-else>{{ series.stats.total.toLocaleString('de-DE') }}</span>
        </div>
        <div class="sc-meta">
          <span style="color:var(--status-success)">{{ series.stats.continuing }} ▶</span>
          <span style="color:var(--text-muted)">{{ series.stats.ended }} ■</span>
        </div>
      </div>
      <span class="sc-arr">›</span>
    </button>

    <button class="stat-card" style="--c:var(--lidarr)" @click="nav('/music')">
      <div class="sc-icon">🎵</div>
      <div class="sc-body">
        <div class="sc-label">Künstler</div>
        <div class="sc-num">
          <span v-if="music.isLoading" class="skel" />
          <span v-else>{{ music.stats.total.toLocaleString('de-DE') }}</span>
        </div>
        <div class="sc-meta">
          <span>{{ music.stats.monitored }} überwacht</span>
          <span style="color:var(--text-muted)">· {{ music.stats.albums }} Alben</span>
        </div>
      </div>
      <span class="sc-arr">›</span>
    </button>

    <button class="stat-card" style="--c:var(--sabnzbd)" @click="nav('/downloads')">
      <div class="sc-icon">⬇️</div>
      <div class="sc-body">
        <div class="sc-label">Downloads</div>
        <div class="sc-num">{{ queue.totalCount }}</div>
        <div class="sc-meta">
          <span :class="queue.isConnected ? 'live' : 'off'" />
          <span>{{ speedLabel }}</span>
          <span v-if="queue.sabnzbd?.paused" style="color:var(--sabnzbd)">· ⏸</span>
        </div>
      </div>
      <span class="sc-arr">›</span>
    </button>

    <button class="stat-card" style="--c:var(--tautulli)" @click="nav('/streams')">
      <div class="sc-icon">📊</div>
      <div class="sc-body">
        <div class="sc-label">Streams</div>
        <div class="sc-num">{{ streamCount ?? 0 }}</div>
        <div class="sc-meta"><span>–</span></div>
      </div>
      <span class="sc-arr">›</span>
    </button>

    <button class="stat-card" style="--c:var(--overseerr)" @click="nav('/overseerr')">
      <div class="sc-icon">🙋</div>
      <div class="sc-body">
        <div class="sc-label">Anfragen</div>
        <div class="sc-num">{{ requestCount ?? 0 }}</div>
        <div class="sc-meta"><span style="color:var(--overseerr)">offen</span></div>
      </div>
      <span class="sc-arr">›</span>
    </button>

    <button class="stat-card" style="--c:var(--prowlarr)" @click="nav('/search')">
      <div class="sc-icon">🔍</div>
      <div class="sc-body">
        <div class="sc-label">Prowlarr</div>
        <div class="sc-num">{{ enabledIndexers ?? 0 }}</div>
        <div class="sc-meta"><span>Indexer aktiv</span></div>
      </div>
      <span class="sc-arr">›</span>
    </button>

    <button class="stat-card" style="--c:var(--gotify)" @click="nav('/gotify')">
      <div class="sc-icon">🔔</div>
      <div class="sc-body">
        <div class="sc-label">Gotify</div>
        <div class="sc-num">{{ gotify.unreadCount }}</div>
        <div class="sc-meta"><span>Nachrichten</span></div>
      </div>
      <span class="sc-arr">›</span>
    </button>
  </div>
</template>

<style scoped>
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(175px, 1fr)); gap: var(--space-3); }
.stat-card {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-surface); border: 1px solid var(--bg-border);
  border-left: 3px solid var(--c); border-radius: var(--radius-lg);
  cursor: pointer; transition: background .15s, transform .1s; text-align: left;
}
.stat-card:hover { background: var(--bg-elevated); transform: translateY(-1px); }
.sc-icon   { font-size: 22px; line-height: 1; flex-shrink: 0; }
.sc-body   { flex: 1; min-width: 0; }
.sc-label  { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .06em; }
.sc-num    { font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); line-height: 1.1; font-variant-numeric: tabular-nums; }
.sc-meta   { font-size: 10px; color: var(--text-muted); margin-top: 1px; display: flex; gap: 4px; align-items: center; }
.sc-ok     { color: var(--status-success); }
.sc-miss   { color: var(--status-error); }
.sc-arr    { font-size: 18px; color: var(--text-muted); }
.skel      { display: inline-block; width: 50px; height: 22px; background: var(--bg-elevated); border-radius: 4px; animation: shimmer 1.5s infinite; }
.live      { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--status-success); }
.off       { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); }
@keyframes shimmer { 0%, 100% { opacity: .4; } 50% { opacity: .9; } }
</style>
