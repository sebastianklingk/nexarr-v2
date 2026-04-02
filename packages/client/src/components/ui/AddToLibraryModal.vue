<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useMoviesStore } from '../../stores/movies.store.js';
import { useSeriesStore } from '../../stores/series.store.js';
import { useApi } from '../../composables/useApi.js';

const props = defineProps<{
  modelValue: boolean;
  type: 'movie' | 'series';
}>();
const emit = defineEmits<{ 'update:modelValue': [boolean] }>();

const moviesStore = useMoviesStore();
const seriesStore = useSeriesStore();
const { get, post } = useApi();

// ── Search ─────────────────────────────────────────────────────────────────
const searchQuery   = ref('');
const searchResults = ref<any[]>([]);
const isSearching   = ref(false);
const inputRef      = ref<HTMLInputElement | null>(null);
let debounce: ReturnType<typeof setTimeout> | null = null;

// ── Selection + Config ─────────────────────────────────────────────────────
const selected       = ref<any>(null);
const rootFolders    = ref<any[]>([]);
const qualityProfiles = ref<any[]>([]);
const selFolder      = ref('');
const selQuality     = ref(0);
const selType        = ref('standard');
const monitored      = ref(true);
const searchNow      = ref(true);
const configLoaded   = ref(false);
const configLoading  = ref(false);

// ── Action ─────────────────────────────────────────────────────────────────
const adding   = ref(false);
const addError = ref('');
const addOk    = ref(false);

// ── Computed ───────────────────────────────────────────────────────────────
const isMovie = computed(() => props.type === 'movie');
const appColor = computed(() => isMovie.value ? 'var(--radarr)' : 'var(--sonarr)');
const modalTitle = computed(() => isMovie.value ? 'Film hinzufügen' : 'Serie hinzufügen');

function inLibrary(r: any): boolean {
  if (isMovie.value)
    return moviesStore.movies.some(m => m.tmdbId === r.tmdbId || (m.title === r.title && m.year === r.year));
  return seriesStore.series.some(s => s.tvdbId === r.tvdbId || (s.title === r.title && s.year === r.year));
}

// ── Search ─────────────────────────────────────────────────────────────────
function onInput() {
  selected.value = null;
  if (debounce) clearTimeout(debounce);
  const q = searchQuery.value.trim();
  if (q.length < 2) { searchResults.value = []; return; }
  debounce = setTimeout(doSearch, 420);
}

async function doSearch() {
  const q = searchQuery.value.trim();
  if (q.length < 2) return;
  isSearching.value = true;
  try {
    const url = isMovie.value
      ? `/api/radarr/lookup?term=${encodeURIComponent(q)}`
      : `/api/sonarr/lookup?term=${encodeURIComponent(q)}`;
    searchResults.value = (await get<any[]>(url)) ?? [];
  } catch { searchResults.value = []; }
  finally { isSearching.value = false; }
}

// ── Select + Config ─────────────────────────────────────────────────────────
async function selectResult(r: any) {
  selected.value = r;
  if (!configLoaded.value && !configLoading.value) await loadConfig();
}

async function loadConfig() {
  configLoading.value = true;
  try {
    const base = isMovie.value ? 'radarr' : 'sonarr';
    const [folders, profiles] = await Promise.all([
      get<any[]>(`/api/${base}/rootfolders`),
      get<any[]>(`/api/${base}/qualityprofiles`),
    ]);
    rootFolders.value    = folders ?? [];
    qualityProfiles.value = profiles ?? [];
    selFolder.value      = folders?.[0]?.path ?? '';
    selQuality.value     = profiles?.[0]?.id ?? 0;
    configLoaded.value   = true;
  } catch { /* */ }
  finally { configLoading.value = false; }
}

