# nexarr v2 – AI Context
> Dieses Dokument wird am Ende jeder Session aktualisiert.
> Zuletzt aktualisiert: 31.03.2026
> Aktualisiert von: Chat-Claude

---

## Projekt-Übersicht

nexarr ist ein self-hosted Media-Management-Dashboard das Radarr, Sonarr, Lidarr,
Prowlarr, SABnzbd, Tautulli, Overseerr, Bazarr, Gotify, Plex, TMDB und Audiobookshelf
in einer einheitlichen Dark-UI vereint.

**Stack:** Node 20 + TypeScript 5 + Express 5 + Vue 3 + Vite + Pinia + Socket.io + SQLite
**Architektur:** Monorepo (npm workspaces) mit packages/server, packages/client, packages/shared

---

## Server & Pfade

| | Dev (Odin) | Prod (Thor) |
|---|---|---|
| Host | 192.168.188.42 | 192.168.188.69 |
| Port | 3000 | 3001 |
| URL | http://192.168.188.42:3000 | http://192.168.188.69:3001 |
| MCP-Pfad | \\ODIN\appdata\openclaw\config\workspace\nexarr-v2\ | Docker via Portainer |

**Server starten (Dev):**
```bash
npm run dev
# Startet: packages/server (tsx watch, Port 3000) + packages/client (vite, Port 5173)
```

**Server starten (manuell):**
```bash
pkill -f "tsx" 2>/dev/null
cd /mnt/user/appdata/openclaw/config/workspace/nexarr-v2
npm run dev > /tmp/nexarr-v2.log 2>&1 &
sleep 3 && echo "OK"
```

**Logs:** `/tmp/nexarr-v2.log`
**DB:** `./data/nexarr.db` (SQLite, better-sqlite3)
**Config:** `.env` (Zod-validiert beim Start)

---

## Aktueller Implementierungs-Stand

### Abgeschlossene Phasen
- [x] Phase 0 – Fundament (Monorepo, Auth, Socket.io, Docker, Cache, Vue Shell, Login)
- [x] Phase 1 – Radarr / Movies (MoviesView, MovieDetailView, PosterCard, movies.store)

### Aktive Phase
- **Phase 3** – Dashboard + Real-time (Downloads Queue, Socket.io live)

### Abgeschlossene Phasen
- [x] Phase 0 – Fundament
- [x] Phase 1 – Radarr / Movies
- [x] Phase 2 – Sonarr + Lidarr (SeriesView, SeriesDetailView mit Staffel-Accordion, MusicView, ArtistDetailView)

### Offene TODOs (Phase 3)
- [x] DownloadsView.vue – SABnzbd Queue + Radarr/Sonarr/Lidarr Queue
- [x] queue.store.ts (Pinia, befüllt via Socket.io)
- [x] Socket.io Queue-Push vom Server (Polling alle 3s, lazy start/stop)
- [x] DashboardView.vue – Stats-Widgets (Counts, aktive Downloads)

### Nächste Schritte (Phase 4 Vorbereitung)
- [ ] TypeCheck + Server-Start verifizieren (Claude Code)
- [ ] CalendarView.vue – Sonarr/Lidarr/Radarr Kalender
- [ ] SearchView.vue – Prowlarr-Suche
- [ ] Sidebar Download-Badge (live count aus queue.store)

---

## Kritische .env Keys

```bash
# Server
PORT=3000
NODE_ENV=development
SESSION_SECRET=                    # min. 32 Zeichen, auto-generiert beim ersten Start
DB_PATH=./data/nexarr.db

# Integrationen (alle optional)
RADARR_URL=http://192.168.188.69:7878
RADARR_API_KEY=1741bcd195184876b93adf9f75856917

SONARR_URL=http://192.168.188.69:8989
SONARR_API_KEY=d84ec10588924539ae79c3d7bf61797e

LIDARR_URL=http://192.168.188.69:8686
LIDARR_API_KEY=4c715257904f4da9b640f48ff1183f4c

PROWLARR_URL=http://192.168.188.69:9696
PROWLARR_API_KEY=a0568c70a5a9451183f2323f55eb2b2b

SABNZBD_URL=http://192.168.188.69:8080
SABNZBD_API_KEY=ec9c8df3cd734f6393c0db6e60c05693

TAUTULLI_URL=http://192.168.188.69:8281
TAUTULLI_API_KEY=b_AHt38E2A5Yg8TCNLmSdbXKohYpMqF9

OLLAMA_URL=http://192.168.188.42:11434
OLLAMA_MODEL=qwen3:32b

OVERSEERR_URL=http://192.168.188.69:5055
OVERSEERR_API_KEY=

BAZARR_URL=http://192.168.188.69:6767
BAZARR_API_KEY=

GOTIFY_URL=
GOTIFY_TOKEN=

TMDB_API_KEY=
ABS_URL=
ABS_TOKEN=
```

