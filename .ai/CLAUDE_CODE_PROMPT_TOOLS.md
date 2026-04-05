# nexarr AI – Claude Code Implementierungs-Prompt (Tool-Erweiterung)

> Dieses Dokument wird von Claude Code gelesen. Es definiert die nächste Implementierungsphase.
> Erstellt: 04.04.2026

---

## Projekt: nexarr v2 – KI Tool-Erweiterung (Phase AI-2B bis AI-6)

Du erweiterst die KI von nexarr v2 massiv. Die Basis (Phase AI-1 bis AI-5) ist fertig:
Ollama-Anbindung, 21 Tools, Memory, RAG, Frontend Chat-Widget – alles funktioniert.
Jetzt geht es darum nexarr AI von einem netten Chatbot zum mächtigsten Feature des Dashboards zu machen.

---

## Projektpfad & Stack

```
Pfad:    /mnt/user/appdata/openclaw/config/workspace/nexarr-v2/
Stack:   Node 22 + TypeScript 5 + Express 5 + Vue 3 + Vite + Pinia + Socket.io + SQLite (node:sqlite)
Struktur: npm workspaces Monorepo → packages/server, packages/client, packages/shared
Dev-URL: http://192.168.188.42:3000 (Express) / http://192.168.188.42:5173 (Vite)
Auth:    AUTH_DISABLED=true
Ollama:  http://192.168.188.42:11434 (qwen3:30b Chat, nomic-embed-text Embed, gemma3:27b Vision)
GPU:     RTX 6000 Ada 48 GB VRAM – alle 3 Modelle passen gleichzeitig rein
```

---

## Pflichtlektüre – ZUERST lesen

1. **`.ai/CONTEXT.md`** → Gesamter Projekt-Stand, Design-System, alle Phasen
2. **`.ai/LESSONS.md`** → Bekannte Bugs und Regeln
3. **`.ai/CONVENTIONS.md`** → Code-Standards, Imports, Commit-Workflow
4. **`.ai/TOOLS_COMPLETE.md`** → **DIE TOOL-LISTE** – 107 Tools, Prioritäten, welche Services existieren
5. **`.ai/ROADMAP_AI.md`** → Architektur-Übersicht, Memory, Personality

Für Service-APIs die du anbinden musst:
6. **`.ai/INTEGRATIONS.md`** → API-Patterns für Radarr, Sonarr, etc.

---

## Was bereits existiert

### AI Backend (packages/server/src/ai/)
- `ai.service.ts` – Ollama HTTP Client (chat, chatStream, embed)
- `personality.ts` – System-Prompt Builder
- `tools.ts` – **21 Tool-Definitionen** (aktuell)
- `executor.ts` – Tool-Dispatcher an Services
- `agent.ts` – Agentic Loop (max 5 Iterationen)
- `stream.ts` – Socket.io Streaming + Tool-Loop
- `vectors.ts`, `memory.ts`, `summary.ts` – Memory-System
- `knowledge.ts`, `chunking.ts`, `knowledge-seed.ts`, `library-analysis.ts` – RAG

### AI Frontend (packages/client/src/)
- `stores/ai.store.ts` – Pinia Store mit Socket.io Streaming
- `components/ai/AiChatWidget.vue` – Floating Button + Panel
- `components/ai/AiChatPanel.vue` – Chat mit Message-Bubbles, Streaming, Tool-Call Badges

### Bestehende Services (packages/server/src/services/)
Alle diese Services haben Funktionen die als AI-Tools exponiert werden können:
- `radarr.service.ts` – Filme (CRUD, Search, Releases, History, Missing, Quality Profiles)
- `sonarr.service.ts` – Serien (CRUD, Episodes, Releases, History, Missing, Season Monitor)
- `lidarr.service.ts` – Musik (Artists, Albums, Search)
- `tmdb.service.ts` – TMDB (Details, Credits, Videos, Trending, Discover, Similar)
- `prowlarr.service.ts` – Indexer (Search, Grab, Stats)
- `sabnzbd.service.ts` – Downloads (Queue, Pause, Resume, Priority, Delete)
- `transmission.service.ts` – Torrents (Queue, Pause, Resume, Delete)
- `tautulli.service.ts` – Streams & Analytics (Activity, History, und VIEL MEHR via API)
- `overseerr.service.ts` – Anfragen (List, Approve, Decline)
- `bazarr.service.ts` – Untertitel (Movie/Episode Status, Search, Delete)
- `plex.service.ts` – Plex (Sessions, Libraries, DeepLink, Status)
- `abs.service.ts` – Audiobookshelf (Libraries, Items, Search, Progress)
- `gotify.service.ts` – Benachrichtigungen (Messages, Delete)
- `queue.service.ts` – Aggregierte Download-Queue

