import axios from 'axios';
import { env } from '../config/env.js';
import { C } from '../cache/cache.js';
import { TTL } from '../config/constants.js';
import type { TMDBCredits, TMDBVideos } from '@nexarr/shared';

const TMDB_BASE = 'https://api.themoviedb.org/3';

function client() {
  if (!env.TMDB_API_KEY) {
    throw Object.assign(new Error('TMDB nicht konfiguriert'), { status: 503 });
  }
  return axios.create({
    baseURL: TMDB_BASE,
    params:  { api_key: env.TMDB_API_KEY, language: 'de-DE' },
    timeout: 10_000,
  });
}

export async function getMovieCredits(tmdbId: number): Promise<TMDBCredits> {
  return C.fetch(`tmdb_movie_credits_${tmdbId}`, async () => {
    const { data } = await client().get<TMDBCredits>(`/movie/${tmdbId}/credits`);
    // Cast auf max. 20 kürzen, nur relevante Crew
    return {
      cast: data.cast.slice(0, 20),
      crew: data.crew.filter(c =>
        ['Director', 'Producer', 'Screenplay', 'Writer', 'Story', 'Director of Photography'].includes(c.job)
      ).slice(0, 10),
    };
  }, TTL.DETAIL);
}

export async function getMovieVideos(tmdbId: number): Promise<TMDBVideos> {
  return C.fetch(`tmdb_movie_videos_${tmdbId}`, async () => {
    // Erst Deutsch, dann Englisch als Fallback
    const [de, en] = await Promise.all([
      client().get<TMDBVideos>(`/movie/${tmdbId}/videos`, { params: { api_key: env.TMDB_API_KEY, language: 'de-DE' } }),
      client().get<TMDBVideos>(`/movie/${tmdbId}/videos`, { params: { api_key: env.TMDB_API_KEY, language: 'en-US' } }),
    ]);
    // Kombination: deutsche zuerst, dann englische (ohne Duplikate)
    const deIds = new Set(de.data.results.map(v => v.id));
    const combined = [
      ...de.data.results,
      ...en.data.results.filter(v => !deIds.has(v.id)),
    ];
    return { results: combined.filter(v => v.site === 'YouTube') };
  }, TTL.DETAIL);
}

export async function getSeriesCredits(tmdbId: number): Promise<TMDBCredits> {
  return C.fetch(`tmdb_series_credits_${tmdbId}`, async () => {
    const { data } = await client().get<TMDBCredits>(`/tv/${tmdbId}/credits`);
    return {
      cast: data.cast.slice(0, 20),
      crew: data.crew.filter(c =>
        ['Creator', 'Executive Producer', 'Showrunner', 'Director'].includes(c.job)
      ).slice(0, 8),
    };
  }, TTL.DETAIL);
}

// ── Discover / Trending ──────────────────────────────────────────────────────

export async function getTrending(
  type: 'movie' | 'tv',
  window: 'week' | 'day' = 'week',
): Promise<unknown[]> {
  return C.fetch(`tmdb_trending_${type}_${window}`, async () => {
    const { data } = await client().get<{ results: unknown[] }>(`/trending/${type}/${window}`);
    return data.results ?? [];
  }, TTL.STATS); // TTL.STATS = kurz, Trending ändert sich täglich
}

export async function discover(
  type: 'movie' | 'tv',
  params: {
    genre?: string;
    min_rating?: number;
    min_votes?: number;
    sort_by?: string;
    page?: number;
  } = {},
): Promise<unknown[]> {
  const key = `tmdb_discover_${type}_${JSON.stringify(params)}`;
  return C.fetch(key, async () => {
    const qParams: Record<string, string | number> = {
      'vote_average.gte': params.min_rating ?? 0,
      'vote_count.gte':   params.min_votes  ?? 50,
      sort_by:            params.sort_by    ?? 'popularity.desc',
      page:               params.page       ?? 1,
    };
    if (params.genre) qParams['with_genres'] = params.genre;
    const { data } = await client().get<{ results: unknown[] }>(`/discover/${type}`, { params: qParams });
    return data.results ?? [];
  }, TTL.LONG);
}

export async function getMovieDetails(tmdbId: number): Promise<unknown> {
  return C.fetch(`tmdb_movie_detail_${tmdbId}`, async () => {
    const { data } = await client().get(`/movie/${tmdbId}`, {
      params: { append_to_response: 'credits' },
    });
    if (data.credits) {
      data.credits.cast  = (data.credits.cast  ?? []).slice(0, 20);
      data.credits.crew  = (data.credits.crew  ?? [])
        .filter((c: { job: string }) => ['Director','Producer','Screenplay','Writer','Director of Photography'].includes(c.job))
        .slice(0, 10);
    }
    return data;
  }, TTL.DETAIL);
}

export async function getTvDetails(tmdbId: number): Promise<unknown> {
  return C.fetch(`tmdb_tv_detail_${tmdbId}`, async () => {
    const { data } = await client().get(`/tv/${tmdbId}`, {
      params: { append_to_response: 'credits' },
    });
    if (data.credits) {
      data.credits.cast = (data.credits.cast ?? []).slice(0, 20);
      data.credits.crew = (data.credits.crew ?? [])
        .filter((c: { job: string }) => ['Creator','Executive Producer','Director'].includes(c.job))
        .slice(0, 8);
    }
    return data;
  }, TTL.DETAIL);
}

export async function getSimilarMovies(tmdbId: number): Promise<unknown[]> {
  return C.fetch(`tmdb_movie_similar_${tmdbId}`, async () => {
    const { data } = await client().get<{ results: unknown[] }>(`/movie/${tmdbId}/similar`);
    return data.results ?? [];
  }, TTL.LONG);
}

export async function getSimilarTv(tmdbId: number): Promise<unknown[]> {
  return C.fetch(`tmdb_tv_similar_${tmdbId}`, async () => {
    const { data } = await client().get<{ results: unknown[] }>(`/tv/${tmdbId}/similar`);
    return data.results ?? [];
  }, TTL.LONG);
}

// TMDB-ID via TVDB-ID ermitteln (für Sonarr-Integration)
export async function findTmdbIdByTvdbId(tvdbId: number): Promise<number | null> {
  return C.fetch(`tmdb_find_tvdb_${tvdbId}`, async () => {
    const { data } = await client().get<{ tv_results: Array<{ id: number }> }>(`/find/${tvdbId}`, {
      params: { api_key: env.TMDB_API_KEY, external_source: 'tvdb_id' },
    });
    return data.tv_results?.[0]?.id ?? null;
  }, TTL.LONG);
}

export async function getSeriesVideos(tmdbId: number): Promise<TMDBVideos> {
  return C.fetch(`tmdb_series_videos_${tmdbId}`, async () => {
    const [de, en] = await Promise.all([
      client().get<TMDBVideos>(`/tv/${tmdbId}/videos`, { params: { api_key: env.TMDB_API_KEY, language: 'de-DE' } }),
      client().get<TMDBVideos>(`/tv/${tmdbId}/videos`, { params: { api_key: env.TMDB_API_KEY, language: 'en-US' } }),
    ]);
    const deIds = new Set(de.data.results.map(v => v.id));
    const combined = [
      ...de.data.results,
      ...en.data.results.filter(v => !deIds.has(v.id)),
    ];
    return { results: combined.filter(v => v.site === 'YouTube') };
  }, TTL.DETAIL);
}
