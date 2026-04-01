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

// ── Read ──────────────────────────────────────────────────────────────────────

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

// Episode-Files mit vollständiger MediaInfo für eine Serie
export async function getEpisodeFiles(seriesId: number): Promise<unknown[]> {
  return C.fetch(`sonarr_episodefiles_${seriesId}`, async () => {
    const { data } = await client().get('/episodefile', {
      params: { seriesId },
    });
    return data as unknown[];
  }, TTL.QUEUE);
}

export async function getQueue(): Promise<unknown> {
  return C.fetch('sonarr_queue', async () => {
    const { data } = await client().get('/queue', { params: { pageSize: 100 } });
    return data;
  }, TTL.QUEUE);
}

export async function getRootFolders(): Promise<Array<{ id: number; path: string; freeSpace: number }>> {
  return C.fetch('sonarr_rootfolders', async () => {
    const { data } = await client().get('/rootfolder');
    return data;
  }, TTL.LONG);
}

export async function getCalendar(start: string, end: string): Promise<unknown[]> {
  const key = `sonarr_calendar_${start}_${end}`;
  return C.fetch(key, async () => {
    const { data } = await client().get('/calendar', { params: { start, end, includeSeries: true, includeEpisodeFile: true } });
    return data as unknown[];
  }, TTL.CALENDAR);
}

// Releases für Interactive Search (kein Cache)
export async function getEpisodeReleases(episodeId: number): Promise<unknown[]> {
  const { data } = await client().get('/release', {
    params: { episodeId },
    timeout: 60_000,
  });
  return data as unknown[];
}

// ── Write / Actions ───────────────────────────────────────────────────────────

export async function updateSeries(id: number, body: SonarrSeries): Promise<SonarrSeries> {
  const { data } = await client().put<SonarrSeries>(`/series/${id}`, body);
  C.invalidate(`sonarr_series_${id}`);
  C.invalidate('sonarr_series');
  return data;
}

export async function deleteSeries(id: number, deleteFiles = false): Promise<void> {
  await client().delete(`/series/${id}`, {
    params: { deleteFiles, addImportExclusion: false },
  });
  C.invalidate(`sonarr_series_${id}`);
  C.invalidate('sonarr_series');
}

export async function sendCommand(body: Record<string, unknown>): Promise<unknown> {
  const { data } = await client().post('/command', body);
  return data;
}

export async function downloadRelease(body: { guid: string; indexerId: number }): Promise<unknown> {
  const { data } = await client().post('/release', body);
  return data;
}

export async function deleteEpisodeFile(fileId: number): Promise<void> {
  await client().delete(`/episodefile/${fileId}`);
  // Kein direkter Cache-Key bekannt, daher Pattern-Invalidierung
  C.invalidatePattern('sonarr_episodefiles_');
}

export async function updateEpisode(id: number, body: SonarrEpisode): Promise<SonarrEpisode> {
  const { data } = await client().put<SonarrEpisode>(`/episode/${id}`, body);
  // Episoden-Cache für die Series invalidieren
  if (body.seriesId) C.invalidate(`sonarr_episodes_${body.seriesId}`);
  return data;
}

// Staffel-Überwachung: holt aktuelle Serie, ändert monitored der Staffel, sendet zurück
export async function updateSeasonMonitor(
  seriesId: number,
  seasonNumber: number,
  monitored: boolean,
): Promise<SonarrSeries> {
  // Aktuelles Serie-Objekt holen (frisch, nicht aus Cache)
  const { data: current } = await client().get<SonarrSeries>(`/series/${seriesId}`);
  const updated = {
    ...current,
    seasons: current.seasons.map(s =>
      s.seasonNumber === seasonNumber ? { ...s, monitored } : s,
    ),
  };
  const { data } = await client().put<SonarrSeries>(`/series/${seriesId}`, updated);
  C.invalidate(`sonarr_series_${seriesId}`);
  C.invalidate('sonarr_series');
  return data;
}

export async function lookup(term: string): Promise<unknown[]> {
  const { data } = await client().get('/series/lookup', { params: { term } });
  return data as unknown[];
}

export async function addSeries(body: Record<string, unknown>): Promise<unknown> {
  const { data } = await client().post('/series', body);
  C.invalidate('sonarr_series');
  return data;
}

export async function triggerSearch(seriesId: number): Promise<void> {
  await client().post('/command', { name: 'SeriesSearch', seriesId });
}

export async function getQualityProfiles(): Promise<unknown[]> {
  return C.fetch('sonarr_qualityprofiles', async () => {
    const { data } = await client().get('/qualityprofile');
    return data;
  }, TTL.LONG);
}

export async function getHealth(): Promise<unknown[]> {
  const { data } = await client().get('/health');
  return data;
}

export async function testAllIndexers(): Promise<void> {
  await client().post('/indexer/testall');
}

export async function getMissingEpisodes(pageSize = 100): Promise<unknown> {
  const { data } = await client().get('/wanted/missing', {
    params: { pageSize, monitored: true },
  });
  return data;
}

export async function getHistory(pageSize = 100): Promise<unknown> {
  const { data } = await client().get('/history', { params: { pageSize } });
  return data;
}
