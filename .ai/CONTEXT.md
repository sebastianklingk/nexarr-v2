# nexarr v2 – AI Context
> Dieses Dokument wird am Ende jeder Session aktualisiert.
> Zuletzt aktualisiert: 03.04.2026 – AUTH_DISABLED + Image-URL-Optimierung (w342/w500/w1280)
> Aktualisiert von: Chat-Claude
> Stand: Phase 10 ✅ KOMPLETT · Phase 11 Schritt 5 ✅ + Auth-Bypass + Poster-Performance

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
# Startet: packages/server (tsx, KEIN watch) + packages/client (vite HMR)
# predev killt automatisch Port 3000 falls belegt
```

**Server neu starten (nach Backend-Änderungen):**
```bash
npm run restart
# Oder: Ctrl+C, dann npm run dev
```

**Logs:** `/tmp/nexarr-v2.log`
**DB:** `./data/nexarr.db` (SQLite, node:sqlite)
**Config:** `.env` (Zod-validiert beim Start)
**Auth:** `AUTH_DISABLED=true` in .env → kein Login nötig (Dev-Modus)

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
- [x] Phase 8 – Gotify, Bazarr, TMDB, Plex, ABS, Lidarr-Suche
- [x] Phase 9 – Alle Integrationen live getestet und funktionierend
- [x] Phase 10 – Polish & Vollständigkeit (komplett)

### Aktive Phase
- **Phase 11** – v1-Parität + Neue Features

---

## Kritische .env Keys

```bash
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
# Transmission (optional – zweiter Downloader)
# TRANSMISSION_URL=http://192.168.188.69:9091
# TRANSMISSION_USER=admin
# TRANSMISSION_PASS=password
TAUTULLI_URL=http://192.168.188.69:8281
TAUTULLI_API_KEY=b_AHt38E2A5Yg8TCNLmSdbXKohYpMqF9
OVERSEERR_URL=http://192.168.188.56:5055
OVERSEERR_API_KEY=MTc0ODE2ODc4NzAxNDM2NDhkZDMyLTMxNjMtNGZmNC05ZWYwLTY1MTRhNTJjZTdkZQ==
BAZARR_URL=http://192.168.188.69:6767
BAZARR_API_KEY=176a878f96c8b6747a8b9b9d720e5310
GOTIFY_URL=http://192.168.188.69:8070
GOTIFY_TOKEN=At.6VXHHOfJeyvW
TMDB_API_KEY=b28a462ee85f857197dae4a37857e959
PLEX_URL=http://192.168.188.57:32400
PLEX_TOKEN=K7hQdgmb3oyN1sunUPAK
ABS_URL=http://192.168.188.69:13378
ABS_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlJZCI6IjNkODQxYWM3LTMwMTQtNDdiOS05OTNmLTQ0N2VjMDlkODFlNSIsIm5hbWUiOiJuZXhhcnItdjIiLCJ0eXBlIjoiYXBpIiwiaWF0IjoxNzc0OTkyNzE4fQ.jd8cjUNVUpfCdU6imQwTn9QUTe1uTqP4YkGPApA6sFk
```

---

## Design System (IMMER einhalten)

### App-Farben (Stand 01.04.2026)
```
Radarr:       #ffc230    Sonarr:       #2193b5    Lidarr:       #00a65b
Prowlarr:     #e66000    SABnzbd:      #ffca28    Tautulli:     #e5a00d
Overseerr:    #4942c0    Bazarr:       #9c36b5    Gotify:       #90caf9
Plex:         #E5A00D    TMDB:         #19a98d    ABS:          #c19243
Transmission: #c10303    nexarr:       #9b0045
```

Alle Farben zentral in `packages/client/src/assets/styles/main.css` als CSS-Variablen.
Zusätzlich als RGB-Tripel verfügbar: `--radarr-rgb`, `--sonarr-rgb` etc. für `rgba(var(--radarr-rgb), 0.12)`.

### Text-Hierarchie (WCAG AA)
```
--text-primary:   #ffffff
--text-secondary: #cccccc
--text-tertiary:  #999999
--text-muted:     #666666
```

### Kritische Design-Regel
App-Farben NIEMALS als Fließtext-Farbe. Nur als: Border-Akzente, Badge-Hintergründe, Icon-Farben, Hover-States.

---

## Architektur-Überblick

```
packages/
├── shared/     → Types (integrations.ts, socket.ts, etc.)
├── server/     → Express Backend
│   └── src/
│       ├── config/env.ts
│       ├── cache/cache.ts       → C.fetch(), C.invalidate(), C.invalidatePattern()
│       ├── routes/*.routes.ts
│       └── services/*.service.ts
└── client/     → Vue 3 Frontend
    └── src/
        ├── components/ui/       → PosterCard, InteractiveSearchModal, ConfirmDialog
        ├── stores/*.store.ts
        └── views/*View.vue
```

---

## Multi-Downloader Architektur (Phase 11 Schritt 5)

### NormalizedSlot Pattern
```typescript
// Alle Downloader → NormalizedSlot → DownloadsView
// Matching: slot.nativeId === arrItem.downloadId (gilt für SABnzbd UND Transmission)

interface NormalizedSlot {
  id: string           // "${downloaderType}:${nativeId}" – eindeutig
  nativeId: string     // SABnzbd: nzo_id, Transmission: hashString
  downloader: 'sabnzbd' | 'transmission' | 'qbittorrent' | 'nzbget'
  // ... status, progress, etc.
  canPause: boolean
  canMoveToTop: boolean    // false bei Transmission
  canSetPriority: boolean  // false bei Transmission
}
```

### Neuen Downloader hinzufügen (Checklist)
1. `DownloaderType` in socket.ts erweitern
2. `${name}.service.ts` anlegen – `getNormalizedSlots()` + Actions
3. `${name}.routes.ts` anlegen + in app.ts registrieren
4. env.ts um URL/Keys erweitern
5. queue.service.ts: Promise + normalization + summary
6. DownloadsView: `dlColor()` + `dlLabel()` Einträge ergänzen

---

## Test-IDs

```
Radarr Film:   id=1604 (The Rip), id=770 (28 Weeks Later)
Sonarr Serie:  id=1 (3 Body Problem), id=2596 (The 100)
Lidarr Artist: id=1 (3 Doors Down)
```

---

## Gitea & GitHub

```
Gitea: http://192.168.188.42:3002/sebastian/nexarr-v2
GitHub: sebastianklingk/nexarr-v2
```

```bash
git add -A && git commit -m "type(scope): beschreibung"
git push gitea main && git push github main
```

---

## Phase 11 – Stand (aktiv)

> Vollständige Roadmap: `.ai/ROADMAP_PHASE11.md`

### Schritt 1: Backend-Batch ✅
TMDB: trending/discover/details/similar; Radarr/Sonarr/Lidarr: qualityprofiles/health/indexertest/missing/history; Prowlarr: stats/history/rss/indexer(s)

### Schritt 2: DiscoverView ✅
`packages/client/src/views/DiscoverView.vue` – Hero, Trending-Grid, Genre-Pillen, Detail-Modal, Add-Config, Library-Check, Ähnliche-Inhalte. Route `/discover` + Sidebar Kompass-Icon.

### Schritt 3: IndexerView ✅
`packages/client/src/views/IndexerView.vue` – Stats-Row, Health-Widget, Prowlarr Release-Suche + Filter/Sort, Indexer-Grid, History-Tab, RSS-Tab. Route `/indexer`.

### Schritt 4: CalendarView ✅
- **3 Ansichten:** Woche (7-Spalten-Grid, minmax(0,1fr)) | Monat | Liste
- **Optionen-Drawer:** Side-Panel von rechts, Toggle-Switches für alle Optionen
- **Daten:** Self-contained aus API-Response (kein Store-Lookup – Sonarr timeout war 10s, jetzt 30s)
- **Tooltips:** 4 Varianten: Film (PosterCard-Klon mit Poster+Tech-Badges), Episode (Poster+epFile-Daten: Qualität/Größe/Sprachen/Badges), Serien-Bundle, Standard
- **Option B:** Grüner rechter Rand (2px) bei hasFile=true auf Karten
- **Bugfixes:** fmtDate() lokal statt toISOString() UTC; loadEnd +1 Tag (exklusiv); minmax(0,1fr) für gleiche Grid-Spalten
- **Sonarr Calendar-Params:** `includeSeries:true, includeEpisodeFile:true`

### Schritt 5: DownloadsView ✅
- **Multi-Downloader Architektur:** `NormalizedSlot` Interface abstrahiert SABnzbd + Transmission + zukünftige Downloader
- **Neue Shared Types:** `DownloaderType`, `NormalizedSlot`, `DownloaderSummary` in socket.ts; `QueueState.slots[]` + `QueueState.downloaders[]`
- **Transmission Service:** `transmission.service.ts` – RPC-Client mit CSRF-Token-Handling (409-Retry), per-Torrent + global Actions
- **Transmission Routes:** `transmission.routes.ts` – pause/resume global + per-torrent, delete mit deleteFiles-Option
- **Queue Service:** Aggregiert SABnzbd + Transmission zu `NormalizedSlot[]`; `sabnzbd` Feld bleibt für Backward-Compat
- **Env:** `TRANSMISSION_URL`, `TRANSMISSION_USER`, `TRANSMISSION_PASS` (optional – Downloader nur wenn konfiguriert)
- **Downloader-Badge:** `[SAB]` gelb, `[TR]` rot auf jeder Card; optisch sofort unterscheidbar
- **Batch-Selektion:** Checkbox links (erscheint bei Hover; immer sichtbar wenn Selektion aktiv), Slide-up Toolbar (Pausieren | Fortsetzen | Löschen | Aufheben)
- **Shift-Range-Select:** Shift+Klick selektiert alle Items zwischen letztem Klick und aktuellem; Anker-Index wird nur beim normalen Klick gesetzt, nicht beim Shift-Klick
- **Actions dispatch:** anhand `slot.downloader` → richtiger Endpoint
- **Capabilities:** `canPause/canMoveToTop/canSetPriority` pro Slot – Buttons nur wenn supported
- **Torrent-Badges:** Seeds/Peers, Upload-Ratio (Transmission-spezifisch)
- **Stats-Bar:** Pro Downloader eine Card (dynamisch, keine Hardcoded-SABnzbd-Annahme mehr)
- **Header-Controls:** Pro Downloader ein Pause/Resume-Button mit farbigem Downloader-Badge

### Zwischen-Schritt: Auth-Bypass + Image-Performance ✅
- **AUTH_DISABLED:** `.env` Variable `AUTH_DISABLED=true` – Middleware setzt Fake-Admin-Session, `/api/auth/me` gibt immer Admin zurück, kein Login-Screen
- **Session-Problem gelöst:** MemoryStore verliert Sessions bei Server-Restart (tsx watch) – AUTH_DISABLED macht das irrelevant für Dev
- **Image-URL-Optimierung:** Zentrale Utility `packages/client/src/utils/images.ts` mit `posterUrl()`, `fanartUrl()`, `tmdbImageUrl()`
  - TMDB-URLs werden automatisch von `/original/` auf passende Größe umgeschrieben
  - Grid-Poster: `w342` (~30KB statt ~500KB = 94% kleiner)
  - Detail-Poster: `w500` (~60KB statt ~500KB)
  - Fanart/Backdrop: `w1280` (~150KB statt ~1MB)
  - Angewendet auf: MoviesView, SeriesView, MusicView, MovieDetailView, SeriesDetailView, ArtistDetailView, SearchView, CalendarView

---

## Was Claude Code IMMER als erstes tun soll

1. `.ai/CONTEXT.md` lesen
2. `.ai/LESSONS.md` lesen
3. `.ai/CONVENTIONS.md` lesen
4. Bei neuen Integrationen: `.ai/INTEGRATIONS.md` lesen
