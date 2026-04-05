# nexarr AI – Vollständige Tool-Liste
> Erstellt: 04.04.2026 · Alles was technisch möglich ist
> Für Claude Code: Diese Datei definiert ALLE Tools die implementiert werden sollen.
> Status: ✅ = existiert | ❌ = fehlt (Service existiert) | 🆕 = neues Feature | 🔬 = experimentell

---

## Übersicht

| Kategorie | ✅ | ❌ | 🆕 | 🔬 | Gesamt |
|-----------|-----|-----|-----|-----|--------|
| Filme (Radarr + TMDB) | 4 | 8 | 2 | 2 | 16 |
| Serien (Sonarr + TMDB) | 4 | 9 | 1 | 1 | 15 |
| Musik (Lidarr) | 1 | 4 | 0 | 0 | 5 |
| Downloads | 3 | 4 | 0 | 0 | 7 |
| Untertitel (Bazarr) | 0 | 3 | 0 | 0 | 3 |
| Streams & Plex | 2 | 3 | 1 | 1 | 7 |
| Tautulli Analytics | 0 | 0 | 8 | 0 | 8 |
| Kalender & Discover | 2 | 3 | 0 | 0 | 5 |
| Overseerr & System | 4 | 1 | 0 | 0 | 5 |
| Indexer (Prowlarr) | 1 | 1 | 0 | 0 | 2 |
| Audiobookshelf | 0 | 3 | 0 | 0 | 3 |
| Benachrichtigungen (Gotify) | 0 | 2 | 0 | 0 | 2 |
| UI Navigation | 0 | 0 | 3 | 0 | 3 |
| Rich Media (Chat-Cards) | 0 | 0 | 6 | 0 | 6 |
| Smart/AI Features | 0 | 0 | 5 | 0 | 5 |
| Cross-Service Intelligence | 0 | 0 | 0 | 7 | 7 |
| Automation & Workflows | 0 | 0 | 0 | 5 | 5 |
| Vision (gemma3:27b) | 0 | 0 | 0 | 3 | 3 |
| **Gesamt** | **21** | **41** | **26** | **19** | **107** |

---

## 🎬 Filme (Radarr + TMDB) — 16 Tools

### Vorhanden (4)
- ✅ `movies_search` – Suche in lokaler Bibliothek
- ✅ `movies_lookup` – TMDB-Suche zum Hinzufügen
- ✅ `movies_add` – Film zu Radarr hinzufügen
- ✅ `movies_details` – Film-Details aus Radarr

### Fehlend – Service existiert (8)
- ❌ `movies_delete` – Film aus Bibliothek entfernen + optional Dateien löschen
  → `radarr.deleteMovie(id, deleteFiles)` existiert
- ❌ `movies_trigger_search` – Radarr-Suche erneut starten für einen Film
  → `radarr.triggerSearch([movieId])` existiert
- ❌ `movies_interactive_search` – Releases finden für manuellen Download
  → `radarr.getReleases(movieId)` existiert (bis 60s Timeout)
- ❌ `movies_grab_release` – Spezifisches Release herunterladen
  → `radarr.downloadRelease({guid, indexerId})` existiert
- ❌ `movies_missing` – Alle fehlenden/gesuchten Filme auflisten
  → `radarr.getMissingMovies()` existiert
- ❌ `movies_history` – Radarr Event-History (Grabs, Imports, Fehler)
  → `radarr.getHistory()` existiert
- ❌ `movies_update` – Film bearbeiten: Monitoring, Qualitätsprofil, Tags
  → `radarr.updateMovie(id, body)` existiert
- ❌ `movies_tmdb_rich` – Reichere TMDB-Infos mit Poster-URL, Cast, Trailer-Links, Similar
  → `tmdb.getMovieDetails()`, `tmdb.getMovieCredits()`, `tmdb.getMovieVideos()`, `tmdb.getSimilarMovies()` existieren alle

### Neu (2)
- 🆕 `movies_recommendations` – "Empfiehl mir was Ähnliches wie X"
  → Kombiniert `tmdb.getSimilarMovies()` + Library-Check (schon vorhanden?) + User-Memories
- 🆕 `movies_quality_profiles` – Qualitätsprofile auflisten zur Auswahl
  → `radarr.getQualityProfiles()` existiert

### Experimentell (2)
- 🔬 `movies_batch_add` – Mehrere Filme auf einmal hinzufügen ("Füg mir alle Marvel-Filme hinzu")
  → Kombination aus TMDB Collection API + movies_add in Schleife
