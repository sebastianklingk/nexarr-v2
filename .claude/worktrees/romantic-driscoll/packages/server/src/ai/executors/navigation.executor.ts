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
