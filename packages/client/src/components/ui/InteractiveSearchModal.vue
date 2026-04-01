<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useApi } from '../../composables/useApi.js';

interface Release {
  guid: string;
  title: string;
  indexerId: number;
  indexer: string;
  protocol: string;
  quality: { quality: { name: string } };
  customFormats?: Array<{ name: string }>;
  seeders?: number;
  size: number;
  ageHours?: number;
  age?: number;
  indexerScore?: number;
  preferredWordScore?: number;
}

const props = defineProps<{
  modelValue: boolean;
  source: 'radarr' | 'sonarr';
  entityId: number;
  title: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>();

const { post } = useApi();
const releases = ref<Release[]>([]);
const isLoading = ref(false);
const filterProto = ref<'all' | 'usenet' | 'torrent'>('all');
const sortKey = ref<'score' | 'size' | 'age' | 'seeders' | 'lang'>('score');
const sortDir = ref<'desc' | 'asc'>('desc');
const dlStatus = ref<Record<string, 'loading' | 'ok' | 'error'>>({});

function close() { emit('update:modelValue', false); }
function onKey(e: KeyboardEvent) { if (e.key === 'Escape') close(); }

async function load() {
  isLoading.value = true;
  releases.value = [];
  try {
    const ep = props.source === 'radarr'
      ? `/api/radarr/release?movieId=${props.entityId}`
      : `/api/sonarr/release?episodeId=${props.entityId}`;
    const r = await fetch(ep, { credentials: 'include' });
    if (r.ok) releases.value = await r.json();
  } catch { /* */ }
  finally { isLoading.value = false; }
}

watch(() => props.modelValue, v => {
  if (v) { load(); window.addEventListener('keydown', onKey); }
  else { window.removeEventListener('keydown', onKey); releases.value = []; dlStatus.value = {}; filterProto.value = 'all'; sortKey.value = 'score'; }
});

function langTag(t: string): string {
  const s = t.toLowerCase();
  if (/\b(german|ger|deutsch)\b/.test(s)) return 'DE';
  if (/\b(english|eng)\b/.test(s)) return 'EN';
  if (/\b(french|fra)\b/.test(s)) return 'FR';
  if (/\b(spanish|spa)\b/.test(s)) return 'ES';
  if (/\b(italian|ita)\b/.test(s)) return 'IT';
  if (/\b(japanese|jpn)\b/.test(s)) return 'JP';
  if (/\b(dutch|nld)\b/.test(s)) return 'NL';
  if (/\b(russian|rus)\b/.test(s)) return 'RU';
  return '';
}
function fmtSize(b: number): string {
  const g = b/1024/1024/1024;
  return g >= 1 ? `${g.toFixed(2)} GB` : `${(b/1024/1024).toFixed(0)} MB`;
}
function fmtAge(r: Release): string {
  const h = r.ageHours ?? (r.age != null ? r.age * 24 : undefined);
  if (h == null) return '';
  return h < 24 ? `${Math.round(h)}h` : `${Math.floor(h/24)}d`;
}
function score(r: Release) { return (r.indexerScore ?? 0) + (r.preferredWordScore ?? 0); }

const list = computed(() => {
  let l = [...releases.value];
  if (filterProto.value !== 'all') l = l.filter(r => r.protocol === filterProto.value);
  l.sort((a, b) => {
    let d = 0;
    if (sortKey.value === 'score')   d = score(b) - score(a);
    else if (sortKey.value === 'size')    d = b.size - a.size;
    else if (sortKey.value === 'age')     d = (a.ageHours ?? 0) - (b.ageHours ?? 0);
    else if (sortKey.value === 'seeders') d = (b.seeders ?? 0) - (a.seeders ?? 0);
    else d = langTag(a.title).localeCompare(langTag(b.title));
    return sortDir.value === 'desc' ? d : -d;
  });
  return l;
});

function toggleSort(k: typeof sortKey.value) {
  if (sortKey.value === k) sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc';
  else { sortKey.value = k; sortDir.value = 'desc'; }
}

async function download(r: Release) {
  if (dlStatus.value[r.guid] === 'loading') return;
  dlStatus.value[r.guid] = 'loading';
  try {
    const ep = props.source === 'radarr' ? '/api/radarr/release' : '/api/sonarr/release';
    await post(ep, { guid: r.guid, indexerId: r.indexerId });
    dlStatus.value[r.guid] = 'ok';
  } catch {
    dlStatus.value[r.guid] = 'error';
    setTimeout(() => delete dlStatus.value[r.guid], 3000);
  }
}

function seedColor(s?: number) {
  if (s == null) return 'var(--text-muted)';
  return s >= 10 ? '#22c55e' : s >= 1 ? '#f59e0b' : '#ef4444';
}

const SORT_LABELS: Record<string, string> = { score: 'Score', size: 'Größe', age: 'Alter', seeders: 'Seeds', lang: 'Sprache' };
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="is-backdrop" @click.self="close">
      <div class="is-modal">

        <!-- Header -->
        <div class="is-header">
          <div>
            <p class="is-label">Interaktive Suche</p>
            <p class="is-sub">{{ title }}</p>
          </div>
          <button class="is-close" @click="close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Toolbar (nach Laden) -->
        <div v-if="!isLoading && releases.length > 0" class="is-toolbar">
          <span class="is-count">{{ list.length }} Ergebnisse</span>
          <div class="is-chips">
            <button v-for="f in (['all','usenet','torrent'] as const)" :key="f"
              :class="['chip', { active: filterProto === f }]"
              @click="filterProto = f">
              {{ f === 'all' ? 'Alle' : f === 'usenet' ? 'Usenet' : 'Torrent' }}
            </button>
          </div>
          <div class="is-chips">
            <button v-for="sk in (['score','size','age','seeders','lang'] as const)" :key="sk"
              :class="['chip', { active: sortKey === sk }]"
              @click="toggleSort(sk)">
              {{ SORT_LABELS[sk] }}
              <span v-if="sortKey === sk">{{ sortDir === 'desc' ? '▼' : '▲' }}</span>
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="is-body">
          <div v-if="isLoading" class="is-loading">
            <svg class="spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            Suche läuft – kann etwas dauern…
          </div>

          <div v-else-if="list.length === 0" class="is-empty">
            {{ releases.length === 0 ? 'Keine Ergebnisse gefunden' : 'Keine Ergebnisse für diesen Filter' }}
          </div>

          <div v-else class="is-list">
            <div v-for="r in list" :key="r.guid" class="is-row">
              <!-- Left -->
              <div class="is-left">
                <p class="is-title">{{ r.title }}</p>
                <div class="is-badges">
                  <span class="b-quality">{{ r.quality?.quality?.name }}</span>
                  <span v-for="cf in (r.customFormats ?? [])" :key="cf.name" class="b-cf">{{ cf.name }}</span>
                  <span v-if="langTag(r.title)" class="b-cf">{{ langTag(r.title) }}</span>
                  <span class="b-indexer">{{ r.indexer }}</span>
                  <span v-if="score(r) !== 0" :class="score(r) > 0 ? 'b-score-p' : 'b-score-n'">{{ score(r) > 0 ? '+' : '' }}{{ score(r) }}</span>
                </div>
              </div>

              <!-- Right -->
              <div class="is-right">
                <span :class="['b-proto', r.protocol === 'usenet' ? 'proto-u' : 'proto-t']">
                  {{ r.protocol === 'usenet' ? 'NZB' : 'TOR' }}
                </span>
                <span v-if="r.protocol === 'torrent'" class="is-seeds" :style="{ color: seedColor(r.seeders) }">▲{{ r.seeders ?? 0 }}</span>
                <span class="is-age">{{ fmtAge(r) }}</span>
                <span class="is-size">{{ fmtSize(r.size) }}</span>
                <button
                  :class="['is-dl', { 'dl-loading': dlStatus[r.guid]==='loading', 'dl-ok': dlStatus[r.guid]==='ok', 'dl-err': dlStatus[r.guid]==='error' }]"
                  :disabled="dlStatus[r.guid]==='loading' || dlStatus[r.guid]==='ok'"
                  @click="download(r)">
                  <svg v-if="dlStatus[r.guid]==='loading'" class="spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  <span v-else>{{ dlStatus[r.guid]==='ok' ? '✓' : dlStatus[r.guid]==='error' ? '✗' : 'Laden' }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.is-backdrop {
  position: fixed; inset: 0; z-index: 99990;
  background: rgba(0,0,0,.78); backdrop-filter: blur(5px);
  display: flex; align-items: center; justify-content: center; padding: 16px;
}
.is-modal {
  background: var(--bg-elevated); border: 1px solid var(--bg-border);
  border-radius: var(--radius-xl); width: 820px; max-width: 100%; max-height: 85vh;
  display: flex; flex-direction: column;
  box-shadow: 0 24px 64px rgba(0,0,0,.9);
  animation: is-in .15s ease;
}
@keyframes is-in { from { opacity:0; transform:scale(.96) translateY(8px); } to { opacity:1; transform:none; } }

