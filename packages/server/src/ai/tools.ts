import type { OllamaTool } from './ai.service.js';

// ── nexarr Tool-Registry ─────────────────────────────────────────────────────
// Jedes Tool wird als JSON-Schema an Ollama übergeben.
// Der LLM entscheidet autonom welches Tool für die User-Anfrage relevant ist.

// ── 🎬 Filme ─────────────────────────────────────────────────────────────────

export const moviesSearch: OllamaTool = {
  type: 'function',
  function: {
    name: 'movies_search',
    description: 'Sucht nach Filmen in der lokalen Radarr-Bibliothek. Gibt Titel, Jahr, Qualität, Dateigröße und ob der Film vorhanden ist zurück.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Suchbegriff (Titel oder Teil des Titels)' },
      },
      required: ['query'],
    },
  },
};

export const moviesLookup: OllamaTool = {
  type: 'function',
  function: {
    name: 'movies_lookup',
    description: 'Sucht nach Filmen auf TMDB zum Hinzufügen. Gibt TMDB-ID, Titel, Jahr, Beschreibung zurück. Nutze dies wenn der User einen Film hinzufügen möchte der noch nicht in der Bibliothek ist.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Suchbegriff (Filmtitel)' },
      },
      required: ['query'],
    },
  },
};

export const moviesAdd: OllamaTool = {
  type: 'function',
  function: {
    name: 'movies_add',
    description: 'Fügt einen Film zu Radarr hinzu und startet optional die Suche nach einem Release. DESTRUKTIV: Verändert die Bibliothek.',
    parameters: {
      type: 'object',
      properties: {
        tmdbId: { type: 'number', description: 'TMDB-ID des Films (aus movies_lookup)' },
        searchNow: { type: 'boolean', description: 'Sofort nach Release suchen (Standard: true)' },
      },
      required: ['tmdbId'],
    },
  },
};

export const moviesDetails: OllamaTool = {
  type: 'function',
  function: {
    name: 'movies_details',
    description: 'Gibt detaillierte Infos zu einem Film aus der Bibliothek: Titel, Jahr, Genre, Rating, Qualität, Dateigröße, Pfad.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Radarr-Film-ID' },
      },
      required: ['id'],
    },
  },
};

export const moviesDelete: OllamaTool = {
  type: 'function',
  function: {
    name: 'movies_delete',
    description: 'Entfernt einen Film aus der Radarr-Bibliothek. Optional werden auch die Dateien gelöscht. DESTRUKTIV.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Radarr-Film-ID' },
        deleteFiles: { type: 'boolean', description: 'Auch Dateien auf der Festplatte löschen (Standard: false)' },
      },
      required: ['id'],
    },
  },
};

export const moviesTriggerSearch: OllamaTool = {
  type: 'function',
  function: {
    name: 'movies_trigger_search',
    description: 'Startet eine automatische Release-Suche in Radarr für einen bestimmten Film.',
    parameters: {
      type: 'object',
      properties: {
        movieId: { type: 'number', description: 'Radarr-Film-ID' },
      },
      required: ['movieId'],
    },
  },
};

export const moviesInteractiveSearch: OllamaTool = {
  type: 'function',
  function: {
    name: 'movies_interactive_search',
    description: 'Findet verfügbare Releases für einen Film (interaktive Suche). Gibt Indexer, Größe, Qualität, Seeders zurück. Kann bis zu 60 Sekunden dauern.',
    parameters: {
      type: 'object',
      properties: {
        movieId: { type: 'number', description: 'Radarr-Film-ID' },
      },
      required: ['movieId'],
    },
  },
};

export const moviesGrabRelease: OllamaTool = {
  type: 'function',
  function: {
    name: 'movies_grab_release',
    description: 'Lädt ein spezifisches Release für einen Film herunter (aus movies_interactive_search). DESTRUKTIV: Startet Download.',
    parameters: {
      type: 'object',
      properties: {
        guid: { type: 'string', description: 'Release-GUID (aus interactive_search)' },
        indexerId: { type: 'number', description: 'Indexer-ID (aus interactive_search)' },
      },
      required: ['guid', 'indexerId'],
    },
  },
};

export const moviesMissing: OllamaTool = {
  type: 'function',
  function: {
    name: 'movies_missing',
    description: 'Listet alle fehlenden Filme auf (in der Bibliothek, aber ohne Datei).',
    parameters: { type: 'object', properties: {} },
  },
};

export const moviesHistory: OllamaTool = {
  type: 'function',
  function: {
    name: 'movies_history',
    description: 'Zeigt die Radarr Event-History: Grabs, Imports, Fehlschläge.',
    parameters: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Anzahl Einträge (Standard: 20)' },
      },
    },
  },
};

export const moviesUpdate: OllamaTool = {
  type: 'function',
  function: {
    name: 'movies_update',
    description: 'Bearbeitet einen Film: Monitoring an/aus, Qualitätsprofil ändern. DESTRUKTIV.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Radarr-Film-ID' },
        monitored: { type: 'boolean', description: 'Monitoring aktivieren/deaktivieren' },
        qualityProfileId: { type: 'number', description: 'Neue Qualitätsprofil-ID' },
      },
      required: ['id'],
    },
  },
};

export const moviesTmdbRich: OllamaTool = {
  type: 'function',
  function: {
    name: 'movies_tmdb_rich',
    description: 'Holt reichhaltige TMDB-Infos: Poster-URL, Cast, Regisseur, Trailer-Links, ähnliche Filme.',
    parameters: {
      type: 'object',
      properties: {
        tmdbId: { type: 'number', description: 'TMDB-ID des Films' },
      },
      required: ['tmdbId'],
    },
  },
};