// ── Add ─────────────────────────────────────────────────────────────────────
async function addToLibrary() {
  if (!selected.value || adding.value) return;
  adding.value = true;
  addError.value = '';
  try {
    const payload = {
      ...selected.value,
      qualityProfileId: selQuality.value,
      rootFolderPath:   selFolder.value,
      monitored:        monitored.value,
      addOptions: isMovie.value
        ? { searchForMovie: searchNow.value }
        : { monitor: 'all', searchForMissingEpisodes: searchNow.value, seriesType: selType.value },
    };
    await post(isMovie.value ? '/api/radarr/movie' : '/api/sonarr/series', payload);
    addOk.value = true;
    if (isMovie.value) moviesStore.fetchMovies();
    else               seriesStore.fetchSeries();
    setTimeout(close, 900);
  } catch (e: any) {
    addError.value = e?.message?.includes('already') ? 'Bereits in der Bibliothek vorhanden' : (e?.message ?? 'Fehler beim Hinzufügen');
  } finally { adding.value = false; }
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function resultPoster(r: any): string | undefined {
  if (Array.isArray(r.images)) return r.images.find((i: any) => i.coverType === 'poster')?.remoteUrl;
  return r.remotePoster ?? undefined;
}

function resultTitle(r: any): string {
  return r.title ?? '–';
}

function resultYear(r: any): number | undefined {
  return r.year ?? undefined;
}

function resultMeta(r: any): string {
  const parts: string[] = [];
  if (r.studio)        parts.push(r.studio);
  else if (r.network)  parts.push(r.network);
  if (r.runtime)       parts.push(`${r.runtime} min`);
  const seasons = r.seasonCount ?? r.statistics?.seasonCount;
  if (seasons)         parts.push(`${seasons} Staffeln`);
  return parts.join(' · ');
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
function close() {
  emit('update:modelValue', false);
}

function reset() {
  searchQuery.value   = '';
  searchResults.value = [];
  selected.value      = null;
  addError.value      = '';
  addOk.value         = false;
  adding.value        = false;
}

watch(() => props.modelValue, async (open) => {
  if (open) {
    reset();
    await nextTick();
    inputRef.value?.focus();
  }
});

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') close();
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-backdrop" @click.self="close" @keydown="onKeyDown">
        <div class="modal-box" :style="`--app: ${appColor}`">

          <!-- Header -->
          <div class="modal-header">
            <div class="modal-header-left">
              <div class="modal-accent-bar" />
              <h2 class="modal-title">{{ modalTitle }}</h2>
            </div>
            <button class="modal-close" @click="close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <!-- Search -->
          <div class="modal-search-wrap">
            <div class="modal-search-box" :class="{ searching: isSearching }">
              <svg v-if="!isSearching" class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <svg v-else class="search-icon spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              <input
                ref="inputRef"
                v-model="searchQuery"
                class="search-input"
                type="text"
                :placeholder="isMovie ? 'Filmtitel suchen…' : 'Serientitel suchen…'"
                autocomplete="off"
                @input="onInput"
              />
              <button v-if="searchQuery" class="search-clear" @click="searchQuery=''; searchResults=[]; selected=null">✕</button>
            </div>
          </div>

          <!-- Results -->
          <div class="results-wrap">
            <!-- Empty hint -->
            <div v-if="!searchQuery.trim() && !searchResults.length" class="results-hint">
              {{ isMovie ? 'Filmtitel eingeben um zu suchen' : 'Serientitel eingeben um zu suchen' }}
            </div>

            <!-- Results list -->
            <div v-else-if="searchResults.length" class="results-list">
              <button
                v-for="r in searchResults.slice(0, 12)"
                :key="r.tvdbId ?? r.tmdbId ?? r.title"
                :class="['result-item', { selected: selected === r, 'in-library': inLibrary(r) }]"
                @click="selectResult(r)"
              >
                <div class="result-poster">
                  <img v-if="resultPoster(r)" :src="resultPoster(r)" :alt="resultTitle(r)" loading="lazy" />
                  <div v-else class="result-poster-ph">{{ isMovie ? '🎬' : '📺' }}</div>
                </div>
                <div class="result-info">
                  <span class="result-title">{{ resultTitle(r) }}<span v-if="resultYear(r)" class="result-year"> ({{ resultYear(r) }})</span></span>
                  <span v-if="resultMeta(r)" class="result-meta">{{ resultMeta(r) }}</span>
                  <span v-if="inLibrary(r)" class="result-inlib">✓ Bereits in {{ isMovie ? 'Radarr' : 'Sonarr' }}</span>
                </div>
                <svg v-if="selected === r" class="result-check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
            </div>

            <!-- No results -->
            <div v-else-if="!isSearching && searchQuery.trim().length >= 2" class="results-hint">
              Keine Ergebnisse für „{{ searchQuery }}"
            </div>
          </div>

          <!-- Config (erscheint wenn ausgewählt) -->
          <Transition name="slide">
            <div v-if="selected" class="config-section">
              <div v-if="configLoading" class="config-loading">
                <div class="skeleton" style="height:32px;border-radius:6px" />
                <div class="skeleton" style="height:32px;border-radius:6px" />
              </div>
              <template v-else-if="configLoaded">
                <div class="config-grid">
                  <div class="config-field">
                    <label class="config-label">{{ isMovie ? 'Bibliothek / Root Folder' : 'Root Folder' }}</label>
                    <select v-model="selFolder" class="config-select">
                      <option v-for="f in rootFolders" :key="f.path" :value="f.path">{{ f.path }}</option>
                    </select>
                  </div>
                  <div class="config-field">
                    <label class="config-label">Qualitätsprofil</label>
                    <select v-model="selQuality" class="config-select">
                      <option v-for="p in qualityProfiles" :key="p.id" :value="p.id">{{ p.name }}</option>
                    </select>
                  </div>
                  <div v-if="!isMovie" class="config-field">
                    <label class="config-label">Serientyp</label>
                    <select v-model="selType" class="config-select">
                      <option value="standard">Standard</option>
                      <option value="anime">Anime</option>
                      <option value="daily">Daily</option>
                    </select>
                  </div>
                </div>
                <div class="config-checks">
                  <label class="config-check">
                    <input type="checkbox" v-model="monitored" />
                    <span>Überwachen</span>
                  </label>
                  <label class="config-check">
                    <input type="checkbox" v-model="searchNow" />
                    <span>Sofort suchen</span>
                  </label>
                </div>
              </template>
            </div>
          </Transition>

          <!-- Error -->
          <div v-if="addError" class="add-error">{{ addError }}</div>

          <!-- Footer -->
          <div class="modal-footer">
            <button class="btn-cancel" @click="close">Abbrechen</button>
            <button
              class="btn-add"
              :class="{ 'btn-ok': addOk }"
              :disabled="!selected || adding || inLibrary(selected)"
              @click="addToLibrary"
            >
              <svg v-if="adding" class="spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              <svg v-else-if="addOk" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              {{ addOk ? 'Hinzugefügt!' : adding ? 'Wird hinzugefügt…' : inLibrary(selected ?? {}) ? 'Bereits vorhanden' : 'Hinzufügen' }}
            </button>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  z-index: 3000;
  display: flex; align-items: center; justify-content: center;
  padding: var(--space-4);
}

.modal-box {
  background: #131313;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: var(--radius-xl);
  width: 680px;
  max-width: 95vw;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 32px 80px rgba(0,0,0,.95), 0 0 0 1px rgba(255,255,255,.04);
  overflow: hidden;
}

/* Header */
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: var(--space-5) var(--space-6) var(--space-4);
  border-bottom: 1px solid rgba(255,255,255,.06);
  flex-shrink: 0;
}
.modal-header-left { display: flex; align-items: center; gap: var(--space-3); }
.modal-accent-bar { width: 3px; height: 20px; background: var(--app); border-radius: 2px; flex-shrink: 0; }
.modal-title { font-size: var(--text-lg); font-weight: 700; color: var(--text-primary); margin: 0; }
.modal-close {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: var(--radius-sm);
  background: var(--bg-elevated); border: 1px solid var(--bg-border);
  color: var(--text-muted); cursor: pointer; transition: all .15s;
}
.modal-close:hover { background: var(--bg-overlay); color: var(--text-secondary); }