- 🔬 `movies_upgrade_check` – Prüfe welche Filme ein Qualitäts-Upgrade bekommen könnten
  → Vergleiche hasFile-Qualität mit verfügbaren Releases

---

## 📺 Serien (Sonarr + TMDB) — 15 Tools

### Vorhanden (4)
- ✅ `series_search` – Suche in lokaler Bibliothek
- ✅ `series_lookup` – TVDB/TMDB-Suche zum Hinzufügen
- ✅ `series_add` – Serie zu Sonarr hinzufügen
- ✅ `series_details` – Serien-Details

### Fehlend – Service existiert (9)
- ❌ `series_delete` – Serie entfernen
  → `sonarr.deleteSeries(id, deleteFiles)` existiert
- ❌ `series_episodes` – Episoden einer Staffel auflisten (welche fehlen, welche vorhanden)
  → `sonarr.getEpisodes(seriesId)` existiert
- ❌ `series_trigger_search` – Sonarr-Suche starten für Serie/Staffel
  → `sonarr.triggerSearch(seriesId)` existiert
- ❌ `series_episode_search` – Release-Suche für einzelne Episode
  → `sonarr.getEpisodeReleases(episodeId)` existiert
- ❌ `series_grab_release` – Spezifisches Release grabben
  → `sonarr.downloadRelease({guid, indexerId})` existiert
- ❌ `series_missing` – Fehlende Episoden aller Serien
  → `sonarr.getMissingEpisodes()` existiert
- ❌ `series_history` – Event-History
  → `sonarr.getHistory()` existiert
- ❌ `series_season_monitor` – Staffel-Monitoring an/aus schalten
  → `sonarr.updateSeasonMonitor(seriesId, seasonNumber, monitored)` existiert
- ❌ `series_update` – Serie bearbeiten (Monitoring, Profil)
  → `sonarr.updateSeries(id, body)` existiert

### Neu (1)
- 🆕 `series_tmdb_rich` – Cast, Trailer, Similar, Poster-URL
  → `tmdb.getTvDetails()`, `tmdb.getSeriesCredits()`, `tmdb.getSimilarTv()`, `tmdb.getSeriesVideos()` existieren

### Experimentell (1)
- 🔬 `series_next_episode` – "Wann kommt die nächste Folge von X?"
  → Kombiniert Sonarr-Daten + Kalender-API

---

## 🎵 Musik (Lidarr) — 5 Tools

### Vorhanden (1)
- ✅ `music_search` – Suche in lokaler Bibliothek

### Fehlend (4)
- ❌ `music_lookup` – Lidarr-Suche zum Hinzufügen
- ❌ `music_add` – Künstler zu Lidarr hinzufügen
- ❌ `music_details` – Künstler-Details + Alben-Liste
- ❌ `music_trigger_search` – Lidarr-Suche starten

---

## 📥 Downloads (SABnzbd + Transmission) — 7 Tools

### Vorhanden (3)
- ✅ `downloads_status` – Aktuelle Queue + Speed
- ✅ `downloads_pause` – Alle Downloads eines Downloaders pausieren
- ✅ `downloads_resume` – Downloads fortsetzen

### Fehlend (4)
- ❌ `downloads_pause_single` – Einzelnen Download pausieren/fortsetzen
  → SABnzbd: `pause(nzoId)` / Transmission: `pauseTorrent(hash)`
- ❌ `downloads_delete` – Download aus Queue entfernen
  → SABnzbd: `deleteSlot(nzoId)` / Transmission: `deleteTorrent(hash)`
- ❌ `downloads_priority` – Priorität ändern oder nach oben schieben
  → `sabnzbd.setPriority(nzoId, priority)`, `sabnzbd.moveToTop(nzoId)` existieren
- ❌ `downloads_speed_limit` – Geschwindigkeitslimit setzen/aufheben
  → SABnzbd API unterstützt `speedlimit` Parameter

---

## 🔤 Untertitel (Bazarr) — 3 Tools

### Fehlend – Service komplett vorhanden (3)
- ❌ `subtitles_movie_status` – Untertitel-Status für einen Film (vorhanden + fehlend)
  → `bazarr.getMovieSubtitlesFull(radarrId)` existiert
- ❌ `subtitles_series_status` – Untertitel für alle Episoden einer Serie
  → `bazarr.getEpisodeSubtitlesBySeries(sonarrSeriesId)` existiert
- ❌ `subtitles_search` – Untertitel-Suche auslösen
  → `bazarr.searchMovieSubtitles(radarrId)`, `bazarr.searchEpisodeSubtitles(episodeId)` existieren

