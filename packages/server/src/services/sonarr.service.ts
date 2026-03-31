import axios from 'axios';
import { env } from '../config/env.js';
import { C } from '../cache/cache.js';
import { TTL } from '../config/constants.js';
import type { SonarrSeries, SonarrEpisode } from '@nexarr/shared';

function client() {
  if (!env.SONARR_URL || !env.SONARR_API_KEY) {
    throw Object.assign(new Error('Sonarr nicht konfiguriert'), { status: 503 });
  }
  return axios.create({
    baseURL: `${env.SONARR_URL}/api/v3`,
    headers: { 'X-Api-Key': env.SONARR_API_KEY },
    timeout: 10_000,
  });
}

export async function getSeries(): Promise<SonarrSeries[]> {
  return C.fetch('sonarr_series', async () => {
    const { data } = await client().get<SonarrSeries[]>('/series');
    return data;
  }, TTL.COLLECTION);
}

export async function getSeriesById(id: number): Promise<SonarrSeries> {
  return C.fetch(`sonarr_series_${id}`, async () => {
    const { data } = await client().get<SonarrSeries>(`/series/${id}`);
    return data;
  }, TTL.DETAIL);
}

export async function getEpisodes(seriesId: number): Promise<SonarrEpisode[]> {
  return C.fetch(`sonarr_episodes_${seriesId}`, async () => {
    const { data } = await client().get<SonarrEpisode[]>('/episode', {
      params: { seriesId },
    });
    return data;
  }, TTL.DETAIL);
}

export async function getQueue(): Promise<unknown> {
  return C.fetch('sonarr_queue', async () => {
    const { data } = await client().get('/queue', { params: { pageSize: 100 } });
    return data;
  }, TTL.QUEUE);
}

export async function getCalendar(start: string, end: string): Promise<unknown[]> {
  const key = `sonarr_calendar_${start}_${end}`;
  return C.fetch(key, async () => {
    const { data } = await client().get('/calendar', { params: { start, end, includeSeries: true } });
    return data as unknown[];
  }, TTL.CALENDAR);
}