/* Search */
.modal-search-wrap { padding: var(--space-4) var(--space-6); flex-shrink: 0; }
.modal-search-box {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-elevated);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: var(--radius-md);
  transition: border-color .15s;
}
.modal-search-box:focus-within { border-color: var(--app); }
.search-icon { color: var(--text-muted); flex-shrink: 0; }
.search-input {
  flex: 1; background: none; border: none; outline: none;
  font-size: var(--text-base); color: var(--text-primary);
}
.search-input::placeholder { color: var(--text-muted); }
.search-clear { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 13px; padding: 0; }
.search-clear:hover { color: var(--text-secondary); }

/* Results */
.results-wrap {
  flex: 1; overflow-y: auto; min-height: 80px; max-height: 300px;
  padding: 0 var(--space-6);
}
.results-hint {
  padding: var(--space-6) 0;
  text-align: center; font-size: var(--text-sm); color: var(--text-muted);
}
.results-list { display: flex; flex-direction: column; gap: 2px; padding-bottom: var(--space-2); }

.result-item {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer; text-align: left; width: 100%;
  transition: all .12s;
}
.result-item:hover { background: rgba(255,255,255,.04); border-color: rgba(255,255,255,.06); }
.result-item.selected {
  background: rgba(var(--app), .08);
  border-color: var(--app);
  background: color-mix(in srgb, var(--app) 10%, transparent);
  border-color: color-mix(in srgb, var(--app) 50%, transparent);
}
.result-item.in-library .result-title { color: var(--text-muted); }

