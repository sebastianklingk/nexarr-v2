// ── Smart Tool Selector ──────────────────────────────────────────────────────
// Statt alle 95 Tools bei jedem Request mitzuschicken, klassifiziert der
// Selector den User-Intent per Keywords und lädt max 2 Kategorien (~15-20 Tools).

import type { OllamaTool } from './ai.service.js';
import {
  // Filme
  moviesSearch, moviesLookup, moviesAdd, moviesDetails, moviesDelete,
  moviesTriggerSearch, moviesInteractiveSearch, moviesGrabRelease,
  moviesMissing, moviesHistory, moviesUpdate, moviesTmdbRich, moviesQualityProfiles,
  // Serien
  seriesSearch, seriesLookup, seriesAdd, seriesDetails, seriesDelete,
  seriesEpisodes, seriesTriggerSearch, seriesEpisodeSearch, seriesGrabRelease,
  seriesMissing, seriesHistory, seriesSeasonMonitor, seriesUpdate, seriesTmdbRich,
  // Musik
  musicSearch, musicLookup, musicAdd, musicDetails, musicTriggerSearch,
  // Downloads
  downloadsStatus, downloadsPause, downloadsResume,
  downloadsPauseSingle, downloadsDelete, downloadsPriority, downloadsSpeedLimit,
  // Streams & Plex
  streamsActive, streamsHistory, plexLibraries, plexDeeplink, plexStatus,
  // Kalender & Discover
  calendarUpcoming, calendarToday,
  discoverTrending, discoverByGenre, discoverSimilar,
  // Analytics
  analyticsMostWatched, analyticsUserStats, analyticsLibraryStats,
  analyticsRecentlyAdded, analyticsWatchTimeTrend, analyticsTranscodeStats,
  analyticsConcurrentStreams, analyticsUserHistory,
  // System
  statsOverview, systemHealth,
  overseerrRequests, overseerrApprove, overseerrDecline,
  subtitlesMovieStatus, subtitlesSeriesStatus, subtitlesSearch,
  audiobooksSearch, audiobooksDetails, audiobooksLibraries,
  notificationsList, notificationsClear,
  prowlarrSearch, prowlarrGrab,
  // Smart
  recommend, buildWatchlist, libraryReport, whatToWatch, mediaQuiz,
  // Cross-Service
  crossActorSearch, crossDuplicateCheck, crossQualityAudit, crossSpaceAnalyzer,
  crossWatchUnwatched, crossSubtitleAudit, crossReleaseMonitor,
  // Automation
  autoQualityUpgrade, autoCleanup, autoMissingSearch, scheduledTask, proactiveNotify,
  // Navigation
  navigateTo, navigateToExternal, navigateSearch,
  // Composite (Suche + Navigate)
  openMovie, openSeries,
  // Vision
  visionIdentifyMedia, visionAnalyzePoster, visionUiHelp,
} from './tools.js';

// ── Kategorien ──────────────────────────────────────────────────────────────

interface ToolCategory {
  name: string;
  keywords: string[];
  tools: OllamaTool[];
}

