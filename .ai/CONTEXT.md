# nexarr v2 – AI Context
> Dieses Dokument wird am Ende jeder Session aktualisiert.
> Zuletzt aktualisiert: 01.04.2026 – Phase 10 vollständig abgeschlossen; Phase 11 geplant
> Aktualisiert von: Chat-Claude
> Stand: Phase 10 ✅ KOMPLETT · Phase 11 als nächstes (IndexerView, DiscoverView, Kalender-Woche, Downloads-Ausbau)

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
- [x] Phase 8 – Gotify, Bazarr, TMDB, Plex, ABS, Lidarr-Suche
- [x] Phase 9 – Alle Integrationen live getestet und funktionierend

### Aktive Phase
- **Phase 10** – Polish & Vollständigkeit

---

## Phase 10 – Vollständiger Implementierungsplan

### Grundsatz: Alles was nexarr-v1 kann, soll v2 besser können.
Jede Seite: maximale Infos aus allen APIs, alle Actions, saubere Empty/Loading/Error-States.

---

### 10.A – Backend-Erweiterungen (MUSS vor 10.3/10.5/10.6 erledigt werden)

#### 10.A1 – Radarr Backend erweitern
**Datei:** `packages/server/src/services/radarr.service.ts` + `routes/radarr.routes.ts`

- [x] `PUT /api/radarr/movies/:id` – Film-Objekt vollständig updaten (monitored-Toggle, etc.)
- [x] `DELETE /api/radarr/movies/:id` – Film aus Radarr entfernen (deleteFiles=true/false)
- [x] `POST /api/radarr/command` – Generischer Command-Endpoint (MoviesSearch, RescanMovie)
- [x] `GET /api/radarr/release?movieId=:id` – Releases für Interactive Search
- [x] `POST /api/radarr/release` – Release herunterladen
- [x] `GET /api/radarr/credits/:metaId` – Besetzung aus Radarr

#### 10.A2 – Sonarr Backend erweitern
**Datei:** `packages/server/src/services/sonarr.service.ts` + `routes/sonarr.routes.ts`

- [x] `PUT /api/sonarr/series/:id` – Serie updaten (monitored-Toggle)
- [x] `DELETE /api/sonarr/series/:id` – Serie löschen (deleteFiles=true/false)
- [x] `POST /api/sonarr/command` – Generischer Command (SeriesSearch, SeasonSearch, EpisodeSearch, RefreshSeries)
- [x] `GET /api/sonarr/release?episodeId=:id` – Releases für Interactive Search
- [x] `POST /api/sonarr/release` – Release herunterladen
- [x] `GET /api/sonarr/episodefile/:seriesId` – Episode-Files mit MediaInfo
- [x] `DELETE /api/sonarr/episodefile/:id` – Episode-Datei löschen
- [x] `PUT /api/sonarr/episode/:id` – Episode updaten (monitored-Toggle)
- [x] `PUT /api/sonarr/season-monitor/:seriesId` – Staffel-Überwachung togglen

#### 10.A3 – Lidarr Backend erweitern
**Datei:** `packages/server/src/services/lidarr.service.ts` + `routes/lidarr.routes.ts`

- [x] `GET /api/lidarr/albums?artistId=:id` – Alben eines Artists
- [x] `GET /api/lidarr/tracks?artistId=:id&albumId=:id` – Tracks (duration in ms → mm:ss)
- [x] `PUT /api/lidarr/album/:id` – Album monitored-Toggle
- [x] `POST /api/lidarr/command` – Generischer Command (ArtistSearch, AlbumSearch, RefreshArtist)
- [x] `DELETE /api/lidarr/artist/:id` – Künstler löschen (deleteFiles=true/false)

#### 10.A4 – Bazarr Backend komplett überarbeiten
**Datei:** `packages/server/src/services/bazarr.service.ts` + `routes/bazarr.routes.ts`

Das aktuelle Bazarr-Backend gibt ein vereinfachtes Format zurück. V1 nutzt das volle Objekt mit deutlich mehr Daten.

