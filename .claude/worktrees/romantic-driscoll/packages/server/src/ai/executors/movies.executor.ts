import type { ToolResult } from '../executor.js';
import * as radarr from '../../services/radarr.service.js';
import * as tmdb from '../../services/tmdb.service.js';

type Args = Record<string, unknown>;

export async function handleMoviesSearch(args: Args): Promise<ToolResult> {
  const query = String(args.query || '').toLowerCase();
  const movies = await radarr.getMovies();
  const matches = movies
    .filter(m => m.title.toLowerCase().includes(query))
    .slice(0, 10)
    .map(m => ({
      id: m.id,
      title: m.title,
      year: m.year,
      hasFile: m.hasFile,
      quality: m.movieFile?.quality?.quality?.name,
      sizeGb: m.movieFile?.size ? +(m.movieFile.size / 1e9).toFixed(1) : null,
      imdbRating: m.ratings?.imdb?.value,
      tmdbId: m.tmdbId,
      genres: m.genres?.slice(0, 3),
    }));
  return { success: true, data: { count: matches.length, movies: matches } };
}

export async function handleMoviesLookup(args: Args): Promise<ToolResult> {
  const results = await radarr.lookup(String(args.query || ''));
  const compact = (results as Array<Record<string, unknown>>).slice(0, 5).map((m) => ({
    tmdbId: m.tmdbId,
    title: m.title,
    year: m.year,
    overview: typeof m.overview === 'string' ? m.overview.slice(0, 200) : '',
    genres: m.genres,
  }));
  return { success: true, data: compact };
}

