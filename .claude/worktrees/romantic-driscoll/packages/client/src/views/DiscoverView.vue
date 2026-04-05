<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '../composables/useApi.js';
import { useMoviesStore } from '../stores/movies.store.js';
import { useSeriesStore } from '../stores/series.store.js';

const { get, post } = useApi();
const router       = useRouter();
const moviesStore  = useMoviesStore();
const seriesStore  = useSeriesStore();

// ── Genre Maps ────────────────────────────────────────────────────────────────

const GENRE_MOVIE: Record<number, string> = {
  28:'Action', 12:'Abenteuer', 16:'Animation', 35:'Komödie', 80:'Krimi',
  99:'Doku', 18:'Drama', 10751:'Familie', 14:'Fantasy', 36:'Geschichte',
  27:'Horror', 10402:'Musik', 9648:'Mystery', 10749:'Romantik', 878:'Sci-Fi',
  53:'Thriller', 10752:'Krieg', 37:'Western',
};
const GENRE_TV: Record<number, string> = {
  10759:'Action', 16:'Animation', 35:'Komödie', 80:'Krimi', 99:'Doku',
  18:'Drama', 10751:'Familie', 10762:'Kinder', 10749:'Romantik', 878:'Sci-Fi',
  27:'Horror', 9648:'Mystery', 53:'Thriller', 10765:'Sci-Fi & Fantasy',
};
const GENRE_EMOJI: Record<number, string> = {
  28:'💥', 12:'🗺️', 16:'🎨', 35:'😂', 80:'🔍', 99:'📹', 18:'🎭',
  10751:'👨‍👩‍👧', 14:'🐉', 36:'📜', 27:'👻', 10402:'🎵', 9648:'🔮',
  10749:'💕', 878:'🚀', 53:'🔪', 10752:'⚔️', 37:'🤠',
  10759:'🏃', 10765:'🛸', 10762:'🧒',
};

// ── State ────────────────────────────────────────────────────────────────────

type MediaType = 'movie' | 'tv';
type Window    = 'week'  | 'day';

const mediaType    = ref<MediaType>('movie');
const trendingWin  = ref<Window>('week');
const minRating    = ref(6.0);
const activeGenre  = ref<number | null>(null);
const activeGenreName = ref('');

const trendingItems  = ref<any[]>([]);
const genreItems     = ref<any[]>([]);
const loadingTrend   = ref(true);
const loadingGenre   = ref(false);

// Detail Modal
const showModal      = ref(false);
const modalItem      = ref<any>(null);
const loadingModal   = ref(false);
const showAddConfig  = ref(false);

// Add Config
const rootFolders    = ref<any[]>([]);
const qualityProfiles = ref<any[]>([]);
const selFolder      = ref('');
const selQuality     = ref<number>(0);
const monitored      = ref(true);
const searchNow      = ref(true);
const adding         = ref(false);
const addedIds       = ref<Set<number>>(new Set());

// Toast
interface Toast { id: number; msg: string; ok: boolean }
const toasts = ref<Toast[]>([]);
let   toastN = 0;
function toast(msg: string, ok = true) {
  const id = ++toastN;
  toasts.value.push({ id, msg, ok });
  setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id); }, 3500);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const posterBase = 'https://image.tmdb.org/t/p/w342';
const backdropBase = 'https://image.tmdb.org/t/p/w1280';

function poster(path?: string) { return path ? posterBase + path : null; }
function backdrop(path?: string) { return path ? backdropBase + path : null; }

function inLibrary(tmdbId: number) {
  if (mediaType.value === 'movie')
    return moviesStore.movies.find(m => m.tmdbId === tmdbId) ?? null;
  return seriesStore.series.find(s => s.tmdbId === tmdbId) ?? null;
}

function itemTitle(item: any) { return item.title ?? item.name ?? '–'; }
function itemYear(item: any)  { return (item.release_date ?? item.first_air_date ?? '').slice(0, 4); }
function itemRating(item: any){ return item.vote_average?.toFixed(1) ?? ''; }

const genreMap = computed(() => mediaType.value === 'movie' ? GENRE_MOVIE : GENRE_TV);

const heroItem = computed(() =>
  trendingItems.value.filter(i => (i.vote_average ?? 0) >= minRating.value)[0] ?? trendingItems.value[0] ?? null
);

const filteredTrend = computed(() =>
  trendingItems.value.filter(i => (i.vote_average ?? 0) >= minRating.value)
);

// ── Load ──────────────────────────────────────────────────────────────────────

async function loadTrending() {
  loadingTrend.value = true;
  activeGenre.value  = null;
  try {
    trendingItems.value = await get<any[]>(
      `/api/tmdb/trending?type=${mediaType.value}&window=${trendingWin.value}`
    );
  } catch { trendingItems.value = []; }
  finally { loadingTrend.value = false; }
}