export const moviesQualityProfiles: OllamaTool = {
  type: 'function',
  function: {
    name: 'movies_quality_profiles',
    description: 'Listet alle verfügbaren Qualitätsprofile in Radarr auf.',
    parameters: { type: 'object', properties: {} },
  },
};

// ── 📺 Serien ────────────────────────────────────────────────────────────────

export const seriesSearch: OllamaTool = {
  type: 'function',
  function: {
    name: 'series_search',
    description: 'Sucht nach Serien in der lokalen Sonarr-Bibliothek.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Suchbegriff (Serientitel)' },
      },
      required: ['query'],
    },
  },
};

export const seriesLookup: OllamaTool = {
  type: 'function',
  function: {
    name: 'series_lookup',
    description: 'Sucht nach Serien auf TheTVDB/TMDB zum Hinzufügen.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Suchbegriff (Serientitel)' },
      },
      required: ['query'],
    },
  },
};

export const seriesAdd: OllamaTool = {
  type: 'function',
  function: {
    name: 'series_add',
    description: 'Fügt eine Serie zu Sonarr hinzu. DESTRUKTIV: Verändert die Bibliothek.',
    parameters: {
      type: 'object',
      properties: {
        tvdbId: { type: 'number', description: 'TVDB-ID der Serie (aus series_lookup)' },
        searchNow: { type: 'boolean', description: 'Sofort nach Releases suchen (Standard: true)' },
      },
      required: ['tvdbId'],
    },
  },
};

export const seriesDetails: OllamaTool = {
  type: 'function',
  function: {
    name: 'series_details',
    description: 'Gibt detaillierte Infos zu einer Serie: Titel, Status, Staffeln, Episodenstatistik.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Sonarr-Serien-ID' },
      },
      required: ['id'],
    },
  },
};

export const seriesDelete: OllamaTool = {
  type: 'function',
  function: {
    name: 'series_delete',
    description: 'Entfernt eine Serie aus der Sonarr-Bibliothek. DESTRUKTIV.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Sonarr-Serien-ID' },
        deleteFiles: { type: 'boolean', description: 'Auch Dateien löschen (Standard: false)' },
      },
      required: ['id'],
    },
  },
};

export const seriesEpisodes: OllamaTool = {
  type: 'function',
  function: {
    name: 'series_episodes',
    description: 'Listet alle Episoden einer Serie auf (welche fehlen, welche vorhanden sind). Optional nach Staffel filtern.',
    parameters: {
      type: 'object',
      properties: {
        seriesId: { type: 'number', description: 'Sonarr-Serien-ID' },
        seasonNumber: { type: 'number', description: 'Optional: Nur Episoden dieser Staffel' },
      },
      required: ['seriesId'],
    },
  },
};

export const seriesTriggerSearch: OllamaTool = {
  type: 'function',
  function: {
    name: 'series_trigger_search',
    description: 'Startet eine automatische Release-Suche in Sonarr für eine Serie.',
    parameters: {
      type: 'object',
      properties: {
        seriesId: { type: 'number', description: 'Sonarr-Serien-ID' },
      },
      required: ['seriesId'],
    },
  },
};

export const seriesEpisodeSearch: OllamaTool = {
  type: 'function',
  function: {
    name: 'series_episode_search',
    description: 'Findet verfügbare Releases für eine einzelne Episode.',
    parameters: {
      type: 'object',
      properties: {
        episodeId: { type: 'number', description: 'Sonarr-Episoden-ID' },
      },
      required: ['episodeId'],
    },
  },
};

export const seriesGrabRelease: OllamaTool = {
  type: 'function',
  function: {
    name: 'series_grab_release',
    description: 'Lädt ein spezifisches Release für eine Episode herunter. DESTRUKTIV.',
    parameters: {
      type: 'object',
      properties: {
        guid: { type: 'string', description: 'Release-GUID' },
        indexerId: { type: 'number', description: 'Indexer-ID' },
      },
      required: ['guid', 'indexerId'],
    },
  },
};

export const seriesMissing: OllamaTool = {
  type: 'function',
  function: {
    name: 'series_missing',
    description: 'Listet alle fehlenden Episoden aller Serien auf.',
    parameters: { type: 'object', properties: {} },
  },
};

export const seriesHistory: OllamaTool = {
  type: 'function',
  function: {
    name: 'series_history',
    description: 'Zeigt die Sonarr Event-History.',
    parameters: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Anzahl Einträge (Standard: 20)' },
      },
    },
  },
};

export const seriesSeasonMonitor: OllamaTool = {
  type: 'function',
  function: {
    name: 'series_season_monitor',
    description: 'Aktiviert oder deaktiviert das Monitoring einer einzelnen Staffel. DESTRUKTIV.',
    parameters: {
      type: 'object',
      properties: {
        seriesId: { type: 'number', description: 'Sonarr-Serien-ID' },
        seasonNumber: { type: 'number', description: 'Staffelnummer' },
        monitored: { type: 'boolean', description: 'Monitoring an/aus' },
      },
      required: ['seriesId', 'seasonNumber', 'monitored'],
    },
  },
};

export const seriesUpdate: OllamaTool = {
  type: 'function',
  function: {
    name: 'series_update',
    description: 'Bearbeitet eine Serie: Monitoring an/aus, Qualitätsprofil ändern. DESTRUKTIV.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Sonarr-Serien-ID' },
        monitored: { type: 'boolean', description: 'Monitoring aktivieren/deaktivieren' },
        qualityProfileId: { type: 'number', description: 'Neue Qualitätsprofil-ID' },
      },
      required: ['id'],
    },
  },
};

