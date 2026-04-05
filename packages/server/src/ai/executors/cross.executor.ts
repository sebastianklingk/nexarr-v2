import type { ToolResult } from '../executor.js';
import * as radarr from '../../services/radarr.service.js';
import * as sonarr from '../../services/sonarr.service.js';
import * as tmdb from '../../services/tmdb.service.js';
import * as tautulli from '../../services/tautulli.service.js';
import * as bazarr from '../../services/bazarr.service.js';

type Args = Record<string, unknown>;

// ── cross_actor_search ───────────────────────────────────────────────────────

export async function handleCrossActorSearch(args: Args): Promise<ToolResult> {
  const name = typeof args.name === 'string' ? args.name : '';
  if (!name) return { success: false, error: 'name ist erforderlich' };

  // Search TMDB for person
  const searchResult = await tmdb.searchPerson(name);
  const results = (searchResult as { results?: Array<{ id: number; name: string; known_for?: unknown[] }> }).results ?? [];
  if (results.length === 0) return { success: true, data: { message: `Keine Person "${name}" auf TMDB gefunden.` } };

  const person = results[0];
  const credits = await tmdb.getPersonCredits(person.id);
  const castCredits = (credits as { cast?: Array<{ id: number; title?: string; name?: string; media_type?: string }> }).cast ?? [];

  // Get library movies
  const movies = await radarr.getMovies();
  const movieTmdbIds = new Set(movies.map(m => m.tmdbId));

  // Match credits against library
  const inLibrary = castCredits.filter(c => movieTmdbIds.has(c.id));
  const notInLibrary = castCredits
    .filter(c => !movieTmdbIds.has(c.id) && c.media_type === 'movie')
    .slice(0, 10);

  return {
    success: true,
    data: {
      person: person.name,
      inLibrary: inLibrary.map(c => ({ title: c.title ?? c.name, tmdbId: c.id })),
      notInLibrary: notInLibrary.map(c => ({ title: c.title ?? c.name, tmdbId: c.id })),
      totalCredits: castCredits.length,
    },
  };
}

// ── cross_duplicate_check ────────────────────────────────────────────────────

export async function handleCrossDuplicateCheck(_args: Args): Promise<ToolResult> {
  const movies = await radarr.getMovies();

  // Find duplicates by tmdbId
  const seen = new Map<number, string[]>();
  for (const m of movies) {
    const existing = seen.get(m.tmdbId);
    if (existing) {
      existing.push(m.title);
    } else {
      seen.set(m.tmdbId, [m.title]);
    }
  }

  const duplicates = [...seen.entries()]
    .filter(([, titles]) => titles.length > 1)
    .map(([tmdbId, titles]) => ({ tmdbId, titles }));

  return {
    success: true,
    data: {
      duplicateCount: duplicates.length,
      duplicates: duplicates.slice(0, 20),
      totalMovies: movies.length,
    },
  };
}

// ── cross_quality_audit ──────────────────────────────────────────────────────

export async function handleCrossQualityAudit(args: Args): Promise<ToolResult> {
  const maxQuality = typeof args.max_quality === 'string' ? args.max_quality : '720p';
  const movies = await radarr.getMovies();

  // Filter movies with files below threshold
  const lowQuality = movies
    .filter(m => {
      if (!m.hasFile || !m.movieFile) return false;
      const qual = (m.movieFile as { quality?: { quality?: { name?: string } } })?.quality?.quality?.name ?? '';
      if (maxQuality === '720p') return qual.includes('480') || qual.includes('SDTV') || qual.includes('DVD');
      if (maxQuality === '1080p') return qual.includes('480') || qual.includes('720') || qual.includes('SDTV') || qual.includes('DVD');
      return false;
    })
    .map(m => ({
      title: m.title,
      year: m.year,
      quality: ((m.movieFile as { quality?: { quality?: { name?: string } } })?.quality?.quality?.name ?? 'unknown'),
      sizeGb: Math.round((m.sizeOnDisk ?? 0) / (1024 ** 3) * 10) / 10,
      id: m.id,
    }));

  return {
    success: true,
    data: {
      threshold: maxQuality,
      lowQualityCount: lowQuality.length,
      items: lowQuality.slice(0, 30),
      totalMovies: movies.length,
    },
  };
}

// ── cross_space_analyzer ─────────────────────────────────────────────────────