---

## 📡 Streams & Plex — 7 Tools

### Vorhanden (2)
- ✅ `streams_active` – Aktuelle Plex-Streams
- ✅ `streams_history` – Letzte Wiedergaben

### Fehlend (3)
- ❌ `plex_libraries` – Plex-Bibliotheken auflisten
  → `plex.getLibraries()` existiert
- ❌ `plex_deeplink` – Deep-Link zu Plex Web generieren
  → `plex.buildDeepLink()` existiert – User klickt Link → öffnet Film in Plex
- ❌ `plex_status` – Plex Server-Status
  → `plex.getStatus()` existiert

### Neu (1)
- 🆕 `plex_play` – Film/Serie direkt in Plex abspielen (auf bestimmtem Client)
  → Plex Remote Control API: `/player/playback/playMedia`

### Experimentell (1)
- 🔬 `plex_kill_stream` – Laufenden Stream beenden (z.B. bei unautorisiertem Zugriff)
  → Tautulli API: `terminate_session`

---

## 📊 Tautulli Analytics — 8 Tools (ALLE NEU)

Tautulli hat eine riesige API die nexarr AI bisher gar nicht nutzt:

- 🆕 `analytics_most_watched` – Meistgeschaute Filme/Serien (Top 10/25)
  → Tautulli API: `get_home_stats` (most_watched, most_popular)
- 🆕 `analytics_user_stats` – Watch-Statistiken pro User (Stunden, Plays)
  → Tautulli API: `get_user_watch_time_stats`, `get_user_player_stats`
- 🆕 `analytics_library_stats` – Bibliotheks-Statistiken (Größe, Plays, Last Watched)
  → Tautulli API: `get_library_watch_time_stats`, `get_libraries_table`
- 🆕 `analytics_recently_added` – Kürzlich hinzugefügte Medien
  → Tautulli API: `get_recently_added`
- 🆕 `analytics_watch_time_trend` – Watch-Time Trend (pro Tag/Woche/Monat)
  → Tautulli API: `get_plays_by_date`, `get_plays_by_dayofweek`, `get_plays_by_hourofday`
- 🆕 `analytics_transcode_stats` – Transcode-Statistiken (Direct Play vs. Transcode)
  → Tautulli API: `get_plays_by_stream_type`, `get_stream_type_by_top_10_platforms`
- 🆕 `analytics_concurrent_streams` – Parallele Streams (Peak)
  → Tautulli API: `get_stream_data` aggregiert
- 🆕 `analytics_user_history` – Detaillierte Watch-History eines Users
  → Tautulli API: `get_history` mit user_id Filter

---

## 📅 Kalender & Discover — 5 Tools

### Vorhanden (2)
- ✅ `calendar_upcoming` – Kommende Releases
- ✅ `discover_trending` – TMDB Trending

### Fehlend (3)
- ❌ `discover_by_genre` – TMDB Discover mit Genre/Rating/Jahr Filter
  → `tmdb.discover(type, {genre, min_rating, sort_by})` existiert
- ❌ `discover_similar` – Ähnliche Titel basierend auf einem Film/Serie
  → `tmdb.getSimilarMovies(tmdbId)`, `tmdb.getSimilarTv(tmdbId)` existieren
- ❌ `calendar_today` – Was kommt heute (Shortcut)

---

## 📬 Overseerr & System — 5 Tools

### Vorhanden (4)
- ✅ `overseerr_requests` – Offene Anfragen
- ✅ `overseerr_approve` – Anfrage genehmigen
- ✅ `overseerr_decline` – Anfrage ablehnen
- ✅ `stats_overview` – System-Übersicht

### Fehlend (1)
- ❌ `system_health` – Health-Check aller Integrationen
  → `radarr.getHealth()`, `sonarr.getHealth()`, `plex.getStatus()`, `bazarr.getStatus()`, `abs.getStatus()`, `gotify.getHealth()` existieren alle

---

## 🔍 Indexer (Prowlarr) — 2 Tools

### Vorhanden (1)
- ✅ `prowlarr_search` – Release-Suche

### Fehlend (1)
- ❌ `prowlarr_grab` – Release herunterladen
  → `prowlarr.grab(guid, indexerId)` existiert im Service

---

## 📚 Audiobookshelf — 3 Tools

### Fehlend – Service komplett vorhanden (3)
- ❌ `audiobooks_search` – Hörbücher/Podcasts suchen
  → `abs.searchItems(libraryId, query)` existiert