export const seriesTmdbRich: OllamaTool = {
  type: 'function',
  function: {
    name: 'series_tmdb_rich',
    description: 'Holt reichhaltige TMDB-Infos für eine Serie: Poster-URL, Cast, Trailer, ähnliche Serien.',
    parameters: {
      type: 'object',
      properties: {
        tmdbId: { type: 'number', description: 'TMDB-ID der Serie' },
      },
      required: ['tmdbId'],
    },
  },
};

// ── 🎵 Musik ─────────────────────────────────────────────────────────────────

export const musicSearch: OllamaTool = {
  type: 'function',
  function: {
    name: 'music_search',
    description: 'Sucht nach Künstlern/Alben in der lokalen Lidarr-Bibliothek.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Suchbegriff (Künstler oder Album)' },
      },
      required: ['query'],
    },
  },
};

export const musicLookup: OllamaTool = {
  type: 'function',
  function: {
    name: 'music_lookup',
    description: 'Sucht nach Künstlern auf MusicBrainz/Lidarr zum Hinzufügen.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Suchbegriff (Künstlername)' },
      },
      required: ['query'],
    },
  },
};

export const musicAdd: OllamaTool = {
  type: 'function',
  function: {
    name: 'music_add',
    description: 'Fügt einen Künstler zu Lidarr hinzu. DESTRUKTIV.',
    parameters: {
      type: 'object',
      properties: {
        foreignArtistId: { type: 'string', description: 'MusicBrainz Artist-ID (aus music_lookup)' },
        searchNow: { type: 'boolean', description: 'Sofort nach Alben suchen (Standard: true)' },
      },
      required: ['foreignArtistId'],
    },
  },
};

export const musicDetails: OllamaTool = {
  type: 'function',
  function: {
    name: 'music_details',
    description: 'Gibt detaillierte Infos zu einem Künstler: Name, Alben-Liste, Genres, Status.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Lidarr-Artist-ID' },
      },
      required: ['id'],
    },
  },
};

export const musicTriggerSearch: OllamaTool = {
  type: 'function',
  function: {
    name: 'music_trigger_search',
    description: 'Startet eine Release-Suche in Lidarr für einen Künstler.',
    parameters: {
      type: 'object',
      properties: {
        artistId: { type: 'number', description: 'Lidarr-Artist-ID' },
      },
      required: ['artistId'],
    },
  },
};

// ── 📥 Downloads ─────────────────────────────────────────────────────────────

export const downloadsStatus: OllamaTool = {
  type: 'function',
  function: {
    name: 'downloads_status',
    description: 'Zeigt den aktuellen Download-Status: Aktive Downloads, Geschwindigkeit, Fortschritt.',
    parameters: { type: 'object', properties: {} },
  },
};

export const downloadsPause: OllamaTool = {
  type: 'function',
  function: {
    name: 'downloads_pause',
    description: 'Pausiert alle Downloads eines Downloaders. DESTRUKTIV.',
    parameters: {
      type: 'object',
      properties: {
        downloader: { type: 'string', enum: ['sabnzbd', 'transmission'], description: 'Welcher Downloader' },
      },
      required: ['downloader'],
    },
  },
};

export const downloadsResume: OllamaTool = {
  type: 'function',
  function: {
    name: 'downloads_resume',
    description: 'Setzt alle pausierten Downloads eines Downloaders fort.',
    parameters: {
      type: 'object',
      properties: {
        downloader: { type: 'string', enum: ['sabnzbd', 'transmission'], description: 'Welcher Downloader' },
      },
      required: ['downloader'],
    },
  },
};

export const downloadsPauseSingle: OllamaTool = {
  type: 'function',
  function: {
    name: 'downloads_pause_single',
    description: 'Pausiert oder setzt einen einzelnen Download fort. DESTRUKTIV.',
    parameters: {
      type: 'object',
      properties: {
        downloader: { type: 'string', enum: ['sabnzbd', 'transmission'], description: 'Downloader-Typ' },
        id: { type: 'string', description: 'Download-ID (NZO-ID oder Torrent-Hash)' },
        resume: { type: 'boolean', description: 'true = fortsetzen, false = pausieren (Standard: false)' },
      },
      required: ['downloader', 'id'],
    },
  },
};

export const downloadsDelete: OllamaTool = {
  type: 'function',
  function: {
    name: 'downloads_delete',
    description: 'Entfernt einen Download aus der Queue. DESTRUKTIV.',
    parameters: {
      type: 'object',
      properties: {
        downloader: { type: 'string', enum: ['sabnzbd', 'transmission'], description: 'Downloader-Typ' },
        id: { type: 'string', description: 'Download-ID' },
        deleteFiles: { type: 'boolean', description: 'Auch Dateien löschen (nur Transmission, Standard: false)' },
      },
      required: ['downloader', 'id'],
    },
  },
};

export const downloadsPriority: OllamaTool = {
  type: 'function',
  function: {
    name: 'downloads_priority',
    description: 'Ändert die Priorität eines SABnzbd-Downloads oder schiebt ihn nach oben.',
    parameters: {
      type: 'object',
      properties: {
        nzoId: { type: 'string', description: 'SABnzbd NZO-ID' },
        priority: { type: 'string', enum: ['Force', 'High', 'Normal', 'Low'], description: 'Neue Priorität' },
        moveToTop: { type: 'boolean', description: 'An die Spitze der Queue schieben' },
      },
      required: ['nzoId'],
    },
  },
};

