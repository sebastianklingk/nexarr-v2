import type { ToolResult } from '../executor.js';

type Args = Record<string, unknown>;

const ALLOWED_PATHS = [
  '/dashboard', '/movies', '/series', '/music', '/downloads',
  '/calendar', '/discover', '/streams', '/indexer', '/overseerr',
  '/audiobookshelf', '/gotify', '/settings', '/search', '/tautulli',
];

export async function handleNavigateTo(args: Args): Promise<ToolResult> {
  const path = String(args.path || '');
  if (!path) return { success: false, error: 'path ist erforderlich' };

  // Allow exact matches or parameterized paths like /movies/123
  const isAllowed = ALLOWED_PATHS.some(p =>
    path === p || path.startsWith(p + '/')
  );
  if (!isAllowed) {
    return { success: false, error: `Pfad nicht erlaubt: ${path}. Erlaubt: ${ALLOWED_PATHS.join(', ')}` };
  }

  return {
    success: true,
    data: { _action: { type: 'navigate', path } },
  };
}

export async function handleNavigateToExternal(args: Args): Promise<ToolResult> {
  const url = String(args.url || '');
  if (!url) return { success: false, error: 'url ist erforderlich' };

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    return { success: false, error: 'Ungültige URL' };
  }

  return {
    success: true,
    data: { _action: { type: 'open_url', url } },
  };
}

export async function handleNavigateSearch(args: Args): Promise<ToolResult> {
  const query = String(args.query || '');
  if (!query) return { success: false, error: 'query ist erforderlich' };

  return {
    success: true,
    data: { _action: { type: 'navigate', path: `/search?q=${encodeURIComponent(query)}` } },
  };
}

// ── Composite: Open Movie / Open Series (Suche + Navigate in einem Schritt) ──

import * as radarr from '../../services/radarr.service.js';
import * as sonarr from '../../services/sonarr.service.js';

export async function handleOpenMovie(args: Args): Promise<ToolResult> {
  const query = String(args.query || '').toLowerCase();
  if (!query) return { success: false, error: 'query ist erforderlich' };

  const movies = await radarr.getMovies();
  // Exact match first, then includes
  const match = movies.find(m => m.title.toLowerCase() === query)
    || movies.find(m => m.title.toLowerCase().includes(query));

  if (!match) {
    return {
      success: false,
      error: `Film "${args.query}" nicht in der Bibliothek gefunden. Nutze movies_lookup um auf TMDB zu suchen.`,
    };
  }

  return {
    success: true,
    data: {
      title: match.title,
      year: match.year,
      id: match.id,
      tmdbId: match.tmdbId,
      hasFile: match.hasFile,
      _action: { type: 'navigate', path: `/movies/${match.id}` },
    },
  };
}

export async function handleOpenSeries(args: Args): Promise<ToolResult> {
  const query = String(args.query || '').toLowerCase();
  if (!query) return { success: false, error: 'query ist erforderlich' };

  const series = await sonarr.getSeries();
  const match = series.find(s => s.title.toLowerCase() === query)
    || series.find(s => s.title.toLowerCase().includes(query));

  if (!match) {
    return {
      success: false,
      error: `Serie "${args.query}" nicht in der Bibliothek gefunden. Nutze series_lookup um auf TVDB zu suchen.`,
    };
  }

  return {
    success: true,
    data: {
      title: match.title,
      year: match.year,
      id: match.id,
      tvdbId: match.tvdbId,
      tmdbId: (match as unknown as Record<string, unknown>).tmdbId,
      status: match.status,
      _action: { type: 'navigate', path: `/series/${match.id}` },
    },
  };
}
