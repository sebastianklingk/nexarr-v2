import express from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes    from './routes/auth.routes.js';
import systemRoutes  from './routes/system.routes.js';
import radarrRoutes  from './routes/radarr.routes.js';
import sonarrRoutes  from './routes/sonarr.routes.js';
import lidarrRoutes  from './routes/lidarr.routes.js';
import sabnzbdRoutes   from './routes/sabnzbd.routes.js';
import calendarRoutes  from './routes/calendar.routes.js';
import tautulliRoutes  from './routes/tautulli.routes.js';
import overseerrRoutes from './routes/overseerr.routes.js';
import prowlarrRoutes  from './routes/prowlarr.routes.js';
import { gotifyRouter }  from './routes/gotify.routes.js';
import { bazarrRouter } from './routes/bazarr.routes.js';
import { tmdbRouter }   from './routes/tmdb.routes.js';
import { plexRouter }   from './routes/plex.routes.js';
import { absRouter }    from './routes/abs.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  // ── Middleware ────────────────────────────────────────────────────────────
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(cors({
    origin: env.NODE_ENV === 'development'
      ? ['http://localhost:5173', 'http://192.168.188.42:5173']
      : false,
    credentials: true,
  }));

  // Memory-Store für Dev (reicht, Daten gehen beim Neustart verloren – kein Problem)
  app.use(session({
    secret:            env.SESSION_SECRET,
    resave:            false,
    saveUninitialized: false,
    cookie: {
      secure:   env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge:   7 * 24 * 60 * 60 * 1000, // 7 Tage
    },
  }));

  // ── API Routes ────────────────────────────────────────────────────────────
  app.use('/api/auth',    authRoutes);
  app.use('/api/system',  systemRoutes);
  app.use('/api/radarr',  radarrRoutes);
  app.use('/api/sonarr',  sonarrRoutes);
  app.use('/api/lidarr',  lidarrRoutes);
  app.use('/api/sabnzbd',   sabnzbdRoutes);
  app.use('/api/calendar',  calendarRoutes);
  app.use('/api/tautulli',  tautulliRoutes);
  app.use('/api/overseerr', overseerrRoutes);
  app.use('/api/prowlarr',  prowlarrRoutes);
  app.use('/api/gotify',    gotifyRouter);
  app.use('/api/bazarr',    bazarrRouter);
  app.use('/api/tmdb',      tmdbRouter);
  app.use('/api/plex',      plexRouter);
  app.use('/api/abs',       absRouter);

  // ── Static (Production) ───────────────────────────────────────────────────
  if (env.NODE_ENV === 'production') {
    const clientDist = path.join(__dirname, '../../public');
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // ── 404 Handler ──────────────────────────────────────────────────────────
  app.use((req: express.Request, res: express.Response) => {
    res.status(404).json({ error: `Endpoint nicht gefunden: ${req.path}` });
  });

  // ── Error Handler (muss zuletzt sein) ────────────────────────────────────
  app.use(errorHandler);

  return app;
}