export const downloadsSpeedLimit: OllamaTool = {
  type: 'function',
  function: {
    name: 'downloads_speed_limit',
    description: 'Setzt ein Geschwindigkeitslimit für SABnzbd (in Prozent). 0 = kein Limit.',
    parameters: {
      type: 'object',
      properties: {
        percent: { type: 'number', description: 'Speed-Limit in Prozent (0 = unbegrenzt, 50 = halbe Geschwindigkeit)' },
      },
      required: ['percent'],
    },
  },
};

// ── 📅 Kalender ──────────────────────────────────────────────────────────────

export const calendarUpcoming: OllamaTool = {
  type: 'function',
  function: {
    name: 'calendar_upcoming',
    description: 'Zeigt kommende Film- und Serien-Releases der nächsten Tage.',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Wie viele Tage voraus (Standard: 7)' },
      },
    },
  },
};

export const calendarToday: OllamaTool = {
  type: 'function',
  function: {
    name: 'calendar_today',
    description: 'Zeigt was heute erscheint (Filme und Episoden).',
    parameters: { type: 'object', properties: {} },
  },
};

// ── 📡 Streams & Plex ───────────────────────────────────────────────────────

export const streamsActive: OllamaTool = {
  type: 'function',
  function: {
    name: 'streams_active',
    description: 'Zeigt aktuelle Plex-Streams: Wer schaut was, Qualität, Direct Play/Transcode.',
    parameters: { type: 'object', properties: {} },
  },
};

export const streamsHistory: OllamaTool = {
  type: 'function',
  function: {
    name: 'streams_history',
    description: 'Zeigt die letzten Wiedergaben auf Plex.',
    parameters: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Anzahl Einträge (Standard: 10)' },
      },
    },
  },
};

export const plexLibraries: OllamaTool = {
  type: 'function',
  function: {
    name: 'plex_libraries',
    description: 'Listet alle Plex-Bibliotheken auf (Filme, Serien, Musik etc.).',
    parameters: { type: 'object', properties: {} },
  },
};

export const plexDeeplink: OllamaTool = {
  type: 'function',
  function: {
    name: 'plex_deeplink',
    description: 'Generiert einen Deep-Link zu einem Medium in Plex Web.',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Plex-Metadata-Key (z.B. /library/metadata/12345)' },
      },
      required: ['key'],
    },
  },
};

export const plexStatus: OllamaTool = {
  type: 'function',
  function: {
    name: 'plex_status',
    description: 'Gibt den Plex Server-Status: Version, Plattform, Name.',
    parameters: { type: 'object', properties: {} },
  },
};

// ── 🔍 Indexer (Prowlarr) ───────────────────────────────────────────────────

export const prowlarrSearch: OllamaTool = {
  type: 'function',
  function: {
    name: 'prowlarr_search',
    description: 'Sucht nach Releases über alle Indexer (Prowlarr).',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Suchbegriff' },
        type: { type: 'string', enum: ['movie', 'tv', 'music'], description: 'Medientyp' },
      },
      required: ['query'],
    },
  },
};

export const prowlarrGrab: OllamaTool = {
  type: 'function',
  function: {
    name: 'prowlarr_grab',
    description: 'Lädt ein Release über Prowlarr herunter. DESTRUKTIV.',
    parameters: {
      type: 'object',
      properties: {
        guid: { type: 'string', description: 'Release-GUID (aus prowlarr_search)' },
        indexerId: { type: 'number', description: 'Indexer-ID (aus prowlarr_search)' },
      },
      required: ['guid', 'indexerId'],
    },
  },
};

// ── 💡 TMDB Discover ────────────────────────────────────────────────────────

export const discoverTrending: OllamaTool = {
  type: 'function',
  function: {
    name: 'discover_trending',
    description: 'Zeigt aktuell angesagte Filme oder Serien von TMDB.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['movie', 'tv'], description: 'Filme oder Serien (Standard: movie)' },
      },
    },
  },
};

export const discoverByGenre: OllamaTool = {
  type: 'function',
  function: {
    name: 'discover_by_genre',
    description: 'TMDB Discover: Filme/Serien nach Genre, Rating, Jahr filtern.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['movie', 'tv'], description: 'Filme oder Serien' },
        genre: { type: 'string', description: 'Genre-ID oder Name (z.B. "28" für Action)' },
        minRating: { type: 'number', description: 'Mindest-Rating (0-10)' },
        year: { type: 'number', description: 'Erscheinungsjahr' },
        sortBy: { type: 'string', description: 'Sortierung (z.B. popularity.desc, vote_average.desc)' },
      },
    },
  },
};

export const discoverSimilar: OllamaTool = {
  type: 'function',
  function: {
    name: 'discover_similar',
    description: 'Findet ähnliche Filme/Serien basierend auf einer TMDB-ID.',
    parameters: {
      type: 'object',
      properties: {
        tmdbId: { type: 'number', description: 'TMDB-ID des Ausgangsmediums' },
        type: { type: 'string', enum: ['movie', 'tv'], description: 'Filme oder Serien' },
      },
      required: ['tmdbId'],
    },
  },
};

// ── 📊 System & Stats ───────────────────────────────────────────────────────

export const statsOverview: OllamaTool = {
  type: 'function',
  function: {
    name: 'stats_overview',
    description: 'Gibt eine Übersicht: Bibliotheks-Größen, Downloads, aktive Streams.',
    parameters: { type: 'object', properties: {} },
  },
};

