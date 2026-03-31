import 'dotenv/config';
import http from 'node:http';
import bcrypt from 'bcryptjs';
import { env } from './config/env.js';
import { initDb, getDb } from './db/index.js';
import { createApp } from './app.js';
import { initSocket } from './socket/index.js';

async function bootstrap() {
  // 1. DB + Migrations
  initDb();

  // Ersten Admin-User anlegen falls noch keiner existiert
  const db = getDb();
  const userCount = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  if (userCount === 0) {
    const defaultPassword = 'nexarr';
    const hash = await bcrypt.hash(defaultPassword, 12);
    db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
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
