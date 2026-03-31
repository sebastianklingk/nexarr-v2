import express from 'express';
import cors from 'cors';
import session from 'express-session';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes   from './routes/auth.routes.js';
import systemRoutes from './routes/system.routes.js';
import radarrRoutes from './routes/radarr.routes.js';
import sonarrRoutes from './routes/sonarr.routes.js';
import lidarrRoutes from './routes/lidarr.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  // ── Middleware ────────────────────────────────────────────────────────────
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(cors({
    origin: env.NODE_ENV === 'development'
      ? ['http://localhost:5173', `http://192.168.188.42:5173`]
      : false,
    credentials: true,
  }));

  app.use(session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 Tage
    },
  }));

  // ── API Routes ────────────────────────────────────────────────────────────
  app.use('/api/auth',    authRoutes);
  app.use('/api/system',  systemRoutes);
  app.use('/api/radarr',  radarrRoutes);
  app.use('/api/sonarr',  sonarrRoutes);
  app.use('/api/lidarr',  lidarrRoutes);

  // ── Static (Production) ───────────────────────────────────────────────────
  if (env.NODE_ENV === 'production') {
    const clientDist = path.join(__dirname, '../../public');
    app.use(express.static(clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // ── Error Handler (muss zuletzt sein) ────────────────────────────────────
  app.use(errorHandler);

  return app;
}