export const systemHealth: OllamaTool = {
  type: 'function',
  function: {
    name: 'system_health',
    description: 'Health-Check aller Integrationen: Radarr, Sonarr, Plex, Bazarr, ABS, Gotify, Tautulli.',
    parameters: { type: 'object', properties: {} },
  },
};

// ── 📬 Overseerr ────────────────────────────────────────────────────────────

export const overseerrRequests: OllamaTool = {
  type: 'function',
  function: {
    name: 'overseerr_requests',
    description: 'Zeigt offene Medien-Anfragen aus Overseerr.',
    parameters: { type: 'object', properties: {} },
  },
};

export const overseerrApprove: OllamaTool = {
  type: 'function',
  function: {
    name: 'overseerr_approve',
    description: 'Genehmigt eine Overseerr-Anfrage. DESTRUKTIV.',
    parameters: {
      type: 'object',
      properties: {
        requestId: { type: 'number', description: 'ID der Anfrage' },
      },
      required: ['requestId'],
    },
  },
};

export const overseerrDecline: OllamaTool = {
  type: 'function',
  function: {
    name: 'overseerr_decline',
    description: 'Lehnt eine Overseerr-Anfrage ab. DESTRUKTIV.',
    parameters: {
      type: 'object',
      properties: {
        requestId: { type: 'number', description: 'ID der Anfrage' },
      },
      required: ['requestId'],
    },
  },
};

// ── 🔤 Untertitel (Bazarr) ──────────────────────────────────────────────────

export const subtitlesMovieStatus: OllamaTool = {
  type: 'function',
  function: {
    name: 'subtitles_movie_status',
    description: 'Zeigt den Untertitel-Status eines Films: vorhandene und fehlende Sprachen.',
    parameters: {
      type: 'object',
      properties: {
        radarrId: { type: 'number', description: 'Radarr-Film-ID' },
      },
      required: ['radarrId'],
    },
  },
};

export const subtitlesSeriesStatus: OllamaTool = {
  type: 'function',
  function: {
    name: 'subtitles_series_status',
    description: 'Zeigt den Untertitel-Status aller Episoden einer Serie.',
    parameters: {
      type: 'object',
      properties: {
        sonarrSeriesId: { type: 'number', description: 'Sonarr-Serien-ID' },
      },
      required: ['sonarrSeriesId'],
    },
  },
};

export const subtitlesSearch: OllamaTool = {
  type: 'function',
  function: {
    name: 'subtitles_search',
    description: 'Löst eine Untertitel-Suche in Bazarr aus. DESTRUKTIV.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['movie', 'episode'], description: 'Film oder Episode' },
        radarrId: { type: 'number', description: 'Radarr-Film-ID (wenn type=movie)' },
        episodeId: { type: 'number', description: 'Sonarr-Episoden-ID (wenn type=episode)' },
      },
      required: ['type'],
    },
  },
};

// ── 📚 Audiobookshelf ───────────────────────────────────────────────────────

export const audiobooksSearch: OllamaTool = {
  type: 'function',
  function: {
    name: 'audiobooks_search',
    description: 'Sucht nach Hörbüchern/Podcasts in Audiobookshelf.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Suchbegriff (Titel oder Autor)' },
        libraryId: { type: 'string', description: 'Optional: Library-ID (sonst wird die erste Library verwendet)' },
      },
      required: ['query'],
    },
  },
};

export const audiobooksDetails: OllamaTool = {
  type: 'function',
  function: {
    name: 'audiobooks_details',
    description: 'Gibt Details zu einem Hörbuch: Titel, Autor, Erzähler, Dauer, Hörfortschritt.',
    parameters: {
      type: 'object',
      properties: {
        itemId: { type: 'string', description: 'Audiobookshelf-Item-ID' },
      },
      required: ['itemId'],
    },
  },
};

export const audiobooksLibraries: OllamaTool = {
  type: 'function',
  function: {
    name: 'audiobooks_libraries',
    description: 'Listet alle Audiobookshelf-Bibliotheken auf.',
    parameters: { type: 'object', properties: {} },
  },
};

// ── 🔔 Benachrichtigungen (Gotify) ─────────────────────────────────────────

export const notificationsList: OllamaTool = {
  type: 'function',
  function: {
    name: 'notifications_list',
    description: 'Zeigt die letzten Benachrichtigungen aus Gotify.',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Anzahl Einträge (Standard: 20)' },
      },
    },
  },
};

export const notificationsClear: OllamaTool = {
  type: 'function',
  function: {
    name: 'notifications_clear',
    description: 'Löscht eine oder alle Benachrichtigungen. DESTRUKTIV.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Nachrichten-ID (wenn leer: alle löschen)' },
      },
    },
  },
};

// ── 🧭 UI Navigation ────────────────────────────────────────────────────────

export const navigateTo: OllamaTool = {
  type: 'function',
  function: {
    name: 'navigate_to',
    description: 'Navigiert den User zu einer nexarr-View (z.B. /movies, /movies/123, /downloads, /calendar).',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Pfad in nexarr (z.B. /movies, /movies/1604, /series/1, /downloads, /calendar, /streams)' },
      },
      required: ['path'],
    },
  },
};

export const navigateToExternal: OllamaTool = {
  type: 'function',
  function: {
    name: 'navigate_to_external',
    description: 'Öffnet einen externen Link in einem neuen Browser-Tab (z.B. Plex Deep-Link, TMDB-Seite, YouTube-Trailer).',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Vollständige URL (https://...)' },
      },
      required: ['url'],
    },
  },
};