async function loadGenre(id: number, name: string) {
  activeGenre.value     = id;
  activeGenreName.value = name;
  loadingGenre.value    = true;
  try {
    genreItems.value = await get<any[]>(
      `/api/tmdb/discover?type=${mediaType.value}&genre=${id}&min_rating=${minRating.value}&min_votes=100`
    );
  } catch { genreItems.value = []; }
  finally { loadingGenre.value = false; }
}

async function openDetail(item: any) {
  showModal.value     = true;
  showAddConfig.value = false;
  loadingModal.value  = true;
  modalItem.value     = item; // sofort Basis-Infos zeigen
  try {
    const endpoint = mediaType.value === 'movie'
      ? `/api/tmdb/movie/${item.id}`
      : `/api/tmdb/tv/${item.id}`;
    modalItem.value = await get<any>(endpoint);
  } catch { /* behalte Basis-Item */ }
  finally { loadingModal.value = false; }
}

async function loadAddConfig() {
  showAddConfig.value = true;
  try {
    const [folders, profiles] = await Promise.all([
      get<any[]>(mediaType.value === 'movie' ? '/api/radarr/rootfolders' : '/api/sonarr/rootfolders'),
      get<any[]>(mediaType.value === 'movie' ? '/api/radarr/qualityprofiles' : '/api/sonarr/qualityprofiles'),
    ]);
    rootFolders.value     = folders ?? [];
    qualityProfiles.value = profiles ?? [];
    selFolder.value       = folders?.[0]?.path ?? '';
    selQuality.value      = profiles?.[0]?.id   ?? 0;
  } catch { toast('Fehler beim Laden der Konfiguration', false); }
}

async function addToArr() {
  if (!modalItem.value) return;
  adding.value = true;
  try {
    const tmdbId   = modalItem.value.id;
    const isMovie  = mediaType.value === 'movie';
    const lookupUrl = isMovie
      ? `/api/radarr/lookup?term=tmdb:${tmdbId}`
      : `/api/sonarr/lookup?term=tmdb:${tmdbId}`;
    const results = await get<any[]>(lookupUrl);
    const match   = results?.[0];
    if (!match) throw new Error('Nicht in Radarr/Sonarr gefunden');

    const payload = {
      ...match,
      qualityProfileId: selQuality.value,
      rootFolderPath:   selFolder.value,
      monitored:        monitored.value,
      addOptions: isMovie
        ? { searchForMovie: searchNow.value }
        : { monitor: 'all', searchForMissingEpisodes: searchNow.value },
    };
    const addUrl = isMovie ? '/api/radarr/movie' : '/api/sonarr/series';
    const added  = await post<any>(addUrl, payload);
    addedIds.value.add(tmdbId);
    toast(`„${itemTitle(added)}" wurde hinzugefügt!`);
    // Stores refreshen damit Bibliotheks-Check klappt
    if (isMovie) moviesStore.fetchMovies();
    else         seriesStore.fetchSeries();
    closeModal();
  } catch (e) {
    toast(e instanceof Error ? e.message : 'Fehler beim Hinzufügen', false);
  } finally {
    adding.value = false;
  }
}

async function openSimilar(tmdbId: number) {
  closeModal();
  loadingGenre.value    = true;
  activeGenre.value     = -1;
  activeGenreName.value = 'Ähnliche Inhalte';
  try {
    const endpoint = mediaType.value === 'movie'
      ? `/api/tmdb/movie/${tmdbId}/similar`
      : `/api/tmdb/tv/${tmdbId}/similar`;
    genreItems.value = await get<any[]>(endpoint);
  } catch { genreItems.value = []; }
  finally { loadingGenre.value = false; }
}

function openInLibrary(item: any) {
  const lib = inLibrary(item.id);
  if (!lib) return;
  if (mediaType.value === 'movie') router.push(`/movies/${lib.id}`);
  else                             router.push(`/series/${lib.id}`);
}

function closeModal() {
  showModal.value     = false;
  modalItem.value     = null;
  showAddConfig.value = false;
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  await Promise.allSettled([
    moviesStore.fetchMovies(),
    seriesStore.fetchSeries(),
    loadTrending(),
  ]);
});

watch([mediaType, trendingWin], loadTrending);

function setMediaType(t: MediaType) {
  mediaType.value   = t;
  activeGenre.value = null;
}

// Escape schließt Modal
function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') closeModal(); }
</script>

