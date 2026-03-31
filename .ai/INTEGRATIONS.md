# nexarr v2 – Integration Reference
> Vollständige API-Dokumentation für alle externen Dienste.
> Claude Code liest diese Datei bevor es einen neuen Service implementiert.
> Zuletzt aktualisiert: v2 Kickoff

---

## Allgemeine Muster

### Auth-Patterns
```typescript
// Radarr / Sonarr / Lidarr / Prowlarr / Overseerr / Bazarr
headers: { 'X-Api-Key': env.RADARR_API_KEY }

// SABnzbd
params: { apikey: env.SABNZBD_API_KEY, output: 'json' }

// Tautulli
params: { apikey: env.TAUTULLI_API_KEY, cmd: 'get_activity' }

// Gotify
headers: { 'X-Gotify-Key': env.GOTIFY_TOKEN }

// Audiobookshelf
headers: { Authorization: `Bearer ${env.ABS_TOKEN}` }

// Plex
params: { 'X-Plex-Token': env.PLEX_TOKEN }

// TMDB
params: { api_key: env.TMDB_API_KEY, language: env.TMDB_LANGUAGE || 'de-DE' }

// Ollama – kein Auth
```

### Timeout-Konvention
```typescript
timeout: 10000   // Standard (10s)
timeout: 15000   // Für langsame Container-zu-Container Calls (ABS)
timeout: 30000   // Für heavy Endpoints (ABS Library Scan)
timeout: 5000    // Für Status-Checks / Health-Checks
```

---

## Radarr
**Farbe:** `#F4A54A` | **URL:** `env.RADARR_URL` | **Version:** v3 API

### Endpoints
```
GET  /api/v3/movie                    → RadarrMovie[]          Cache: COLLECTION
GET  /api/v3/movie/:id                → RadarrMovie            Cache: DETAIL
POST /api/v3/movie                    → RadarrMovie            Invalidiert: radarr_movies
PUT  /api/v3/movie/:id                → RadarrMovie            Invalidiert: radarr_movie_{id}
DELETE /api/v3/movie/:id              → void                   Invalidiert: radarr_movies, radarr_movie_{id}
GET  /api/v3/movie/lookup?term=       → RadarrMovieLookup[]   Kein Cache
GET  /api/v3/qualityprofile           → QualityProfile[]       Cache: STATIC
GET  /api/v3/rootfolder               → RootFolder[]           Cache: STATIC
GET  /api/v3/queue                    → RadarrQueue            Cache: QUEUE
POST /api/v3/command                  → Command (body: {name, movieIds?})
  name: 'MoviesSearch' | 'RefreshMovie' | 'RescanMovie'
GET  /api/v3/history?page=&pageSize=  → RadarrHistory          Cache: HISTORY
GET  /api/v3/system/status            → SystemStatus           Cache: STATIC
```

### Cache-Keys
```
radarr_movies           – Komplette Film-Bibliothek
radarr_movie_{id}       – Einzelner Film
radarr_queue            – Download-Queue
radarr_history          – History
radarr_qualityprofiles  – Qualitätsprofile
radarr_rootfolders      – Root-Folders
radarr_status           – System-Status
```

### Wichtige Hinweise
- `hasFile: true` → Film ist lokal vorhanden
- `movieFile.quality.quality.name` → Qualitäts-String (z.B. "Remux-1080p")
- `movieFile.mediaInfo.videoCodec` → Codec
- Prowlarr-Suche für Filme: `categories=2000`
- Lookup für Hinzufügen: `GET /api/v3/movie/lookup?term=tmdb:{tmdbId}`

---

## Sonarr
**Farbe:** `#35C5F4` | **URL:** `env.SONARR_URL` | **Version:** v3 API