---

## Design System (IMMER einhalten)

### App-Farben
```
Radarr:      #F4A54A    Sonarr:      #35C5F4    Lidarr:      #22C65B
Prowlarr:    #FF7F50    SABnzbd:     #F5C518    Tautulli:    #E5C06D
Overseerr:   #7C4DFF    Bazarr:      #A78BFA    Gotify:      #0060A8
Plex:        #E5A00D    TMDB:        #01B4E4    ABS:         #F0A500
nexarr:      #9b0045
```

### Text-Hierarchie (WCAG AA)
```
--text-primary:   #ffffff   (21:1)   Titles, Hero Content
--text-secondary: #cccccc   (11.6:1) Card Titles, Labels
--text-tertiary:  #999999   (5.9:1)  Metadata, Descriptions
--text-muted:     #666666   (3.6:1)  Hints (nie für informative Inhalte)
```

### Kritische Design-Regel
App-Farben NIEMALS als Fließtext-Farbe verwenden. Nur als:
- Border-Akzente (`border-left: 3px solid var(--radarr)`)
- Badge-Hintergründe mit ausreichend Kontrast
- Icon-Farben
- Hover-States auf Buttons/Cards

---

## Architektur-Überblick

```
packages/
├── shared/     → Types die Server + Client teilen (Interfaces, Zod-Schemas)
├── server/     → Express Backend
│   └── src/
│       ├── config/env.ts        → Zod .env Validation
│       ├── db/index.ts          → SQLite + Migrations
│       ├── cache/cache.ts       → Cache Backbone v2
│       ├── socket/index.ts      → Socket.io Setup
│       ├── middleware/auth.ts   → requireAuth, requireRole
│       ├── routes/*.routes.ts   → HTTP Handler (nur req/res)
│       └── services/*.service.ts → Business Logic + API Calls
└── client/     → Vue 3 Frontend
    └── src/
        ├── router/index.ts      → Vue Router (alle Routen)
        ├── stores/*.store.ts    → Pinia Stores
        ├── composables/use*.ts  → Shared Logic
        ├── components/          → Wiederverwendbare Vue Components
        └── views/*View.vue      → Page-Level Components
```

---

## Test-IDs (für Debugging)

```
Radarr Film:   id=1604 (The Rip), id=770 (28 Weeks Later)
Sonarr Serie:  id=14 (Dark Matter 2024), id=2596 (The 100)
Lidarr Artist: id=1 (3 Doors Down)
```

---

## Gitea & GitHub

```
Gitea (primär): http://192.168.188.42:3002/sebastian/nexarr-v2
GitHub (CI/CD): sebastianklingk/nexarr-v2
Docker Image:   ghcr.io/sebastianklingk/nexarr:v2-latest
```

**Git-Workflow:**
```bash
# Commit (Claude Code führt aus)
git add -A && git commit -m "type(scope): beschreibung"

# Push zu beiden Remotes
git push gitea main
git push github main    ← triggert GitHub Actions → Docker Build
```

**Commit-Format:** `type(scope): beschreibung`
```
feat(radarr): add movie detail endpoint
fix(cache): handle stale data on startup
refactor(ui): extract PosterCard component
docs(ai): update session log
```

---

## Was Claude Code IMMER als erstes tun soll

1. `.ai/CONTEXT.md` lesen (dieser Abschnitt)
2. `.ai/CONVENTIONS.md` lesen
3. Bei neuen Integrationen: `.ai/INTEGRATIONS.md` lesen
4. Bei unklaren Patterns: Referenz-Implementierung lesen
   - Backend: `packages/server/src/routes/radarr.routes.ts`
   - Frontend: `packages/client/src/views/MoviesView.vue`
5. Am Ende: `npx tsc --noEmit` – muss fehlerfrei sein vor dem Commit