export const navigateSearch: OllamaTool = {
  type: 'function',
  function: {
    name: 'navigate_search',
    description: 'Öffnet die SearchView mit einem vorgefüllten Suchbegriff.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Suchbegriff' },
      },
      required: ['query'],
    },
  },
};

// ── 📈 Analytics (Tautulli) ─────────────────────────────────────────────────

export const analyticsMostWatched: OllamaTool = {
  type: 'function',
  function: {
    name: 'analytics_most_watched',
    description: 'Zeigt meistgeschaute Filme/Serien (Top 10/25) aus Tautulli.',
    parameters: {
      type: 'object',
      properties: {
        time_range: { type: 'number', description: 'Zeitraum in Tagen (Standard: 30)' },
        count: { type: 'number', description: 'Anzahl Ergebnisse (Standard: 10)' },
      },
    },
  },
};

export const analyticsUserStats: OllamaTool = {
  type: 'function',
  function: {
    name: 'analytics_user_stats',
    description: 'Watch-Statistiken pro User: Stunden, Plays, Player-Nutzung. Ohne user_id werden alle User aufgelistet.',
    parameters: {
      type: 'object',
      properties: {
        user_id: { type: 'number', description: 'Tautulli-User-ID (leer = User-Liste anzeigen)' },
      },
    },
  },
};

export const analyticsLibraryStats: OllamaTool = {
  type: 'function',
  function: {
    name: 'analytics_library_stats',
    description: 'Bibliotheks-Statistiken: Größe, Plays, letzte Wiedergabe. Ohne section_id alle Bibliotheken.',
    parameters: {
      type: 'object',
      properties: {
        section_id: { type: 'number', description: 'Plex-Library Section-ID (leer = Übersicht aller Bibliotheken)' },
      },
    },
  },
};

export const analyticsRecentlyAdded: OllamaTool = {
  type: 'function',
  function: {
    name: 'analytics_recently_added',
    description: 'Kürzlich zu Plex hinzugefügte Medien.',
    parameters: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Anzahl Einträge (Standard: 25)' },
      },
    },
  },
};

export const analyticsWatchTimeTrend: OllamaTool = {
  type: 'function',
  function: {
    name: 'analytics_watch_time_trend',
    description: 'Watch-Time Trend: Plays pro Tag, Wochentag oder Stunde.',
    parameters: {
      type: 'object',
      properties: {
        time_range: { type: 'number', description: 'Zeitraum in Tagen (Standard: 30)' },
        group_by: { type: 'string', enum: ['date', 'day_of_week', 'hour_of_day'], description: 'Gruppierung (Standard: date)' },
      },
    },
  },
};

export const analyticsTranscodeStats: OllamaTool = {
  type: 'function',
  function: {
    name: 'analytics_transcode_stats',
    description: 'Transcode-Statistiken: Direct Play vs. Transcode, aufgeschlüsselt nach Plattform.',
    parameters: {
      type: 'object',
      properties: {
        time_range: { type: 'number', description: 'Zeitraum in Tagen (Standard: 30)' },
      },
    },
  },
};

export const analyticsConcurrentStreams: OllamaTool = {
  type: 'function',
  function: {
    name: 'analytics_concurrent_streams',
    description: 'Aktuelle parallele Streams, Bandwidth-Nutzung und Stream-Verteilung.',
    parameters: { type: 'object', properties: {} },
  },
};

export const analyticsUserHistory: OllamaTool = {
  type: 'function',
  function: {
    name: 'analytics_user_history',
    description: 'Detaillierte Watch-History eines Users oder gefiltert nach Medientyp.',
    parameters: {
      type: 'object',
      properties: {
        user: { type: 'string', description: 'Username (leer = alle User)' },
        media_type: { type: 'string', enum: ['movie', 'episode', 'track'], description: 'Medientyp-Filter' },
        length: { type: 'number', description: 'Anzahl Einträge (Standard: 25)' },
      },
    },
  },
};

// ── 🧠 Smart AI Features ────────────────────────────────────────────────────

export const recommend: OllamaTool = {
  type: 'function',
  function: {
    name: 'recommend',
    description: 'Intelligente Medien-Empfehlung basierend auf Stimmung, Genre und Watch-History.',
    parameters: {
      type: 'object',
      properties: {
        mood: { type: 'string', description: 'Stimmung (z.B. "entspannt", "spannend", "lustig")' },
        genre: { type: 'string', description: 'Genre-Präferenz (z.B. "Action", "Comedy")' },
        type: { type: 'string', enum: ['movie', 'tv'], description: 'Filme oder Serien (Standard: movie)' },
      },
    },
  },
};

export const buildWatchlist: OllamaTool = {
  type: 'function',
  function: {
    name: 'build_watchlist',
    description: 'Erstellt eine kuratierte Watch-Session innerhalb eines Zeitbudgets mit Laufzeiten.',
    parameters: {
      type: 'object',
      properties: {
        hours: { type: 'number', description: 'Zeitbudget in Stunden (Standard: 3)' },
        genre: { type: 'string', description: 'Genre-Filter' },
        type: { type: 'string', enum: ['movie', 'tv'], description: 'Filme oder Serien (Standard: movie)' },
      },
    },
  },
};

export const libraryReport: OllamaTool = {
  type: 'function',
  function: {
    name: 'library_report',
    description: 'Umfassender Bibliotheks-Report: Genre-Verteilung, Speicher, Qualität, Top-Genres.',
    parameters: { type: 'object', properties: {} },
  },
};