const categories: ToolCategory[] = [
  {
    name: 'movies',
    keywords: ['film', 'movie', 'kino', 'radarr', 'tmdb',
               'hinzufügen', 'poster', 'imdb', 'dune', 'inception',
               'avengers', 'batman', 'marvel', 'dc',
               'öffne', 'öffnen', 'zeig', 'zeige', 'anzeigen', 'navigiere'],
    tools: [moviesSearch, moviesLookup, moviesAdd, moviesDetails, moviesDelete,
            moviesTriggerSearch, moviesInteractiveSearch, moviesGrabRelease,
            moviesMissing, moviesHistory, moviesUpdate, moviesTmdbRich,
            moviesQualityProfiles, openMovie, navigateSearch],
  },
  {
    name: 'series',
    keywords: ['serie', 'series', 'staffel', 'episode', 'sonarr', 'folge',
               'season', 'tv show', 'fernseh', 'anime',
               'öffne', 'öffnen', 'zeig', 'zeige', 'anzeigen', 'navigiere'],
    tools: [seriesSearch, seriesLookup, seriesAdd, seriesDetails, seriesDelete,
            seriesEpisodes, seriesTriggerSearch, seriesEpisodeSearch,
            seriesGrabRelease, seriesMissing, seriesHistory,
            seriesSeasonMonitor, seriesUpdate, seriesTmdbRich, openSeries, navigateSearch],
  },
  {
    name: 'music',
    keywords: ['musik', 'music', 'artist', 'album', 'song', 'lidarr', 'künstler',
               'band', 'sänger'],
    tools: [musicSearch, musicLookup, musicAdd, musicDetails, musicTriggerSearch],
  },
  {
    name: 'downloads',
    keywords: ['download', 'queue', 'sabnzbd', 'sab', 'transmission', 'torrent',
               'nzb', 'speed', 'pause', 'geschwindigkeit', 'fortschritt'],
    tools: [downloadsStatus, downloadsPause, downloadsResume,
            downloadsPauseSingle, downloadsDelete, downloadsPriority,
            downloadsSpeedLimit],
  },
  {
    name: 'streams',
    keywords: ['stream', 'plex', 'schaut', 'guckt', 'wiedergabe', 'abspielen',
               'tautulli', 'play', 'läuft', 'wer schaut'],
    tools: [streamsActive, streamsHistory, plexLibraries, plexDeeplink, plexStatus],
  },
  {
    name: 'analytics',
    keywords: ['statistik', 'stats', 'analytics', 'meistgeschaut', 'beliebt',
               'watch time', 'trend', 'transcode', 'history', 'verlauf',
               'am meisten', 'top 10'],
    tools: [analyticsMostWatched, analyticsUserStats, analyticsLibraryStats,
            analyticsRecentlyAdded, analyticsWatchTimeTrend, analyticsTranscodeStats,
            analyticsConcurrentStreams, analyticsUserHistory],
  },
  {
    name: 'discover',
    keywords: ['trending', 'discover', 'ähnlich', 'genre',
               'kalender', 'kommend', 'release', 'neu', 'morgen', 'woche',
               'kommt raus', 'premiere', 'erscheint'],
    tools: [calendarUpcoming, calendarToday, discoverTrending,
            discoverByGenre, discoverSimilar],
  },
  {
    name: 'system',
    keywords: ['system', 'health', 'status', 'overseerr', 'anfrage', 'request',
               'bazarr', 'untertitel', 'subtitle', 'gotify', 'benachrichtigung',
               'notification', 'audiobook', 'hörbuch', 'prowlarr', 'indexer'],
    tools: [statsOverview, systemHealth,
            overseerrRequests, overseerrApprove, overseerrDecline,
            subtitlesMovieStatus, subtitlesSeriesStatus, subtitlesSearch,
            audiobooksSearch, audiobooksDetails, audiobooksLibraries,
            notificationsList, notificationsClear,
            prowlarrSearch, prowlarrGrab],
  },
  {
    name: 'smart',
    keywords: ['empfiehl', 'recommend', 'filmabend', 'watchlist', 'stimmung',
               'mood', 'vorschlag', 'langweilig', 'was soll ich', 'quiz',
               'report', 'bibliothek', 'library', 'schauen'],
    tools: [recommend, buildWatchlist, libraryReport, whatToWatch, mediaQuiz],
  },
  {
    name: 'cross',
    keywords: ['schauspieler', 'actor', 'duplikat', 'doppelt', 'qualität',
               'upgrade', 'speicherplatz', 'platz', 'space', 'ungesehen',
               'unwatched', 'cleanup', 'aufräumen', 'fehlend', 'missing',
               'reminder', 'erinnerung', 'task'],
    tools: [crossActorSearch, crossDuplicateCheck, crossQualityAudit,
            crossSpaceAnalyzer, crossWatchUnwatched, crossSubtitleAudit,
            crossReleaseMonitor, autoQualityUpgrade, autoCleanup,
            autoMissingSearch, scheduledTask, proactiveNotify],
  },
  {
    name: 'vision',
    keywords: [],  // Getriggert via hasImage flag
    tools: [visionIdentifyMedia, visionAnalyzePoster, visionUiHelp],
  },
];

// ── Basis-Tools (immer dabei, max 5) ────────────────────────────────────────

const BASE_TOOLS: OllamaTool[] = [
  navigateTo,
  navigateToExternal,
  openMovie,          // Composite: sucht Film + navigiert zur Detail-Seite
  openSeries,         // Composite: sucht Serie + navigiert zur Detail-Seite
  statsOverview,
];

// ── Selector ────────────────────────────────────────────────────────────────

/**
 * Wählt relevante Tools basierend auf User-Message und Bild-Flag.
 * Max ~20 Tools pro Request statt 95.
 */
export function selectTools(message: string, hasImage: boolean): OllamaTool[] {
  const msgLower = message.toLowerCase();
  const selected = new Set<OllamaTool>(BASE_TOOLS);

  // Bei Bild: immer Vision-Tools laden
  if (hasImage) {
    const vision = categories.find(c => c.name === 'vision');
    if (vision) {
      for (const tool of vision.tools) selected.add(tool);
    }
  }

  // Keyword-Matching: finde passende Kategorien mit Score
  const scored: Array<{ cat: ToolCategory; score: number }> = [];
  for (const cat of categories) {
    if (cat.name === 'vision') continue;
    const hits = cat.keywords.filter(kw => msgLower.includes(kw));
    if (hits.length > 0) {
      scored.push({ cat, score: hits.length });
    }
  }

  if (scored.length === 0) {
    // Kein Match → Smart + System (generische Antwort-Fähigkeit)
    const smart = categories.find(c => c.name === 'smart');
    const system = categories.find(c => c.name === 'system');
    if (smart) for (const t of smart.tools) selected.add(t);
    if (system) for (const t of system.tools.slice(0, 5)) selected.add(t);
  } else {
    // Max 2 Kategorien (die mit den meisten Keyword-Hits)
    scored.sort((a, b) => b.score - a.score);
    for (const { cat } of scored.slice(0, 2)) {
      for (const tool of cat.tools) selected.add(tool);
    }
  }

  const result = Array.from(selected);
  console.log(
    `[AI ToolSelector] ${result.length} Tools für: "${message.slice(0, 60)}${message.length > 60 ? '...' : ''}"`,
  );
  return result;
}