<template>
  <div class="discover-view" @keydown="onKeyDown" tabindex="-1">

    <!-- Toasts -->
    <Teleport to="body">
      <div class="toast-wrap">
        <TransitionGroup name="toast">
          <div v-for="t in toasts" :key="t.id" :class="['toast-item', t.ok ? 'tok' : 'terr']">{{ t.msg }}</div>
        </TransitionGroup>
      </div>
    </Teleport>

    <!-- Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">Entdecken</h1>
        <p class="page-sub">Trending, Genres &amp; Empfehlungen via TMDB</p>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <!-- Typ -->
      <div class="filter-group">
        <span class="filter-lbl">Typ</span>
        <button v-for="t in (['movie','tv'] as const)" :key="t"
          :class="['fchip', { active: mediaType === t }]"
          @click="setMediaType(t)">
          {{ t === 'movie' ? '🎬 Filme' : '📺 Serien' }}
        </button>
      </div>
      <div class="filter-sep" />
      <!-- Zeitraum -->
      <div class="filter-group">
        <span class="filter-lbl">Zeitraum</span>
        <button :class="['fchip', { active: trendingWin === 'week' }]" @click="trendingWin = 'week'">Diese Woche</button>
        <button :class="['fchip', { active: trendingWin === 'day' }]"  @click="trendingWin = 'day'">Heute</button>
      </div>
      <div class="filter-sep" />
      <!-- Min. Wertung -->
      <div class="filter-group">
        <span class="filter-lbl">Mind. Wertung</span>
        <input type="range" min="0" max="9" step="0.5" :value="minRating"
          @input="minRating = parseFloat(($event.target as HTMLInputElement).value)"
          class="rating-range" />
        <span class="rating-val">{{ minRating.toFixed(1) }}</span>
      </div>
    </div>

    <!-- Hero -->
    <div v-if="heroItem && !loadingTrend" class="hero" :style="backdrop(heroItem.backdrop_path) ? `--bd: url(${backdrop(heroItem.backdrop_path)})` : ''">
      <div class="hero-bg" />
      <div class="hero-grad" />
      <div class="hero-content">
        <img v-if="poster(heroItem.poster_path)" :src="poster(heroItem.poster_path)!" class="hero-poster" />
        <div class="hero-info">
          <span class="trending-badge">🔥 Trending</span>
          <h2 class="hero-title">{{ itemTitle(heroItem) }}</h2>
          <div class="hero-meta">
            <span v-if="itemYear(heroItem)">{{ itemYear(heroItem) }}</span>
            <span v-if="heroItem.genre_ids?.length">{{ heroItem.genre_ids.slice(0,3).map((id: number) => genreMap[id]).filter(Boolean).join(' · ') }}</span>
            <span v-if="itemRating(heroItem)">⭐ {{ itemRating(heroItem) }}</span>
          </div>
          <p v-if="heroItem.overview" class="hero-overview">{{ heroItem.overview.slice(0, 220) }}{{ heroItem.overview.length > 220 ? '…' : '' }}</p>
          <div class="hero-actions">
            <button v-if="inLibrary(heroItem.id)" class="btn-inlib" @click="openInLibrary(heroItem)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              In Bibliothek öffnen
            </button>
            <button v-else class="btn-add" @click="openDetail(heroItem)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Hinzufügen
            </button>
            <button class="btn-details" @click="openDetail(heroItem)">Details</button>
          </div>
        </div>
      </div>
    </div>
    <div v-else-if="loadingTrend" class="hero-skeleton skeleton" />

    <!-- Trending Section -->
    <div class="section-header">
      <div class="section-title">
        <span class="sdot" />
        {{ mediaType === 'movie' ? '🔥 Trending' : '📺 Trending' }}
        {{ trendingWin === 'week' ? 'diese Woche' : 'heute' }}
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loadingTrend" class="poster-grid">
      <div v-for="i in 10" :key="i" class="pcard-skeleton skeleton" />
    </div>

    <!-- Poster Grid -->
    <div v-else class="poster-grid">
      <div v-for="item in filteredTrend.slice(0, 20)" :key="item.id"
        class="pcard" @click="openDetail(item)">
        <div class="pcard-img-wrap">
          <img v-if="poster(item.poster_path)" :src="poster(item.poster_path)!" :alt="itemTitle(item)" class="pcard-img" loading="lazy" />
          <div v-else class="pcard-img pcard-img-ph">{{ mediaType === 'movie' ? '🎬' : '📺' }}</div>
          <div v-if="inLibrary(item.id)" class="pcard-lib-badge">✓</div>
          <span class="pcard-type" :class="mediaType">{{ mediaType === 'movie' ? 'Film' : 'Serie' }}</span>
          <div class="pcard-hover-btn">
            <span v-if="inLibrary(item.id)">Öffnen →</span>
            <span v-else>+ Hinzufügen</span>
          </div>
        </div>
        <div class="pcard-info">
          <p class="pcard-title">{{ itemTitle(item) }}</p>
          <div class="pcard-meta">
            <span class="pcard-year">{{ itemYear(item) }}</span>
            <span v-if="itemRating(item)" class="pcard-rating">★ {{ itemRating(item) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Genre Section -->
    <div class="section-header" id="genres">
      <div class="section-title"><span class="sdot" />🎭 Nach Genre entdecken</div>
    </div>
    <div class="genre-pills">
      <button v-for="(name, id) in genreMap" :key="id"
        :class="['gpill', { active: activeGenre === Number(id) }]"
        @click="loadGenre(Number(id), name)">
        <span>{{ GENRE_EMOJI[Number(id)] ?? '🎬' }}</span>{{ name }}
      </button>
    </div>

    <!-- Genre Results -->
    <template v-if="activeGenre !== null">
      <div class="section-header">
        <div class="section-title">
          <span class="sdot" />
          {{ activeGenre === -1 ? '🔁 Ähnliche Inhalte' : `${GENRE_EMOJI[activeGenre] ?? '🎬'} ${activeGenreName}` }}
        </div>
      </div>
      <div v-if="loadingGenre" class="poster-grid">
        <div v-for="i in 8" :key="i" class="pcard-skeleton skeleton" />
      </div>
      <div v-else class="poster-grid">
        <div v-for="item in genreItems.slice(0, 20)" :key="item.id"
          class="pcard" @click="openDetail(item)">
          <div class="pcard-img-wrap">
            <img v-if="poster(item.poster_path)" :src="poster(item.poster_path)!" :alt="itemTitle(item)" class="pcard-img" loading="lazy" />
            <div v-else class="pcard-img pcard-img-ph">{{ mediaType === 'movie' ? '🎬' : '📺' }}</div>
            <div v-if="inLibrary(item.id)" class="pcard-lib-badge">✓</div>
            <span class="pcard-type" :class="mediaType">{{ mediaType === 'movie' ? 'Film' : 'Serie' }}</span>
            <div class="pcard-hover-btn">
              <span v-if="inLibrary(item.id)">Öffnen →</span>
              <span v-else>+ Hinzufügen</span>
            </div>
          </div>
          <div class="pcard-info">
            <p class="pcard-title">{{ itemTitle(item) }}</p>
            <div class="pcard-meta">
              <span class="pcard-year">{{ itemYear(item) }}</span>
              <span v-if="itemRating(item)" class="pcard-rating">★ {{ itemRating(item) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Detail Modal ── -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showModal" class="modal-backdrop" @click.self="closeModal">
          <div class="modal-box">
            <!-- Backdrop image -->
            <div v-if="modalItem?.backdrop_path" class="modal-backdrop-img"
              :style="`background-image: url(${backdrop(modalItem.backdrop_path)})`" />
            <button class="modal-close" @click="closeModal">✕</button>

            <div class="modal-body">
              <!-- Header -->
              <div class="modal-header">
                <img v-if="poster(modalItem?.poster_path)" :src="poster(modalItem.poster_path)!" class="modal-poster" />
                <div v-else class="modal-poster modal-poster-ph">{{ mediaType === 'movie' ? '🎬' : '📺' }}</div>

                <div class="modal-meta">
                  <h2 class="modal-title">
                    {{ itemTitle(modalItem ?? {}) }}
                    <span v-if="itemYear(modalItem ?? {})" class="modal-year">({{ itemYear(modalItem ?? {}) }})</span>
                  </h2>
                  <div class="modal-badges">
                    <span class="mbadge" :class="mediaType">{{ mediaType === 'movie' ? 'Film' : 'Serie' }}</span>
                    <span v-if="inLibrary(modalItem?.id ?? 0)" class="mbadge mbadge-lib">✓ In Bibliothek</span>
                  </div>
                  <!-- Genre Tags -->
                  <div v-if="modalItem?.genres?.length" class="modal-genres">
                    <span v-for="g in modalItem.genres.slice(0,5)" :key="g.id" class="modal-genre">{{ g.name }}</span>
                  </div>
                  <!-- Rating -->
                  <div v-if="modalItem?.vote_average" class="modal-rating">
                    ⭐ {{ modalItem.vote_average.toFixed(1) }}
                    <span v-if="modalItem.vote_count" class="modal-votes">({{ (modalItem.vote_count >= 1000 ? (modalItem.vote_count/1000).toFixed(1)+'k' : modalItem.vote_count) }})</span>
                  </div>
                </div>
              </div>

              <!-- Loading skeleton -->
              <div v-if="loadingModal" class="modal-skeleton">
                <div class="skeleton" style="height:60px;border-radius:8px" />
                <div class="skeleton" style="height:40px;border-radius:8px" />
              </div>

              <template v-else>
                <!-- Overview -->
                <p v-if="modalItem?.overview" class="modal-overview">{{ modalItem.overview }}</p>

                <!-- Facts Grid -->
                <div class="facts-grid">
                  <div v-if="modalItem?.runtime" class="fact">
                    <span class="fact-lbl">Laufzeit</span>
                    <span class="fact-val">{{ modalItem.runtime }} min</span>
                  </div>
                  <div v-if="modalItem?.number_of_seasons" class="fact">
                    <span class="fact-lbl">Staffeln</span>
                    <span class="fact-val">{{ modalItem.number_of_seasons }}</span>
                  </div>
                  <div v-if="modalItem?.number_of_episodes" class="fact">
                    <span class="fact-lbl">Episoden</span>
                    <span class="fact-val">{{ modalItem.number_of_episodes }}</span>
                  </div>
                  <div v-if="modalItem?.status" class="fact">
                    <span class="fact-lbl">Status</span>
                    <span class="fact-val" :style="modalItem.status === 'Returning Series' || modalItem.status === 'Released' ? 'color:var(--status-success)' : ''">
                      {{ ({'Released':'Veröffentlicht','In Production':'In Produktion','Planned':'Geplant','Ended':'Beendet','Canceled':'Abgesagt','Returning Series':'Laufend'} as Record<string,string>)[modalItem.status] ?? modalItem.status }}
                    </span>
                  </div>
                  <div v-if="modalItem?.production_companies?.[0]" class="fact">
                    <span class="fact-lbl">Studio</span>
                    <span class="fact-val">{{ modalItem.production_companies[0].name }}</span>
                  </div>
                  <div v-if="modalItem?.networks?.[0]" class="fact">
                    <span class="fact-lbl">Netzwerk</span>
                    <span class="fact-val">{{ modalItem.networks[0].name }}</span>
                  </div>
                  <div v-if="modalItem?.original_language" class="fact">
                    <span class="fact-lbl">Sprache</span>
                    <span class="fact-val">{{ modalItem.original_language.toUpperCase() }}</span>
                  </div>
                  <div v-if="modalItem?.budget > 1_000_000" class="fact">
                    <span class="fact-lbl">Budget</span>
                    <span class="fact-val">${{ (modalItem.budget/1_000_000).toFixed(0) }}M</span>
                  </div>
                </div>

                <!-- Cast -->
                <p v-if="modalItem?.credits?.cast?.length" class="modal-cast">
                  <strong>Besetzung:</strong>
                  {{ modalItem.credits.cast.slice(0,6).map((c: any) => c.name).join(', ') }}
                </p>

                <!-- Actions -->
                <div class="modal-actions">
                  <!-- In Bibliothek -->
                  <template v-if="inLibrary(modalItem?.id ?? 0)">
                    <button class="btn-inlib" @click="openInLibrary(modalItem)">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                      In nexarr öffnen
                    </button>
                  </template>
                  <!-- Noch nicht vorhanden -->
                  <template v-else>
                    <button class="btn-add" @click="showAddConfig ? showAddConfig = false : loadAddConfig()">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Zu {{ mediaType === 'movie' ? 'Radarr' : 'Sonarr' }} hinzufügen
                    </button>
                  </template>
                  <button class="btn-similar" @click="openSimilar(modalItem?.id)">Ähnliche</button>
                  <a v-if="modalItem?.id" :href="`https://www.themoviedb.org/${mediaType}/${modalItem.id}`"
                    target="_blank" class="btn-tmdb">TMDB ↗</a>
                </div>

                <!-- Add Config Panel -->
                <Transition name="slide">
                  <div v-if="showAddConfig && !inLibrary(modalItem?.id ?? 0)" class="add-config">
                    <div class="config-row">
                      <div class="config-field">
                        <label class="config-lbl">Root Folder</label>
                        <select v-model="selFolder" class="config-sel">
                          <option v-for="f in rootFolders" :key="f.path" :value="f.path">{{ f.path }}</option>
                        </select>
                      </div>
                      <div class="config-field">
                        <label class="config-lbl">Qualitätsprofil</label>
                        <select v-model="selQuality" class="config-sel">
                          <option v-for="p in qualityProfiles" :key="p.id" :value="p.id">{{ p.name }}</option>
                        </select>
                      </div>
                    </div>
                    <div class="config-checks">
                      <label class="config-check"><input type="checkbox" v-model="monitored" /> Überwachen</label>
                      <label class="config-check"><input type="checkbox" v-model="searchNow" /> Sofort suchen</label>
                    </div>
                    <button class="btn-confirm" :disabled="adding" @click="addToArr">
                      <span v-if="adding">Wird hinzugefügt…</span>
                      <span v-else>Jetzt hinzufügen</span>
                    </button>
                  </div>
                </Transition>
              </template>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

  </div>
</template>

<style scoped>
.discover-view { padding: var(--space-6); min-height: 100%; display: flex; flex-direction: column; gap: var(--space-5); }

/* Header */
.page-header { margin-bottom: calc(-1 * var(--space-2)); }
.page-title  { font-size: var(--text-xl); font-weight: 700; color: var(--text-primary); margin: 0; }
.page-sub    { font-size: var(--text-sm); color: var(--text-muted); margin: 4px 0 0; }

/* Filter Bar */
.filter-bar { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; background: var(--bg-surface); border: 1px solid var(--bg-border); border-radius: var(--radius-lg); padding: var(--space-3) var(--space-4); }
.filter-group { display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }
.filter-lbl { font-size: var(--text-xs); color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; white-space: nowrap; }
.filter-sep { width: 1px; height: 24px; background: var(--bg-border); margin: 0 var(--space-2); flex-shrink: 0; }
.fchip { padding: 4px 12px; border-radius: 99px; font-size: var(--text-sm); font-weight: 500; background: transparent; border: 1px solid var(--bg-border); color: var(--text-muted); cursor: pointer; transition: all .12s; white-space: nowrap; }
.fchip:hover { border-color: var(--accent); color: var(--text-primary); }
.fchip.active { background: rgba(155,0,69,.12); border-color: var(--accent); color: var(--text-primary); }
.rating-range { -webkit-appearance: none; height: 3px; background: var(--bg-border); border-radius: 3px; outline: none; cursor: pointer; width: 90px; }
.rating-range::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; border-radius: 50%; background: var(--accent); cursor: pointer; }
.rating-val { font-size: var(--text-sm); color: var(--accent); font-weight: 700; min-width: 28px; }

/* Hero */
.hero { position: relative; border-radius: var(--radius-lg); overflow: hidden; min-height: 280px; background: var(--bg-surface); }
.hero-bg { position: absolute; inset: 0; background-image: var(--bd); background-size: cover; background-position: center 25%; opacity: .35; }
.hero-grad { position: absolute; inset: 0; background: linear-gradient(to right, rgba(10,10,10,.95) 0%, rgba(10,10,10,.6) 50%, transparent 100%); }
.hero-content { position: relative; z-index: 1; padding: var(--space-8) var(--space-9); display: flex; gap: var(--space-6); align-items: flex-start; }
.hero-poster { width: 120px; border-radius: var(--radius-md); box-shadow: 0 8px 32px rgba(0,0,0,.7); flex-shrink: 0; }
.hero-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--space-3); }
.trending-badge { display: inline-flex; align-items: center; font-size: var(--text-xs); font-weight: 700; padding: 3px 10px; border-radius: 99px; background: rgba(245,197,24,.12); color: var(--sabnzbd); border: 1px solid rgba(245,197,24,.25); align-self: flex-start; }
.hero-title { font-size: clamp(20px,3vw,28px); font-weight: 800; color: #fff; margin: 0; line-height: 1.2; }
.hero-meta { display: flex; gap: var(--space-3); flex-wrap: wrap; font-size: var(--text-sm); color: #888; }
.hero-overview { font-size: var(--text-sm); color: #999; line-height: 1.65; margin: 0; max-width: 600px; }
.hero-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.hero-skeleton { height: 280px; border-radius: var(--radius-lg); }

/* Buttons */
.btn-add { display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; background: var(--accent); border: none; color: #fff; border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: 600; cursor: pointer; transition: background .15s; }
.btn-add:hover { background: #b8005a; }
.btn-inlib { display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; background: rgba(29,185,84,.12); border: 1px solid rgba(29,185,84,.3); color: var(--status-success); border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: 600; cursor: pointer; transition: all .15s; }
.btn-inlib:hover { background: rgba(29,185,84,.22); }
.btn-details { padding: 8px 18px; background: transparent; border: 1px solid #333; color: #888; border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: 500; cursor: pointer; transition: all .15s; }
.btn-details:hover { border-color: var(--accent); color: #fff; }

/* Section Header */
.section-header { display: flex; align-items: center; justify-content: space-between; }
.section-title  { display: flex; align-items: center; gap: var(--space-2); font-size: var(--text-base); font-weight: 700; color: var(--text-secondary); }
.sdot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }

/* Poster Grid */
.poster-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: var(--space-4); }
.pcard-skeleton { aspect-ratio: 2/3; border-radius: var(--radius-md); }

.pcard { display: flex; flex-direction: column; gap: var(--space-2); cursor: pointer; }
.pcard-img-wrap { position: relative; aspect-ratio: 2/3; border-radius: var(--radius-md); overflow: hidden; background: var(--bg-elevated); border: 2px solid transparent; transition: border-color .15s, transform .2s; }
.pcard:hover .pcard-img-wrap { border-color: var(--accent); transform: translateY(-3px); box-shadow: 0 8px 24px rgba(155,0,69,.3); }
.pcard-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.pcard-img-ph { display: flex; align-items: center; justify-content: center; font-size: 28px; color: var(--text-muted); }
.pcard-lib-badge { position: absolute; top: 6px; left: 6px; background: rgba(29,185,84,.9); border-radius: var(--radius-sm); padding: 2px 5px; font-size: 9px; font-weight: 700; color: #000; }
.pcard-type { position: absolute; top: 6px; right: 6px; border-radius: var(--radius-sm); padding: 2px 5px; font-size: 9px; font-weight: 700; }
.pcard-type.movie { background: rgba(244,165,74,.85); color: #000; }
.pcard-type.tv    { background: rgba(53,197,244,.85);  color: #000; }
.pcard-hover-btn { position: absolute; bottom: 40px; left: 0; right: 0; background: rgba(155,0,69,.92); color: #fff; text-align: center; padding: 6px 0; font-size: 11px; font-weight: 700; opacity: 0; transition: opacity .15s; backdrop-filter: blur(4px); }
.pcard:hover .pcard-hover-btn { opacity: 1; }
.pcard-info { display: flex; flex-direction: column; gap: 2px; }
.pcard-title { font-size: var(--text-xs); font-weight: 600; color: var(--text-secondary); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.pcard-meta { display: flex; align-items: center; justify-content: space-between; }
.pcard-year { font-size: var(--text-xs); color: var(--text-muted); }
.pcard-rating { font-size: var(--text-xs); font-weight: 700; color: var(--sabnzbd); }

/* Genre Pills */
.genre-pills { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.gpill { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; border-radius: 99px; font-size: var(--text-sm); font-weight: 500; background: var(--bg-surface); border: 1px solid var(--bg-border); color: var(--text-muted); cursor: pointer; transition: all .12s; }
.gpill:hover { border-color: var(--accent); color: var(--text-primary); }
.gpill.active { background: rgba(155,0,69,.12); border-color: var(--accent); color: var(--text-primary); }

/* Modal */
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.8); z-index: 2000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(6px); padding: var(--space-4); }
.modal-box { background: #111; border: 1px solid var(--bg-border); border-radius: var(--radius-xl); width: 700px; max-width: 92vw; max-height: 88vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 24px 80px rgba(0,0,0,.9); position: relative; }
.modal-backdrop-img { height: 160px; background-size: cover; background-position: center; flex-shrink: 0; }
.modal-backdrop-img::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 160px; background: linear-gradient(to bottom, transparent, #111); pointer-events: none; }
.modal-close { position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,.6); border: none; color: #fff; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; z-index: 10; backdrop-filter: blur(4px); transition: background .12s; }
.modal-close:hover { background: rgba(155,0,69,.7); }
.modal-body { padding: 0 var(--space-6) var(--space-6); overflow-y: auto; flex: 1; }
.modal-header { display: flex; gap: var(--space-5); margin-top: calc(-1 * var(--space-12)); margin-bottom: var(--space-4); position: relative; }
.modal-poster { width: 90px; height: 135px; object-fit: cover; border-radius: var(--radius-md); flex-shrink: 0; border: 3px solid #111; box-shadow: 0 4px 20px rgba(0,0,0,.5); }
.modal-poster-ph { display: flex; align-items: center; justify-content: center; font-size: 36px; background: var(--bg-elevated); }
.modal-meta { padding-top: 52px; flex: 1; min-width: 0; }
.modal-title { font-size: var(--text-xl); font-weight: 800; color: #fff; margin: 0 0 var(--space-2); line-height: 1.25; }
.modal-year  { color: #444; font-size: var(--text-lg); font-weight: 400; }
.modal-badges { display: flex; gap: var(--space-2); flex-wrap: wrap; margin-bottom: var(--space-2); }
.mbadge { font-size: var(--text-xs); padding: 2px 8px; border-radius: 99px; font-weight: 500; }
.mbadge.movie { background: rgba(244,165,74,.12); color: var(--radarr); border: 1px solid rgba(244,165,74,.25); }
.mbadge.tv    { background: rgba(53,197,244,.12);  color: var(--sonarr); border: 1px solid rgba(53,197,244,.25); }
.mbadge-lib   { background: rgba(29,185,84,.1); color: var(--status-success); border: 1px solid rgba(29,185,84,.25); }
.modal-genres { display: flex; gap: var(--space-1); flex-wrap: wrap; margin-bottom: var(--space-2); }
.modal-genre  { font-size: 10px; padding: 2px 8px; border-radius: 10px; background: var(--bg-elevated); color: var(--text-muted); border: 1px solid var(--bg-border); }
.modal-rating { font-size: var(--text-sm); font-weight: 700; color: var(--sabnzbd); }
.modal-votes  { font-size: var(--text-xs); color: var(--text-muted); font-weight: 400; margin-left: 4px; }
.modal-skeleton { display: flex; flex-direction: column; gap: var(--space-3); margin-bottom: var(--space-4); }
.modal-overview { font-size: var(--text-sm); color: #888; line-height: 1.7; margin: 0 0 var(--space-4); }
.facts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2) var(--space-4); background: var(--bg-elevated); border: 1px solid var(--bg-border); border-radius: var(--radius-md); padding: var(--space-3) var(--space-4); margin-bottom: var(--space-4); }
.fact { display: flex; flex-direction: column; gap: 2px; }
.fact-lbl { font-size: 9px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
.fact-val { font-size: var(--text-sm); color: var(--text-secondary); }
.modal-cast { font-size: var(--text-sm); color: var(--text-muted); margin: 0 0 var(--space-4); line-height: 1.6; }
.modal-cast strong { color: var(--text-tertiary); }
.modal-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; margin-bottom: var(--space-3); }
.btn-similar { padding: 8px 16px; background: transparent; border: 1px solid var(--bg-border); color: var(--text-muted); border-radius: var(--radius-md); font-size: var(--text-sm); cursor: pointer; transition: all .15s; }
.btn-similar:hover { border-color: var(--accent); color: var(--text-primary); }
.btn-tmdb { display: inline-flex; align-items: center; padding: 8px 14px; background: rgba(1,180,228,.07); border: 1px solid rgba(1,180,228,.18); color: #01b4e4; border-radius: var(--radius-md); font-size: var(--text-sm); text-decoration: none; transition: all .15s; }
.btn-tmdb:hover { background: rgba(1,180,228,.15); }

/* Add Config */
.add-config { background: var(--bg-elevated); border: 1px solid var(--bg-border); border-radius: var(--radius-md); padding: var(--space-4); }
.config-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-bottom: var(--space-3); }
.config-field { display: flex; flex-direction: column; gap: var(--space-1); }
.config-lbl { font-size: var(--text-xs); color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
.config-sel { background: var(--bg-surface); border: 1px solid var(--bg-border); color: var(--text-secondary); padding: 7px 10px; border-radius: var(--radius-md); font-size: var(--text-sm); outline: none; cursor: pointer; }
.config-sel:focus { border-color: var(--accent); }
.config-checks { display: flex; gap: var(--space-4); margin-bottom: var(--space-3); }
.config-check { display: flex; align-items: center; gap: 6px; font-size: var(--text-sm); color: var(--text-muted); cursor: pointer; }
.config-check input { accent-color: var(--accent); }
.btn-confirm { width: 100%; padding: 9px; background: var(--accent); border: none; color: #fff; border-radius: var(--radius-md); font-size: var(--text-sm); font-weight: 700; cursor: pointer; transition: background .15s; }
.btn-confirm:hover:not(:disabled) { background: #b8005a; }
.btn-confirm:disabled { opacity: .45; cursor: not-allowed; }

/* Toast */
.toast-wrap { position: fixed; bottom: 24px; right: 24px; z-index: 99999; display: flex; flex-direction: column; gap: 8px; pointer-events: none; }
.toast-item { padding: 10px 18px; border-radius: var(--radius-lg); font-size: var(--text-sm); font-weight: 600; box-shadow: 0 8px 32px rgba(0,0,0,.5); }
.tok  { background: rgba(34,197,94,.15); border: 1px solid rgba(34,197,94,.3); color: #22c55e; }
.terr { background: rgba(239,68,68,.15); border: 1px solid rgba(239,68,68,.3); color: #ef4444; }

/* Animations */
.modal-enter-active, .modal-leave-active { transition: all .2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; transform: scale(.96); }
.slide-enter-active, .slide-leave-active { transition: all .2s ease; overflow: hidden; }
.slide-enter-from, .slide-leave-to { opacity: 0; max-height: 0; }
.slide-enter-to, .slide-leave-from { max-height: 400px; }
.toast-enter-active { transition: all .2s ease; }
.toast-leave-active { transition: all .2s ease; }
.toast-enter-from   { opacity: 0; transform: translateY(8px); }
.toast-leave-to     { opacity: 0; transform: translateX(20px); }
</style>