---

## Implementierungs-Auftrag

Arbeite die folgenden 6 Batches der Reihe nach ab. Die vollständige Tool-Liste mit allen Details steht in `.ai/TOOLS_COMPLETE.md`.

### Batch 1: Fehlende Tools verdrahten (41 Tools)

Erweitere `tools.ts` und `executor.ts` um ALLE ❌-markierten Tools aus TOOLS_COMPLETE.md.
Das sind Tools wo der Backend-Service bereits existiert – du musst nur:
1. Tool-Definition (JSON-Schema) in `tools.ts` hinzufügen
2. Handler-Funktion in `executor.ts` implementieren
3. Tool in `allTools[]` Array registrieren
4. Bei destruktiven Tools: in `destructiveTools` Set aufnehmen

**Kategorien:** Filme (8), Serien (9), Musik (4), Downloads (4), Bazarr (3), Plex (3), Kalender/Discover (3), System (1), Prowlarr (1), Audiobookshelf (3), Gotify (2)

**Wichtig:** Einige Services müssen ggf. um Tautulli-API-Endpoints erweitert werden (siehe Batch 3).
Die `executor.ts` Datei wird groß – splitte sie auf wenn sie 300 Zeilen überschreitet:
- `executor.ts` → Import-Router der an Teil-Executors delegiert
- `executors/movies.executor.ts`, `executors/series.executor.ts`, etc.

### Batch 2: UI Navigation + Rich Media Cards (9 Tools)

**2a – Navigation (Backend + Frontend)**

Neues Socket.io Event-System:
```typescript
// Backend: stream.ts – neue Events emittieren
socket.emit('ai:navigate', { path: '/movies/1604' });
socket.emit('ai:open_url', { url: 'https://app.plex.tv/...' });

// Frontend: ai.store.ts – Events abfangen
socket.on('ai:navigate', (data) => router.push(data.path));
socket.on('ai:open_url', (data) => window.open(data.url, '_blank'));
```

Tools: `navigate_to`, `navigate_to_external`, `navigate_search`
Diese Tools sind NICHT destruktiv – sie ändern nur die UI-View.

**2b – Rich Media Cards (Frontend-Erweiterung)**

`AiChatPanel.vue` / `AiMessage.vue` muss Tool-Results als Cards rendern statt nur Text:

```
Tool-Result Typ → Renderer
─────────────────────────────────
poster_card    → Film/Serien-Card mit Poster-Bild, Rating, Genre, Action-Buttons
media_carousel → Horizontaler Slider mit mehreren Poster-Cards
download_card  → Progress-Bar, Speed, ETA
stream_card    → User, Poster, Quality-Badges
calendar_preview → Mini-Kalender-Woche
action_buttons → Klickbare Buttons die weitere Tool-Calls auslösen
```

Dafür brauchst du:
- Neue Vue-Komponenten in `components/ai/cards/`
  - `AiPosterCard.vue` – Poster links, Infos rechts, Action-Buttons unten
  - `AiMediaCarousel.vue` – Horizontaler Scroll mit Poster-Cards
  - `AiDownloadCard.vue` – Progress-Bar Widget
  - `AiStreamCard.vue` – Stream-Info Card
  - `AiActionButtons.vue` – Interaktive Button-Reihe
- In `AiChatPanel.vue`: Tool-Result Dispatcher der den richtigen Card-Type rendert
- Die Tool-Handler (executor) müssen strukturierte Daten mit einem `_cardType` Feld zurückgeben

TMDB Poster-URLs: `https://image.tmdb.org/t/p/w342/{poster_path}` (existiert schon als Pattern in `images.ts`)

### Batch 3: Tautulli Analytics (8 Tools)

Der Tautulli-Service muss um diese Endpoints erweitert werden:
```typescript
// Neue Funktionen in tautulli.service.ts:
getHomeStats(timeRange?: number): Promise<unknown>       // get_home_stats
getUserWatchTimeStats(userId: number): Promise<unknown>   // get_user_watch_time_stats
getLibraryWatchTimeStats(sectionId: number): Promise<unknown> // get_library_watch_time_stats
getRecentlyAdded(count?: number): Promise<unknown>        // get_recently_added
getPlaysByDate(timeRange?: number): Promise<unknown>      // get_plays_by_date
getPlaysByStreamType(timeRange?: number): Promise<unknown> // get_plays_by_stream_type
getUserPlayerStats(userId: number): Promise<unknown>      // get_user_player_stats
```