export async function handleCrossSpaceAnalyzer(_args: Args): Promise<ToolResult> {
  const [movies, rootFolders] = await Promise.all([
    radarr.getMovies(),
    radarr.getRootFolders(),
  ]);

  // Size by genre
  const genreSize: Record<string, number> = {};
  for (const m of movies) {
    const sizeGb = (m.sizeOnDisk ?? 0) / (1024 ** 3);
    for (const g of m.genres ?? []) {
      genreSize[g] = (genreSize[g] ?? 0) + sizeGb;
    }
  }

  const topGenresBySize = Object.entries(genreSize)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([genre, gb]) => ({ genre, sizeGb: Math.round(gb * 10) / 10 }));

  // Largest files
  const largest = [...movies]
    .filter(m => m.hasFile)
    .sort((a, b) => (b.sizeOnDisk ?? 0) - (a.sizeOnDisk ?? 0))
    .slice(0, 10)
    .map(m => ({
      title: m.title,
      sizeGb: Math.round((m.sizeOnDisk ?? 0) / (1024 ** 3) * 10) / 10,
    }));

  const totalSizeGb = Math.round(movies.reduce((s, m) => s + (m.sizeOnDisk ?? 0), 0) / (1024 ** 3) * 10) / 10;

  return {
    success: true,
    data: {
      rootFolders: rootFolders.map(rf => ({
        path: rf.path,
        freeSpaceGb: Math.round((rf.freeSpace ?? 0) / (1024 ** 3) * 10) / 10,
      })),
      totalSizeGb,
      topGenresBySize,
      largestFiles: largest,
      totalMovies: movies.length,
    },
  };
}

// ── cross_watch_unwatched ────────────────────────────────────────────────────

export async function handleCrossWatchUnwatched(args: Args): Promise<ToolResult> {
  const type = typeof args.type === 'string' ? args.type : 'movie';

  const [history, movies] = await Promise.all([
    tautulli.getHistory(500).catch(() => ({ data: [] })),
    type === 'movie' ? radarr.getMovies() : sonarr.getSeries(),
  ]);

  const historyData = (history as { data?: Array<{ title?: string; rating_key?: string }> })?.data ?? [];
  const watchedTitles = new Set(historyData.map(h => h.title?.toLowerCase()));

  const unwatched = movies
    .filter(m => !('hasFile' in m) || m.hasFile !== false)
    .filter(m => !watchedTitles.has(m.title.toLowerCase()))
    .map(m => ({ title: m.title, year: m.year, genres: m.genres ?? [] }));

  return {
    success: true,
    data: {
      unwatchedCount: unwatched.length,
      totalInLibrary: movies.length,
      watchedCount: movies.length - unwatched.length,
      unwatched: unwatched.slice(0, 30),
    },
  };
}

// ── cross_subtitle_audit ─────────────────────────────────────────────────────

export async function handleCrossSubtitleAudit(args: Args): Promise<ToolResult> {
  const language = typeof args.language === 'string' ? args.language : 'de';

  // Get movies from Radarr and check a sample via Bazarr
  const movies = await radarr.getMovies();
  const withFile = movies.filter(m => m.hasFile);

  // Check up to 50 movies for subtitle status
  const sample = withFile.slice(0, 50);
  const results = await Promise.allSettled(
    sample.map(m => bazarr.getMovieSubtitles(m.id)),
  );

  const missing: Array<{ title: string; id: number }> = [];
  const hasSubtitle: Array<{ title: string }> = [];

  results.forEach((r, i) => {
    if (r.status !== 'fulfilled') return;
    const info = r.value;
    const langs = (info as { languages?: string[] }).languages ?? [];
    if (langs.some(l => l.includes(language))) {
      hasSubtitle.push({ title: sample[i].title });
    } else {
      missing.push({ title: sample[i].title, id: sample[i].id });
    }
  });

  return {
    success: true,
    data: {
      language,
      sampleSize: sample.length,
      totalMoviesWithFile: withFile.length,
      missingCount: missing.length,
      hasSubtitleCount: hasSubtitle.length,
      missingSamples: missing.slice(0, 20),
    },
  };
}

// ── cross_release_monitor ────────────────────────────────────────────────────

export async function handleCrossReleaseMonitor(args: Args): Promise<ToolResult> {
  const personId = typeof args.person_id === 'number' ? args.person_id : undefined;
  const personName = typeof args.person_name === 'string' ? args.person_name : undefined;

  if (!personId && !personName) {
    return { success: false, error: 'person_id oder person_name erforderlich' };
  }

  let tmdbPersonId = personId;
  if (!tmdbPersonId && personName) {
    const search = await tmdb.searchPerson(personName);
    const results = (search as { results?: Array<{ id: number }> }).results ?? [];
    if (results.length === 0) return { success: true, data: { message: `Person "${personName}" nicht gefunden.` } };
    tmdbPersonId = results[0].id;
  }

  const credits = await tmdb.getPersonCredits(tmdbPersonId!);
  const castCredits = (credits as { cast?: Array<{ id: number; title?: string; name?: string; release_date?: string; first_air_date?: string }> }).cast ?? [];

  // Filter upcoming releases (future dates)
  const now = new Date().toISOString().slice(0, 10);
  const upcoming = castCredits
    .filter(c => {
      const date = c.release_date ?? c.first_air_date;
      return date && date > now;
    })
    .sort((a, b) => {
      const da = a.release_date ?? a.first_air_date ?? '';
      const db = b.release_date ?? b.first_air_date ?? '';
      return da.localeCompare(db);
    })
    .slice(0, 10);

  return {
    success: true,
    data: {
      personId: tmdbPersonId,
      upcoming: upcoming.map(c => ({
        title: c.title ?? c.name,
        releaseDate: c.release_date ?? c.first_air_date,
        tmdbId: c.id,
      })),
    },
  };
}