export const whatToWatch: OllamaTool = {
  type: 'function',
  function: {
    name: 'what_to_watch',
    description: '"Was soll ich schauen?" – Personalisierte Vorschläge aus deiner Bibliothek.',
    parameters: {
      type: 'object',
      properties: {
        mood: { type: 'string', description: 'Aktuelle Stimmung' },
        type: { type: 'string', enum: ['movie', 'tv'], description: 'Filme oder Serien (Standard: movie)' },
      },
    },
  },
};

export const mediaQuiz: OllamaTool = {
  type: 'function',
  function: {
    name: 'media_quiz',
    description: 'Film/Serien-Quiz: Rate den Titel anhand der Beschreibung. Fun-Feature!',
    parameters: {
      type: 'object',
      properties: {
        difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'], description: 'Schwierigkeitsgrad' },
        type: { type: 'string', enum: ['movie', 'tv'], description: 'Filme oder Serien' },
      },
    },
  },
};

// ── 🔗 Cross-Service Intelligence ───────────────────────────────────────────

export const crossActorSearch: OllamaTool = {
  type: 'function',
  function: {
    name: 'cross_actor_search',
    description: '"Welche Filme mit [Schauspieler] habe ich?" – TMDB Credits vs. Radarr-Bibliothek.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name des Schauspielers/Regisseurs' },
      },
      required: ['name'],
    },
  },
};

export const crossDuplicateCheck: OllamaTool = {
  type: 'function',
  function: {
    name: 'cross_duplicate_check',
    description: 'Findet doppelte Filme in der Radarr-Bibliothek (gleiche TMDB-ID).',
    parameters: { type: 'object', properties: {} },
  },
};

export const crossQualityAudit: OllamaTool = {
  type: 'function',
  function: {
    name: 'cross_quality_audit',
    description: 'Qualitäts-Audit: Welche Filme haben nur SD/720p?',
    parameters: {
      type: 'object',
      properties: {
        max_quality: { type: 'string', enum: ['720p', '1080p'], description: 'Maximale Qualität die als "niedrig" gilt (Standard: 720p)' },
      },
    },
  },
};

export const crossSpaceAnalyzer: OllamaTool = {
  type: 'function',
  function: {
    name: 'cross_space_analyzer',
    description: 'Speicherplatz-Analyse: Root-Folders, größte Dateien, Platz pro Genre.',
    parameters: { type: 'object', properties: {} },
  },
};

export const crossWatchUnwatched: OllamaTool = {
  type: 'function',
  function: {
    name: 'cross_watch_unwatched',
    description: 'Ungesehene Medien finden: Bibliothek vs. Tautulli Watch-History.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['movie', 'tv'], description: 'Filme oder Serien (Standard: movie)' },
      },
    },
  },
};

export const crossSubtitleAudit: OllamaTool = {
  type: 'function',
  function: {
    name: 'cross_subtitle_audit',
    description: 'Untertitel-Audit: Welche Filme fehlen Untertitel in einer bestimmten Sprache?',
    parameters: {
      type: 'object',
      properties: {
        language: { type: 'string', description: 'Sprachcode (z.B. "de", "en") – Standard: de' },
      },
    },
  },
};

export const crossReleaseMonitor: OllamaTool = {
  type: 'function',
  function: {
    name: 'cross_release_monitor',
    description: 'Überwacht TMDB auf kommende Releases eines Schauspielers/Regisseurs.',
    parameters: {
      type: 'object',
      properties: {
        person_name: { type: 'string', description: 'Name der Person' },
        person_id: { type: 'number', description: 'TMDB-Person-ID (optional, wird per Name gesucht)' },
      },
    },
  },
};

// ── ⚙️ Automation ───────────────────────────────────────────────────────────

export const autoQualityUpgrade: OllamaTool = {
  type: 'function',
  function: {
    name: 'auto_quality_upgrade',
    description: 'Batch-Upgrade: Alle Filme auf ein höheres Qualitätsprofil umstellen. DESTRUKTIV.',
    parameters: {
      type: 'object',
      properties: {
        quality_profile_id: { type: 'number', description: 'Ziel-Qualitätsprofil-ID (leer = Profile anzeigen)' },
        search_after: { type: 'boolean', description: 'Nach Upgrade automatisch suchen (Standard: true)' },
      },
    },
  },
};

export const autoCleanup: OllamaTool = {
  type: 'function',
  function: {
    name: 'auto_cleanup',
    description: 'Findet fehlgeschlagene und steckengebliebene Downloads zum Aufräumen.',
    parameters: { type: 'object', properties: {} },
  },
};

export const autoMissingSearch: OllamaTool = {
  type: 'function',
  function: {
    name: 'auto_missing_search',
    description: 'Startet eine Suche nach allen fehlenden Filmen/Episoden. DESTRUKTIV.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['movie', 'series', 'both'], description: 'Was suchen (Standard: both)' },
      },
    },
  },
};

export const scheduledTask: OllamaTool = {
  type: 'function',
  function: {
    name: 'scheduled_task',
    description: 'Reminder und geplante Tasks erstellen, auflisten oder abbrechen.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'create', 'cancel'], description: 'Aktion (Standard: list)' },
        description: { type: 'string', description: 'Beschreibung des Tasks (bei create)' },
        type: { type: 'string', enum: ['reminder', 'monitor', 'recurring'], description: 'Task-Typ' },
        trigger_condition: { type: 'string', description: 'Auslöse-Bedingung (z.B. "Staffel 3 Release")' },
        next_check: { type: 'string', description: 'Nächster Check-Zeitpunkt (ISO-Datum)' },
        id: { type: 'number', description: 'Task-ID (bei cancel)' },
      },
    },
  },
};