- [x] `GET /api/bazarr/movies/:radarrId/subtitles/full` – Vollständiges Bazarr-Movie-Objekt (subtitles, missing, audio_language, sceneName)
- [x] `GET /api/bazarr/series/:sonarrSeriesId/episodes` – Alle Episode-Untertitel einer Serie
- [x] `POST /api/bazarr/movies/:radarrId/subtitles/search` – Gesamtsuche für Film
- [x] `POST /api/bazarr/episodes/:episodeId/subtitles/search` – Untertitel-Suche für Episode

#### 10.A5 – Tautulli Backend erweitern
**Datei:** `packages/server/src/services/tautulli.service.ts` + `routes/tautulli.routes.ts`

- [x] `GET /api/tautulli/movie-history?tmdbId=:id&title=:title` – Play-History für einen Film
- [x] `GET /api/tautulli/user-stats?rating_key=:key` – User-Statistiken für ein Item
- [x] `GET /api/tautulli/metadata?rating_key=:key` – Plex-Metadata
- [x] `GET /api/tautulli/history?count=` – History mit count-Parameter

---

### 10.B – Gemeinsame Frontend-Komponenten (vor den Detail-Views bauen)

#### 10.B1 – InteractiveSearchModal.vue
**Datei:** `packages/client/src/components/ui/InteractiveSearchModal.vue`

Wiederverwendbares Modal das von MovieDetailView UND SeriesDetailView genutzt wird.

Props:
```typescript
interface Props {
  modelValue: boolean          // v-model:open
  source: 'radarr' | 'sonarr' // welche API
  entityId: number             // movieId oder episodeId
  title: string                // Modal-Subtitle (Filmtitel oder Episode-Titel)
}
```

Features:
- [x] Header + Schließen-X + Escape-Support
- [x] Toolbar: Filter (Alle/Usenet/Torrent) + Sort (Score/Größe/Alter/Seeds/Sprache) mit ▲/▼
- [x] Loading/Empty-State
- [x] Release-Liste: Tech-Badges, Score, Sprach-Parsing aus Titel, Seeds farbig
- [x] Laden-Button mit Zustands-Feedback (... → ✓ / ✗)
- [x] Backdrop-Click + Escape schließt Modal

#### 10.B2 – ConfirmDialog.vue
**Datei:** `packages/client/src/components/ui/ConfirmDialog.vue`

Einfacher Bestätigungs-Dialog für Lösch-Aktionen.

Props:
```typescript
interface Props {
  modelValue: boolean
  title: string
  message: string
  confirmLabel?: string   // default: 'Löschen'
  confirmColor?: string   // default: '#ef4444'
  cancelLabel?: string    // default: 'Abbrechen'
}
```

Events: `confirm`, `cancel`

Features:
- [x] Dark Modal mit Backdrop-Blur
- [x] Icon (Mülleimer)
- [x] Titel + Beschreibung
- [x] Cancel + Confirm Buttons (konfigurierbares Label + Farbe)
- [x] Escape schließt Dialog

---

### 10.3 – MovieDetailView – Vollständiger Ausbau

**Datei:** `packages/client/src/views/MovieDetailView.vue`

#### Hero-Bereich

- [x] **Action-Bar**: Trailer | Interaktiv | Suchen | In Plex | Aktualisieren | Überwacht-Toggle | Löschen
- [x] **Certification-Badge** (aus movie.certification)
- [x] **Originalsprache** im Hero-Meta
- [x] **Ratings als klickbare Pills**: IMDb (mit Votes), TMDb, RT

#### Übersicht-Tab

- [x] **Film-Details Grid**: Studio, Kinostart, Digital/DVD, sizeOnDisk, Status, Popularität, IDs, Pfad
- [x] **Genres** als Tag-Chips
- [x] **Crew + Cast** aus TMDB Credits

#### Datei-Tab

- [x] **Tech-Badges** (4K/1080p, DV/HDR, H.265/H.264, Atmos/TrueHD/DD+/DTS, 7.1/5.1)
- [x] **Datei-Grid**: Qualität, Codec, HDR, Audio, Sprachen, Release Group, Größe, Pfad, Datum

#### Bazarr-Tab

