# nexarr v2 – Code Conventions
> Verbindlich für Chat-Claude und Claude Code.
> Abweichungen nur nach expliziter Entscheidung in SESSION_LOG.md dokumentieren.

---

## Wer macht was? Chat-Claude vs. Claude Code

Chat-Claude hat via nexarr-MCP direkten Dateizugriff auf den Workspace.
Vor jeder Aufgabe kurz abwägen:

| Situation | Wer macht es? |
|---|---|
| Einzelne Datei schreiben / patchen | Chat-Claude direkt |
| Verzeichnisse + Scaffold anlegen | Chat-Claude direkt |
| `.ai/`-Dateien pflegen | Chat-Claude direkt |
| Code lesen / reviewen | Chat-Claude direkt |
| `git`, `npm install`, `npx tsc` | User (Shell) |
| **Server neustarten nach Backend-Änderung** | **User: `npm run restart`** |
| Große Feature-Phase (5+ Dateien + TypeCheck) | Claude Code |
| Server-Debugging (Logs, Crashes) | Claude Code |
| Docker Build / Push | Claude Code |

---

## TypeScript

### Grundregeln
```typescript
// ✅ Explizite Return Types bei allen Service-Funktionen
async function getMovies(): Promise<RadarrMovie[]> { ... }

// ✅ Zod für ALLE externen API-Responses – nie blind casten
const movie = RadarrMovieSchema.safeParse(response.data);
if (!movie.success) throw new ApiError('Invalid Radarr response', 500);

// ✅ unknown statt any bei unbekannten Typen
function processWebhook(payload: unknown): WebhookEvent {
  return WebhookEventSchema.parse(payload);
}

// ❌ Kein any
const data: any = response.data;  // VERBOTEN

// ❌ Kein blindes Casting
const movie = response.data as RadarrMovie;  // VERBOTEN ohne vorherige Validation

// ✅ Type Guards für Discriminated Unions
function isRadarrMovie(x: unknown): x is RadarrMovie {
  return typeof x === 'object' && x !== null && 'tmdbId' in x;
}
```

### Imports
```typescript
// ✅ Relative Imports innerhalb eines packages
import { C } from '../cache/cache';
import type { RadarrMovie } from '@nexarr/shared';

// ✅ Type-only Imports für reine Types
import type { Request, Response, NextFunction } from 'express';

// ❌ Kein Default-Export bei Services und Routes
export default radarrService;  // VERBOTEN – named exports only
```

---

## Backend – Express Routes

### Datei-Struktur: routes/*.routes.ts
```typescript
// ✅ Korrekte Route-Struktur
import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import * as radarrService from '../services/radarr.service';

const router = Router();

// Nur HTTP-Handling hier – KEINE Business Logic
router.get('/movies', requireAuth, async (req, res, next) => {
  try {
    const movies = await radarrService.getMovies();
    res.json(movies);
  } catch (err) {
    next(err);  // ← IMMER next(err), nie res.status(500) direkt
  }
});

// Query-Parameter validieren mit Zod
router.get('/search', requireAuth, async (req, res, next) => {
  try {
    const { q, type } = SearchQuerySchema.parse(req.query);
    const results = await radarrService.search(q, type);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

export { router as radarrRouter };
```

### Datei-Struktur: services/*.service.ts
```typescript
// ✅ Korrekte Service-Struktur
import axios from 'axios';
import { env } from '../config/env';
import { C } from '../cache/cache';
import type { RadarrMovie } from '@nexarr/shared';

// Helper für konsistente Headers
const radarrHeaders = () => ({ 'X-Api-Key': env.RADARR_API_KEY });
const radarrBase = () => env.RADARR_URL + '/api/v3';

export async function getMovies(): Promise<RadarrMovie[]> {
  return C.fetch(
    'radarr_movies',
    async () => {
      const { data } = await axios.get(`${radarrBase()}/movie`, {
        headers: radarrHeaders(),
        timeout: 10000,
      });
      return data as RadarrMovie[];
    },
    C.TTL.COLLECTION
  );
}

// Nach Mutations: Cache invalidieren
export async function deleteMovie(id: number): Promise<void> {
  await axios.delete(`${radarrBase()}/movie/${id}`, {
    headers: radarrHeaders(),
  });
  C.del('radarr_movies');
  C.del(`radarr_movie_${id}`);
}
```