- ❌ `audiobooks_details` – Hörbuch-Details + Hörfortschritt
  → `abs.getItem(itemId)`, `abs.getProgress(itemId)` existieren
- ❌ `audiobooks_libraries` – ABS Bibliotheken auflisten
  → `abs.getLibraries()` existiert

---

## 🔔 Benachrichtigungen (Gotify) — 2 Tools

### Fehlend (2)
- ❌ `notifications_list` – Letzte Benachrichtigungen anzeigen
  → `gotify.getMessages()` existiert
- ❌ `notifications_clear` – Benachrichtigung(en) löschen
  → `gotify.deleteMessage(id)`, `gotify.deleteAllMessages()` existieren

---

## 🧭 UI Navigation — 3 Tools (ALLE NEU)

> Konzept: AI sendet Socket.io Event → Frontend fängt es ab → Vue Router navigiert

- 🆕 `navigate_to` – User zu beliebiger nexarr-View navigieren
  → Socket.io Event `ai:navigate` → `router.push(path)`
  → Erlaubte Pfade: /dashboard, /movies, /movies/:id, /series, /series/:id, /music, /music/:id, /downloads, /calendar, /discover, /streams, /indexer, /overseerr, /audiobookshelf, /gotify, /settings, /search
- 🆕 `navigate_to_external` – Externen Link in neuem Tab öffnen
  → Plex Deep-Link, TMDB-Seite, Trailer (YouTube)
  → Socket.io Event `ai:open_url` → `window.open(url, '_blank')`
- 🆕 `navigate_search` – SearchView mit vorgefülltem Suchbegriff öffnen
  → `router.push({ name: 'search', query: { q: 'term' } })`

---

## 🖼️ Rich Media im Chat — 6 Tools (ALLE NEU)

> Konzept: Tool gibt strukturierte Daten zurück → Frontend rendert spezielle Cards statt Text

- 🆕 `show_poster_card` – Film/Serien-Card mit Poster, Rating, Jahr, Genre, Badges
  → TMDB Poster-URL: `https://image.tmdb.org/t/p/w342/{poster_path}`
  → Click → navigiert zur Detail-View oder Plex-Link
- 🆕 `show_media_carousel` – Horizontaler Slider mit mehreren Poster-Cards
  → Für Trending, Similar, Empfehlungen, Suchergebnisse
  → Swipeable, mit "Alle anzeigen" Button
- 🆕 `show_download_card` – Download mit Fortschrittsbalken, Speed, ETA
  → Live-Update via Socket.io (Progress-Bar animiert)
- 🆕 `show_stream_card` – Aktiver Stream: User-Avatar, Poster, Quality-Badges, Progress
  → Direct Play/Transcode Badge, Bandwidth, Player-Info
- 🆕 `show_calendar_preview` – Kompakte Wochenvorschau im Chat
  → Mini-Kalender mit Poster-Thumbnails pro Tag
- 🆕 `show_action_buttons` – Interaktive Buttons im Chat
  → z.B. "Hinzufügen" / "In Plex öffnen" / "Ähnliche finden"
  → Button-Click sendet via Socket.io neuen Tool-Call

---

## 🧠 Smarte AI Features — 5 Tools (ALLE NEU)

- 🆕 `recommend` – Intelligente Empfehlung basierend auf Kontext
  → Analysiert: Library-Profil + Memories + Stimmung + Watch-History
  → Output: Poster-Card(s) mit Begründung warum gerade dieser Film
  → Kann Genre, Stimmung, Laufzeit-Budget berücksichtigen
- 🆕 `build_watchlist` – Kuratierte Watch-Session erstellen
  → Input: Zeitbudget ("3 Stunden") + Stimmung/Genre
  → Output: Sortierte Liste mit Laufzeiten, Poster, "Gesamtdauer: Xh Ym"
- 🆕 `library_report` – Bibliotheks-Report generieren
  → Genre-Verteilung, Qualitäts-Verteilung, Speicherplatz, Top-Rated, kürzlich hinzugefügt
  → Als Rich-Card im Chat mit Mini-Charts
- 🆕 `what_to_watch` – "Was soll ich schauen?"
  → Berücksichtigt: ungesehene Filme, Tageszeit, Wochentag, letzte Watchlist, Stimmung
  → Personalisiert via User-Memories
- 🆕 `media_quiz` – Film/Serien-Quiz ("Rate den Film anhand der Beschreibung")
  → Fun-Feature, nutzt TMDB-Daten, lernt Vorlieben

---

## 🔗 Cross-Service Intelligence — 7 Tools (EXPERIMENTELL)

