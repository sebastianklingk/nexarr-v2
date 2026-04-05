import type { ToolResult } from '../executor.js';
import * as tautulli from '../../services/tautulli.service.js';

type Args = Record<string, unknown>;

// ── analytics_most_watched ───────────────────────────────────────────────────

export async function handleAnalyticsMostWatched(args: Args): Promise<ToolResult> {
  const timeRange = typeof args.time_range === 'number' ? args.time_range : 30;
  const count = typeof args.count === 'number' ? args.count : 10;
  const stats = await tautulli.getHomeStats(timeRange, count);
  return { success: true, data: stats };
}

// ── analytics_user_stats ─────────────────────────────────────────────────────

export async function handleAnalyticsUserStats(args: Args): Promise<ToolResult> {
  const userId = Number(args.user_id);
  if (!userId) {
    // Return user list so AI can pick one
    const users = await tautulli.getUsers();
    return { success: true, data: { message: 'user_id benötigt. Verfügbare User:', users } };
  }
  const [watchTime, playerStats] = await Promise.all([
    tautulli.getUserWatchTimeStats(userId),
    tautulli.getUserPlayerStats(userId),
  ]);
  return { success: true, data: { watchTime, playerStats } };
}

// ── analytics_library_stats ──────────────────────────────────────────────────

export async function handleAnalyticsLibraryStats(args: Args): Promise<ToolResult> {
  const sectionId = Number(args.section_id);
  if (sectionId) {
    const stats = await tautulli.getLibraryWatchTimeStats(sectionId);
    return { success: true, data: stats };
  }
  // Return all libraries overview
  const libs = await tautulli.getLibrariesTable();
  return { success: true, data: libs };
}

// ── analytics_recently_added ─────────────────────────────────────────────────

export async function handleAnalyticsRecentlyAdded(args: Args): Promise<ToolResult> {
  const count = typeof args.count === 'number' ? args.count : 25;
  const items = await tautulli.getRecentlyAdded(count);
  return { success: true, data: items };
}

// ── analytics_watch_time_trend ───────────────────────────────────────────────

export async function handleAnalyticsWatchTimeTrend(args: Args): Promise<ToolResult> {
  const timeRange = typeof args.time_range === 'number' ? args.time_range : 30;
  const groupBy = typeof args.group_by === 'string' ? args.group_by : 'date';

  if (groupBy === 'day_of_week') {
    const data = await tautulli.getPlaysByDayOfWeek(timeRange);
    return { success: true, data };
  }
  if (groupBy === 'hour_of_day') {
    const data = await tautulli.getPlaysByHourOfDay(timeRange);
    return { success: true, data };
  }
  // Default: by date
  const data = await tautulli.getPlaysByDate(timeRange);
  return { success: true, data };
}

// ── analytics_transcode_stats ────────────────────────────────────────────────

export async function handleAnalyticsTranscodeStats(args: Args): Promise<ToolResult> {
  const timeRange = typeof args.time_range === 'number' ? args.time_range : 30;
  const [streamType, platforms] = await Promise.all([
    tautulli.getPlaysByStreamType(timeRange),
    tautulli.getStreamTypeByTopPlatforms(timeRange),
  ]);
  return { success: true, data: { streamType, platforms } };
}

// ── analytics_concurrent_streams ─────────────────────────────────────────────

export async function handleAnalyticsConcurrentStreams(_args: Args): Promise<ToolResult> {
  // Use current activity for live concurrent + home stats for historical peaks
  const [activity, homeStats] = await Promise.all([
    tautulli.getActivity(),
    tautulli.getHomeStats(30, 1),
  ]);
  return {
    success: true,
    data: {
      currentStreams: activity.stream_count,
      directPlay: activity.stream_count_direct_play,
      directStream: activity.stream_count_direct_stream,
      transcode: activity.stream_count_transcode,
      totalBandwidth: activity.total_bandwidth,
      lanBandwidth: activity.lan_bandwidth,
      wanBandwidth: activity.wan_bandwidth,
      homeStats,
    },
  };
}

// ── analytics_user_history ───────────────────────────────────────────────────

export async function handleAnalyticsUserHistory(args: Args): Promise<ToolResult> {
  const user = typeof args.user === 'string' ? args.user : undefined;
  const mediaType = typeof args.media_type === 'string' ? args.media_type : undefined;
  const length = typeof args.length === 'number' ? args.length : 25;

  const data = await tautulli.getHistoryFiltered({
    length,
    media_type: mediaType,
    user,
  });
  return { success: true, data };
}
