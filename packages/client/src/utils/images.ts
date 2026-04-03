/**
 * Image URL Utilities
 *
 * TMDB-Bild-URLs kommen standardmäßig als `/original/` (2000×3000px, ~500KB).
 * Für PosterCards in 120-140px Grids ist das massiver Overkill.
 *
 * TMDB Poster-Größen: w92 | w154 | w185 | w342 | w500 | w780 | original
 * TMDB Backdrop-Größen: w300 | w780 | w1280 | original
 */

type TmdbPosterSize = 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original';
type TmdbBackdropSize = 'w300' | 'w780' | 'w1280' | 'original';

const TMDB_IMAGE_RE = /https?:\/\/image\.tmdb\.org\/t\/p\/[^/]+\//;

/**
 * Optimiert eine TMDB-Bild-URL auf die angegebene Größe.
 * Nicht-TMDB-URLs bleiben unverändert.
 */
export function tmdbImageUrl(url: string | undefined, size: TmdbPosterSize | TmdbBackdropSize): string | undefined {
  if (!url) return undefined;
  return url.replace(TMDB_IMAGE_RE, `https://image.tmdb.org/t/p/${size}/`);
}

/**
 * Extrahiert die Poster-URL aus einem images-Array (Radarr/Sonarr/Lidarr Format).
 * Automatische Größenoptimierung für TMDB-URLs.
 *
 * @param images - Array mit { coverType, remoteUrl }
 * @param size - TMDB-Größe (default: 'w342' – optimal für PosterCard-Grids)
 */
export function posterUrl(
  images: Array<{ coverType: string; remoteUrl: string }> | undefined,
  size: TmdbPosterSize = 'w342'
): string | undefined {
  const img = images?.find(i => i.coverType === 'poster');
  if (!img?.remoteUrl) return undefined;
  return tmdbImageUrl(img.remoteUrl, size);
}

/**
 * Extrahiert die Fanart/Backdrop-URL aus einem images-Array.
 * Automatische Größenoptimierung für TMDB-URLs.
 *
 * @param images - Array mit { coverType, remoteUrl }
 * @param size - TMDB-Größe (default: 'w1280' – optimal für Hero-Hintergründe)
 */
export function fanartUrl(
  images: Array<{ coverType: string; remoteUrl: string }> | undefined,
  size: TmdbBackdropSize = 'w1280'
): string | undefined {
  const img = images?.find(i => i.coverType === 'fanart');
  if (!img?.remoteUrl) return undefined;
  return tmdbImageUrl(img.remoteUrl, size);
}
