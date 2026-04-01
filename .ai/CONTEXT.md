# nexarr v2 – AI Context
> Dieses Dokument wird am Ende jeder Session aktualisiert.
> Zuletzt aktualisiert: 31.03.2026 – Phase 8 abgeschlossen, TypeCheck ✅, Server läuft
> Aktualisiert von: Chat-Claude
> Stand: Phase 7 vollständig abgeschlossen, Phase 8 offen

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
- [x] Phase 2 – Sonarr + Lidarr (SeriesView, SeriesDetailView mit Staffel-Accordion, MusicView, ArtistDetailView)
- [x] Phase 3 – Dashboard + Real-time (Downloads Queue, Socket.io live)
- [x] Phase 4 – Sidebar Download-Badge, CalendarView, SearchView
- [x] Phase 5 – SettingsView, PM2
- [x] Phase 6 – Tautulli, Overseerr, Prowlarr, Radarr/Sonarr Lookup+Add
- [x] Phase 7 – MovieDetailView/SeriesDetailView "Jetzt suchen", TautulliView, OverseerrView

### Aktive Phase
- **Phase 8** – Erweiterungen

### Phase 8 – Status
- [x] 8.1 – Lidarr: "Jetzt suchen" in ArtistDetailView
- [x] 8.2 – Gotify: Service, Routes, gotify.store.ts, ToastContainer.vue, GotifyView.vue, Sidebar-Eintrag + Badge
- [x] 8.3 – Bazarr: Service, Routes, BazarrSubtitle Type, MovieDetailView Untertitel-Tab (vorhanden/fehlend, suchen, löschen)
- [x] 8.4 – TMDB: Service, Routes, TMDBCredits/Video Types, Trailer-Button + Cast-Grid in Movie+SeriesDetailView, tvdbId-Lookup für Sonarr
- [x] 8.5 – Plex: Service, Routes, env.ts (PLEX_URL/TOKEN), „In Plex öffnen"-Button in Movie+SeriesDetailView
- [x] 8.6 – ABS: Service, Routes, ABSLibrary/Item/Progress Types, abs.store.ts, AbsView.vue (Grid, Library-Switcher, Suche, Pagination), Sidebar-Eintrag

### Phase 8 – VOLLSTÄNDIG ABGESCHLOSSEN ✅

### Phase 9 – Integrationen wirklich zum Laufen bringen (eine nach der anderen)

Reihenfolge:
- [x] 9.1 – Gotify: Client-Token korrigiert, Nachrichten werden angezeigt, Toasts funktionieren ✅
- [x] 9.2 – Bazarr: API-Format bestätigt, Service korrekt, eingebettete Subs zeigen path=null (erwartet) ✅
- [x] 9.3 – TMDB: API bestätigt, Cast/Crew werden in MovieDetailView angezeigt ✅
- [x] 9.4 – Plex: API bestätigt (0 aktive Sessions), Deep-Link-Button funktioniert ✅
- [x] 9.5 – ABS: Library-Switcher (Podcasts/Hörbücher), Grid, Cover-Proxy funktioniert. Fehlende Cover = ABS hat keine hinterlegt (korrekt) ✅
- [x] 9.6 – Settings: Gotify, Plex, ABS im Integrations-Grid ergänzt (Backend + Frontend) ✅

### Phase 9 – VOLLSTÄNDIG ABGESCHLOSSEN ✅

### Phase 10 – Polish & Vollständigkeit (Menü von oben nach unten)

Jede Seite wird vollständig polished: alle Daten anzeigen, alles klickbar, gute Empty-States, Loading-States, Fehlerhandling.

