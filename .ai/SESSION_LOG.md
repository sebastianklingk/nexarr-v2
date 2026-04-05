# nexarr v2 – Session Log
> Wird am Ende jeder Session von Chat-Claude aktualisiert.
> Neueste Session zuerst.

---

## Session Template (kopieren für jede neue Session)

```
## Session YYYY-MM-DD
**Gestartet:** HH:MM
**Aktive Phase:** Phase X – Name
**Commits:** [hash1], [hash2]

### Erledigt
- [x] ...

### Offen für nächste Session
- [ ] ...

### Entscheidungen getroffen
- ...

### Probleme / Learnings
- ...
```

---

## Session 2026-04-04 – KI-Integration (Phase AI-1 bis AI-5)
**Aktive Phase:** Phase AI – KI-Integration
**Commits:** –

### Erledigt
- [x] **Phase AI-1 – Fundament:** ai.service.ts (Ollama HTTP Client, Streaming, /no_think), personality.ts (System-Prompt Builder), conversations.ts (SQLite CRUD), stream.ts (Socket.io Streaming + Tool-Loop), ai.routes.ts (REST Endpoints), 003_ai.sql (3 DB-Tabellen: ai_conversations, ai_memories, ai_knowledge)
- [x] **Phase AI-2 – Tool-System:** tools.ts (21 Tools in 10 Kategorien), executor.ts (Tool-Dispatcher), agent.ts (Agentic Loop, max 5 Iterationen)
- [x] **Phase AI-3 – Memory:** vectors.ts (Embedding + Cosine Similarity + semantische Suche), memory.ts (LLM-basierte Fakten-Extraktion, ADD/UPDATE/NOOP), summary.ts (Rolling Summary alle 10 Messages)
- [x] **Phase AI-4 – RAG & Knowledge Base:** chunking.ts (Text/Markdown Chunking mit Overlap), knowledge.ts (Ingestion Pipeline + semantische Suche), knowledge-seed.ts (3 statische Wissens-Dokumente), library-analysis.ts (Bibliotheks-Statistiken + LLM-Geschmacksprofil), RAG-Kontext in personality.ts, 4 neue API-Endpunkte, seedKnowledge() beim Serverstart
- [x] **Phase AI-5 – Frontend Chat Widget:** ai.store.ts (Pinia Store mit Socket.io Streaming), AiChatPanel.vue (Chat-UI mit Bubbles, Streaming, Quick Actions, Tool-Call Badges), AiChatWidget.vue (Floating Button + Panel), AiToolCallPayload in shared socket types, Tool-Call Events in stream.ts, env.d.ts für Vue SFC Types

### Offen für nächste Session
- [ ] Phase AI-6+ – Polish, Vision (gemma3:27b), Messenger-Gateway
- [ ] Playwright-Tests für Chat-Widget im Browser
- [ ] Library-Analyse als Scheduled Job (täglich)

### Entscheidungen getroffen
- qwen3:30b mit `/no_think` Prefix statt deepseek-r1 (besseres Tool Calling, schneller)
- Vektor-Suche In-Memory in Node.js statt externe Vektor-DB (SQLite BLOB + Cosine Similarity)
- nomic-embed-text (768-dim) für Embeddings
- Socket.io Streaming für Token-by-Token Antworten (nicht HTTP Streaming)
- Tool-Loop non-streaming (braucht vollständige Response für tool_calls Erkennung), finale Antwort streaming
- node:sqlite (Node 22 built-in) statt better-sqlite3

### Probleme / Learnings
- qwen3:30b Hybrid-Thinking erzeugt `<think>` Tags → `/no_think` Prefix + stripThinkingTags() Fallback
- SonarrSeries hat kein `seasonCount` direkt → aus `seasons[]` Array aggregieren
- nomic-embed-text muss manuell gepullt werden (`ollama pull nomic-embed-text`)
- Client-Typecheck braucht env.d.ts mit Vue SFC Modul-Deklaration
- `npx tsc` muss aus dem Projektverzeichnis laufen (sonst falsches tsc-Paket)

---

## Session 2026-03-30 – Kickoff
**Aktive Phase:** Planung / v2 Vorbereitung
**Commits:** –

### Erledigt
- [x] V2_PLAN.md erstellt (Tech Stack, Projektstruktur, Datenbankschema, Auth-Konzept, Socket.io Events, Cache Backbone v2, Dockerfile, CI/CD, Migrations-Strategie, Phasen-Plan)
- [x] UI & Design System Kapitel erstellt (Color System, Navigation, Grid-Ansichten, Detail-Seiten, Animationen, Component Library)
- [x] AI-Collaboration-System konzipiert und dokumentiert
- [x] `.ai/` Workspace angelegt:
  - CONTEXT.md – immer aktueller Projekt-State
  - CONVENTIONS.md – Coding-Regeln und Patterns
  - INTEGRATIONS.md – Vollständige API-Referenz aller Integrationen
  - SESSION_LOG.md – dieses Dokument
  - prompts/ – Claude-Code-Prompt-Templates

### Offen für nächste Session (Phase 0 – Fundament)
- [ ] Monorepo-Struktur anlegen (`npm init`, workspaces konfigurieren)
- [ ] `packages/shared` – Base Types, Zod Schemas, Socket.io Event Types
- [ ] `packages/server` – Express App, Zod Env Validation, SQLite Setup, Auth (Passport.js + bcrypt), Socket.io
- [ ] `packages/server` – Cache Backbone v2 (portiert aus v1 cache.js, TypeScript)
- [ ] `packages/client` – Vite + Vue 3 + Vue Router + Pinia Skeleton
- [ ] Login View (Vue)
- [ ] App Shell: Sidebar + kollabierbar + Bottom-Nav Mobile (Vue)
- [ ] Dockerfile Multi-Stage + docker-compose.yml + docker-compose.dev.yml
- [ ] GitHub Actions: Build + Push zu ghcr.io
- [ ] `.gitignore` (ROADMAP.md, V2_PLAN.md, .ai/ aus GitHub ausschließen)
- [ ] `.env.example` mit allen Keys dokumentiert

### Entscheidungen getroffen
- Stack: Node 20 + TypeScript 5 + Express 5 + Vue 3 + Vite + Pinia + Socket.io + SQLite
- Frontend: Vue 3 (Composition API, SFC) – keine anderen Frameworks
- Datenbank: .env für Config + SQLite (better-sqlite3) für dynamische Daten
- Auth: Passport.js + bcrypt, single-user jetzt, multi-user-ready via users-Tabelle
- Real-time: Socket.io 4 (statt SSE wie in v1)
- Monorepo: npm workspaces (packages/server, packages/client, packages/shared)
- Design: Cinema-Grade + App-like, kontextsensitive Navigation (Sidebar Desktop / Bottom-Bar Mobile)
- Grid: 3 Ansichten (Poster / Fokus / Liste), User-Präferenz in SQLite gespeichert
- App-Farben: NIEMALS als Textfarbe, nur als Akzente (Borders, Badges, Icons)
- Kein Light Mode, kein CSS Framework, kein GraphQL, kein Masonry-Grid

### Probleme / Learnings
- Keine (erste Session war reine Planung)
