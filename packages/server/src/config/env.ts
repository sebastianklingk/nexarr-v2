import 'dotenv/config';
import { z } from 'zod';

// Leere Strings in .env werden als undefined behandelt
const optUrl = z.string().url().optional().or(z.literal('')).transform(v => v || undefined);
const optStr = z.string().optional().transform(v => v || undefined);
const optBool = z.string().optional().transform(v => v === 'true' || v === '1');

const envSchema = z.object({
  PORT:             z.string().default('3000'),
  NODE_ENV:         z.enum(['development', 'production', 'test']).default('development'),
  SESSION_SECRET:   z.string().min(32, 'SESSION_SECRET muss mindestens 32 Zeichen haben'),
  DB_PATH:          z.string().default('./data/nexarr.db'),

  // Auth deaktivieren (kein Login nötig – für Entwicklung)
  AUTH_DISABLED:     optBool,

  RADARR_URL:        optUrl,
  RADARR_API_KEY:    optStr,

  SONARR_URL:        optUrl,
  SONARR_API_KEY:    optStr,

  LIDARR_URL:        optUrl,
  LIDARR_API_KEY:    optStr,

  PROWLARR_URL:      optUrl,
  PROWLARR_API_KEY:  optStr,

  SABNZBD_URL:       optUrl,
  SABNZBD_API_KEY:   optStr,

  // Transmission (optional – zweiter Downloader)
  TRANSMISSION_URL:  optUrl,
  TRANSMISSION_USER: optStr,
  TRANSMISSION_PASS: optStr,

  TAUTULLI_URL:      optUrl,
  TAUTULLI_API_KEY:  optStr,

  OVERSEERR_URL:     optUrl,
  OVERSEERR_API_KEY: optStr,

  BAZARR_URL:        optUrl,
  BAZARR_API_KEY:    optStr,

  GOTIFY_URL:        optUrl,
  GOTIFY_TOKEN:      optStr,

  TMDB_API_KEY:      optStr,

  OLLAMA_URL:        optUrl,
  OLLAMA_MODEL:      z.string().default('qwen3:32b'),

  ABS_URL:           optUrl,
  ABS_TOKEN:         optStr,

  PLEX_URL:          optUrl,
  PLEX_TOKEN:        optStr,
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error('❌ Ungültige Umgebungsvariablen:');
  result.error.issues.forEach(issue => {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1);
}

export const env = result.data;
export type Env = typeof env;
