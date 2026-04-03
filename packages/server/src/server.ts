import 'dotenv/config';
import http from 'node:http';
import bcrypt from 'bcryptjs';
import { env } from './config/env.js';
import { initDb, dbGet, dbRun } from './db/index.js';
import { createApp } from './app.js';
import { initSocket } from './socket/index.js';
import { warmCache, startCacheRefreshTimer } from './cache/warmup.js';

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
    console.log(`   DB:       ${env.DB_PATH}\n`);

    // 5. Cache-Warming im Hintergrund (alle 4 Wellen, blockiert den Server nicht)
    warmCache(4).catch(err => {
      console.warn('Cache-Warming Fehler:', (err as Error)?.message ?? err);
    });

    // 6. Periodischer Refresh für Welle 1+2 alle 4 Minuten
    startCacheRefreshTimer();
  });

  // Graceful Shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM – Server wird heruntergefahren...');
    httpServer.close(() => process.exit(0));
  });
}

bootstrap().catch((err) => {
  console.error('❌ Startup-Fehler:', err);
  process.exit(1);
});
