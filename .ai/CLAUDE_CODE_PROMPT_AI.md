# nexarr AI – Claude Code Implementierungs-Prompt

> Kopiere diesen gesamten Text als ersten Prompt in einen neuen Claude Code Chat.
> Erstellt: 04.04.2026

---

## Projekt: nexarr v2 – KI-Integration (Phase AI)

Du implementierst die KI-Features für nexarr v2, ein self-hosted Media-Dashboard.
Das Projekt ist ein aktives, funktionierendes Monorepo mit ~11 fertigen Phasen.
Du baust jetzt die KI-Schicht darauf auf.

---

## Projektpfad & Stack

```
Pfad:    /mnt/user/appdata/openclaw/config/workspace/nexarr-v2/
Stack:   Node 20/22 + TypeScript 5 + Express 5 + Vue 3 + Vite + Pinia + Socket.io + SQLite (node:sqlite)
Struktur: npm workspaces Monorepo → packages/server, packages/client, packages/shared
Dev-URL: http://192.168.188.42:3000 (Express) / http://192.168.188.42:5173 (Vite)
Auth:    AUTH_DISABLED=true (Dev-Modus, kein Login nötig)
DB:      ./data/nexarr.db (SQLite, node:sqlite mit --experimental-sqlite)
```

---

## Pflichtlektüre – Diese Dateien ZUERST lesen

Lies zu Beginn JEDER Session diese Dateien vollständig:

1. **`.ai/CONTEXT.md`** → Aktueller Projekt-Stand, alle fertigen Phasen, Design-System, Architektur
2. **`.ai/LESSONS.md`** → Bekannte Bugs und Regeln (TypeScript-Aliases, Import-Pfade, etc.)
3. **`.ai/CONVENTIONS.md`** → Code-Standards, Commit-Workflow, wer macht was, File-Size-Limits
4. **`.ai/INTEGRATIONS.md`** → API-Patterns für alle Services (Radarr, Sonarr, etc.)
5. **`.ai/ROADMAP_AI.md`** → **DER Plan für die KI-Implementierung** – Architektur, Modelle, Memory, Tools, Frontend, Messenger

---

## Hardware & Ollama

- **Server:** ODIN (192.168.188.42) – Unraid
- **GPU für AI:** NVIDIA RTX 6000 Ada Generation – **48 GB VRAM**
- **Ollama:** Docker-Container auf ODIN, REST API auf `http://192.168.188.42:11434`
- **Modelle:**
  - Chat + Tool Calling: `qwen3:30b` (~20 GB VRAM, ~45 t/s)
  - Embeddings: `nomic-embed-text` (768-dim, ~275 MB)
  - Vision: `gemma3:27b` (~18 GB, on-demand)
- **Multi-Model:** Alle drei passen gleichzeitig in 48 GB VRAM
- **Kontext:** 64K Token (`num_ctx: 65536`)

---

## Was du bauen sollst

Die KI-Implementierung folgt der Roadmap in `.ai/ROADMAP_AI.md`.
Arbeite die Phasen **der Reihe nach** ab:

### Phase AI-1: Fundament (Backend + Ollama-Anbindung)
- `.env` + `env.ts` um Ollama-Keys erweitern (OLLAMA_URL, OLLAMA_CHAT_MODEL, etc.)
- `packages/server/src/ai/` Verzeichnisstruktur anlegen
- `ai.service.ts` – Ollama-Client (HTTP-basiert, kein npm-Package nötig – einfach axios)
- `ai.routes.ts` – POST /api/ai/chat, GET /api/ai/models, GET /api/ai/status
- SQLite-Tabellen für ai_conversations, ai_memories, ai_knowledge anlegen
- System-Prompt mit nexarr-Persönlichkeit
- Einfacher Chat (ohne Tools) als Proof of Concept
- Socket.io Event `ai:message` → Streaming-Antwort `ai:token`

### Phase AI-2: Tool-System
- Tool-Registry (JSON-Schema Definitionen für alle nexarr-Funktionen)
- Tool-Executor (Dispatcher an bestehende Services)
- Agentic Loop (Multi-Step Tool Calling mit max 5 Iterationen)
- Sicherheits-Layer für destruktive Aktionen

### Phase AI-3: Memory-System
- Embedding-Generierung via Ollama /api/embed
- Cosine-Similarity in Node.js (Float32Array)
- Conversation-Zusammenfassung + Rolling Summary
- Memory-Extraktion (Fakten aus Gesprächen)
- Context Assembly (Memories in System-Prompt)