- [x] Header-Leiste mit Stats + Suchen-Button + Details-Toggle
- [x] Audio-Sprachen, vorhandene + fehlende Untertitel als Badges (Flagge + F/HI-Tags)
- [x] Scene-Name, Detail-Liste (aufklappbar), Loading/Error-State

#### Tautulli-Tab

- [x] Stats-Inline-Bar (Wiedergaben, Gesamtdauer, Zuletzt)
- [x] History-Tabelle (Datum, User, App, Transcode, Progress)

#### Interactive Search Modal

- [x] InteractiveSearchModal-Komponente integriert (source=radarr)

---

### 10.5 – SeriesDetailView – Vollständiger Ausbau

**Datei:** `packages/client/src/views/SeriesDetailView.vue`

#### Hero-Bereich

- [x] **Action-Bar**: Alle suchen | Aktualisieren | In Plex | Überwacht-Toggle | Entfernen (ConfirmDialog)
- [x] **Nächste/Letzte Episode** in Hero-Meta
- [x] **Erstausstrahlung, Sendezeit, Originalsprache**
- [x] **Externe Links** (IMDb, TheTVDB, TMDb)

#### Staffeln

- [x] Chevron + Staffelnummer + Meta + Progress-Bar + %-Anzeige
- [x] "Alle wählen" + Suchen-Icon + Monitor-Toggle pro Staffel-Header

#### Episoden

- [x] Checkbox, Status-Icon, Ep-Nummer, Monitor-Toggle, Titel, Laufzeit, Datum, Größe
- [x] Hover-Actions: Interaktive Suche | Auto-Suche | Bazarr-Suche | Datei löschen
- [x] Tech-Badges unter Episode (Quality, HDR, Codec, Audio, Sprachen, Bazarr-Subs)
- [x] Overview (2 Zeilen, aufklappbar)

#### Batch-Selektion

- [x] Fixe Toolbar unten (Slide-up-Animation)
- [x] Alle suchen | Dateien löschen | Aufheben

#### Interactive Episode Search

- [x] InteractiveSearchModal (source=sonarr)

#### Übersicht-Tab

- [x] Details-Grid (Network, Typ, Status, Laufzeit, IDs, Pfad)
- [x] Cast + Crew aus TMDB

---

### 10.6 – MusicView + ArtistDetailView – Vollständiger Ausbau

#### 10.6a – MusicView
**Datei:** `packages/client/src/views/MusicView.vue`