### Route Registration in app.ts
```typescript
// ✅ Alle Routen in app.ts registrieren
import { radarrRouter } from './routes/radarr.routes';
app.use('/api/radarr', radarrRouter);

// ✅ Optionale Integrationen: immer registrieren, Guard im Service
// NICHT: if (env.RADARR_URL) app.use('/api/radarr', ...) ← VERBOTEN
// Stattdessen: Route immer registrieren, Service wirft wenn nicht konfiguriert
```

### Error Handling
```typescript
// ✅ Zentraler Error Handler (bereits in app.ts definiert)
// Alle Fehler via next(err) weiterleiten
// Niemals direkt res.status(xxx).json({error: ...}) in Route-Handlern

// ✅ Custom Error Class nutzen
throw new ApiError('Radarr not configured', 503);
throw new ApiError('Movie not found', 404);
throw new ValidationError('Invalid query parameter', details);
```

---

## Backend – Cache

### Cache-Regeln
```typescript
// ✅ ALLE externen API-Calls via C.fetch()
const movies = await C.fetch('radarr_movies', fetchFn, C.TTL.COLLECTION);

// ✅ TTL-Auswahl
C.TTL.LIVE       // 4s   – Queue-Status, aktive Downloads
C.TTL.QUEUE      // 12s  – Download-Queues
C.TTL.STATS      // 30s  – Statistiken, Counts
C.TTL.DETAIL     // 60s  – Einzel-Objekte (Film, Serie, etc.)
C.TTL.HISTORY    // 60s  – History-Listen
C.TTL.COLLECTION // 5min – Komplette Bibliotheken
C.TTL.CALENDAR   // 5min – Kalender-Daten
C.TTL.STATIC     // 30min – Unveränderliche Daten (Qualitätsprofile, Root-Folders)

// ✅ Cache-Keys: konsistentes Naming-Schema
'radarr_movies'              // Komplette Collection
'radarr_movie_{id}'          // Einzelnes Objekt
'radarr_queue'               // Queue-Status
'sonarr_series'
'sonarr_series_{id}'
'sonarr_episodes_{seriesId}'

// ✅ Nach JEDER Mutation invalidieren
C.del('radarr_movies');              // Einzelner Key
C.delPrefix('radarr_movie_');        // Alle Detail-Keys
C.delPrefix('radarr_');              // Alles von Radarr (selten nötig)
```

---

## Frontend – Vue 3

### Component-Struktur
```vue
<!-- ✅ Korrekte Component-Struktur -->
<script setup lang="ts">
// 1. Imports
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useMoviesStore } from '@/stores/movies.store';
import PosterCard from '@/components/media/PosterCard.vue';
import type { RadarrMovie } from '@nexarr/shared';

// 2. Props & Emits
const props = defineProps<{
  movieId: number;
  showRating?: boolean;
}>();

const emit = defineEmits<{
  'movie-selected': [movie: RadarrMovie];
  'close': [];
}>();

// 3. Composables & Stores
const router = useRouter();
const moviesStore = useMoviesStore();

// 4. Reactive State
const isLoading = ref(false);
const searchQuery = ref('');

// 5. Computed
const filteredMovies = computed(() =>
  moviesStore.movies.filter(m =>
    m.title.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
);

// 6. Methods
function openMovie(movie: RadarrMovie) {
  router.push(`/movies/${movie.id}`);
  emit('movie-selected', movie);
}

// 7. Lifecycle
onMounted(async () => {
  await moviesStore.fetchMovies();
});
</script>

<template>
  <!-- ✅ Kein inline onclick, kein document.getElementById -->
  <!-- ✅ Immer @click="handler" -->
  <div class="movies-grid">
    <PosterCard
      v-for="movie in filteredMovies"
      :key="movie.id"
      :item="movie"
      @click="openMovie(movie)"
    />
  </div>
</template>

<!-- ✅ Scoped Styles – immer scoped -->
<style scoped>
.movies-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--space-3);
}
</style>
```

