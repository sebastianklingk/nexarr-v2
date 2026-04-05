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
import * as analytics from './executors/analytics.executor.js';
import * as smart from './executors/smart.executor.js';
import * as cross from './executors/cross.executor.js';
import * as automation from './executors/automation.executor.js';
import * as vision from './executors/vision.executor.js';

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
  open_movie:                navigation.handleOpenMovie,
  open_series:               navigation.handleOpenSeries,

  // Analytics (Tautulli)
  analytics_most_watched:       analytics.handleAnalyticsMostWatched,
  analytics_user_stats:         analytics.handleAnalyticsUserStats,
  analytics_library_stats:      analytics.handleAnalyticsLibraryStats,
  analytics_recently_added:     analytics.handleAnalyticsRecentlyAdded,
  analytics_watch_time_trend:   analytics.handleAnalyticsWatchTimeTrend,
  analytics_transcode_stats:    analytics.handleAnalyticsTranscodeStats,
  analytics_concurrent_streams: analytics.handleAnalyticsConcurrentStreams,
  analytics_user_history:       analytics.handleAnalyticsUserHistory,

  // Smart Features
  recommend:                    smart.handleRecommend,
  build_watchlist:              smart.handleBuildWatchlist,
  library_report:               smart.handleLibraryReport,
  what_to_watch:                smart.handleWhatToWatch,
  media_quiz:                   smart.handleMediaQuiz,

  // Cross-Service Intelligence
  cross_actor_search:           cross.handleCrossActorSearch,
  cross_duplicate_check:        cross.handleCrossDuplicateCheck,
  cross_quality_audit:          cross.handleCrossQualityAudit,
  cross_space_analyzer:         cross.handleCrossSpaceAnalyzer,
  cross_watch_unwatched:        cross.handleCrossWatchUnwatched,
  cross_subtitle_audit:         cross.handleCrossSubtitleAudit,
  cross_release_monitor:        cross.handleCrossReleaseMonitor,

  // Automation
  auto_quality_upgrade:         automation.handleAutoQualityUpgrade,
  auto_cleanup:                 automation.handleAutoCleanup,
  auto_missing_search:          automation.handleAutoMissingSearch,
  scheduled_task:               automation.handleScheduledTask,
  proactive_notify:             automation.handleProactiveNotify,

  // Vision
  vision_identify_media:        vision.handleVisionIdentifyMedia,
  vision_analyze_poster:        vision.handleVisionAnalyzePoster,
  vision_ui_help:               vision.handleVisionUiHelp,
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
