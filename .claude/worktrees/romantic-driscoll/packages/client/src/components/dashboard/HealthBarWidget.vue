<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useApi } from '../../composables/useApi.js';

interface IntegStatus { name: string; status: 'online' | 'offline' | 'unconfigured'; version: string | null; url: string | null }

const { get } = useApi();
const integrations = ref<IntegStatus[]>([]);

const integMeta: Record<string, { label: string; color: string }> = {
  radarr:    { label: 'Radarr',    color: 'var(--radarr)' },
  sonarr:    { label: 'Sonarr',    color: 'var(--sonarr)' },
  lidarr:    { label: 'Lidarr',    color: 'var(--lidarr)' },
  prowlarr:  { label: 'Prowlarr',  color: 'var(--prowlarr)' },
  sabnzbd:   { label: 'SABnzbd',   color: 'var(--sabnzbd)' },
  tautulli:  { label: 'Tautulli',  color: 'var(--tautulli)' },
  overseerr: { label: 'Overseerr', color: 'var(--overseerr)' },
  bazarr:    { label: 'Bazarr',    color: 'var(--bazarr)' },
  gotify:    { label: 'Gotify',    color: 'var(--gotify)' },
  plex:      { label: 'Plex',      color: 'var(--plex)' },
  abs:       { label: 'ABS',       color: '#F0A500' },
};

function integColor(status: string) {
  return status === 'online' ? 'var(--status-success)' : status === 'offline' ? 'var(--status-error)' : 'var(--text-muted)';
}

onMounted(async () => {
  try { integrations.value = await get<IntegStatus[]>('/api/system/integrations'); } catch { /* */ }
});
</script>

<template>
  <div class="health-bar">
    <div
      v-for="integ in integrations"
      :key="integ.name"
      class="health-chip"
      :title="`${integMeta[integ.name]?.label ?? integ.name} – ${integ.status}${integ.version ? ' v'+integ.version : ''}`"
    >
      <span class="health-dot" :style="{ background: integColor(integ.status) }" />
      <span class="health-label" :style="{ color: integ.status === 'online' ? integMeta[integ.name]?.color : 'var(--text-muted)' }">
        {{ integMeta[integ.name]?.label ?? integ.name }}
      </span>
      <span v-if="integ.version" class="health-ver">v{{ integ.version }}</span>
    </div>
  </div>
</template>

<style scoped>
.health-bar {
  display: flex; flex-wrap: wrap; gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-lg);
  align-items: center;
}
.health-chip   { display: flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: var(--radius-sm); background: var(--bg-elevated); border: 1px solid var(--bg-border); }
.health-dot    { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.health-label  { font-size: 11px; font-weight: 600; }
.health-ver    { font-size: 10px; color: var(--text-muted); }
</style>
