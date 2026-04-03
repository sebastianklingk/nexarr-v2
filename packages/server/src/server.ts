import 'dotenv/config';
import http from 'node:http';
import { execSync } from 'node:child_process';
import bcrypt from 'bcryptjs';
import { env } from './config/env.js';
import { initDb, dbGet, dbRun } from './db/index.js';
import { createApp } from './app.js';
import { initSocket } from './socket/index.js';
import { warmCache, startCacheRefreshTimer, stopWarmup } from './cache/warmup.js';

/**
 * Versucht den Port freizugeben falls er belegt ist (tsx watch restart).
 * Nur in Development – in Production soll EADDRINUSE ein harter Fehler sein.
 */
function tryFreePort(port: number): void {
  if (env.NODE_ENV !== 'development') return;
  try {
    execSync(`fuser -k ${port}/tcp 2>/dev/null`, { stdio: 'ignore' });
  } catch {
    // fuser nicht vorhanden oder Port schon frei – beides OK
  }
}

/**
 * Listen mit Retry bei EADDRINUSE.
 * tsx watch kann den alten Prozess nicht immer rechtzeitig beenden.
 */
function listenWithRetry(
  server: http.Server,
  port: number,
  host: string,
  maxRetries = 5,
  delayMs = 800
): Promise<void> {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    function tryListen() {
      attempt++;
      server.listen(port, host);
    }

    server.on('listening', () => resolve());

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && attempt < maxRetries) {
        console.warn(`⚠ Port ${port} belegt (Versuch ${attempt}/${maxRetries}), versuche freizugeben...`);
        tryFreePort(port);
        setTimeout(tryListen, delayMs);
      } else {
        reject(err);
      }
    });

    tryListen();
  });
}

async function bootstrap() {
  // 1. DB + Migrations
  initDb();

  // Ersten Admin-User anlegen falls noch keiner existiert
  const existing = dbGet<{ c: number }>('SELECT COUNT(*) as c FROM users');
  if (!existing || existing.c === 0) {
    const hash = await bcrypt.hash('nexarr', 12);
    dbRun('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', 'admin', hash, 'admin');
    console.log('👤 Standard-Admin angelegt: admin / nexarr  ← Bitte Passwort ändern!');
  }

  // 2. Express App
  const app = createApp();
  const httpServer = http.createServer(app);

  // 3. Socket.io
  initSocket(httpServer);

  // 4. Starten (mit Retry bei EADDRINUSE – tsx watch restart)
  const port = Number(env.PORT);
  await listenWithRetry(httpServer, port, '0.0.0.0');

  console.log(`\n🚀 nexarr v2 läuft auf http://0.0.0.0:${port}`);
  console.log(`   Umgebung: ${env.NODE_ENV}`);
  console.log(`   DB:       ${env.DB_PATH}`);
  if (env.AUTH_DISABLED) {
    console.log('   ⚠️  AUTH DEAKTIVIERT – kein Login erforderlich');
  }
  console.log('');

  // 5. Cache-Warming im Hintergrund (alle 4 Wellen, blockiert den Server nicht)
  warmCache(4).catch(err => {
    console.warn('Cache-Warming Fehler:', (err as Error)?.message ?? err);
  });

  // 6. Periodischer Refresh für Welle 1+2 alle 4 Minuten
  startCacheRefreshTimer();

  // Graceful Shutdown
  const shutdown = (signal: string) => {
    console.log(`${signal} – Server wird heruntergefahren...`);
    stopWarmup();
    httpServer.close(() => process.exit(0));
    // Force-Exit nach 3s falls Connections offen bleiben
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('❌ Startup-Fehler:', err);
  process.exit(1);
});