- [ ] 10.1 – Dashboard (Widgets, Live-Daten, Plex Sessions, Schnellzugriff)
- [ ] 10.2 – Filme / MoviesView (Filter, Sortierung, Suche, Stats)
- [ ] 10.3 – MovieDetailView (alle Tabs gefüllt, Aktionen, Bazarr)
- [ ] 10.4 – Serien / SeriesView (Filter, Sortierung, Stats)
- [ ] 10.5 – SeriesDetailView (Staffeln, Episoden, Cast, Bazarr)
- [ ] 10.6 – Musik / MusicView + ArtistDetailView
- [ ] 10.7 – Downloads (Queue-Aktionen, Pause/Resume/Delete)
- [ ] 10.8 – Kalender (Klickbar, Detail-Popups)
- [ ] 10.9 – Suche (Prowlarr + Bibliothek verbessern)
- [ ] 10.10 – Statistiken / TautulliView (mehr Charts)
- [ ] 10.11 – Anfragen / OverseerrView (Request-Detail, Status)
- [ ] 10.12 – Audiobookshelf (Detail-Ansicht, Fortschritt)
- [ ] 10.13 – Benachrichtigungen / GotifyView (Prioritäten-Filter)
- [ ] 10.14 – Einstellungen (kompletter Polish)

### Aktive Phase
- **Phase 10.1** – Dashboard

### Vorgehen pro Integration
1. Backend-Route direkt testen (curl gegen API)
2. Response-Format mit tatsächlicher API-Antwort abgleichen
3. Frontend anpassen bis Daten wirklich angezeigt werden
4. Edge Cases (nicht konfiguriert, leer, Fehler) sauber behandeln

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
OVERSEERR_API_KEY=MTc0ODE2ODc4NzAxNDM2NDhkZDMyLTMxNjMtNGZmNC05ZWYwLTY1MTRhNTJjZTdkZQ==

BAZARR_URL=http://192.168.188.69:6767
BAZARR_API_KEY=176a878f96c8b6747a8b9b9d720e5310

GOTIFY_URL=http://192.168.188.69:8070
GOTIFY_TOKEN=At.6VXHHOfJeyvW

TMDB_API_KEY=b28a462ee85f857197dae4a37857e959

ABS_URL=http://192.168.188.69:13378
ABS_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlJZCI6IjNkODQxYWM3LTMwMTQtNDdiOS05OTNmLTQ0N2VjMDlkODFlNSIsIm5hbWUiOiJuZXhhcnItdjIiLCJ0eXBlIjoiYXBpIiwiaWF0IjoxNzc0OTkyNzE4fQ.jd8cjUNVUpfCdU6imQwTn9QUTe1uTqP4YkGPApA6sFk
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
2. `.ai/LESSONS.md` lesen (Fehler-Muster aus vergangenen Sessions)
3. `.ai/CONVENTIONS.md` lesen
4. Bei neuen Integrationen: `.ai/INTEGRATIONS.md` lesen
5. Bei unklaren Patterns: Referenz-Implementierung lesen
   - Backend: `packages/server/src/routes/radarr.routes.ts`
   - Frontend: `packages/client/src/views/MoviesView.vue`

---

## Arbeitsweise (Claude Code)

### Plan-Mode
Bei nicht-trivialen Tasks (3+ Schritte oder Architektur-Entscheidung): erst planen, dann bauen.
Geht etwas schief → sofort stoppen und neu planen, nicht weiter drücken.

### Subagents
Subagents gezielt einsetzen um den Haupt-Kontext sauber zu halten:
- **Exploration/Research:** Subagent liest und analysiert, Hauptagent baut
- **3+ unabhängige Dateien** die gleichzeitig verstanden werden müssen → parallel via Subagent
- **Kein Subagent** für lineare Single-Feature-Tasks (z.B. neue Integration nach bekanntem Muster)
- Faustregel: Subagent für „verstehen", Hauptagent für „bauen"

### Eleganz-Check
Vor nicht-trivialen Änderungen kurz fragen: „Passt das zum bestehenden Pattern?"
Referenz: `radarr.routes.ts` (Backend), `MoviesView.vue` (Frontend).
Keine Über-Engineering bei einfachen, offensichtlichen Fixes.

### Done-Checkliste (vor jedem Commit)
- [ ] `npx tsc --noEmit` – fehlerfrei
- [ ] Smoke-Test im Browser (http://192.168.188.42:3000)
- [ ] `CONTEXT.md` aktualisiert (Stand, Phase, offene TODOs)
- [ ] `LESSONS.md` ergänzt falls eine Korrektur nötig war
- [ ] Commit gepusht (gitea + github)
