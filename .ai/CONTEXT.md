# nexarr v2 – AI Context
> Dieses Dokument wird am Ende jeder Session aktualisiert.
> Zuletzt aktualisiert: 01.04.2026 – Phase 10 Deep-Research-Plan eingearbeitet
> Aktualisiert von: Chat-Claude
> Stand: Phase 9 vollständig, Phase 10 aktiv

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

- [ ] `PUT /api/radarr/movies/:id` – Film-Objekt vollständig updaten (monitored-Toggle, etc.)
  - Service: `updateMovie(id, body)` → PUT `/movie/:id` an Radarr
  - Invalidiert `radarr_movies` + `radarr_movie_${id}` Cache
- [ ] `DELETE /api/radarr/movies/:id` – Film aus Radarr entfernen
  - Service: `deleteMovie(id)` → DELETE `/movie/:id`
  - Query-Param: `deleteFiles=true/false` (vom Client steuerbar)
  - Invalidiert gesamten `radarr_movies` Cache
- [ ] `POST /api/radarr/command` – Generischer Command-Endpoint
  - Service: `sendCommand(body)` → POST `/command` (body enthält `{name, movieIds?, movieId?}`)
  - Keine Caching (Commands sind sofortige Aktionen)
  - Verwendet für: `MoviesSearch` (Auto-Suche), `RescanMovie` (Aktualisieren)
- [ ] `GET /api/radarr/release?movieId=:id` – Releases für Interactive Search
  - Service: `getReleases(movieId)` → GET `/release?movieId=X`
  - Kein Cache (immer live, kann 10-30s dauern)
  - TTL auf 0 (nie cachen)
- [ ] `POST /api/radarr/release` – Release herunterladen (aus Interactive Search)
  - Service: `downloadRelease(body)` → POST `/release` mit `{guid, indexerId}`
  - Kein Cache
- [ ] `GET /api/radarr/credits/:metaId` – Besetzung direkt aus Radarr (nicht TMDB)
  - Service: `getCredits(metaId)` → GET `/credit?movieMetadataId=X`
  - Cache: TTL.DETAIL (30min)

#### 10.A2 – Sonarr Backend erweitern
**Datei:** `packages/server/src/services/sonarr.service.ts` + `routes/sonarr.routes.ts`

- [ ] `PUT /api/sonarr/series/:id` – Serie updaten (monitored-Toggle)
  - Service: `updateSeries(id, body)` → PUT `/series/:id`
  - Invalidiert `sonarr_series` + `sonarr_series_${id}` Cache
- [ ] `DELETE /api/sonarr/series/:id` – Serie löschen
  - Service: `deleteSeries(id)` → DELETE `/series/:id`
  - Query-Param: `deleteFiles=true/false`
- [ ] `POST /api/sonarr/command` – Generischer Command-Endpoint
  - Service: `sendCommand(body)` → POST `/command`
  - Verwendet für: `SeriesSearch`, `SeasonSearch` (mit `seasonNumber`), `EpisodeSearch` (mit `episodeIds[]`), `RefreshSeries`
- [ ] `GET /api/sonarr/release?episodeId=:id` – Releases für Episode Interactive Search
  - Service: `getEpisodeReleases(episodeId)` → GET `/release?episodeId=X`
  - Kein Cache
- [ ] `POST /api/sonarr/release` – Release herunterladen
  - Service: `downloadRelease(body)` → POST `/release`
- [ ] `GET /api/sonarr/episodefile/:seriesId` – Alle Episode-Files einer Serie mit MediaInfo
  - Service: `getEpisodeFiles(seriesId)` → GET `/episodefile?seriesId=X`
  - Cache: TTL.QUEUE (kurz, da sich ändert)
  - Response enthält pro File: `id, size, quality, mediaInfo (resolution, videoCodec, audioCodes, audioChannels, videoDynamicRangeType, subtitles, runTime), languages[], releaseGroup, dateAdded, relativePath`
- [ ] `DELETE /api/sonarr/episodefile/:id` – Episode-Datei löschen
  - Service: `deleteEpisodeFile(id)` → DELETE `/episodefile/:id`
  - Invalidiert `sonarr_episodefiles_*` Cache
- [ ] `PUT /api/sonarr/episode/:id` – Episode updaten (monitored-Toggle)
  - Service: `updateEpisode(id, body)` → PUT `/episode/:id`
  - Kein globaler Cache-Reset nötig
