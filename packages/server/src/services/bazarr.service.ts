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

// Bazarr gibt Untertitel in einem verschachtelten Format zurück
interface BazarrMovieResponse {
  data: Array<{
    radarrId: number;
    title: string;
    subtitles: BazarrSubtitle[] | null;
    missing_subtitles: BazarrSubtitle[] | null;
    monitored: boolean;
  }>;
}

export interface MovieSubtitleInfo {
  available: BazarrSubtitle[];
  missing:   BazarrSubtitle[];
  monitored: boolean;
}

export async function getMovieSubtitles(radarrId: number): Promise<MovieSubtitleInfo> {
  return C.fetch(`bazarr_subs_movie_${radarrId}`, async () => {
    const { data } = await client().get<BazarrMovieResponse>('/api/movies', {
      params: { radarrid: radarrId },
    });
    const movie = data.data?.[0];
    if (!movie) return { available: [], missing: [], monitored: false };
    return {
      available: movie.subtitles        ?? [],
      missing:   movie.missing_subtitles ?? [],
      monitored: movie.monitored ?? false,
    };
  }, TTL.DETAIL);
}

export async function triggerMovieSubtitleSearch(radarrId: number, language: string): Promise<void> {
  await client().post('/api/subtitles', null, {
    params: { radarrid: radarrId, language, type: 'movie' },
  });
  C.invalidate(`bazarr_subs_movie_${radarrId}`);
}

export async function deleteMovieSubtitle(radarrId: number, language: string, path: string): Promise<void> {
  await client().delete('/api/subtitles', {
    params: { radarrid: radarrId, language, path, type: 'movie' },
  });
  C.invalidate(`bazarr_subs_movie_${radarrId}`);
}

export async function getStatus(): Promise<unknown> {
  return C.fetch('bazarr_status', async () => {
    const { data } = await client().get('/api/system/status');
    return data;
  }, TTL.LONG);
}