.result-poster {
  width: 38px; height: 56px; flex-shrink: 0;
  border-radius: var(--radius-sm); overflow: hidden;
  background: var(--bg-elevated); border: 1px solid var(--bg-border);
}
.result-poster img { width: 100%; height: 100%; object-fit: cover; }
.result-poster-ph { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 16px; }

.result-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.result-title { font-size: var(--text-sm); color: var(--text-secondary); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.result-year { color: var(--text-muted); font-weight: 400; }
.result-meta { font-size: var(--text-xs); color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.result-inlib { font-size: var(--text-xs); color: #22c55e; font-weight: 600; }

.result-check { color: var(--app); flex-shrink: 0; }

/* Config */
.config-section {
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid rgba(255,255,255,.06);
  background: rgba(255,255,255,.02);
  flex-shrink: 0;
}
.config-loading { display: flex; gap: var(--space-3); }
.config-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-3); }
.config-field { display: flex; flex-direction: column; gap: 5px; }
.config-label { font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .06em; }
.config-select {
  background: var(--bg-elevated); border: 1px solid rgba(255,255,255,.1);
  color: var(--text-secondary); padding: 7px 10px;
  border-radius: var(--radius-md); font-size: var(--text-sm);
  outline: none; cursor: pointer; width: 100%;
}
.config-select:focus { border-color: var(--app); }
.config-checks { display: flex; gap: var(--space-5); }
.config-check { display: flex; align-items: center; gap: 7px; font-size: var(--text-sm); color: var(--text-secondary); cursor: pointer; }
.config-check input { accent-color: var(--app); width: 14px; height: 14px; cursor: pointer; }

/* Error */
.add-error {
  margin: 0 var(--space-6) var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.25);
  border-radius: var(--radius-sm); font-size: var(--text-xs); color: #ef4444;
  flex-shrink: 0;
}

/* Footer */
.modal-footer {
  display: flex; align-items: center; justify-content: flex-end; gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid rgba(255,255,255,.06);
  flex-shrink: 0;
}
.btn-cancel {
  padding: 8px 18px; border-radius: var(--radius-md);
  background: var(--bg-elevated); border: 1px solid rgba(255,255,255,.1);
  color: var(--text-secondary); font-size: var(--text-sm); font-weight: 500;
  cursor: pointer; transition: all .15s;
}
.btn-cancel:hover { background: var(--bg-overlay); color: var(--text-primary); }
.btn-add {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 22px; border-radius: var(--radius-md);
  background: var(--app); border: 1px solid var(--app);
  color: #000; font-size: var(--text-sm); font-weight: 700;
  cursor: pointer; transition: all .15s; min-width: 120px; justify-content: center;
}
.btn-add:hover:not(:disabled) { opacity: .88; }
.btn-add:disabled { opacity: .4; cursor: not-allowed; }
.btn-add.btn-ok { background: #22c55e; border-color: #22c55e; }

/* Animations */
.modal-enter-active, .modal-leave-active { transition: all .2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; transform: scale(.97) translateY(8px); }

.slide-enter-active, .slide-leave-active { transition: all .2s ease; overflow: hidden; }
.slide-enter-from, .slide-leave-to { opacity: 0; max-height: 0; padding-top: 0; padding-bottom: 0; }
.slide-enter-to, .slide-leave-from { max-height: 300px; }

@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin .8s linear infinite; }
</style>