- [ ] `PUT /api/sonarr/season-monitor/:seriesId` – Staffel-Überwachung togglen
  - Service: `updateSeasonMonitor(seriesId, body)` → PUT `/series/:seriesId` mit geänderter seasons[]-Liste
  - Body: `{seasonNumber, monitored}` – Service holt aktuelle Serie, ändert Staffel, sendet ganzes Objekt zurück

#### 10.A3 – Lidarr Backend erweitern
**Datei:** `packages/server/src/services/lidarr.service.ts` + `routes/lidarr.routes.ts`

- [ ] `GET /api/lidarr/albums?artistId=:id` – Alben eines Artists (nicht alle Alben!)
  - Service: `getAlbumsByArtist(artistId)` → GET `/album?artistId=X&includeAllArtistAlbums=false`
  - Cache: TTL.DETAIL, Key `lidarr_albums_artist_${artistId}`
- [ ] `GET /api/lidarr/tracks?artistId=:id&albumId=:id` – Tracks (v1-kompatible Query-Params)
  - Service: `getTracks(artistId, albumId)` → GET `/track?artistId=X&albumId=Y`
  - Cache: TTL.DETAIL
  - Response enthält: `id, trackNumber, title, duration, hasFile, trackFile (quality, size)`
  - ⚠️ v1 übergibt duration in Millisekunden, Lidarr API gibt Sekunden zurück – Client muss korrekt formatieren
- [ ] `PUT /api/lidarr/album/:id` – Album monitored-Toggle
  - Service: `updateAlbum(id, body)` → PUT `/album/:id`
  - Invalidiert `lidarr_albums_artist_*` Cache
- [ ] `POST /api/lidarr/command` – Generischer Command-Endpoint
  - Service: `sendCommand(body)` → POST `/command`
  - Verwendet für: `ArtistSearch`, `AlbumSearch` (mit `albumIds[]`), `RefreshArtist`
- [ ] `DELETE /api/lidarr/artist/:id` – Künstler löschen
  - Service: `deleteArtist(id)` → DELETE `/artist/:id`
  - Query-Param: `deleteFiles=true/false`

#### 10.A4 – Bazarr Backend komplett überarbeiten
**Datei:** `packages/server/src/services/bazarr.service.ts` + `routes/bazarr.routes.ts`

Das aktuelle Bazarr-Backend gibt ein vereinfachtes Format zurück. V1 nutzt das volle Objekt mit deutlich mehr Daten.

- [ ] `GET /api/bazarr/movie/full?radarrId=:id` – Vollständiges Bazarr-Movie-Objekt
  - Service: `getMovieFull(radarrId)` → GET `/movies?radarrid=X`
  - Response-Felder: `radarrId, title, sceneName, monitored`
  - `subtitles[]`: `{code2, code3, name, path, forced, hi, format, provider_name, file_size}`
  - `missing_subtitles[]`: `{code2, code3, name, forced, hi}`
  - `audio_language[]`: `{code2, code3, name}`
  - Cache: TTL.DETAIL
- [ ] `GET /api/bazarr/episodes?sonarrId=:id` – Alle Episode-Untertitel einer Serie auf einmal
  - Service: `getEpisodeSubtitlesBySeries(sonarrId)` → GET `/episodes?seriesid=X`
  - Gibt Array zurück: pro Episode `{sonarrEpisodeId, subtitles[], missing_subtitles[]}`
  - Cache: TTL.QUEUE (kurz)
- [ ] `POST /api/bazarr/search/movie` – Gesamtsuche für Film (ohne Sprach-Angabe)
  - Service: `searchMovieSubtitles(radarrId)` → POST `/subtitles` mit `{action: 'search', radarrid: X}`
  - Kein Cache
- [ ] `POST /api/bazarr/search/episode` – Untertitel-Suche für einzelne Episode
  - Service: `searchEpisodeSubtitles(episodeId)` → POST `/subtitles` mit `{action: 'search', episodeid: X}`
  - Kein Cache

#### 10.A5 – Tautulli Backend erweitern
**Datei:** `packages/server/src/services/tautulli.service.ts` + `routes/tautulli.routes.ts`

- [ ] `GET /api/tautulli/movie-history?tmdbId=:id` – Play-History für einen Film
  - Service: `getMovieHistory(tmdbId)` → GET API `get_history` mit `metadata_type=movie` + `search=tmdbId`
  - Fallback: Suche nach Titel wenn keine TMDB-Ergebnisse
  - Response: Array von History-Einträgen mit `{date, started, friendly_name, user_thumb, product, platform, player, location, transcode_decision, paused_counter, watched_status, percent_complete, play_duration}`
  - Cache: TTL.STATS (5min) – Plays ändern sich nicht so oft