### Was VERBOTEN ist in Vue
```typescript
// ❌ Kein document.getElementById in Vue Components
const el = document.getElementById('my-element');  // VERBOTEN
// ✅ Stattdessen: template refs
const myRef = ref<HTMLElement | null>(null);  // + ref="myRef" im Template

// ❌ Kein Options API
export default { data() {}, methods: {} }  // VERBOTEN
// ✅ Nur Composition API mit <script setup>

// ❌ Kein inline Event-Handler mit Strings
<button onclick="doSomething()">  // VERBOTEN
// ✅ Immer Vue-Events
<button @click="doSomething">

// ❌ Kein direktes DOM-Manipulation
document.querySelector('.card').style.display = 'none';  // VERBOTEN
// ✅ Reactiver State
const isVisible = ref(true);
// <div v-if="isVisible">

// ❌ Keine hardcodierten API-URLs
fetch('http://192.168.188.42:3000/api/radarr/movies')  // VERBOTEN
// ✅ Immer über useApi Composable
const { data } = useApi('/api/radarr/movies')
```

### Pinia Store Struktur
```typescript
// ✅ Korrekte Store-Struktur (Composition Store API)
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useApi } from '@/composables/useApi';
import type { RadarrMovie } from '@nexarr/shared';

export const useMoviesStore = defineStore('movies', () => {
  // State
  const movies = ref<RadarrMovie[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Getters
  const movieById = computed(() =>
    (id: number) => movies.value.find(m => m.id === id)
  );

  const availableMovies = computed(() =>
    movies.value.filter(m => m.hasFile)
  );

  // Actions
  async function fetchMovies() {
    isLoading.value = true;
    error.value = null;
    try {
      const { data } = await useApi('/api/radarr/movies');
      movies.value = data;
    } catch (err) {
      error.value = 'Filme konnten nicht geladen werden';
    } finally {
      isLoading.value = false;
    }
  }

  return { movies, isLoading, error, movieById, availableMovies, fetchMovies };
});
```

---

## CSS & Styling

### Design-Token Verwendung
```css
/* ✅ Immer CSS Variables aus dem Design System */
.card {
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}

.title {
  color: var(--text-secondary);  /* NICHT #cccccc hardcoden */
  font-size: var(--text-md);
}

/* ❌ Keine hardcodierten Farben außer App-Farben in Spezialfällen */
.title { color: #cccccc; }  /* VERBOTEN */

/* ✅ App-Farben: NUR als Akzente, NICHT als Textfarbe */
.radarr-indicator {
  border-left: 3px solid var(--radarr);  /* ✅ OK */
  color: var(--radarr);                  /* ❌ Nur für Icons/Badges mit hohem Kontrast */
}

.section-title {
  color: var(--radarr);  /* ❌ VERBOTEN – schlechter Kontrast */
  color: var(--text-secondary);  /* ✅ Weißlicher Text, lesbar */
}
```

### Responsive Design
```css
/* Mobile First – immer von klein nach groß */
.grid {
  grid-template-columns: repeat(2, 1fr);  /* Mobile: 2 Spalten */
}

@media (min-width: 480px) {
  .grid { grid-template-columns: repeat(3, 1fr); }
}

@media (min-width: 768px) {
  .grid { grid-template-columns: repeat(4, 1fr); }
}

/* Besser: auto-fill ohne Media Queries */
.poster-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: var(--space-3);
}
```

---

## Naming Conventions

```
Dateien:
  kebab-case         radarr.service.ts, poster-card.vue (nein, Vue = PascalCase)
  PascalCase         PosterCard.vue, HeroSection.vue (Vue Components)
  camelCase          useApi.ts, moviesStore (Composables, Stores)

Funktionen:
  camelCase          getMovies(), fetchMovies(), handleClick()
  Boolean-Prefix     isLoading, hasFile, canDelete

Typen & Interfaces:
  PascalCase         RadarrMovie, SonarrSeries, ApiResponse<T>
  Zod-Schemas        RadarrMovieSchema (Schema als Suffix)

CSS-Klassen:
  kebab-case         .poster-card, .hero-section, .view-toggle

Konstanten:
  SCREAMING_SNAKE    MAX_RETRY_COUNT, DEFAULT_TIMEOUT_MS
```

---

## File Size Limits

Wenn eine Datei diese Grenzen überschreitet → aufteilen.