### Endpoints
```
GET  /api/v3/series                   → SonarrSeries[]         Cache: COLLECTION
GET  /api/v3/series/:id               → SonarrSeries           Cache: DETAIL
POST /api/v3/series                   → SonarrSeries           Invalidiert: sonarr_series
PUT  /api/v3/series/:id               → SonarrSeries           Invalidiert: sonarr_series_{id}
DELETE /api/v3/series/:id             → void
GET  /api/v3/series/lookup?term=      → SonarrSeriesLookup[]  Kein Cache
GET  /api/v3/episode?seriesId=        → SonarrEpisode[]        Cache: DETAIL (key: sonarr_episodes_{seriesId})
GET  /api/v3/episode/:id              → SonarrEpisode          Cache: DETAIL
PUT  /api/v3/episode/:id              → SonarrEpisode (Monitor Toggle)
GET  /api/v3/episodefile?seriesId=    → EpisodeFile[]          Cache: DETAIL
DELETE /api/v3/episodefile/:id        → void
GET  /api/v3/season?seriesId=         → Season[]
GET  /api/v3/qualityprofile           → QualityProfile[]       Cache: STATIC
GET  /api/v3/rootfolder               → RootFolder[]           Cache: STATIC
GET  /api/v3/queue                    → SonarrQueue            Cache: QUEUE
POST /api/v3/command                  → Command
  name: 'SeriesSearch' | 'SeasonSearch' | 'EpisodeSearch' | 'RefreshSeries'
  body: { seriesId?, seasonNumber?, episodeIds? }
GET  /api/v3/calendar?start=&end=     → SonarrEpisode[]        Cache: CALENDAR
GET  /api/v3/history?page=&pageSize=  → SonarrHistory          Cache: HISTORY
GET  /api/v3/system/status            → SystemStatus           Cache: STATIC
```

### Cache-Keys
```
sonarr_series              – Komplette Serien-Bibliothek
sonarr_series_{id}         – Einzelne Serie
sonarr_episodes_{seriesId} – Episoden einer Serie (heavy! bis 1000 Einträge)
sonarr_queue
sonarr_history
sonarr_calendar_{start}_{end}
sonarr_qualityprofiles
sonarr_rootfolders
sonarr_status
```

### Wichtige Hinweise
- Episodes Endpoint: KEIN Paginierungs-Problem bei pageSize=1000 (Sonarr gibt alle zurück)
- Monitor-Typen beim Hinzufügen: `'all' | 'future' | 'missing' | 'existing' | 'none'`
- `statistics.percentOfEpisodes` → Prozent der verfügbaren Episoden
- Prowlarr-Suche für Serien: `categories=5000`
- Lookup: `GET /api/v3/series/lookup?term=tvdb:{tvdbId}`

---

## Lidarr
**Farbe:** `#22C65B` | **URL:** `env.LIDARR_URL` | **Version:** v1 API

### Endpoints
```
GET  /api/v1/artist                   → LidarrArtist[]         Cache: COLLECTION
GET  /api/v1/artist/:id               → LidarrArtist           Cache: DETAIL
POST /api/v1/artist                   → LidarrArtist           Invalidiert: lidarr_artists
GET  /api/v1/artist/lookup?term=      → LidarrArtistLookup[]  Kein Cache
GET  /api/v1/album?artistId=          → LidarrAlbum[]          Cache: DETAIL
GET  /api/v1/album/:id                → LidarrAlbum            Cache: DETAIL
GET  /api/v1/track?albumId=           → LidarrTrack[]          Cache: DETAIL
GET  /api/v1/qualityprofile           → QualityProfile[]       Cache: STATIC
GET  /api/v1/rootfolder               → RootFolder[]           Cache: STATIC
GET  /api/v1/queue                    → LidarrQueue            Cache: QUEUE
POST /api/v1/command                  → Command
  name: 'ArtistSearch' | 'AlbumSearch' | 'RefreshArtist'
GET  /api/v1/calendar?start=&end=     → LidarrAlbum[]          Cache: CALENDAR
GET  /api/v1/system/status            → SystemStatus           Cache: STATIC
```

### Cache-Keys
```
lidarr_artists
lidarr_artist_{id}
lidarr_albums_{artistId}
lidarr_tracks_{albumId}
lidarr_queue
lidarr_calendar_{start}_{end}
lidarr_qualityprofiles
lidarr_rootfolders
lidarr_status
```

### Wichtige Hinweise
- Prowlarr-Suche für Musik: `categories=6000`
- Artist Lookup: `GET /api/v1/artist/lookup?term=lidarr:{mbId}` oder Freitext

---

## Prowlarr
**Farbe:** `#FF7F50` | **URL:** `env.PROWLARR_URL` | **Version:** v1 API