Tautulli API-Pattern: `GET /api/v2?apikey={key}&cmd={command}&{params}`
Die Base-URL und API-Key sind schon in `.env` (TAUTULLI_URL, TAUTULLI_API_KEY).

### Batch 4: Smart AI Features (5 Tools)

Höhere Logik die mehrere Services kombiniert:
- `recommend` – Library-Analyse + Memories + TMDB Similar → Poster-Card(s)
- `build_watchlist` – Zeitbudget + Genre → kuratierte Liste mit Laufzeiten
- `library_report` – Stats aus allen Services aggregiert → Rich-Card
- `what_to_watch` – Tautulli History + ungesehene Filme + Tageszeit + Stimmung
- `media_quiz` – Fun-Feature mit TMDB-Daten

Diese Tools sind im `executor` komplexer – sie rufen mehrere Services auf und kombinieren die Ergebnisse.

### Batch 5: Cross-Service Intelligence + Automation (12 Tools)

**Cross-Service (7):**
- `cross_actor_search` – TMDB Credits + Radarr matchen
- `cross_duplicate_check` – Radarr vs. Plex Library
- `cross_quality_audit` – Filme mit nur SD/720p finden
- `cross_space_analyzer` – Radarr Root-Folders + größte Dateien
- `cross_watch_unwatched` – Tautulli History vs. Bibliothek
- `cross_subtitle_audit` – Bazarr missing + Bibliothek
- `cross_release_monitor` – TMDB Person-API + User-Memories

**Automation (5):**
- `auto_quality_upgrade` – Batch-Upgrade auf höheres Profil
- `auto_cleanup` – Fehlgeschlagene Downloads aufräumen
- `auto_missing_search` – Radarr/Sonarr MissingSearch Command
- `proactive_notify` – Background-Worker für proaktive Benachrichtigungen
- `scheduled_task` – Reminder-System mit SQLite-Tabelle

Für `proactive_notify` und `scheduled_task` brauchst du:
- Neue SQLite-Tabelle `ai_scheduled_tasks`
- Background-Worker (setInterval im Server-Start, z.B. alle 5 Minuten)
- Socket.io Push für proaktive Messages

### Batch 6: Vision – gemma3:27b (3 Tools)

- `ai.service.ts` erweitern: `chatWithImage(model, messages, imageBase64)` Funktion
- Vision-Modell: `gemma3:27b` (env: OLLAMA_VISION_MODEL)
- Frontend: Bild-Upload im Chat (Drag&Drop oder Button)
- Tools: `vision_identify_media`, `vision_analyze_poster`, `vision_ui_help`

Ollama Vision API:
```typescript
const response = await ollama.chat({
  model: 'gemma3:27b',
  messages: [{
    role: 'user',
    content: 'Was ist das für ein Film?',
    images: [base64ImageData]  // Base64-encoded Bild
  }]
});
```

---

## Kritische Regeln

### TypeScript & Imports
- **KEINE `@/`-Aliases** → immer relative Pfade mit `.js`-Extension
- **KEIN `any`** → `unknown` + Type Guards oder Zod
- **File-Size-Limits:** services max 300 Zeilen, routes max 200 Zeilen → aufteilen!

### Dev-Workflow
```bash
cd /mnt/user/appdata/openclaw/config/workspace/nexarr-v2
npm run typecheck          # MUSS fehlerfrei sein
npm run restart            # Nach Backend-Änderungen
npm run logs               # Server-Log prüfen
git add -A && git commit -m "feat(ai): beschreibung" && git push gitea main && git push github main
```

### Playwright
Nutze Playwright um nach Frontend-Änderungen die UI zu verifizieren:
- Dev-URL: `http://192.168.188.42:5173`
- Chat-Widget testen: Floating Button klicken, Message senden, Card-Rendering prüfen
- Navigation-Tools testen: AI-Navigate Event → prüfe dass richtige View geladen wird

---

## Reihenfolge

1. Lies die 6 Pflicht-Dateien
2. Batch 1 → typecheck → commit
3. Batch 2 → typecheck → commit → Playwright-Test
4. Batch 3 → typecheck → commit
5. Batch 4 → typecheck → commit
6. Batch 5 → typecheck → commit
7. Batch 6 → typecheck → commit → Playwright-Test
8. CONTEXT.md aktualisieren (alle neuen Tools dokumentieren)
9. TOOLS_COMPLETE.md aktualisieren (alle ❌ → ✅ setzen)

Los geht's – starte mit Batch 1!