- [x] Alphabetische Gruppierung (A-Z + #) mit Alphabet-Nav
- [x] Status-Dot (grün=vollständig, lidarr-grün=teilweise, rot=fehlend, grau=ignoriert)
- [x] Progress-Bar unten auf Poster (Tracks-Vollständigkeit %)
- [x] Rating unter Poster (★ X.X)
- [x] Hover-Tooltip (Name, Genres, Overview 4 Zeilen, Stats)
- [x] Filter-Chips: Alle | Aktiv | Inaktiv | Überwacht | Ignoriert | Vollständig | Unvollständig
- [x] Sort: A–Z | Alben | Bewertung

#### 10.6b – ArtistDetailView
**Datei:** `packages/client/src/views/ArtistDetailView.vue`

##### Hero-Bereich

- [x] **Action-Bar**: Suchen (ArtistSearch) | Aktualisieren (RefreshArtist) | Entfernen (ConfirmDialog → DELETE)
- [x] **Artist-Links** als Chips (Discogs, Spotify, MusicBrainz, Last.fm, Wikipedia, etc.)
- [x] **Hero-Meta**: Hinzugefügt-Datum, Pfad (Ordnername)

##### Album-Liste

- [x] Cover + Titel + Meta + Progress-Bar + %-Anzeige + Suchen-Icon + Monitor-Toggle + Chevron

##### Track-Liste

- [x] ✓/– + Track-Nummer + Titel + Quality-Badge + Dauer (ms → mm:ss)
- [x] ⚠ duration aus Lidarr = Millisekunden korrekt formatiert

---

### 10.7 – Downloads – Aktionen ausbauen

**Datei:** `packages/client/src/views/DownloadsView.vue`

- [x] SABnzbd per-Item: Pause-Button (POST /queue/:id/pause), Resume-Button, Delete-Button
- [x] Globale SABnzbd-Controls: Pause/Fortsetzen
- [x] Arr Queue-Items: Remove-Button mit ConfirmDialog
- [x] Live-Updates via Socket.io
- [x] Backend: POST /api/sabnzbd/queue/:nzoId/pause + /resume

---

### 10.8 – Kalender – Klickbar + Navigation

**Datei:** `packages/client/src/views/CalendarView.vue`

- [x] Events klickbar → navigiert zu Film/Serien-Detailseite
- [x] Hover-Tooltip (App-Badge, Serientitel, Episode, Overview, Status)
- [x] App-Farben pro Typ (orange/blau/grün)
- [x] Navigation: ‹ Zurück | Heute | Weiter ›
- [ ] Wochenansicht (7-Spalten-Grid) → Phase 11
- [ ] Monatsansicht → Phase 11
- [ ] Kalenderoptionen-Panel → Phase 11

---

### 10.9 – Suche verbessern

**Datei:** `packages/client/src/views/SearchView.vue`

- [ ] Prowlarr-Suche: Sortierung + Filter bereits vorhanden, verfeinern
- [ ] Bibliotheks-Suche (Radarr/Sonarr/Lidarr): Fuzzy-Matching verbessern
- [ ] Kategorie-Filter: Filme | Serien | Musik | Alle

---

### 10.10 – TautulliView – Mehr Charts

**Datei:** `packages/client/src/views/TautulliView.vue`

- [ ] Top-10 Filme/Serien/Musik der letzten 30 Tage
- [ ] Plays-Timeline (letzte 30 Tage als Balkendiagramm)
- [ ] User-Statistiken: Wer hat wie viel geschaut
- [ ] Aktuelle Streams-Sektion (live, bereits im Dashboard vorhanden → hier ausführlicher)

---

### 10.11 – OverseerrView – Request-Details

**Datei:** `packages/client/src/views/OverseerrView.vue`

- [ ] Requests mit Poster, Status-Badge (Pending/Approved/Available/Declined)
- [ ] Approve/Decline Buttons (wenn Admin)
- [ ] Filtert nach Status

---

### 10.12 – ABS Detail-Ansicht

**Datei:** `packages/client/src/views/AbsDetailView.vue` (NEU)

- [ ] Buch-Cover groß
- [ ] Metadaten: Autor, Narrator, Serie, Genres, Dauer, Sprache
- [ ] Fortschritts-Anzeige (aus ABSProgress)
- [ ] Kapitel-Liste

---

### 10.13 – GotifyView – Prioritäten-Filter

**Datei:** `packages/client/src/views/GotifyView.vue`

- [x] Filter-Tabs: Alle | Kritisch (≥8) | Wichtig (≥5) | Info (<5) mit Count-Badges
- [x] Löschen per Message (bereits vorhanden)
- [x] Nachrichten-Badge in Sidebar vorhanden

---

### 10.14 – Settings Polish

**Datei:** `packages/client/src/views/SettingsView.vue`

- [ ] Connection-Test-Button pro Integration (testet ob API erreichbar, zeigt ✓/✗)
- [ ] Alle 11 Integrationen vollständig konfigurierbar (URL + API-Key)
- [ ] Speichern-Feedback (Toast)

---

## Phase 11 – Stand

### Schritt 1: Backend-Batch ✅
- TMDB: `getTrending`, `discover`, `getMovieDetails`, `getTvDetails`, `getSimilarMovies`, `getSimilarTv`
- TMDB Routes: `/api/tmdb/trending`, `/api/tmdb/discover`, `/api/tmdb/movie/:id`, `/api/tmdb/movie/:id/similar`, `/api/tmdb/tv/:id`, `/api/tmdb/tv/:id/similar`
- Radarr/Sonarr: `getQualityProfiles`, `getHealth`, `testAllIndexers`, `getMissing*`, `getHistory`
- Lidarr: `getMissingAlbums`, `getHistory`
- Neue Routes: `*/qualityprofiles`, `*/health`, `*/indexer/testall`, `*/missing`, `*/history`

### Schritt 2: DiscoverView ✅
- `DiscoverView.vue` – Hero, Trending-Grid, Genre-Pillen, Genre-Grid, Detail-Modal, Add-Config (Root-Folder + Qualitätsprofil + Optionen), Library-Check via Pinia-Stores, Ähnliche-Inhalte
- Route `/discover` + Sidebar-Eintrag (Kompass-Icon, TMDB-Farbe)
- Sidebar: `compass`-Icon erganzt

### Schritt 3: IndexerView + Sidebar ✅
- `IndexerView.vue` – Stats-Row (5 Karten), Health-Widget (Radarr/Sonarr), Prowlarr Release-Suche mit Tech-Badges + Filter/Sort, Indexer-Grid (Usenet/Torrent-Gruppen), History-Tab, RSS-Tab
- Farbe: `var(--prowlarr)` (#e66000) durchgängig
- Sidebar: Indexer-Eintrag + Package-Icon

### Schritt 4: CalendarView Wochenansicht + Optionen-Panel ✅
- Drei Ansichten: Woche | Monat | Liste (Tabs, via localStorage persistiert)
- Wochenansicht: 7-Spalten-Grid, Tag-Headers mit Heute-Highlight, Events mit Farb-Akzent, Finale-★, Uhrzeit aus airDateUtc
- Monatsansicht: 42-Zellen-Grid, 3 Events/Tag + "+N weitere", Heute-Kreis
- Optionen-Panel (slide-down): Filter Radarr/Sonarr/Lidarr, Release-Typen, Wochenstart Mo/So, Vollfarb-Modus
- Radarr: separate Einträge pro Release-Typ (Kino/Digital/Physisch) mit emoji
- Sonarr: airDateUtc → lokale Uhrzeit, Finale-Erkennung aus finaleType/episodeType
- Alle Einstellungen in localStorage (cal_view, cal_weekStartMon, etc.)

### Schritt 5: DownloadsView kombinierte Queue + History + Fehlend ⏳ (nächstes)
### Schritt 5: DownloadsView kombinierte Queue + History + Fehlend

---

## Phase 10 – ABGESCHLOSSEN ✅

Alle Items erledigt:
```
10.9  ✅ SearchView: Fuzzy-Score (5 Stufen: Exakt/Beginnt/Enthält/Alle-Wörter/Teilmatch), Relevanz-Sort
10.10 ✅ TautulliView: Timeline-Tab mit Balkendiagramm (Filme/Serien/Musik), plays-by-date Backend
10.11 ✅ OverseerrView: war bereits vollständig (Poster, Status-Badges, Approve/Decline, Filter-Tabs)
10.12 ✅ AbsDetailView.vue: Cover, Metadaten, Progress-Bar, Kapitel-Liste, Podcast-Episoden; Route /audiobookshelf/:id; AbsView klickbar
10.14 ✅ SettingsView: Per-Integration Test-Button + Toast-System (Teleport, TransitionGroup)
```

### Neue Backend-Endpoints (Phase 10 letzte Session)
- `GET /api/system/integrations/:name` – Einzel-Integration testen
- `GET /api/tautulli/plays-by-date?time_range=30` – Tages-Statistiken für Timeline-Chart

---

## Status Phase 10

- [x] 10.1 – Dashboard: Health-Bar, Stats-Cards, Zuletzt hinzugefügt, Downloads, Releases, Streams, Gotify/Overseerr/Plex/ABS Widgets, Tautulli History
- [x] 10.2 – MoviesView: Alpha-Gruppen, Alphabet-Nav, Bibliotheks-Filter, Hover-Tooltip, Rating unten, Status-Dot, Quality-Badge
- [x] **10.A1** – Radarr Backend: PUT/DELETE movie, command, release, credits
- [x] **10.A2** – Sonarr Backend: PUT/DELETE series, command, release, episodefile, episode, season-monitor
- [x] **10.A3** – Lidarr Backend: albums?artistId, tracks, PUT album, command, DELETE artist
- [x] **10.A4** – Bazarr Backend: movie/full, episodes, search/movie, search/episode
- [x] **10.A5** – Tautulli Backend: movie-history, user-stats, metadata
- [x] **10.B1** – InteractiveSearchModal.vue (gemeinsame Komponente)
- [x] **10.B2** – ConfirmDialog.vue (gemeinsame Komponente)
- [x] **10.3** – MovieDetailView: Action-Bar, alle Detail-Felder, Bazarr-Widget, Tautulli-Tab, Interactive Search + Bug-Fix Tautulli title-Param
- [x] 10.4 – SeriesView ✅ (bereits erledigt)
- [x] **10.5** – SeriesDetailView: Action-Bar, Season-Monitor, Episode-Aktionen, Batch-System, Interactive Search
- [x] **10.6a** – MusicView: Alpha-Gruppen, Filter, Hover-Tooltip, Status-Dot, Progress-Bar
- [x] **10.6b** – ArtistDetailView: Action-Bar (Suchen/Refresh/Delete), Artist-Links, Album-Suche/Monitor, Track-Quality-Badge
- [x] **10.7** – Downloads: SABnzbd per-Item Pause/Resume/Delete, ConfirmDialog, Arr-Remove
- [x] **10.8** – Kalender: klickbar (→ Detail-Page), Hover-Tooltip, Navigation (Vor/Zurück/Heute)
- [x] **10.9** – SearchView: Fuzzy-Scoring (5 Stufen), Relevanz-Sortierung
- [x] **10.10** – TautulliView: Timeline-Tab, plays-by-date Balkendiagramm
- [x] **10.11** – OverseerrView: war bereits vollständig
- [x] **10.12** – AbsDetailView.vue: Cover, Meta, Progress, Kapitel, Episoden; Route /audiobookshelf/:id
- [x] **10.13** – GotifyView: Prioritäten-Filter (Alle/Kritisch/Wichtig/Info)
- [x] **10.14** – SettingsView: Per-Integration Test-Button + Toast-System

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
TAUTULLI_URL=http://192.168.188.69:8281
TAUTULLI_API_KEY=b_AHt38E2A5Yg8TCNLmSdbXKohYpMqF9
OVERSEERR_URL=http://192.168.188.69:5055
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
├── shared/     → Types (integrations.ts, etc.)
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

## Phase 11 – v1-Parität + Neue Features (geplant)

> Vollständige Roadmap: `.ai/ROADMAP_PHASE11.md`

**Kritische fehlende Views (komplett neu):**
- `DiscoverView.vue` – TMDB Trending, Genre-Entdeckung, Hinzufügen-Modal mit Root-Folder/Qualitätsprofil
- `IndexerView.vue` – Prowlarr Stats, Indexer-Grid, Release-Suche mit Tech-Badges, History, RSS

**Kalender – was noch fehlt (v1 hat das alles):**
- Wochenansicht (7-Spalten-Grid) – v2 hat nur Listenansicht
- Monatsansicht (klassisch mit Tages-Zellen)
- Kalenderoptionen-Panel (Kino/Digital/Physisch, Episodeninfos, Finale-Icon, Zeitzone, Vollfarbe)
- Filter-Toggles (Radarr/Sonarr/Lidarr ein-/ausblenden)
- Ausstrahlungszeit (airDateUtc → Lokalzeit, z.B. "20:15 Uhr")

**Downloads – was noch fehlt:**
- Stats-Bar (4 Karten: Radarr/Sonarr/Lidarr/SABnzbd)
- Kombinierte Queue (SABnzbd-Slot + Arr-Eintrag zusammen: Poster, Medientitel, Format-Badges)
- History-Tab (Radarr/Sonarr/Lidarr History, paginated)
- Fehlend-Tab (Missing mit Sofort-Suche)
- SABnzbd: Priorität-Dropdown + An-Anfang-Button

**Neue Backend-Endpoints:**
- TMDB: trending, discover, tv/:id, similar
- Radarr/Sonarr: missing, history, qualityprofiles, health, indexer/testall
- SABnzbd: queue/:id/priority, queue/:id/move

**Sidebar ergänzen:**
- `/indexer` NavItem
- `/discover` NavItem

---

## Was Claude Code IMMER als erstes tun soll

1. `.ai/CONTEXT.md` lesen
2. `.ai/LESSONS.md` lesen
3. `.ai/CONVENTIONS.md` lesen
4. Bei neuen Integrationen: `.ai/INTEGRATIONS.md` lesen