- [ ] `GET /api/tautulli/user-stats?rating_key=:key` – User-Statistiken für ein Item
  - Service: `getUserStatsForItem(ratingKey)` → GET API `get_item_user_stats?rating_key=X`
  - Response: Array `{friendly_name, user_thumb, total_plays}`
  - Cache: TTL.STATS
- [ ] `GET /api/tautulli/metadata?rating_key=:key` – Plex-Metadata (für rating_key Lookup)
  - Service: `getMetadata(ratingKey)` → GET API `get_metadata?rating_key=X`
  - Wird verwendet um `rating_key` aus Titel/TMDB-ID zu finden
- [ ] Bestehender `GET /api/tautulli/history` erweitern um `?count=` Query-Param

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
- [ ] Header: Titel "Interaktive Suche" + Subtitle (Item-Name) + Schließen-X
- [ ] Toolbar (erscheint nach Laden): Ergebnis-Count + Filter-Chips + Sort-Chips
  - Filter: **Alle** | **Usenet** | **Torrent**
  - Sort: **Score** (default ▼) | **Größe** | **Alter** | **Seeds** | **Sprache**
  - Sort-State: Aktiver Key ist hervorgehoben, ▲/▼ für Richtung, Klick auf aktiven Key dreht Richtung um
- [ ] Loading-State: Spinner + "Suche läuft – kann etwas dauern…"
- [ ] Empty-State: "Keine Ergebnisse" (auch nach Filter)
- [ ] Release-Liste (scrollbar):
  - Pro Release (links): **Titel** (fett, word-break), darunter Badge-Zeile:
    - Quality-Badge (orange), Custom-Format-Badges (grau), Sprach-Badge (grau, aus Titel geparsed), Indexer-Badge (dunkelgrau), Score-Badge (orange wenn >0, rot wenn <0)
  - Pro Release (rechts, ausgerichtet): Protokoll-Badge (Usenet=blau, Torrent=grün), Seeds (farbig: ≥10=grün, ≥1=gelb, 0=rot), Alter (Xh oder Xd), Größe, **„Laden"-Button** (Farbe der App)
- [ ] Laden-Button: sendet POST an richtigen Release-Endpoint, Button-State = "..." → "✓" (grün) oder Error
- [ ] Modal schließt bei Klick auf Backdrop oder Escape-Taste
- [ ] Sprach-Parsing aus Titel: german/ger/deutsch → DE, english/eng → EN, etc.

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
- [ ] Dark Modal mit Backdrop-Blur
- [ ] Icon (Mülleimer oder Warnung)
- [ ] Titel + Beschreibung
- [ ] Cancel + Confirm Buttons
- [ ] Escape schließt Dialog

---

### 10.3 – MovieDetailView – Vollständiger Ausbau

**Datei:** `packages/client/src/views/MovieDetailView.vue`

#### Hero-Bereich

- [ ] **Action-Bar direkt unter dem Poster** (wie v1, in einer Reihe):
  Reihenfolge: `▶ Trailer` | `Interaktiv` | `Suchen` | `▶ In Plex` | `↺ Aktualisieren` | `👁 Überwacht/Nicht überwacht` (Toggle) | `🗑 Löschen`
  - **Trailer**: nur wenn `tmdbTrailer` vorhanden, öffnet YouTube in neuem Tab
  - **Interaktiv**: öffnet `InteractiveSearchModal` mit `source="radarr"` + `entityId=movieId`
  - **Suchen**: POST `/api/radarr/command` mit `{name:'MoviesSearch', movieIds:[id]}`
  - **In Plex**: Link zu `plex://` Deep-Link oder Plex-Web-URL
  - **Aktualisieren**: POST `/api/radarr/command` mit `{name:'RescanMovie', movieId:id}`
  - **Überwacht-Toggle**: PUT `/api/radarr/movies/:id` mit geändertem `monitored`, Button-Farbe ändert sich (aktiv=radarr-Orange, inaktiv=grau), feuert sofortigen UI-Update ohne Page-Reload
  - **Löschen**: öffnet `ConfirmDialog`, nach Bestätigung DELETE `/api/radarr/movies/:id`, navigiert zurück zu `/movies`