### Phase AI-4: RAG & Knowledge Base
- Chunking + Embedding Pipeline
- Bibliotheks-Analyse (Genre-Profil)
- Semantische Suche

### Phase AI-5: Frontend – Chat Widget
- AiChatWidget.vue (Floating Button + Panel)
- AiChatPanel.vue mit Streaming
- ai.store.ts (Pinia)
- Quick Actions pro View

### Phase AI-6+: Polish, Vision, Messenger (später)

---

## Kritische Regeln (aus LESSONS.md + CONVENTIONS.md)

### TypeScript & Imports
- **KEINE `@/`-Aliases** → immer relative Pfade mit `.js`-Extension: `from '../utils/foo.js'`
- **KEIN `any`** → immer `unknown` + Type Guards oder Zod
- **Explizite Return Types** bei allen Service-Funktionen
- **Type-only Imports:** `import type { X } from '...'`

### Vue Components
- **NUR Composition API** mit `<script setup lang="ts">`
- **NUR EIN Root-Element** pro View (kein Fragment)
- **Scoped Styles** immer
- **Kein `document.getElementById`** → template refs

### Backend
- **Routes:** nur HTTP-Handling, keine Business Logic
- **Services:** Business Logic + Cache via `C.fetch()`
- **Fehler:** immer `next(err)`, nie `res.status(500)` direkt
- **Cache:** alle externen API-Calls via `C.fetch()` mit passendem TTL

### Dev-Workflow
```bash
# Immer mit vollem Pfad arbeiten
cd /mnt/user/appdata/openclaw/config/workspace/nexarr-v2

# TypeScript Check (MUSS fehlerfrei sein vor Commit)
npm run typecheck

# Server neustarten nach Backend-Änderungen
npm run restart

# Logs prüfen
npm run logs          # Server
npm run logs:client   # Vite

# Status
npm run status

# Commit
git add -A && git commit -m "feat(ai): beschreibung" && git push gitea main && git push github main
```

### node:sqlite (NICHT better-sqlite3)
```typescript
// nexarr nutzt Node 22 built-in SQLite
// Braucht NODE_OPTIONS='--experimental-sqlite' (bereits in dev/start Scripts)
import { DatabaseSync } from 'node:sqlite';
```

---

## Playwright-Nutzung

Du hast Playwright zur Verfügung für Browser-Tests. Nutze es um:
- Nach Frontend-Änderungen die UI zu verifizieren (Screenshots)
- API-Endpoints zu testen
- Den Chat-Widget im Browser zu testen

**Wichtig:**
- Dev-URL: `http://192.168.188.42:3000` (Express mit Vite-Proxy) oder `http://192.168.188.42:5173` (Vite direkt)
- Auth ist deaktiviert (AUTH_DISABLED=true), kein Login nötig
- Für Screenshots: `page.screenshot()` – verifiziere dass die UI korrekt rendert

---

## Bestehende Services (die AI als Tools nutzen wird)

Die bestehenden Services in `packages/server/src/services/` sind:
- `radarr.service.ts` – Filme (getMovies, getMovie, addMovie, searchMovie, etc.)
- `sonarr.service.ts` – Serien (getSeries, getSerie, addSeries, searchSeries, etc.)
- `lidarr.service.ts` – Musik (getArtists, getArtist, addArtist, etc.)
- `prowlarr.service.ts` – Indexer-Suche (search, grab, getStats, etc.)
- `sabnzbd.service.ts` – Downloads (getQueue, pause, resume, etc.)
- `transmission.service.ts` – Torrent-Downloads
- `tautulli.service.ts` – Streams/Aktivität (getActivity, getHistory, etc.)
- `overseerr.service.ts` – Anfragen (getRequests, approve, decline, etc.)
- `tmdb.service.ts` – TMDB API (trending, discover, details, similar)
- `queue.service.ts` – Aggregierte Download-Queue (SABnzbd + Transmission)
- `gotify.service.ts` – Push-Benachrichtigungen

Alle Services exportieren named functions. Der AI Tool-Executor wird diese direkt aufrufen.

---

## Gitea & GitHub

```
Gitea: http://192.168.188.42:3002/sebastian/nexarr-v2
GitHub: github.com/sebastianklingk/nexarr-v2
```

---

## Los geht's

Lies jetzt die 5 Pflicht-Dateien (CONTEXT.md, LESSONS.md, CONVENTIONS.md, INTEGRATIONS.md, ROADMAP_AI.md) und starte dann mit **Phase AI-1**. Arbeite Schritt für Schritt, teste nach jedem Schritt, und aktualisiere CONTEXT.md wenn eine Phase abgeschlossen ist.
