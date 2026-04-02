import axios from 'axios';
import { env } from '../config/env.js';
import { C } from '../cache/cache.js';
import { TTL } from '../config/constants.js';
import type { BazarrSubtitle } from '@nexarr/shared';

function client() {
  if (!env.BAZARR_URL || !env.BAZARR_API_KEY) {
    throw Object.assign(new Error('Bazarr nicht konfiguriert'), { status: 503 });
  }
  return axios.create({
    baseURL: env.BAZARR_URL,
    headers: { 'X-Api-Key': env.BAZARR_API_KEY },
    timeout: 10_000,
  });
}

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface BazarrSubtitleFull extends BazarrSubtitle {
  provider_name?: string;
  file_size?:     number;
}

export interface BazarrLanguage {
  code2: string;
  code3: string;
  name:  string;
}

// Vollständiges Bazarr Movie-Objekt (wie v1 es nutzt)
export interface BazarrMovieFull {
  radarrId:          number;
  title:             string;
  sceneName?:        string;
  monitored:         boolean;
  subtitles:         BazarrSubtitleFull[];
  missing_subtitles: BazarrSubtitleFull[];
  audio_language:    BazarrLanguage[];
}

// Vereinfachtes Objekt für Rückwärtskompatibilität
export interface MovieSubtitleInfo {
  available: BazarrSubtitle[];
  missing:   BazarrSubtitle[];
  monitored: boolean;
}

export interface BazarrEpisodeSubtitles {
  sonarrEpisodeId: number;
  sonarrSeriesId:  number;
  title:           string;
  subtitles:       BazarrSubtitleFull[];
  missing_subtitles: BazarrSubtitleFull[];
}

// ── Movie Subtitles ───────────────────────────────────────────────────────────

// Vollständiges Objekt (für neues Bazarr-Widget)
export async function getMovieSubtitlesFull(radarrId: number): Promise<BazarrMovieFull | null> {
  return C.fetch(`bazarr_movie_full_${radarrId}`, async () => {
    const { data } = await client().get('/api/movies', {
      params: { radarrid: radarrId },
    });
    const movie = data?.data?.[0] ?? null;
    if (!movie) return null;
    return {
      radarrId:          movie.radarrId ?? radarrId,
      title:             movie.title ?? '',
      sceneName:         movie.sceneName ?? undefined,
      monitored:         movie.monitored ?? false,
      subtitles:         movie.subtitles        ?? [],
      missing_subtitles: movie.missing_subtitles ?? [],
      audio_language:    movie.audio_language    ?? [],
    } as BazarrMovieFull;
  }, TTL.DETAIL);
}

// Vereinfacht (Rückwärtskompatibilität mit bestehendem Tab)
export async function getMovieSubtitles(radarrId: number): Promise<MovieSubtitleInfo> {
  const full = await getMovieSubtitlesFull(radarrId);
  if (!full) return { available: [], missing: [], monitored: false };
  return {
    available: full.subtitles,
    missing:   full.missing_subtitles,
    monitored: full.monitored,
  };
}

export async function triggerMovieSubtitleSearch(radarrId: number, language: string): Promise<void> {
  await client().post('/api/subtitles', null, {
    params: { radarrid: radarrId, language, type: 'movie' },
  });
  C.invalidate(`bazarr_movie_full_${radarrId}`);
  C.invalidate(`bazarr_subs_movie_${radarrId}`);
}

// Gesamtsuche für einen Film (ohne Sprachfilter – wie v1)
export async function searchMovieSubtitles(radarrId: number): Promise<void> {
  await client().post('/api/subtitles', null, {
    params: { radarrid: radarrId, type: 'movie', action: 'search' },
  });
  C.invalidate(`bazarr_movie_full_${radarrId}`);
}

export async function deleteMovieSubtitle(radarrId: number, language: string, path: string): Promise<void> {
  await client().delete('/api/subtitles', {
    params: { radarrid: radarrId, language, path, type: 'movie' },
  });
  C.invalidate(`bazarr_movie_full_${radarrId}`);
  C.invalidate(`bazarr_subs_movie_${radarrId}`);
}

// ── Episode Subtitles ─────────────────────────────────────────────────────────

// Alle Episode-Untertitel einer Serie (für SeriesDetailView – parallel laden)
// Bazarr erwartet 'seriesid[]' als Array-Parameter (wie PHP $_GET)
export async function getEpisodeSubtitlesBySeries(sonarrSeriesId: number): Promise<BazarrEpisodeSubtitles[]> {
  return C.fetch(`bazarr_episodes_series_${sonarrSeriesId}`, async () => {
    const { data } = await client().get('/api/episodes', {
      params: { 'seriesid[]': sonarrSeriesId },
    });
    return (data?.data ?? []) as BazarrEpisodeSubtitles[];
  }, TTL.COLLECTION);
}

// Untertitel-Suche für eine einzelne Episode
export async function searchEpisodeSubtitles(episodeId: number): Promise<void> {
  await client().post('/api/subtitles', null, {
    params: { episodeid: episodeId, type: 'episode', action: 'search' },
  });
  // Serie aus episodeId nicht bekannt → Pattern-Invalidierung
  C.invalidatePattern('bazarr_episodes_series_');
}

export async function deleteEpisodeSubtitle(episodeId: number, language: string, path: string): Promise<void> {
  await client().delete('/api/subtitles', {
    params: { episodeid: episodeId, language, path, type: 'episode' },
  });
  C.invalidatePattern('bazarr_episodes_series_');
}

// ── System ────────────────────────────────────────────────────────────────────

export async function getStatus(): Promise<unknown> {
  return C.fetch('bazarr_status', async () => {
    const { data } = await client().get('/api/system/status');
    return data;
  }, TTL.LONG);
}