### Endpoints
```
GET  /api/v1/indexer                  → ProwlarrIndexer[]      Cache: STATIC
GET  /api/v1/indexer/:id              → ProwlarrIndexer        Cache: STATIC
GET  /api/v1/indexerstats             → IndexerStats           Cache: STATS
GET  /api/v1/search?query=&type=search&categories=  → SearchResult[]  KEIN Cache
  ⚠️  type=search ist PFLICHT ab Prowlarr v2.3 – sonst 400-Fehler
  categories: 2000=Filme, 5000=TV, 6000=Musik
POST /api/v1/release                  → Grab result (Download starten)
  body: { guid, indexerId }
GET  /api/v1/history?page=&pageSize=  → ProwlarrHistory        Cache: HISTORY
GET  /api/v1/system/status            → SystemStatus           Cache: STATIC
```

### Kritische Hinweise
- **`type=search` ist PFLICHT** – fehlt es → Prowlarr antwortet mit 400
- Grab-Endpoint: `POST /api/v1/release` mit `{ guid, indexerId }` aus Search-Result

---

## SABnzbd
**Farbe:** `#F5C518` | **URL:** `env.SABNZBD_URL`

### Endpoints
```
Alle Calls: GET /api?output=json&apikey={KEY}&mode={MODE}

mode=queue                → SABQueue (aktive Downloads)
mode=history&limit=50     → SABHistory
mode=speedlimit&value={x} → Speed-Limit setzen (x in %)
mode=pause                → Pause
mode=resume               → Resume
mode=delete&id={nzo_id}&del_files=1 → Löschen
mode=get_config           → Volle Konfiguration (inkl. Kategorien)
```

### Cache-Keys
```
sabnzbd_queue    – TTL: QUEUE (12s)
sabnzbd_history  – TTL: HISTORY
sabnzbd_status   – TTL: STATS
```

### Wichtige Hinweise
- Speed in MB/s aus `kbpersec / 1024` berechnen
- Queue-Status über Socket.io pushen (nicht SSE)

---

## Tautulli
**Farbe:** `#E5C06D` | **URL:** `env.TAUTULLI_URL`

### Endpoints
```
Alle Calls: GET /api/v2?apikey={KEY}&cmd={CMD}

cmd=get_activity                     → Live Streams
cmd=get_home_stats&time_range=30     → Home Stats
cmd=get_plays_per_day&time_range=30  → Wiedergaben pro Tag
cmd=get_top_movies&count=10          → Top Filme
cmd=get_top_tv&count=10              → Top Serien
cmd=get_top_music&count=10           → Top Musik
cmd=get_top_users&count=10           → Top User
cmd=get_plays_by_hourofday           → Plays nach Uhrzeit
cmd=get_plays_by_dayofweek           → Plays nach Wochentag
cmd=get_history&length=50            → Wiedergabe-History
cmd=get_libraries_table              → Bibliotheken mit Stats
cmd=get_user_player_stats&user_id=   → Player Stats per User
cmd=get_stream_data&session_key=     → Stream Details
```

### Cache-Keys
```
tautulli_activity        – TTL: LIVE (4s), Socket.io Push
tautulli_home_stats      – TTL: STATS
tautulli_top_movies      – TTL: STATS
tautulli_top_series      – TTL: STATS
tautulli_top_users       – TTL: STATS
tautulli_plays_per_day   – TTL: STATS
tautulli_plays_by_hour   – TTL: STATS
tautulli_plays_by_dow    – TTL: STATS
tautulli_history         – TTL: HISTORY
tautulli_libraries       – TTL: COLLECTION
```

---

## Overseerr
**Farbe:** `#7C4DFF` | **URL:** `env.OVERSEERR_URL` | **Auth:** X-Api-Key Header

### Endpoints
```
GET  /api/v1/request?take=20&skip=0&filter=pending → RequestList  Cache: STATS
GET  /api/v1/request/:id               → Request              Cache: DETAIL
POST /api/v1/request/:id/approve       → void                 Invalidiert: overseerr_requests
POST /api/v1/request/:id/decline       → void                 Invalidiert: overseerr_requests
DELETE /api/v1/request/:id             → void                 Invalidiert: overseerr_requests
GET  /api/v1/movie/:tmdbId             → OverseerrMovie
GET  /api/v1/tv/:tmdbId                → OverseerrSeries
GET  /api/v1/status                    → SystemStatus         Cache: STATIC
```