```
routes/*.routes.ts          max. 200 Zeilen
services/*.service.ts       max. 300 Zeilen
views/*View.vue             max. 400 Zeilen
components/**/*.vue         max. 250 Zeilen
stores/*.store.ts           max. 200 Zeilen
```

---

## Checkliste: Neue Integration einbauen

Bei jeder neuen API/Integration diese Reihenfolge einhalten:

1. `.env` + `env.ts` (Zod-Schema) um neue Keys ergänzen
2. `*.service.ts` anlegen – alle `C.fetch()`-Calls mit passendem TTL
3. `*.routes.ts` anlegen + in `app.ts` registrieren
4. **`cache/warmup.ts` aktualisieren** – neue Endpunkte in die richtige Welle (1–4) einfügen
5. Wellen-Tabelle und Cache-Key-Liste in `.ai/INTEGRATIONS.md` ergänzen
6. TypeCheck + Neustart, Warmup-Log prüfen

> Details zur Wellen-Zuordnung: `.ai/INTEGRATIONS.md` → „⚠️ Pflicht bei jeder neuen Integration“

---

## Icon-System

### Drei Utilities für Icons
```typescript
// 1. Media Icons (Codecs, Auflösungen, Kanäle, Content-Rating)
import { getMediaIcon, getBrandIcon, getMediaLabel } from '../utils/mediaIcons.js';

// 2. Rating Icons (IMDb, TMDB, Rotten Tomatoes) – Inline-SVG-Strings
import { getRatingIcon } from '../utils/ratingIcons.js';

// 3. Platform Icons (Tautulli Player-Plattformen) – Inline-SVG-Strings
import { getPlatformIcon } from '../utils/platformIcons.js';
```

### Vue Component: MediaIcon
```vue
<!-- Brand-SVG für bekannte Codecs/Formate -->
<MediaIcon category="audio_codec" value="truehd" :size="24" />
<MediaIcon category="video_codec" value="hevc" :size="20" />
<MediaIcon category="video_resolution" value="4k" :size="20" />

<!-- Standalone Brand-Icons (HDR, Dolby Vision etc.) -->
<MediaIcon brand="dolby_vision" :size="32" />
<MediaIcon brand="hdr10plus" :size="28" />

<!-- Fallback: Text-Badge wenn kein Icon gefunden -->
<MediaIcon category="video_codec" value="unknown_codec" fallbackLabel="???" />
```

### Regeln
- **IMMER** `getMediaIcon()` / `<MediaIcon>` verwenden statt hardcodierte Pfade
- **IMMER** `getRatingIcon()` für Rating-Seiten-Logos (IMDb, RT, TMDB)
- **IMMER** `getPlatformIcon()` für Tautulli Stream-Player
- Brand-SVGs haben Priorität über Tautulli-PNGs (gleicher Codec = SVG wird bevorzugt)
- Alias-System normalisiert automatisch: `h265`→`hevc`, `truehd`→`dolby_truehd`, `2160`→`4k` etc.
- Icons regenerieren: `bash scripts/download-icons.sh` (lädt von GitHub + Wikimedia)
- `ratingIcons.ts` wird vom Script auto-generiert – NICHT manuell editieren
- `platformIcons.ts` wurde manuell aus Tautulli SVGs generiert
- `mediaIcons.ts` ist handgeschrieben – neue Codecs/Aliases hier ergänzen

---

## Validierung vor jedem Commit

```bash
# TypeScript Check – MUSS fehlerfrei sein
npm run typecheck
# oder manuell:
node_modules/.bin/tsc --noEmit                    # Server
node_modules/.bin/vue-tsc --noEmit                # Client
```

**Wer führt das aus?**
- **Chat-Claude:** Kann keine Shell-Befehle ausführen. Gibt den Befehl aus, User führt ihn aus.
- **Claude Code:** Führt `npm run typecheck` IMMER selbst vor dem Commit aus.

Wenn Fehler → zuerst fixen, dann committen.

**Commit-Workflow (immer in dieser Reihenfolge):**
```bash
npm run typecheck          # 1. TypeScript prüfen
git add -A                 # 2. Alles stagen
git commit -m "type(scope): beschreibung"  # 3. Committen
git push gitea main && git push github main  # 4. Pushen
```
