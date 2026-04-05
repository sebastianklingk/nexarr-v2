import { dbGet, dbAll, dbRun } from '../db/index.js';
import type { OllamaMessage } from './ai.service.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ConversationRow {
  id: number;
  session_id: string;
  user_id: number | null;
  summary: string | null;
  messages_json: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

export function getConversation(sessionId: string): ConversationRow | undefined {
  return dbGet<ConversationRow>(
    'SELECT * FROM ai_conversations WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1',
    sessionId
  );
}

export function getConversationMessages(sessionId: string): OllamaMessage[] {
  const row = getConversation(sessionId);
  if (!row) return [];
  try {
    return JSON.parse(row.messages_json) as OllamaMessage[];
  } catch {
    return [];
  }
}

export function upsertConversation(
  sessionId: string,
  messages: OllamaMessage[],
  userId?: number
): void {
  const existing = getConversation(sessionId);
  const json = JSON.stringify(messages);
  const count = messages.filter(m => m.role === 'user' || m.role === 'assistant').length;

  if (existing) {
    dbRun(
      `UPDATE ai_conversations SET messages_json = ?, message_count = ?, updated_at = datetime('now') WHERE id = ?`,
      json, count, existing.id
    );
  } else {
    dbRun(
      `INSERT INTO ai_conversations (session_id, user_id, messages_json, message_count) VALUES (?, ?, ?, ?)`,
      sessionId, userId ?? null, json, count
    );
  }
}

export function getRecentConversations(
  userId: number | undefined,
  limit = 10
): ConversationRow[] {
  if (userId) {
    return dbAll<ConversationRow>(
      'SELECT * FROM ai_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?',
      userId, limit
    );
  }
  return dbAll<ConversationRow>(
    'SELECT * FROM ai_conversations ORDER BY updated_at DESC LIMIT ?',
    limit
  );
}