.is-header { display:flex; align-items:flex-start; justify-content:space-between; padding: 14px 20px; border-bottom: 1px solid var(--bg-border); flex-shrink:0; }
.is-label { font-size: var(--text-base); font-weight:700; color:var(--text-primary); margin:0; }
.is-sub { font-size: var(--text-sm); color:var(--text-muted); margin:3px 0 0; max-width:600px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.is-close { color:var(--text-muted); cursor:pointer; padding:4px; border-radius:var(--radius-sm); transition:color .15s; }
.is-close:hover { color:var(--text-primary); }

.is-toolbar { display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding: 10px 20px; border-bottom: 1px solid var(--bg-border); background:var(--bg-surface); flex-shrink:0; }
.is-count { font-size:11px; color:var(--text-muted); white-space:nowrap; }
.is-chips { display:flex; gap:4px; flex-wrap:wrap; }
.chip { font-size:11px; font-weight:500; padding:3px 9px; border-radius:99px; background:var(--bg-elevated); border:1px solid var(--bg-border); color:var(--text-muted); cursor:pointer; transition:all .12s; }
.chip:hover { color:var(--text-secondary); border-color:rgba(255,255,255,.15); }
.chip.active { background:rgba(155,0,69,.15); border-color:rgba(155,0,69,.4); color:#e74fa6; }

.is-body { overflow-y:auto; flex:1; }
.is-loading { display:flex; align-items:center; justify-content:center; gap:12px; padding:48px; color:var(--text-muted); font-size:var(--text-sm); }
.is-empty { padding:48px; text-align:center; color:var(--text-muted); font-size:var(--text-sm); }
.is-list { display:flex; flex-direction:column; }
.is-row { display:flex; align-items:flex-start; gap:12px; padding: 10px 20px; border-bottom:1px solid rgba(255,255,255,.03); transition:background .12s; }
.is-row:hover { background:var(--bg-surface); }
.is-row:last-child { border-bottom:none; }

.is-left { flex:1; min-width:0; display:flex; flex-direction:column; gap:5px; }
.is-title { font-size:12px; font-weight:600; color:var(--text-secondary); word-break:break-all; line-height:1.4; margin:0; }
.is-badges { display:flex; flex-wrap:wrap; gap:3px; }

/* Badge styles */
.b-quality,.b-cf,.b-indexer,.b-score-p,.b-score-n,.b-proto { font-size:9px; font-weight:700; padding:1px 5px; border-radius:3px; }
.b-quality { background:rgba(244,165,74,.12); color:var(--radarr); border:1px solid rgba(244,165,74,.25); }
.b-cf { background:rgba(255,255,255,.05); color:var(--text-muted); border:1px solid var(--bg-border); }
.b-indexer { background:rgba(255,255,255,.03); color:var(--text-muted); border:1px solid var(--bg-border); }
.b-score-p { background:rgba(244,165,74,.12); color:var(--radarr); border:1px solid rgba(244,165,74,.25); }
.b-score-n { background:rgba(239,68,68,.1); color:#ef4444; border:1px solid rgba(239,68,68,.2); }
.proto-u { background:rgba(53,197,244,.1); color:var(--sonarr); border:1px solid rgba(53,197,244,.2); }
.proto-t { background:rgba(34,197,94,.1); color:#22c55e; border:1px solid rgba(34,197,94,.2); }

.is-right { display:flex; align-items:center; gap:8px; flex-shrink:0; padding-top:1px; }
.is-seeds { font-size:11px; font-weight:700; min-width:28px; text-align:right; }
.is-age { font-size:11px; color:var(--text-muted); min-width:26px; text-align:right; }
.is-size { font-size:11px; color:var(--text-tertiary); min-width:60px; text-align:right; white-space:nowrap; }

.is-dl { padding:4px 10px; font-size:11px; font-weight:600; border-radius:var(--radius-sm); min-width:52px; text-align:center; cursor:pointer; transition:all .15s; white-space:nowrap;
  background:rgba(155,0,69,.12); border:1px solid rgba(155,0,69,.3); color:#e74fa6; }
.is-dl:hover:not(:disabled) { background:rgba(155,0,69,.25); }
.is-dl:disabled { cursor:not-allowed; opacity:.7; }
.dl-ok { background:rgba(34,197,94,.1); border-color:rgba(34,197,94,.3); color:#22c55e; }
.dl-err { background:rgba(239,68,68,.1); border-color:rgba(239,68,68,.25); color:#ef4444; }

@keyframes spin { to { transform:rotate(360deg); } }
.spin { animation:spin .8s linear infinite; }
</style>