- [ ] **Certification/FSK-Badge** im Hero-Meta (aus `movie.certification`, z.B. "18", "FSK 12") – orange Badge
- [ ] **Originalsprache** im Hero-Meta (aus `movie.originalLanguage?.name`)
- [ ] **Ratings als klickbare Pills** (Links öffnen in neuem Tab):
  - IMDb-Pill: Gelbes IMDb-Logo + Wert + Votes (z.B. "6.6 · 290K") → Link zu imdb.com/title/tt...
  - TMDb-Pill: Dunkelblau + Grüner Text + Prozentwert → Link zu themoviedb.org/movie/...
  - Metacritic-Pill (wenn vorhanden): Dunkelgrau + Gelb + Wert → Link zu metacritic.com
  - Trakt-Pill (wenn vorhanden): Schwarz + Rot + Wert → Link zu trakt.tv

#### Übersicht-Tab

- [ ] **Film-Details Grid** (alle Felder aus Radarr):
  - Originalsprache, Studio, Kinostart, Digital/DVD-Datum, Dateigröße (sizeOnDisk), Status (released/announced/etc.)
  - Popularität (popularity, gerundet)
  - IMDb ID (als Link), TMDb ID (als Link), Hinzugefügt-Datum
  - Website (als klickbarer Link, Hostname anzeigen)
  - Alternativtitel (bis zu 3, aus `alternateTitles[]`)
  - Dateipfad (vollständig, mono-Font, klein)
- [ ] **Keywords** als Tag-Liste unter dem Details-Grid (aus `movie.keywords[]` wenn vorhanden)
- [ ] **Genres** als klickbare Tag-Chips (bereits vorhanden, nur verfeinern)
- [ ] **Crew** aus TMDB Credits (Director, Producer, DoP – bereits vorhanden, verfeinern)
- [ ] **Cast** aus TMDB Credits (bereits vorhanden, verfeinern)
- [ ] Fallback: Besetzung aus Radarr-Credits (`/api/radarr/credits/:metaId`) wenn TMDB nicht verfügbar

#### Datei-Tab

- [ ] **Tech-Badges groß** (bereits vorhanden, aber erweitern):
  - 4K / 1080p / 720p (aus resolution)
  - DV / HDR10+ / HDR (aus videoDynamicRangeType)
  - H.265 / H.264 / AV1 (aus videoCodec)
  - Atmos / TrueHD / DD+ / DTS (aus audioCodec)
  - 7.1 / 5.1 / Stereo (aus audioChannels)
- [ ] **Datei-Grid** (alle Felder aus movieFile + mediaInfo):
  - Qualität (quality.quality.name), Auflösung (mediaInfo.resolution)
  - Video Codec, HDR-Typ, Video-Bitrate (in Mbps)
  - Audio Codec + Kanäle
  - Audiosprachenliste (movieFile.languages[].name, kommagetrennt)
  - Eingebettete Untertitel (aus mediaInfo.subtitles, geparsed und gezählt: "3 Subs: DE, EN, FR")
  - Release Group (movieFile.releaseGroup)
  - Dateigröße, Dateiname (relativePath, mono-Font), Datei hinzugefügt-Datum (movieFile.dateAdded)

#### Bazarr-Tab – Komplett neu (inspiriert von v1)

- [ ] **Header-Leiste**:
  - Links: "X Untertitel" (lila), "X fehlend" (rot, gestrichelt), "✓ Vollständig" (grün) – je nach Zustand
  - Rechts: **„Suchen"**-Button (Bazarr-Gesamtsuche, POST `/api/bazarr/search/movie`) + **„Bazarr ↗"**-Link + **„Details"**-Toggle
- [ ] **Audio-Sprachen** als Badges (blau, aus `audio_language[]`)
  - Label: "Audio" + Sprach-Badges mit Flagge
- [ ] **Vorhandene Untertitel** als Badges (lila, aus `subtitles[]`)
  - Pro Sprache: Flagge + Sprachname + ×Count wenn mehrfach + "F" wenn forced + "HI" wenn hearing-impaired
- [ ] **Fehlende Untertitel** als Badges (rot, gestrichelt, aus `missing_subtitles[]`)
  - Label: "Fehlend" + Badges
