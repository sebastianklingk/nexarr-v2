import * as radarr from '../services/radarr.service.js';
import * as sonarr from '../services/sonarr.service.js';
import * as lidarr from '../services/lidarr.service.js';
import { chat, stripThinkingTags } from './ai.service.js';
import { addMemory, getAllMemories, invalidateMemory } from './memory.js';
import { ingestDocument, deleteBySource } from './knowledge.js';
import type { OllamaMessage } from './ai.service.js';
import type { RadarrMovie } from '@nexarr/shared';

// ── Types ────────────────────────────────────────────────────────────────────

export interface LibraryStats {
  movies: {
    total: number;
    withFile: number;
    genres: Record<string, number>;
    decades: Record<string, number>;
    quality: Record<string, number>;
    topRated: Array<{ title: string; year: number; rating: number }>;
  };
  series: {
    total: number;
    continuing: number;
    ended: number;
    genres: Record<string, number>;
  };
  artists: {
    total: number;
    genres: Record<string, number>;
  };
}

// ── Analysis ─────────────────────────────────────────────────────────────────

/**
 * Analysiert die gesamte Bibliothek und generiert Statistiken.
 */
export async function analyzeLibrary(): Promise<LibraryStats> {
  const [movies, series, artists] = await Promise.allSettled([
    radarr.getMovies(),
    sonarr.getSeries(),
    lidarr.getArtists(),
  ]);

  const movieList = movies.status === 'fulfilled' ? movies.value : [];
  const seriesList = series.status === 'fulfilled' ? series.value : [];
  const artistList = artists.status === 'fulfilled' ? artists.value : [];

  // Genre-Verteilung (Filme)
  const movieGenres: Record<string, number> = {};
  const decades: Record<string, number> = {};
  const quality: Record<string, number> = {};
  const topRated: Array<{ title: string; year: number; rating: number }> = [];

  for (const m of movieList) {
    // Genres
    for (const g of m.genres || []) {
      movieGenres[g] = (movieGenres[g] || 0) + 1;
    }
    // Dekaden
    if (m.year) {
      const decade = `${Math.floor(m.year / 10) * 10}er`;
      decades[decade] = (decades[decade] || 0) + 1;
    }
    // Qualität
    if (m.movieFile?.quality?.quality?.name) {
      const q = m.movieFile.quality.quality.name;
      quality[q] = (quality[q] || 0) + 1;
    }
    // Top-Rated
    const rating = m.ratings?.imdb?.value || m.ratings?.tmdb?.value;
    if (rating && rating >= 8.0 && m.hasFile) {
      topRated.push({ title: m.title, year: m.year, rating });
    }
  }

  // Sortiere Top-Rated
  topRated.sort((a, b) => b.rating - a.rating);

  // Genre-Verteilung (Serien)
  const seriesGenres: Record<string, number> = {};
  let continuing = 0;
  let ended = 0;
  for (const s of seriesList) {
    for (const g of s.genres || []) {
      seriesGenres[g] = (seriesGenres[g] || 0) + 1;
    }
    if (s.status === 'continuing') continuing++;
    if (s.status === 'ended') ended++;
  }

  // Genre-Verteilung (Musik)
  const musicGenres: Record<string, number> = {};
  for (const a of artistList) {
    for (const g of a.genres || []) {
      musicGenres[g] = (musicGenres[g] || 0) + 1;
    }
  }

  return {
    movies: {
      total: movieList.length,
      withFile: movieList.filter(m => m.hasFile).length,
      genres: movieGenres,
      decades,
      quality,
      topRated: topRated.slice(0, 20),
    },
    series: {
      total: seriesList.length,
      continuing,
      ended,
      genres: seriesGenres,
    },
    artists: {
      total: artistList.length,
      genres: musicGenres,
    },
  };
}

/**
 * Generiert ein LLM-basiertes Geschmacksprofil aus den Bibliotheks-Statistiken
 * und speichert es als Memory + Knowledge.
 */
export async function generateLibraryProfile(): Promise<string> {
  console.log('[Library] Starte Bibliotheks-Analyse...');

  const stats = await analyzeLibrary();

  // Top 10 Genres sortiert
  const topMovieGenres = Object.entries(stats.movies.genres)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const topSeriesGenres = Object.entries(stats.series.genres)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const topDecades = Object.entries(stats.movies.decades)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topQuality = Object.entries(stats.movies.quality)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const prompt = `/no_think
Analysiere diese Bibliotheks-Statistiken und erstelle ein kurzes Geschmacksprofil (max 150 Wörter, auf Deutsch).
Beschreibe: bevorzugte Genres, Dekaden-Schwerpunkte, Qualitäts-Niveau, Größe der Sammlung.
Sei konkret und nutze die Zahlen.

Filme: ${stats.movies.total} gesamt, ${stats.movies.withFile} mit Datei
Top Film-Genres: ${topMovieGenres.map(([g, n]) => `${g} (${n})`).join(', ')}
Top Dekaden: ${topDecades.map(([d, n]) => `${d} (${n})`).join(', ')}
Top Qualität: ${topQuality.map(([q, n]) => `${q} (${n})`).join(', ')}

Serien: ${stats.series.total} gesamt (${stats.series.continuing} laufend, ${stats.series.ended} abgeschlossen)
Top Serien-Genres: ${topSeriesGenres.map(([g, n]) => `${g} (${n})`).join(', ')}

Musik-Künstler: ${stats.artists.total}`;

  const messages: OllamaMessage[] = [
    { role: 'user', content: prompt },
  ];

  const response = await chat(messages, { temperature: 0.3 });
  const profile = stripThinkingTags(response.message.content).trim();

  // Altes Library-Profil invalidieren
  const existingMemories = getAllMemories(undefined, 50);
  for (const m of existingMemories) {
    if (m.category === 'context' && m.content.includes('Bibliotheks-Profil')) {
      invalidateMemory(m.id);
    }
  }

  // Als Memory speichern
  await addMemory('context', `Bibliotheks-Profil: ${profile}`);

  // Auch als Knowledge-Eintrag für RAG
  deleteBySource('library_profile');
  await ingestDocument('library_profile', 'Bibliotheks-Geschmacksprofil', profile);

  // Detaillierte Stats als Knowledge speichern
  deleteBySource('library_stats');
  const statsText = [
    `Bibliotheks-Statistiken (${new Date().toISOString().slice(0, 10)})`,
    `Filme: ${stats.movies.total} (${stats.movies.withFile} mit Datei)`,
    `Serien: ${stats.series.total} (${stats.series.continuing} laufend)`,
    `Musik-Künstler: ${stats.artists.total}`,
    `Film-Genres: ${topMovieGenres.map(([g, n]) => `${g}=${n}`).join(', ')}`,
    `Serien-Genres: ${topSeriesGenres.map(([g, n]) => `${g}=${n}`).join(', ')}`,
    `Dekaden: ${topDecades.map(([d, n]) => `${d}=${n}`).join(', ')}`,
    `Qualität: ${topQuality.map(([q, n]) => `${q}=${n}`).join(', ')}`,
    `Top-Filme (8.0+): ${stats.movies.topRated.slice(0, 10).map(m => `${m.title} (${m.year}, ${m.rating})`).join('; ')}`,
  ].join('\n');

  await ingestDocument('library_stats', 'Bibliotheks-Statistiken', statsText);

  console.log(`[Library] Profil generiert: ${profile.slice(0, 80)}...`);
  return profile;
}
