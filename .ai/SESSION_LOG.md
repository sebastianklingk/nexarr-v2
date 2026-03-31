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
