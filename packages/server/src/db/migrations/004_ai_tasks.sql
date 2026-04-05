-- ── AI Scheduled Tasks (Phase AI-Tools Batch 5) ─────────────────────────────

CREATE TABLE IF NOT EXISTS ai_scheduled_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  type TEXT NOT NULL CHECK(type IN ('reminder', 'monitor', 'recurring')),
  description TEXT NOT NULL,
  trigger_condition TEXT,
  metadata_json TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
  next_check TEXT,
  last_checked TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_tasks_status ON ai_scheduled_tasks(status);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_next ON ai_scheduled_tasks(next_check);
