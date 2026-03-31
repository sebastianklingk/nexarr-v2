import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) throw new Error('DB nicht initialisiert. initDb() zuerst aufrufen.');
  return db;
}

export function initDb(): void {
  const dbPath = path.resolve(env.DB_PATH);
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  console.log(`✅ SQLite: ${dbPath}`);
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id        INTEGER PRIMARY KEY,
      name      TEXT NOT NULL UNIQUE,
      run_at    INTEGER DEFAULT (unixepoch())
    )
  `);

  const migrationsDir = new URL('./migrations', import.meta.url).pathname;

  if (!fs.existsSync(migrationsDir)) return;

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const already = db.prepare('SELECT id FROM migrations WHERE name = ?').get(file);
    if (already) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    db.exec(sql);
    db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
    console.log(`  ↳ Migration: ${file}`);
  }
}
