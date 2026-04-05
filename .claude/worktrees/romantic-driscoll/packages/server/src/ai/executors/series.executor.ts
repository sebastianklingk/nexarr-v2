import type { ToolResult } from '../executor.js';
import * as sonarr from '../../services/sonarr.service.js';
import * as tmdb from '../../services/tmdb.service.js';

type Args = Record<string, unknown>;

export async function handleSeriesSearch(args: Args): Promise<ToolResult> {
  const query = String(args.query || '').toLowerCase();
  const series = await sonarr.getSeries();
  const matches = series
    .filter(s => s.title.toLowerCase().includes(query))
    .slice(0, 10)
    .map(s => {
      const stats = s.seasons?.reduce(
        (acc, season) => {
          acc.episodeFileCount += season.statistics?.episodeFileCount ?? 0;
          acc.totalEpisodeCount += season.statistics?.totalEpisodeCount ?? 0;
          return acc;
        },
        { episodeFileCount: 0, totalEpisodeCount: 0 }
      );
      return {
        id: s.id,
        title: s.title,
        year: s.year,
        seasonCount: s.seasons?.length ?? 0,
        status: s.status,
        episodeFileCount: stats?.episodeFileCount,
        totalEpisodeCount: stats?.totalEpisodeCount,
        genres: s.genres?.slice(0, 3),
      };
    });
  return { success: true, data: { count: matches.length, series: matches } };
}

export async function handleSeriesLookup(args: Args): Promise<ToolResult> {
  const results = await sonarr.lookup(String(args.query || ''));
  const compact = (results as Array<Record<string, unknown>>).slice(0, 5).map((s) => ({
    tvdbId: s.tvdbId,
    title: s.title,
    year: s.year,
    overview: typeof s.overview === 'string' ? s.overview.slice(0, 200) : '',
    seasonCount: s.seasonCount,
    status: s.status,
  }));
  return { success: true, data: compact };
}

export async function handleSeriesAdd(args: Args): Promise<ToolResult> {
  const tvdbId = Number(args.tvdbId);
  if (!tvdbId) return { success: false, error: 'tvdbId ist erforderlich' };

  const lookupResults = await sonarr.lookup(`tvdb:${tvdbId}`) as Array<Record<string, unknown>>;
  if (!lookupResults.length) return { success: false, error: 'Serie nicht gefunden' };

  const series = lookupResults[0];
  const rootFolders = await sonarr.getRootFolders();
  const profiles = await sonarr.getQualityProfiles() as Array<Record<string, unknown>>;

  const result = await sonarr.addSeries({
    ...series,
    rootFolderPath: rootFolders[0]?.path,
    qualityProfileId: profiles[0]?.id,
    monitored: true,
    addOptions: {
      searchForMissingEpisodes: args.searchNow !== false,
    },
  });

  return {
    success: true,
    data: {
      title: (result as Record<string, unknown>).title,
      year: (result as Record<string, unknown>).year,
      id: (result as Record<string, unknown>).id,
      searchStarted: args.searchNow !== false,
    },
  };
}

export async function handleSeriesDetails(args: Args): Promise<ToolResult> {
  const series = await sonarr.getSeriesById(Number(args.id));
  const stats = series.seasons?.reduce(
    (acc, season) => {
      acc.episodeFileCount += season.statistics?.episodeFileCount ?? 0;
      acc.totalEpisodeCount += season.statistics?.totalEpisodeCount ?? 0;
      return acc;
    },
    { episodeFileCount: 0, totalEpisodeCount: 0 }
  );
  return {
    success: true,
    data: {
      id: series.id,
      title: series.title,
      year: series.year,
      status: series.status,
      seasonCount: series.seasons?.length ?? 0,
      episodeFileCount: stats?.episodeFileCount,
      totalEpisodeCount: stats?.totalEpisodeCount,
      genres: series.genres,
      overview: series.overview?.slice(0, 300),
      path: series.path,
      monitored: series.monitored,
    },
  };
}

export async function handleSeriesDelete(args: Args): Promise<ToolResult> {
  const id = Number(args.id);
  if (!id) return { success: false, error: 'id ist erforderlich' };
  const deleteFiles = args.deleteFiles === true;
  await sonarr.deleteSeries(id, deleteFiles);
  return { success: true, data: { id, deleted: true, filesDeleted: deleteFiles } };
}

export async function handleSeriesEpisodes(args: Args): Promise<ToolResult> {
  const seriesId = Number(args.seriesId);
  if (!seriesId) return { success: false, error: 'seriesId ist erforderlich' };

  const episodes = await sonarr.getEpisodes(seriesId);
  const seasonNum = args.seasonNumber !== undefined ? Number(args.seasonNumber) : undefined;
  const filtered = seasonNum !== undefined
    ? episodes.filter(e => e.seasonNumber === seasonNum)
    : episodes;

  const compact = filtered.slice(0, 50).map(e => ({
    id: e.id,
    seasonNumber: e.seasonNumber,
    episodeNumber: e.episodeNumber,
    title: e.title,
    hasFile: e.hasFile,
    monitored: e.monitored,
    airDateUtc: e.airDateUtc,
  }));
  return { success: true, data: { seriesId, count: compact.length, episodes: compact } };
}

export async function handleSeriesTriggerSearch(args: Args): Promise<ToolResult> {
  const seriesId = Number(args.seriesId);
  if (!seriesId) return { success: false, error: 'seriesId ist erforderlich' };
  await sonarr.triggerSearch(seriesId);
  return { success: true, data: { seriesId, action: 'search_started' } };
}