- [ ] **Scene-Name** (wenn vorhanden, monospace, klein, dunkel)
- [ ] **Detail-Liste** (standardmäßig eingeklappt, Toggle über "Details"-Button):
  - Pro vorhandenem Untertitel: Subtitel-Icon (lila) + Flagge + Sprachname + Forced/HI-Badges + Provider-Name + Dateigröße + Dateipfad
  - Pro fehlendem Untertitel: X-Icon (rot) + Flagge + Sprachname + Forced/HI + "Fehlend"-Label
- [ ] Loading-State, Error-State (Bazarr nicht konfiguriert / Film unbekannt)

#### Tautulli-Tab – NEU (bisher nicht vorhanden)

- [ ] **Stats-Inline-Bar**:
  - "X Wiedergaben" | "Gesamtdauer Xh Xm" | "Zuletzt: DD.MM.YYYY · Username" | "Erstmals: DD.MM.YYYY · Username"
  - "Noch nicht angeschaut" wenn plays = 0
- [ ] **User-Statistiken** (wenn vorhanden):
  - Avatar-Bild + Username + "X Wiedergabe(n)"
- [ ] **History-Tabelle** (scrollbar):
  - Spalten: Datum, Start-Uhrzeit, Benutzer (Avatar + Name), App, Player, LAN/WAN, Transcode (Direct/Copy/Transcode farbig), Pause-Dauer, ✓ (Watched), Progress (Mini-Bar + %), Dauer
  - Leere Tabelle wenn keine History
- [ ] Rating-Key Lookup: `/api/tautulli/metadata?rating_key=` um den richtigen Plex-Key zu finden

#### Interactive Search Modal

- [ ] Nutzt die gemeinsame `InteractiveSearchModal`-Komponente (10.B1)
- [ ] Öffnet sich bei Klick auf "Interaktiv"-Button
- [ ] `source="radarr"`, `entityId=movieId`

---

### 10.5 – SeriesDetailView – Vollständiger Ausbau

**Datei:** `packages/client/src/views/SeriesDetailView.vue`

#### Hero-Bereich

- [ ] **Action-Bar direkt unter dem Poster** (wie v1):
  Reihenfolge: `Alle suchen` | `↺ Aktualisieren` | `▶ In Plex` | `👁 Überwacht/Nicht überwacht` | `🗑 Entfernen`
  - **Alle suchen**: POST `/api/sonarr/command` mit `{name:'SeriesSearch', seriesId:id}`
  - **Aktualisieren**: POST `/api/sonarr/command` mit `{name:'RefreshSeries', seriesId:id}`
  - **In Plex**: Plex-Web-Link
  - **Überwacht-Toggle**: PUT `/api/sonarr/series/:id` mit geändertem `monitored`
  - **Entfernen**: ConfirmDialog → DELETE `/api/sonarr/series/:id`, navigiert zu `/series`

- [ ] **Nächste Episode** in Hero-Meta (nextAiring, in Sonarr-Farbe hervorgehoben, mit Uhr-Icon)
- [ ] **Letzte Episode** in Hero-Meta (previousAiring)
- [ ] **Erstausstrahlung** (firstAired)
- [ ] **Sendezeit** (airTime, mit Uhr-Icon)
- [ ] **Originalsprache** (originalLanguage.name)
- [ ] **Externe Links** als Chips: IMDb (wenn imdbId), TheTVDB (wenn tvdbId), TMDb (wenn tmdbId)

#### Staffeln – Vollständiger Ausbau

Pro Staffel-Header hat jetzt FOLGENDE Elemente (von links nach rechts):
1. **Chevron** (aufklapp-Indikator)
2. **S01 / S02** Nummer (in Sonarr-Farbe)
3. **Staffel-Titel** + Meta-Zeile (X/Y Ep. · Größe)
4. **Progress-Bar** (60px, grün wenn 100%)
5. **%-Anzeige** (farbig: grün=100%, blau=teilweise, grau=0%)
6. **"Alle wählen"**-Button (klein) → selektiert alle Checkboxen dieser Staffel
7. **Suchen-Icon-Button** → POST `/api/sonarr/command` mit `{name:'SeasonSearch', seriesId:id, seasonNumber:sn}`
8. **Monitor-Toggle-Button** (Auge) → PUT `/api/sonarr/season-monitor/:seriesId` mit `{seasonNumber, monitored}`, UI sofort updaten

#### Episoden – Vollständiger Ausbau