export async function handleMoviesAdd(args: Args): Promise<ToolResult> {
  const tmdbId = Number(args.tmdbId);
  if (!tmdbId) return { success: false, error: 'tmdbId ist erforderlich' };

  const lookupResults = await radarr.lookup(`tmdb:${tmdbId}`) as Array<Record<string, unknown>>;
  if (!lookupResults.length) return { success: false, error: 'Film nicht auf TMDB gefunden' };

  const movie = lookupResults[0];
  const rootFolders = await radarr.getRootFolders();
  const profiles = await radarr.getQualityProfiles() as Array<Record<string, unknown>>;

  const result = await radarr.addMovie({
    ...movie,
    rootFolderPath: rootFolders[0]?.path,
    qualityProfileId: profiles[0]?.id,
    monitored: true,
    addOptions: {
      searchForMovie: args.searchNow !== false,
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

export async function handleMoviesDetails(args: Args): Promise<ToolResult> {
  const movie = await radarr.getMovie(Number(args.id));
  return {
    success: true,
    data: {
      id: movie.id,
      title: movie.title,
      year: movie.year,
      hasFile: movie.hasFile,
      quality: movie.movieFile?.quality?.quality?.name,
      sizeGb: movie.movieFile?.size ? +(movie.movieFile.size / 1e9).toFixed(1) : null,
      runtime: movie.runtime,
      genres: movie.genres,
      imdbRating: movie.ratings?.imdb?.value,
      tmdbRating: movie.ratings?.tmdb?.value,
      overview: movie.overview?.slice(0, 300),
      path: movie.path,
      monitored: movie.monitored,
    },
  };
}

export async function handleMoviesDelete(args: Args): Promise<ToolResult> {
  const id = Number(args.id);
  if (!id) return { success: false, error: 'id ist erforderlich' };
  const deleteFiles = args.deleteFiles === true;
  await radarr.deleteMovie(id, deleteFiles);
  return { success: true, data: { id, deleted: true, filesDeleted: deleteFiles } };
}

export async function handleMoviesTriggerSearch(args: Args): Promise<ToolResult> {
  const movieId = Number(args.movieId);
  if (!movieId) return { success: false, error: 'movieId ist erforderlich' };
  await radarr.triggerSearch([movieId]);
  return { success: true, data: { movieId, action: 'search_started' } };
}

export async function handleMoviesInteractiveSearch(args: Args): Promise<ToolResult> {
  const movieId = Number(args.movieId);
  if (!movieId) return { success: false, error: 'movieId ist erforderlich' };
  const releases = await radarr.getReleases(movieId);
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
    approved: r.approved,
    rejections: r.rejections,
  }));
  return { success: true, data: { movieId, releases: compact } };
}

export async function handleMoviesGrabRelease(args: Args): Promise<ToolResult> {
  const guid = String(args.guid || '');
  const indexerId = Number(args.indexerId);
  if (!guid || !indexerId) return { success: false, error: 'guid und indexerId sind erforderlich' };
  await radarr.downloadRelease({ guid, indexerId });
  return { success: true, data: { guid, indexerId, action: 'grabbed' } };
}

export async function handleMoviesMissing(_args: Args): Promise<ToolResult> {
  const result = await radarr.getMissingMovies(50) as Record<string, unknown>;
  const records = Array.isArray(result) ? result : (result.records as Array<Record<string, unknown>>) ?? [];
  const compact = records.slice(0, 20).map(m => ({
    id: m.id,
    title: m.title,
    year: m.year,
    monitored: m.monitored,
    tmdbId: m.tmdbId,
  }));
  return { success: true, data: { count: records.length, movies: compact } };
}

export async function handleMoviesHistory(args: Args): Promise<ToolResult> {
  const pageSize = Number(args.count) || 20;
  const result = await radarr.getHistory(pageSize) as Record<string, unknown>;
  const records = Array.isArray(result) ? result : (result.records as Array<Record<string, unknown>>) ?? [];
  const compact = records.slice(0, pageSize).map(r => ({
    movieId: r.movieId,
    sourceTitle: r.sourceTitle,
    eventType: r.eventType,
    date: r.date,
    quality: (r.quality as Record<string, unknown>)?.quality
      ? ((r.quality as Record<string, unknown>).quality as Record<string, unknown>)?.name
      : undefined,
  }));
  return { success: true, data: { entries: compact } };
}

export async function handleMoviesUpdate(args: Args): Promise<ToolResult> {
  const id = Number(args.id);
  if (!id) return { success: false, error: 'id ist erforderlich' };

  const movie = await radarr.getMovie(id);
  if (args.monitored !== undefined) movie.monitored = args.monitored as boolean;
  if (args.qualityProfileId !== undefined) {
    (movie as unknown as Record<string, unknown>).qualityProfileId = Number(args.qualityProfileId);
  }

  const updated = await radarr.updateMovie(id, movie);
  return {
    success: true,
    data: {
      id: updated.id,
      title: updated.title,
      monitored: updated.monitored,
    },
  };
}

export async function handleMoviesTmdbRich(args: Args): Promise<ToolResult> {
  const tmdbId = Number(args.tmdbId);
  if (!tmdbId) return { success: false, error: 'tmdbId ist erforderlich' };

  const [details, credits, videos, similar] = await Promise.allSettled([
    tmdb.getMovieDetails(tmdbId),
    tmdb.getMovieCredits(tmdbId),
    tmdb.getMovieVideos(tmdbId),
    tmdb.getSimilarMovies(tmdbId),
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
      title: d.title,
      year: String(d.release_date || '').slice(0, 4),
      overview: typeof d.overview === 'string' ? d.overview.slice(0, 400) : '',
      rating: d.vote_average,
      runtime: d.runtime,
      genres: (d.genres as Array<{ name: string }> | undefined)?.map(g => g.name),
      posterUrl: d.poster_path ? `https://image.tmdb.org/t/p/w342${d.poster_path}` : null,
      cast: c.cast.slice(0, 5).map(a => ({
        name: a.name,
        character: a.character,
      })),
      director: c.crew.find(p => p.job === 'Director')?.name ?? null,
      trailers,
      similar: s.slice(0, 5).map(m => ({
        tmdbId: m.id,
        title: m.title,
        year: String(m.release_date || '').slice(0, 4),
        rating: m.vote_average,
      })),
    },
  };
}

export async function handleMoviesQualityProfiles(_args: Args): Promise<ToolResult> {
  const profiles = await radarr.getQualityProfiles() as Array<Record<string, unknown>>;
  return {
    success: true,
    data: profiles.map(p => ({ id: p.id, name: p.name })),
  };
}