export async function handleSeriesEpisodeSearch(args: Args): Promise<ToolResult> {
  const episodeId = Number(args.episodeId);
  if (!episodeId) return { success: false, error: 'episodeId ist erforderlich' };
  const releases = await sonarr.getEpisodeReleases(episodeId);
  const compact = (releases as Array<Record<string, unknown>>).slice(0, 15).map(r => ({
    guid: r.guid,
    title: r.title,
    indexer: r.indexer,
    indexerId: r.indexerId,
    sizeGb: typeof r.size === 'number' ? +(r.size / 1e9).toFixed(2) : null,
    quality: (r.quality as Record<string, unknown>)?.quality
      ? ((r.quality as Record<string, unknown>).quality as Record<string, unknown>)?.name
      : undefined,
    seeders: r.seeders,
    leechers: r.leechers,
    protocol: r.protocol,
  }));
  return { success: true, data: { episodeId, releases: compact } };
}

export async function handleSeriesGrabRelease(args: Args): Promise<ToolResult> {
  const guid = String(args.guid || '');
  const indexerId = Number(args.indexerId);
  if (!guid || !indexerId) return { success: false, error: 'guid und indexerId sind erforderlich' };
  await sonarr.downloadRelease({ guid, indexerId });
  return { success: true, data: { guid, indexerId, action: 'grabbed' } };
}

export async function handleSeriesMissing(_args: Args): Promise<ToolResult> {
  const result = await sonarr.getMissingEpisodes(50) as Record<string, unknown>;
  const records = Array.isArray(result) ? result : (result.records as Array<Record<string, unknown>>) ?? [];
  const compact = records.slice(0, 20).map(e => ({
    seriesId: e.seriesId,
    seriesTitle: (e.series as Record<string, unknown>)?.title,
    seasonNumber: e.seasonNumber,
    episodeNumber: e.episodeNumber,
    title: e.title,
    airDateUtc: e.airDateUtc,
  }));
  return { success: true, data: { count: records.length, episodes: compact } };
}

export async function handleSeriesHistory(args: Args): Promise<ToolResult> {
  const pageSize = Number(args.count) || 20;
  const result = await sonarr.getHistory(pageSize) as Record<string, unknown>;
  const records = Array.isArray(result) ? result : (result.records as Array<Record<string, unknown>>) ?? [];
  const compact = records.slice(0, pageSize).map(r => ({
    seriesId: r.seriesId,
    episodeId: r.episodeId,
    sourceTitle: r.sourceTitle,
    eventType: r.eventType,
    date: r.date,
  }));
  return { success: true, data: { entries: compact } };
}

export async function handleSeriesSeasonMonitor(args: Args): Promise<ToolResult> {
  const seriesId = Number(args.seriesId);
  const seasonNumber = Number(args.seasonNumber);
  const monitored = args.monitored === true;
  if (!seriesId || seasonNumber === undefined) {
    return { success: false, error: 'seriesId und seasonNumber sind erforderlich' };
  }
  await sonarr.updateSeasonMonitor(seriesId, seasonNumber, monitored);
  return { success: true, data: { seriesId, seasonNumber, monitored } };
}

export async function handleSeriesUpdate(args: Args): Promise<ToolResult> {
  const id = Number(args.id);
  if (!id) return { success: false, error: 'id ist erforderlich' };

  const series = await sonarr.getSeriesById(id);
  if (args.monitored !== undefined) series.monitored = args.monitored as boolean;
  if (args.qualityProfileId !== undefined) {
    (series as unknown as Record<string, unknown>).qualityProfileId = Number(args.qualityProfileId);
  }

  const updated = await sonarr.updateSeries(id, series);
  return {
    success: true,
    data: {
      id: updated.id,
      title: updated.title,
      monitored: updated.monitored,
    },
  };
}

export async function handleSeriesTmdbRich(args: Args): Promise<ToolResult> {
  const tmdbId = Number(args.tmdbId);
  if (!tmdbId) return { success: false, error: 'tmdbId ist erforderlich' };

  const [details, credits, videos, similar] = await Promise.allSettled([
    tmdb.getTvDetails(tmdbId),
    tmdb.getSeriesCredits(tmdbId),
    tmdb.getSeriesVideos(tmdbId),
    tmdb.getSimilarTv(tmdbId),
  ]);

  const d = details.status === 'fulfilled' ? details.value as Record<string, unknown> : {};
  const c = credits.status === 'fulfilled' ? credits.value : { cast: [], crew: [] };
  const v = videos.status === 'fulfilled' ? videos.value : { results: [] };
  const s = similar.status === 'fulfilled' ? similar.value as Array<Record<string, unknown>> : [];

  const trailers = v.results
    .filter(r => r.site === 'YouTube' && r.type === 'Trailer')
    .slice(0, 2)
    .map(r => ({ name: r.name, key: r.key }));

  return {
    success: true,
    data: {
      title: d.name,
      year: String(d.first_air_date || '').slice(0, 4),
      overview: typeof d.overview === 'string' ? d.overview.slice(0, 400) : '',
      rating: d.vote_average,
      seasons: d.number_of_seasons,
      episodes: d.number_of_episodes,
      genres: (d.genres as Array<{ name: string }> | undefined)?.map(g => g.name),
      posterUrl: d.poster_path ? `https://image.tmdb.org/t/p/w342${d.poster_path}` : null,
      cast: c.cast.slice(0, 5).map(a => ({
        name: a.name,
        character: a.character,
      })),
      trailers,
      similar: s.slice(0, 5).map(m => ({
        tmdbId: m.id,
        title: m.name,
        year: String(m.first_air_date || '').slice(0, 4),
        rating: m.vote_average,
      })),
    },
  };
}
