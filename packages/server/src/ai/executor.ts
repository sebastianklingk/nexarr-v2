import type { OllamaToolCall } from './ai.service.js';
import { destructiveTools } from './tools.js';

// ── Sub-Executors ───────────────────────────────────────────────────────────
import * as movies from './executors/movies.executor.js';
import * as series from './executors/series.executor.js';
import * as music from './executors/music.executor.js';
import * as downloads from './executors/downloads.executor.js';
import * as media from './executors/media.executor.js';
import * as system from './executors/system.executor.js';
import * as navigation from './executors/navigation.executor.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  /** Wenn true: Tool war destruktiv und wurde nicht ausgeführt (Safety) */
  blocked?: boolean;
}

// ── Safety Layer ─────────────────────────────────────────────────────────────

export function isDestructive(toolName: string): boolean {
  return destructiveTools.has(toolName);
}

// ── Dispatcher ──────────────────────────────────────────────────────────────

type Args = Record<string, unknown>;

/** Route-Map: Tool-Name → Handler-Funktion */
const handlers: Record<string, (args: Args) => Promise<ToolResult>> = {
  // Filme
  movies_search:             movies.handleMoviesSearch,
  movies_lookup:             movies.handleMoviesLookup,
  movies_add:                movies.handleMoviesAdd,
  movies_details:            movies.handleMoviesDetails,
  movies_delete:             movies.handleMoviesDelete,
  movies_trigger_search:     movies.handleMoviesTriggerSearch,
  movies_interactive_search: movies.handleMoviesInteractiveSearch,
  movies_grab_release:       movies.handleMoviesGrabRelease,
  movies_missing:            movies.handleMoviesMissing,
  movies_history:            movies.handleMoviesHistory,
  movies_update:             movies.handleMoviesUpdate,
  movies_tmdb_rich:          movies.handleMoviesTmdbRich,
  movies_quality_profiles:   movies.handleMoviesQualityProfiles,

  // Serien
  series_search:             series.handleSeriesSearch,
  series_lookup:             series.handleSeriesLookup,
  series_add:                series.handleSeriesAdd,
  series_details:            series.handleSeriesDetails,
  series_delete:             series.handleSeriesDelete,
  series_episodes:           series.handleSeriesEpisodes,
  series_trigger_search:     series.handleSeriesTriggerSearch,
  series_episode_search:     series.handleSeriesEpisodeSearch,
  series_grab_release:       series.handleSeriesGrabRelease,
  series_missing:            series.handleSeriesMissing,
  series_history:            series.handleSeriesHistory,
  series_season_monitor:     series.handleSeriesSeasonMonitor,
  series_update:             series.handleSeriesUpdate,
  series_tmdb_rich:          series.handleSeriesTmdbRich,

  // Musik
  music_search:              music.handleMusicSearch,
  music_lookup:              music.handleMusicLookup,
  music_add:                 music.handleMusicAdd,
  music_details:             music.handleMusicDetails,
  music_trigger_search:      music.handleMusicTriggerSearch,

  // Downloads
  downloads_status:          downloads.handleDownloadsStatus,
  downloads_pause:           downloads.handleDownloadsPause,
  downloads_resume:          downloads.handleDownloadsResume,
  downloads_pause_single:    downloads.handleDownloadsPauseSingle,
  downloads_delete:          downloads.handleDownloadsDelete,
  downloads_priority:        downloads.handleDownloadsPriority,
  downloads_speed_limit:     downloads.handleDownloadsSpeedLimit,

  // Kalender
  calendar_upcoming:         media.handleCalendarUpcoming,
  calendar_today:            media.handleCalendarToday,

  // Streams & Plex
  streams_active:            media.handleStreamsActive,
  streams_history:           media.handleStreamsHistory,
  plex_libraries:            media.handlePlexLibraries,
  plex_deeplink:             media.handlePlexDeeplink,
  plex_status:               media.handlePlexStatus,

  // Discover
  discover_trending:         media.handleDiscoverTrending,
  discover_by_genre:         media.handleDiscoverByGenre,
  discover_similar:          media.handleDiscoverSimilar,

  // System & Stats
  stats_overview:            system.handleStatsOverview,
  system_health:             system.handleSystemHealth,

  // Overseerr
  overseerr_requests:        system.handleOverseerrRequests,
  overseerr_approve:         system.handleOverseerrApprove,
  overseerr_decline:         system.handleOverseerrDecline,

  // Prowlarr
  prowlarr_search:           system.handleProwlarrSearch,
  prowlarr_grab:             system.handleProwlarrGrab,

  // Bazarr
  subtitles_movie_status:    system.handleSubtitlesMovieStatus,
  subtitles_series_status:   system.handleSubtitlesSeriesStatus,
  subtitles_search:          system.handleSubtitlesSearch,

  // Audiobookshelf
  audiobooks_search:         system.handleAudiobooksSearch,
  audiobooks_details:        system.handleAudiobooksDetails,
  audiobooks_libraries:      system.handleAudiobooksLibraries,

  // Gotify
  notifications_list:        system.handleNotificationsList,
  notifications_clear:       system.handleNotificationsClear,

  // Navigation
  navigate_to:               navigation.handleNavigateTo,
  navigate_to_external:      navigation.handleNavigateToExternal,
  navigate_search:           navigation.handleNavigateSearch,
};

/**
 * Führt einen einzelnen Tool-Call aus und gibt das Ergebnis zurück.
 */
export async function executeToolCall(call: OllamaToolCall): Promise<ToolResult> {
  const { name, arguments: args } = call.function;

  try {
    const handler = handlers[name];
    if (!handler) {
      return { success: false, error: `Unbekanntes Tool: ${name}` };
    }
    return await handler(args);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
    console.error(`[AI Tool] ${name} Fehler:`, msg);
    return { success: false, error: msg };
  }
}
