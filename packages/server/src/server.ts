import 'dotenv/config';
import http from 'node:http';
import bcrypt from 'bcryptjs';
import { env } from './config/env.js';
import { initDb, dbGet, dbRun } from './db/index.js';
import { createApp } from './app.js';
import { initSocket } from './socket/index.js';
import { warmCache, startCacheRefreshTimer, stopWarmup } from './cache/warmup.js';
import { seedKnowledge } from './ai/knowledge-seed.js';

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

  // 4. Starten
  const port = Number(env.PORT);
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`\n🚀 nexarr v2 läuft auf http://0.0.0.0:${port}`);
    console.log(`   Umgebung: ${env.NODE_ENV}`);
    console.log(`   DB:       ${env.DB_PATH}`);
    if (env.AUTH_DISABLED) {
      console.log('   ⚠️  AUTH DEAKTIVIERT – kein Login erforderlich');
    }
    console.log('');

    // 5. Knowledge-Seeds laden (einmalig)
    seedKnowledge().catch(err => {
      console.warn('Knowledge-Seed Fehler:', (err as Error)?.message ?? err);
    });

    // 6. Cache-Warming im Hintergrund
    warmCache(4).catch(err => {
      console.warn('Cache-Warming Fehler:', (err as Error)?.message ?? err);
    });

    // 7. Periodischer Refresh
    startCacheRefreshTimer();
  });

  // Graceful Shutdown
  const shutdown = (signal: string) => {
    console.log(`${signal} – Server wird heruntergefahren...`);
    stopWarmup();
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('❌ Startup-Fehler:', err);
  process.exit(1);
});