### Cache-Keys
```
overseerr_requests        – Pending Requests
overseerr_request_{id}    – Einzelner Request
```

---

## Bazarr
**Farbe:** `#A78BFA` | **URL:** `env.BAZARR_URL` | **Auth:** X-Api-Key Header

### Endpoints
```
GET  /api/movies?start=0&length=50    → BazarrMovies           Cache: COLLECTION
GET  /api/episodes?seriesid[]={id}    → BazarrEpisodes         Cache: DETAIL
GET  /api/subtitles?radarr_id={id}    → Subtitle[]             Cache: DETAIL
GET  /api/subtitles?sonarr_episode_id={id} → Subtitle[]
POST /api/subtitles/movies?radarr_id={id}&language={lang} → Suche starten
POST /api/subtitles/episodes?sonarr_episode_id={id}&language={lang}
DELETE /api/subtitles/movies?radarr_id={id}&language={lang}&path={path}
GET  /api/wanted/movies               → Wanted Movies          Cache: STATS
GET  /api/wanted/episodes             → Wanted Episodes        Cache: STATS
GET  /api/history/movies?start=0&length=20 → History          Cache: HISTORY
GET  /api/system/status               → SystemStatus           Cache: STATIC
```

### Cache-Keys
```
bazarr_movies
bazarr_episodes_{seriesId}
bazarr_subs_movie_{radarrId}
bazarr_subs_episode_{episodeId}
bazarr_wanted_movies
bazarr_wanted_episodes
bazarr_status
```

---

## Gotify
**Farbe:** `#0060A8` | **URL:** `env.GOTIFY_URL` | **Auth:** X-Gotify-Key (App-Token)

### Endpoints
```
GET  /message?limit=20                → GotifyMessage[]        Cache: STATS
POST /message                         → GotifyMessage (senden)
  body: { title, message, priority? }  priority: 1-10
DELETE /message/{id}                  → void
GET  /application                     → Application[]          Cache: STATIC
GET  /client                          → Client[]               Cache: STATIC
GET  /health                          → { health: 'green' }    Cache: STATIC
```

### Hinweise
- App-Token: für senden (GOTIFY_TOKEN)
- Client-Token: für lesen (wenn separiert)
- Priority 5+ = High Priority Notification in Gotify App

---

## TMDB
**Farbe:** `#01B4E4` | **Base:** `https://api.themoviedb.org/3`

### Endpoints
```
GET  /movie/{id}                      → TMDBMovie              Cache: DETAIL
GET  /movie/{id}/credits              → Credits                Cache: DETAIL
GET  /movie/{id}/similar              → Similar[]              Cache: DETAIL
GET  /tv/{id}                         → TMDBSeries             Cache: DETAIL
GET  /trending/movie/week             → Trending[]             Cache: STATS
GET  /trending/tv/week                → Trending[]             Cache: STATS
GET  /genre/movie/list                → Genre[]                Cache: STATIC
GET  /genre/tv/list                   → Genre[]                Cache: STATIC
GET  /discover/movie?with_genres=&vote_average.gte=  → Discover[]  Cache: STATS
GET  /search/movie?query=             → SearchResult[]         Kein Cache
GET  /search/tv?query=                → SearchResult[]         Kein Cache

Image Base URL: https://image.tmdb.org/t/p/
  Poster:  w342, w500, original
  Backdrop: w780, w1280, original
```

### Cache-Keys
```
tmdb_movie_{id}
tmdb_series_{id}
tmdb_trending_movies_{period}   – period: 'day' | 'week'
tmdb_trending_series_{period}
tmdb_discover_movies_{hash}     – hash aus Query-Params
tmdb_genres_movies
tmdb_genres_series
```

---

## Audiobookshelf (ABS)
**Farbe:** `#F0A500` | **URL:** `env.ABS_URL` | **Auth:** Bearer Token

