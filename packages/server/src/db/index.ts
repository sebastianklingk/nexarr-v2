import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';

let db: DatabaseSync;

export function getDb(): DatabaseSync {
  if (!db) throw new Error('DB nicht initialisiert. initDb() zuerst aufrufen.');
  return db;
}

export function initDb(): void {
  const dbPath = path.resolve(env.DB_PATH);
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new DatabaseSync(dbPath);

  // WAL-Modus für bessere Concurrency
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  runMigrations();
  console.log(`✅ SQLite: ${dbPath}`);
}

function runMigrations(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id     INTEGER PRIMARY KEY,
      name   TEXT NOT NULL UNIQUE,
      run_at INTEGER DEFAULT (unixepoch())
    )
  `);

  const migrationsDir = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    'migrations'
  );

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

// Typed helpers – node:sqlite gibt unknown zurück
export function dbGet<T>(sql: string, ...params: unknown[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function dbAll<T>(sql: string, ...params: unknown[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function dbRun(sql: string, ...params: unknown[]): { changes: number; lastInsertRowid: number | bigint } {
  return db.prepare(sql).run(...params) as { changes: number; lastInsertRowid: number | bigint };
}
