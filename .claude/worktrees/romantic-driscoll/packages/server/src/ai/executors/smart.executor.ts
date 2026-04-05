import type { ToolResult } from '../executor.js';
import * as radarr from '../../services/radarr.service.js';
import * as sonarr from '../../services/sonarr.service.js';
import * as tmdb from '../../services/tmdb.service.js';
import * as tautulli from '../../services/tautulli.service.js';
import * as plex from '../../services/plex.service.js';

type Args = Record<string, unknown>;

// ── recommend ────────────────────────────────────────────────────────────────

export async function handleRecommend(args: Args): Promise<ToolResult> {
  const mood = typeof args.mood === 'string' ? args.mood : undefined;
  const genre = typeof args.genre === 'string' ? args.genre : undefined;
  const type = typeof args.type === 'string' ? args.type : 'movie';

  // Get library + trending + history for context
  const [trending, homeStats] = await Promise.all([
    tmdb.getTrending(type === 'tv' ? 'tv' : 'movie').catch(() => ({ results: [] })),
    tautulli.getHomeStats(30, 5).catch(() => []),
  ]);

  const trendingItems = (trending as { results: unknown[] }).results?.slice(0, 10) ?? [];

  return {
    success: true,
    data: {
      recommendations: trendingItems,
      homeStats,
      context: { mood, genre, type },
      _cardType: 'media_carousel',
      title: mood ? `Empfehlungen (${mood})` : 'Empfehlungen',
      items: trendingItems,
    },
  };
}

// ── build_watchlist ──────────────────────────────────────────────────────────

export async function handleBuildWatchlist(args: Args): Promise<ToolResult> {
  const hours = typeof args.hours === 'number' ? args.hours : 3;
  const genre = typeof args.genre === 'string' ? args.genre : undefined;
  const type = typeof args.type === 'string' ? args.type : 'movie';
  const minuteBudget = hours * 60;

  // Get unwatched library items
  const movies = type === 'movie' ? await radarr.getMovies() : [];
  const series = type === 'tv' ? await sonarr.getSeries() : [];

  // Filter available (downloaded) movies and build watchlist within time budget
  const available = type === 'movie'
    ? movies.filter(m => m.hasFile).map(m => ({
        title: m.title,
        year: m.year,
        runtime: m.runtime ?? 0,
        tmdbId: m.tmdbId,
        genres: m.genres ?? [],
      }))
    : series.map(s => ({
        title: s.title,
        year: s.year,
        runtime: s.runtime ?? 45,
        tmdbId: s.tvdbId,
        genres: s.genres ?? [],
      }));

  // Filter by genre if specified
  const filtered = genre
    ? available.filter(m => m.genres.some(g => g.toLowerCase().includes(genre.toLowerCase())))
    : available;

  // Build watchlist within time budget
  let remaining = minuteBudget;
  const watchlist: typeof filtered = [];
  for (const item of filtered.sort(() => Math.random() - 0.5)) {
    if (item.runtime <= 0) continue;
    if (remaining < item.runtime) continue;
    watchlist.push(item);
    remaining -= item.runtime;
    if (watchlist.length >= 8) break;
  }

  const totalMinutes = watchlist.reduce((sum, m) => sum + m.runtime, 0);

  return {
    success: true,
    data: {
      watchlist,
      totalRuntime: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`,
      remainingBudget: `${Math.floor(remaining / 60)}h ${remaining % 60}m`,
      budget: `${hours}h`,
      genre: genre ?? 'alle',
    },
  };
}

// ── library_report ───────────────────────────────────────────────────────────

export async function handleLibraryReport(_args: Args): Promise<ToolResult> {
  const [movies, series, libs, homeStats] = await Promise.allSettled([
    radarr.getMovies(),
    sonarr.getSeries(),
    plex.getLibraries().catch(() => []),
    tautulli.getHomeStats(30, 5).catch(() => []),
  ]);

  const movieList = movies.status === 'fulfilled' ? movies.value : [];
  const seriesList = series.status === 'fulfilled' ? series.value : [];
  const plexLibs = libs.status === 'fulfilled' ? libs.value : [];
  const stats = homeStats.status === 'fulfilled' ? homeStats.value : [];

  // Genre distribution
  const genreCounts: Record<string, number> = {};
  for (const m of movieList) {
    for (const g of m.genres ?? []) {
      genreCounts[g] = (genreCounts[g] ?? 0) + 1;
    }
  }
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Quality stats
  const withFile = movieList.filter(m => m.hasFile);
  const totalSizeGb = movieList.reduce((sum, m) => sum + (m.sizeOnDisk ?? 0), 0) / (1024 ** 3);

  return {
    success: true,
    data: {
      movies: { total: movieList.length, downloaded: withFile.length, sizeGb: Math.round(totalSizeGb * 10) / 10 },
      series: { total: seriesList.length },
      plexLibraries: plexLibs,
      topGenres,
      homeStats: stats,
    },
  };
}

// ── what_to_watch ────────────────────────────────────────────────────────────

export async function handleWhatToWatch(args: Args): Promise<ToolResult> {
  const mood = typeof args.mood === 'string' ? args.mood : undefined;
  const type = typeof args.type === 'string' ? args.type : 'movie';

  const [movies, history] = await Promise.all([
    type === 'movie' ? radarr.getMovies() : sonarr.getSeries(),
    tautulli.getHistory(50).catch(() => ({ data: [] })),
  ]);

  // Filter downloaded/available
  const available = type === 'movie'
    ? (movies as Awaited<ReturnType<typeof radarr.getMovies>>).filter(m => m.hasFile)
    : movies;

  // Simple random pick from library
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  const suggestions = shuffled.slice(0, 5).map(m => ({
    title: m.title,
    year: m.year,
    genres: m.genres ?? [],
    runtime: ('runtime' in m ? m.runtime : 45) ?? 0,
  }));

  return {
    success: true,
    data: {
      suggestions,
      mood,
      type,
      recentHistory: history,
    },
  };
}

// ── media_quiz ───────────────────────────────────────────────────────────────

export async function handleMediaQuiz(args: Args): Promise<ToolResult> {
  const difficulty = typeof args.difficulty === 'string' ? args.difficulty : 'medium';
  const type = typeof args.type === 'string' ? args.type : 'movie';

  // Get trending for quiz material
  const trending = await tmdb.getTrending(type === 'tv' ? 'tv' : 'movie').catch(() => ({ results: [] }));
  const items = (trending as { results: Array<Record<string, unknown>> }).results ?? [];

  if (items.length === 0) {
    return { success: false, error: 'Keine TMDB-Daten für Quiz verfügbar.' };
  }

  // Pick random item
  const item = items[Math.floor(Math.random() * Math.min(items.length, 20))];

  return {
    success: true,
    data: {
      quiz: {
        overview: item.overview,
        releaseDate: item.release_date ?? item.first_air_date,
        voteAverage: item.vote_average,
        difficulty,
      },
      // Answer (for AI to reveal later)
      _answer: {
        title: item.title ?? item.name,
        posterPath: item.poster_path,
      },
    },
  };
}
