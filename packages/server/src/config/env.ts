import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT:             z.string().default('3000'),
  NODE_ENV:         z.enum(['development', 'production', 'test']).default('development'),
  SESSION_SECRET:   z.string().min(32, 'SESSION_SECRET muss mindestens 32 Zeichen haben'),
  DB_PATH:          z.string().default('./data/nexarr.db'),

  RADARR_URL:       z.string().url().optional(),
  RADARR_API_KEY:   z.string().optional(),

  SONARR_URL:       z.string().url().optional(),
  SONARR_API_KEY:   z.string().optional(),

  LIDARR_URL:       z.string().url().optional(),
  LIDARR_API_KEY:   z.string().optional(),

  PROWLARR_URL:     z.string().url().optional(),
  PROWLARR_API_KEY: z.string().optional(),

  SABNZBD_URL:      z.string().url().optional(),
  SABNZBD_API_KEY:  z.string().optional(),

  TAUTULLI_URL:     z.string().url().optional(),
  TAUTULLI_API_KEY: z.string().optional(),

  OVERSEERR_URL:    z.string().url().optional(),
  OVERSEERR_API_KEY:z.string().optional(),

  BAZARR_URL:       z.string().url().optional(),
  BAZARR_API_KEY:   z.string().optional(),

  GOTIFY_URL:       z.string().url().optional(),
  GOTIFY_TOKEN:     z.string().optional(),

  TMDB_API_KEY:     z.string().optional(),

  OLLAMA_URL:       z.string().url().optional(),
  OLLAMA_MODEL:     z.string().default('qwen3:32b'),

  ABS_URL:          z.string().url().optional(),
  ABS_TOKEN:        z.string().optional(),
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