> Tools die Daten aus mehreren Services kombinieren

- 🔬 `cross_actor_search` – "Welche Filme mit [Actor] habe ich?"
  → TMDB Credits API + Radarr-Bibliothek matchen
- 🔬 `cross_duplicate_check` – Doppelte Medien in der Bibliothek finden
  → Vergleiche Radarr-Movies vs. Plex-Library (TMDB-ID Matching)
- 🔬 `cross_quality_audit` – Qualitäts-Audit: welche Filme haben nur SD/720p?
  → Radarr movieFile.quality + TMDB Daten (ist 4K verfügbar?)
- 🔬 `cross_space_analyzer` – Speicherplatz-Analyse
  → Radarr Root-Folders (freeSpace) + größte Dateien + Platz pro Genre
  → "Du könntest 200 GB sparen wenn du diese 5 Filme in HEVC konvertierst"
- 🔬 `cross_watch_unwatched` – Ungesehene Medien finden
  → Tautulli Watch-History vs. Radarr/Sonarr Bibliothek
  → "Du hast 47 Filme die du noch nie geschaut hast"
- 🔬 `cross_subtitle_audit` – Welche Filme/Episoden haben keine deutschen Untertitel?
  → Bazarr missing_subtitles + Radarr/Sonarr Bibliothek
- 🔬 `cross_release_monitor` – Überwache TMDB auf neue Releases von Lieblings-Regisseuren/Actors
  → TMDB Person-API + User-Memories (Lieblingsregisseure)

---

## ⚡ Automation & Workflows — 5 Tools (EXPERIMENTELL)

- 🔬 `auto_quality_upgrade` – "Upgrade alle meine Filme auf 4K"
  → Batch: finde alle Filme mit <4K → setze Qualitätsprofil → trigger Search
- 🔬 `auto_cleanup` – "Räum meine Downloads auf"
  → Finde: fehlgeschlagene Downloads, lange Paused-Jobs → Löschvorschläge
- 🔬 `auto_missing_search` – "Suche nach allen fehlenden Medien"
  → Radarr: MissingMoviesSearch Kommando + Sonarr analog
- 🔬 `proactive_notify` – AI meldet sich proaktiv
  → Background-Worker prüft: Download fertig, Release morgen, Problem erkannt
  → Pusht via Socket.io + optional Gotify/Telegram
- 🔬 `scheduled_task` – "Erinnere mich wenn Staffel 3 von X rauskommt"
  → Speichert Reminder in SQLite → prüft täglich Kalender → benachrichtigt

---

## 👁️ Vision (gemma3:27b) — 3 Tools (EXPERIMENTELL)

- 🔬 `vision_identify_media` – Bild/Screenshot analysieren → Film/Serie erkennen
  → User sendet Foto von Filmplakat/Screenshot → gemma3:27b erkennt → bietet Hinzufügen an
  → Auch via Telegram: Foto schicken → AI erkennt Film
- 🔬 `vision_analyze_poster` – Poster analysieren und ähnliche Filme empfehlen
  → "Zeig mir Filme die visuell so aussehen wie dieses Poster"
  → gemma3:27b beschreibt Stil → TMDB-Suche nach ähnlichen Genres/Stimmungen
- 🔬 `vision_ui_help` – Screenshot von nexarr analysieren → Hilfe geben
  → User schickt Screenshot eines Problems → AI sieht was falsch ist

---

## Implementation-Priorität

### Batch 1: Quick Wins (❌ fehlende Tools verdrahten) — ~2-3 Stunden
Alle ❌-Tools wo der Service schon existiert – nur tools.ts + executor.ts erweitern.
41 Tools, aber viele sind Copy-Paste-Pattern.

### Batch 2: UI Navigation + Rich Cards — ~4-6 Stunden
Socket.io Events für Navigation + AiMessage.vue um Card-Renderer erweitern.
9 Tools, aber Frontend-Arbeit nötig.

### Batch 3: Tautulli Analytics — ~2-3 Stunden
Tautulli-Service um neue Endpoints erweitern + Tool-Definitionen.
8 Tools.

### Batch 4: Smart AI Features — ~3-4 Stunden
Höhere Logik die mehrere Services kombiniert.
5 Tools.

### Batch 5: Cross-Service + Automation — ~4-6 Stunden
Komplexere Logik, Background-Worker, Scheduled Tasks.
12 Tools.

### Batch 6: Vision — ~2-3 Stunden
gemma3:27b Integration, Bild-Upload im Chat.
3 Tools.