export const proactiveNotify: OllamaTool = {
  type: 'function',
  function: {
    name: 'proactive_notify',
    description: 'Status und Steuerung proaktiver AI-Benachrichtigungen.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['status', 'enable', 'disable'], description: 'Aktion (Standard: status)' },
      },
    },
  },
};

// ── 👁️ Vision (gemma3:27b) ──────────────────────────────────────────────────

export const visionIdentifyMedia: OllamaTool = {
  type: 'function',
  function: {
    name: 'vision_identify_media',
    description: 'Identifiziert einen Film/Serie anhand eines Bildes oder Screenshots (benötigt hochgeladenes Bild).',
    parameters: {
      type: 'object',
      properties: {
        image: { type: 'string', description: 'Base64-encoded Bild (wird automatisch aus dem Chat-Upload befüllt)' },
      },
    },
  },
};

export const visionAnalyzePoster: OllamaTool = {
  type: 'function',
  function: {
    name: 'vision_analyze_poster',
    description: 'Analysiert ein Film-/Serien-Poster im Detail: Titel, Design, Stimmung, Schauspieler.',
    parameters: {
      type: 'object',
      properties: {
        image: { type: 'string', description: 'Base64-encoded Poster-Bild' },
      },
    },
  },
};

export const visionUiHelp: OllamaTool = {
  type: 'function',
  function: {
    name: 'vision_ui_help',
    description: 'Hilft dem User anhand eines nexarr-Screenshots: Was wird angezeigt? Wie nutze ich diese Seite?',
    parameters: {
      type: 'object',
      properties: {
        image: { type: 'string', description: 'Base64-encoded Screenshot' },
        question: { type: 'string', description: 'Frage des Users zum Screenshot' },
      },
    },
  },
};

// ── Registry ─────────────────────────────────────────────────────────────────

/** Alle verfügbaren Tools */
export const allTools: OllamaTool[] = [
  // Filme (13)
  moviesSearch, moviesLookup, moviesAdd, moviesDetails,
  moviesDelete, moviesTriggerSearch, moviesInteractiveSearch, moviesGrabRelease,
  moviesMissing, moviesHistory, moviesUpdate, moviesTmdbRich, moviesQualityProfiles,
  // Serien (14)
  seriesSearch, seriesLookup, seriesAdd, seriesDetails,
  seriesDelete, seriesEpisodes, seriesTriggerSearch, seriesEpisodeSearch,
  seriesGrabRelease, seriesMissing, seriesHistory, seriesSeasonMonitor,
  seriesUpdate, seriesTmdbRich,
  // Musik (5)
  musicSearch, musicLookup, musicAdd, musicDetails, musicTriggerSearch,
  // Downloads (7)
  downloadsStatus, downloadsPause, downloadsResume,
  downloadsPauseSingle, downloadsDelete, downloadsPriority, downloadsSpeedLimit,
  // Kalender (2)
  calendarUpcoming, calendarToday,
  // Streams & Plex (5)
  streamsActive, streamsHistory, plexLibraries, plexDeeplink, plexStatus,
  // Prowlarr (2)
  prowlarrSearch, prowlarrGrab,
  // Discover (3)
  discoverTrending, discoverByGenre, discoverSimilar,
  // System (2)
  statsOverview, systemHealth,
  // Overseerr (3)
  overseerrRequests, overseerrApprove, overseerrDecline,
  // Bazarr (3)
  subtitlesMovieStatus, subtitlesSeriesStatus, subtitlesSearch,
  // Audiobookshelf (3)
  audiobooksSearch, audiobooksDetails, audiobooksLibraries,
  // Gotify (2)
  notificationsList, notificationsClear,
  // Navigation (3)
  navigateTo, navigateToExternal, navigateSearch,
  // Analytics (8)
  analyticsMostWatched, analyticsUserStats, analyticsLibraryStats,
  analyticsRecentlyAdded, analyticsWatchTimeTrend, analyticsTranscodeStats,
  analyticsConcurrentStreams, analyticsUserHistory,
  // Smart Features (5)
  recommend, buildWatchlist, libraryReport, whatToWatch, mediaQuiz,
  // Cross-Service (7)
  crossActorSearch, crossDuplicateCheck, crossQualityAudit, crossSpaceAnalyzer,
  crossWatchUnwatched, crossSubtitleAudit, crossReleaseMonitor,
  // Automation (5)
  autoQualityUpgrade, autoCleanup, autoMissingSearch, scheduledTask, proactiveNotify,
  // Vision (3)
  visionIdentifyMedia, visionAnalyzePoster, visionUiHelp,
];

/**
 * Tools die als destruktiv gelten und eine Bestätigung erfordern.
 */
export const destructiveTools = new Set([
  'movies_add', 'movies_delete', 'movies_update',
  'movies_trigger_search', 'movies_grab_release',
  'series_add', 'series_delete', 'series_update',
  'series_trigger_search', 'series_grab_release', 'series_season_monitor',
  'music_add', 'music_trigger_search',
  'downloads_pause', 'downloads_pause_single',
  'downloads_delete', 'downloads_priority', 'downloads_speed_limit',
  'overseerr_approve', 'overseerr_decline',
  'prowlarr_grab',
  'subtitles_search',
  'notifications_clear',
  'auto_quality_upgrade', 'auto_missing_search',
]);

/** Tool-Name → Tool-Definition Lookup */
export const toolByName = new Map(
  allTools.map(t => [t.function.name, t])
);
