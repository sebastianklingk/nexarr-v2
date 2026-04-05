<script setup lang="ts">
import type { TautulliStream } from '@nexarr/shared';

const props = defineProps<{
  sessions: TautulliStream[];
  streamCount: number;
  totalBandwidth: number;
  wanBandwidth: number;
  lanBandwidth: number;
}>();

function fmtBandwidth(kb: number): string {
  if (kb === 0) return '0 Mbps';
  if (kb > 1000) return `${(kb/1000).toFixed(1)} Mbps`;
  return `${kb} Kbps`;
}
</script>

<template>
  <div class="streams-widget">
    <div class="widget-head">
      <span class="widget-title">Aktive Streams</span>
      <span v-if="streamCount" class="w-badge" style="color:var(--tautulli)">{{ streamCount }}</span>
    </div>
    <div v-if="!sessions.length" class="w-empty">Keine aktiven Streams</div>
    <div v-else class="stream-list">
      <div v-for="s in sessions" :key="s.session_id" class="stream-card">
        <div class="stream-top">
          <span class="stream-user">{{ s.friendly_name }}</span>
          <span :class="s.state==='playing'?'s-play':'s-pause'">{{ s.state==='playing'?'▶':'⏸' }}</span>
          <span class="stream-pct">{{ s.progress_percent }}%</span>
        </div>
        <p class="stream-title">{{ s.grandparent_title ? s.grandparent_title+' – ' : '' }}{{ s.title }}</p>
        <div class="stream-tags">
          <span class="s-tag">{{ s.transcode_decision ?? 'direct play' }}</span>
          <span v-if="s.stream_video_resolution" class="s-tag">{{ s.stream_video_resolution }}</span>
          <span class="s-tag">{{ s.player ?? s.platform }}</span>
        </div>
        <div class="s-track"><div class="s-fill" :style="{width:`${s.progress_percent}%`}" /></div>
      </div>
    </div>
    <div v-if="streamCount" class="stream-bw">
      <span>↑ {{ fmtBandwidth(wanBandwidth) }} WAN</span>
      <span>{{ fmtBandwidth(lanBandwidth) }} LAN</span>
    </div>
  </div>
</template>

<style scoped>
.streams-widget { display: flex; flex-direction: column; gap: var(--space-3); }
.widget-head { display: flex; align-items: center; justify-content: space-between; }
.widget-title { font-size: var(--text-sm); font-weight: 600; color: var(--text-secondary); }
.w-badge { font-size: var(--text-sm); font-weight: 700; }
.w-empty { font-size: var(--text-sm); color: var(--text-muted); padding: var(--space-3) 0; }
.stream-list { display: flex; flex-direction: column; gap: var(--space-2); }
.stream-card { background: var(--bg-elevated); border-radius: var(--radius-md); padding: var(--space-2) var(--space-3); border-left: 2px solid var(--tautulli); }
.stream-top  { display: flex; align-items: center; gap: var(--space-2); margin-bottom: 2px; }
.stream-user { font-size: var(--text-xs); font-weight: 600; color: var(--tautulli); flex: 1; }
.s-play  { color: var(--status-success); font-size: 10px; }
.s-pause { color: var(--text-muted); font-size: 10px; }
.stream-pct { font-size: 10px; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.stream-title { font-size: 11px; color: var(--text-secondary); margin: 0 0 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.stream-tags { display: flex; gap: var(--space-2); flex-wrap: wrap; margin-bottom: 4px; }
.s-tag { font-size: 10px; color: var(--text-muted); }
.s-track { height: 2px; background: var(--bg-border); border-radius: 99px; overflow: hidden; }
.s-fill  { height: 100%; background: var(--tautulli); opacity: .8; border-radius: 99px; transition: width 1s ease; }
.stream-bw { display: flex; gap: var(--space-3); font-size: 10px; color: var(--text-muted); padding-top: var(--space-1); }
</style>