Pro Episode-Zeile (von links nach rechts):
1. **Checkbox** (Batch-Selektion, 14×14px, custom styled)
2. **Status-Icon**: ✓ grün (hasFile), Uhr blau (zukünftig, !hasFile && airDate > heute), – grau (fehlend)
3. **Ep-Nummer** (02, 03...)
4. **Monitor-Toggle** (Auge-Icon, klein) → PUT `/api/sonarr/episode/:id` mit `{...ep, monitored: !ep.monitored}`
5. **Titel** (weiß wenn hasFile, grau wenn nicht)
6. **Laufzeit** (aus episodeFile.mediaInfo.runTime, nur wenn hasFile)
7. **Datum** (DD.MM.YYYY)
8. **Dateigröße** (nur wenn hasFile)
9. **Action-Buttons** (erscheinen nur beim Hover der Zeile, opacity-Transition):
   - Interaktive Suche (Person-Icon, blau) → öffnet InteractiveSearchModal mit `source="sonarr"` + `entityId=episodeId`
   - Auto-Suche (Lupe-Icon) → POST `/api/sonarr/command` mit `{name:'EpisodeSearch', episodeIds:[epId]}`
   - Bazarr-Suchen (Sprechblase-Icon, lila) → POST `/api/bazarr/search/episode` mit `{episodeId}`, Button disabled+Spinner während läuft
   - Datei löschen (Mülleimer, rot bei Hover) → ConfirmDialog → DELETE `/api/sonarr/episodefile/:fileId`, danach Episode-Zeile neu rendern ohne Page-Reload

Unterhalb jeder Episode (wenn hasFile):
- **Tech-Badges-Zeile** (aus episodeFile.mediaInfo + quality + languages):
  - Quality-Badge (blau): `quality.quality.name`
  - DV / HDR10+ / HDR (aus videoDynamicRangeType)
  - H.265 / H.264 (aus videoCodec)
  - 10-bit (wenn videoBitDepth = 10)
  - Audio-Codec + Channels (Atmos/TrueHD/DD+/DTS + 5.1/7.1, grün/grau)
  - Sprach-Badges (DE, EN, etc. aus languages[])
  - Subtitle-Count-Badge (aus mediaInfo.subtitles, geparsed)
  - Release-Group (aus episodeFile.releaseGroup, klein)
- **Bazarr-Untertitel-Badges** (wenn bazarrEpisodeMap[ep.id] vorhanden):
  - Vorhandene Sprachen als lila Badges mit Flagge + Code + ×Count + F/HI-Tags
  - Fehlende als rote gestrichelte Badges mit X-Icon + Anzahl
- **Overview** (kursiv, grau, 2 Zeilen max, klickbar zum vollständig Aufklappen)

#### Batch-Selektion – NEU

- [ ] Fixe Toolbar am unteren Bildrand (`position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%)`)
- [ ] Erscheint mit Slide-up-Animation wenn mindestens 1 Episode ausgewählt
- [ ] Inhalt: "X Episode(n) ausgewählt" | Trennlinie | **Alle suchen** (EpisodeSearch) | **Dateien löschen** (mit ConfirmDialog) | Trennlinie | **Aufheben**
- [ ] Alle suchen: sammelt alle ausgewählten `episodeId`s → POST `/api/sonarr/command` mit `{name:'EpisodeSearch', episodeIds:[...]}`
- [ ] Dateien löschen: sammelt alle `fileId`s (nur wenn hasFile) → alle DELETE-Requests parallel, dann UI updaten
- [ ] Aufheben: leert Selektion, blendet Toolbar aus

#### Interactive Episode Search Modal

- [ ] Nutzt `InteractiveSearchModal`-Komponente
- [ ] `source="sonarr"`, `entityId=episodeId`, `title=epTitle`

#### Übersicht-Tab

- [ ] **Details-Grid** (alle Felder):
  - Sender/Network, Typ (seriesType), Status (Laufend/Beendet), Laufzeit, Hinzugefügt, Nächste Folge, Letzte Folge
  - IMDb ID (Link), TVDB ID (Link), TMDb ID (Link)
  - Pfad (mono-Font, vollständig)
- [ ] **Cast** aus TMDB (bereits vorhanden, verfeinern)
- [ ] **Crew** aus TMDB (bereits vorhanden)

---

### 10.6 – MusicView + ArtistDetailView – Vollständiger Ausbau

#### 10.6a – MusicView
**Datei:** `packages/client/src/views/MusicView.vue`