### Endpoints
```
GET  /api/libraries                   → Library[]              Cache: STATIC
GET  /api/libraries/{id}/items?limit=50  → LibraryItem[]       Cache: COLLECTION
GET  /api/items/{id}                  → LibraryItem            Cache: DETAIL
GET  /api/items/{id}/chapters         → Chapter[]              Cache: DETAIL
GET  /api/podcasts/{id}               → Podcast                Cache: DETAIL
GET  /api/podcasts/{id}/episodes      → Episode[]              Cache: COLLECTION
GET  /api/me/progress/{id}            → Progress               Cache: DETAIL
GET  /api/me/listening-sessions       → Session[]              Cache: HISTORY
POST /api/items/{id}/play             → PlaybackSession (HLS URLs)
PATCH /api/sessions/{id}/sync         → void (Fortschritt speichern)
  body: { currentTime, duration, timeListened }
GET  /api/search?q=                   → SearchResult[]         Kein Cache
```

### Cache-Keys
```
abs_libraries
abs_library_items_{libId}
abs_item_{id}
abs_podcast_{id}
abs_episodes_{podcastId}
abs_progress_{itemId}
```

### Wichtige Hinweise
- Timeout mindestens 15s (Container-to-Container Latenz auf Thor)
- Heavy Endpoints (Library Scan): 30s Timeout
- HLS-Streaming: `POST /api/items/{id}/play` gibt `playbackSession.audioTracks` zurück
- MP3-Direct für Podcasts bevorzugt (kein HLS nötig)
- Fortschritt sync: alle 30s oder bei Pause

---

## Ollama
**URL:** `env.OLLAMA_URL` | **Kein Auth**

### Endpoints
```
GET  /api/tags                        → { models: OllamaModel[] }   Cache: STATIC
POST /api/chat                        → Streaming Response (NDJSON)
  body: {
    model: env.OLLAMA_MODEL,
    messages: Message[],
    stream: true,
    tools?: Tool[]      // Function Calling
  }
POST /api/generate                    → Streaming (für simple Completions)
GET  /api/ps                          → Laufende Modelle
```

### Hinweise
- Standard-Modell: `qwen3:32b` (Odin, 96GB VRAM)
- Streaming: NDJSON – jede Zeile ist ein JSON-Objekt
- Function Calling: `tools` Array mit OpenAI-kompatiblem Format
- Kein Cache für Chat-Responses

---

## Plex (optional)
**Farbe:** `#E5A00D` | **URL:** `env.PLEX_URL` | **Auth:** X-Plex-Token (URL-Param)

### Endpoints
```
GET  /?X-Plex-Token=                  → Server Info           Cache: STATIC
GET  /status/sessions?X-Plex-Token=   → Active Sessions       Cache: LIVE
GET  /library/sections?X-Plex-Token=  → Libraries             Cache: STATIC
GET  /hubs/home?X-Plex-Token=         → Recent + Recommended  Cache: STATS
```

---

## Socket.io Events (Vollständige Referenz)

```typescript
// packages/shared/src/types/socket.ts

// Server → Client
'queue:update'          payload: QueueState         // alle 3s
'activity:update'       payload: ActivityState      // alle 2s
'download:complete'     payload: DownloadEvent      // on event
'download:failed'       payload: DownloadEvent      // on event
'notification:new'      payload: Notification       // on event
'stream:update'         payload: StreamState        // alle 5s
'cache:invalidated'     payload: { key: string }    // nach Mutations
'system:status'         payload: SystemHealth       // alle 30s

// Client → Server
'queue:subscribe'       // Client möchte Queue-Updates
'queue:unsubscribe'     // Client möchte keine Updates mehr
'stream:subscribe'
'stream:unsubscribe'
```

---

## Integration hinzufügen – Checkliste

Wenn eine neue Integration implementiert wird:

1. `.env.example` um neue Keys ergänzen
2. `packages/server/src/config/env.ts` Zod-Schema ergänzen
3. `packages/shared/src/types/integrations.ts` Types hinzufügen
4. `packages/server/src/services/{name}.service.ts` erstellen
5. `packages/server/src/routes/{name}.routes.ts` erstellen
6. Router in `packages/server/src/app.ts` registrieren
7. Cache-Wellen in `packages/server/src/cache/waves.ts` ergänzen
8. Diese Datei (INTEGRATIONS.md) aktualisieren
9. `npx tsc --noEmit` – muss fehlerfrei sein
