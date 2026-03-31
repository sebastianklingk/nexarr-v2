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