Analog zu MoviesView/SeriesView:
- [ ] Alphabetische Gruppierung (#, A-Z) mit Alphabet-Nav rechts
- [ ] Status-Dot (grün/rot/grau) auf Poster
- [ ] Progress-Bar unten auf Poster (Tracks-Vollständigkeit %)
- [ ] Rating unter Poster (★ X.X)
- [ ] Hover-Tooltip: Artistname, Genres, Overview (4 Zeilen), Stats (Alben, Tracks, %)
- [ ] Filter: Alle | Aktiv | Inaktiv | Überwacht | Nicht überwacht | Vollständig | Unvollständig
- [ ] Sort: A-Z, Neu, Bewertung
- [ ] Bibliotheks-Filter (Lidarr hat keine RootFolders in dem Sinne, aber `qualityProfileId` als Filter möglich)

#### 10.6b – ArtistDetailView
**Datei:** `packages/client/src/views/ArtistDetailView.vue`

##### Hero-Bereich

- [ ] **Action-Bar direkt unter dem Foto**:
  Reihenfolge: `Suchen` | `↺ Aktualisieren` | `👁 Überwacht/Nicht überwacht` | `🗑 Entfernen`
  - **Suchen**: POST `/api/lidarr/command` mit `{name:'ArtistSearch', artistId:id}`
  - **Aktualisieren**: POST `/api/lidarr/command` mit `{name:'RefreshArtist', artistId:id}`
  - **Überwacht-Toggle**: PUT nicht implementiert in Lidarr direkt – über Album-Level
  - **Entfernen**: ConfirmDialog → DELETE `/api/lidarr/artist/:id`, navigiert zu `/music`

- [ ] **Artist-Links** als klickbare Chips (aus `artist.links[]`):
  - Discogs, AllMusic, Wikipedia, Last.fm, Spotify, MusicBrainz, Wikidata
  - Nur anzeigen wenn `links[]` vorhanden
- [ ] **Hero-Meta**: Hinzugefügt-Datum, Alben-Count (aus statistics), Tracks X/Y, Pfad (Ordnername)

##### Album-Liste – Vollständiger Ausbau

Pro Album-Header (von links nach rechts):
1. **Cover** (52×52px, abgerundet)
2. **Titel** + Meta-Zeile (Jahr · Album-Typ-Badge · X/Y Tracks · Größe)
3. **Progress-Bar** (80px)
4. **%-Anzeige**
5. **Suchen-Icon** → POST `/api/lidarr/command` mit `{name:'AlbumSearch', albumIds:[albumId]}`
6. **Monitor-Toggle** → PUT `/api/lidarr/album/:id` mit `{...album, monitored: !album.monitored}`
7. **Chevron**

##### Track-Liste – Vollständiger Ausbau

Geladene Daten: GET `/api/lidarr/tracks?artistId=:id&albumId=:id`

Pro Track-Zeile:
- **✓ / –** (grün wenn hasFile, dunkelgrau wenn nicht)
- **Track-Nummer** (rechts-ausgerichtet, mono)
- **Titel** (weiß wenn hasFile, grau wenn nicht)
- **Quality-Badge** (grün, aus trackFile.quality.quality.name wenn hasFile)
- **Dauer** (MM:SS, rechts)

⚠️ Achtung: Lidarr API gibt `duration` in Millisekunden zurück → `mm:ss = Math.floor(ms/60000) + ':' + pad(Math.floor((ms%60000)/1000))`

---

### 10.7 – Downloads – Aktionen ausbauen

**Datei:** `packages/client/src/views/DownloadsView.vue`

- [ ] SABnzbd Queue Items: **Pause-Button**, **Resume-Button**, **Delete-Button** pro Item
  - Pause: POST `/api/sabnzbd/pause?id=nzo_id`
  - Resume: POST `/api/sabnzbd/resume?id=nzo_id`
  - Delete: POST `/api/sabnzbd/delete?id=nzo_id` mit Bestätigung
- [ ] Globale SABnzbd-Controls: **Alles pausieren**, **Alles fortsetzen**
- [ ] Radarr/Sonarr/Lidarr Queue-Items: **Grab-Button**, **Remove-Button**
- [ ] Download-Fortschritt live via Socket.io (bereits teilweise vorhanden, vervollständigen)

---

### 10.8 – Kalender – Klickbar + Detail-Popups

**Datei:** `packages/client/src/views/CalendarView.vue`

- [ ] Kalender-Events klickbar → navigiert zu entsprechender Detail-Seite
- [ ] Hover-Tooltip pro Event mit Mini-Infos
- [ ] Verschiedene Farben pro Typ (Radarr=orange, Sonarr=blau, Lidarr=grün)
- [ ] Wechsel zwischen Monats-/Wochen-Ansicht
- [ ] „Heute"-Button zum Zurückspringen

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

- [ ] Filter-Tabs: Alle | Kritisch (≥8) | Wichtig (≥5) | Info (<5)
- [ ] Als gelesen markieren (Store-Update)
- [ ] Nachrichten-Badge in Sidebar (bereits vorhanden, sicherstellen dass er korrekt zählt)

---

### 10.14 – Settings Polish

**Datei:** `packages/client/src/views/SettingsView.vue`

- [ ] Connection-Test-Button pro Integration (testet ob API erreichbar, zeigt ✓/✗)
- [ ] Alle 11 Integrationen vollständig konfigurierbar (URL + API-Key)
- [ ] Speichern-Feedback (Toast)

---

## Reihenfolge der Implementierung (empfohlen)

```
10.A1 → 10.A2 → 10.A3 (Backend alle drei auf einmal – kein Frontend-Test nötig)
10.A4 → 10.A5            (Bazarr + Tautulli Backend)
10.B1 → 10.B2            (Shared Components bauen)
10.3                     (MovieDetailView vollständig)
10.5                     (SeriesDetailView vollständig)
10.6                     (MusicView + ArtistDetailView)
10.7 → 10.8 → 10.9      (Downloads, Kalender, Suche)
10.10 → 10.11 → 10.12   (Tautulli, Overseerr, ABS)
10.13 → 10.14            (Gotify, Settings)
```

---

## Status Phase 10

- [x] 10.1 – Dashboard: Health-Bar, Stats-Cards, Zuletzt hinzugefügt, Downloads, Releases, Streams, Gotify/Overseerr/Plex/ABS Widgets, Tautulli History
- [x] 10.2 – MoviesView: Alpha-Gruppen, Alphabet-Nav, Bibliotheks-Filter, Hover-Tooltip, Rating unten, Status-Dot, Quality-Badge
- [ ] **10.A1** – Radarr Backend: PUT/DELETE movie, command, release, credits
- [ ] **10.A2** – Sonarr Backend: PUT/DELETE series, command, release, episodefile, episode, season-monitor
- [ ] **10.A3** – Lidarr Backend: albums?artistId, tracks, PUT album, command, DELETE artist
- [ ] **10.A4** – Bazarr Backend: movie/full, episodes, search/movie, search/episode
- [ ] **10.A5** – Tautulli Backend: movie-history, user-stats, metadata
- [ ] **10.B1** – InteractiveSearchModal.vue (gemeinsame Komponente)
- [ ] **10.B2** – ConfirmDialog.vue (gemeinsame Komponente)
- [ ] **10.3** – MovieDetailView: Action-Bar, alle Detail-Felder, Bazarr-Widget, Tautulli-Tab, Interactive Search
- [ ] 10.4 – SeriesView ✅ (bereits erledigt)
- [ ] **10.5** – SeriesDetailView: Action-Bar, Season-Monitor, Episode-Aktionen (Suche/Löschen/Monitor/Bazarr), Batch-System, Interactive Search
- [ ] **10.6a** – MusicView: Alpha-Gruppen, Filter, Hover-Tooltip
- [ ] **10.6b** – ArtistDetailView: Action-Bar, Artist-Links, Album-Suche, Album-Monitor, Track-Quality
- [ ] **10.7** – Downloads: Pause/Resume/Delete pro Item
- [ ] **10.8** – Kalender: klickbar, Hover-Tooltip, Wochen-Ansicht
- [ ] **10.9** – Suche: Bibliotheks-Suche verbessern
- [ ] **10.10** – TautulliView: Charts, Top-10, Timeline
- [ ] **10.11** – OverseerrView: Request-Details, Approve/Decline
- [ ] **10.12** – ABS Detail-Ansicht
- [ ] **10.13** – GotifyView: Prioritäten-Filter
- [ ] **10.14** – Settings: Connection-Test, vollständige Konfiguration

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

## Was Claude Code IMMER als erstes tun soll

1. `.ai/CONTEXT.md` lesen
2. `.ai/LESSONS.md` lesen
3. `.ai/CONVENTIONS.md` lesen
4. Bei neuen Integrationen: `.ai/INTEGRATIONS.md` lesen
