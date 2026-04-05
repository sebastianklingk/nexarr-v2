import { dbGet, dbRun } from '../db/index.js';
import { chat, stripThinkingTags } from './ai.service.js';
import { embed, float32ToBuffer } from './vectors.js';
import type { OllamaMessage } from './ai.service.js';

// ── Types ────────────────────────────────────────────────────────────────────

interface ConversationRow {
  id: number;
  session_id: string;
  summary: string | null;
  message_count: number;
}

// ── Summary Generation ───────────────────────────────────────────────────────

const SUMMARY_PROMPT = `/no_think
Fasse das folgende Gespräch in 2-3 Sätzen auf Deutsch zusammen.
Fokus: Was wollte der User? Was wurde besprochen/gemacht? Welche Medien/Themen?
Keine Meta-Kommentare, nur Inhalt. Max 150 Wörter.`;

/**
 * Generiert eine Zusammenfassung einer Konversation und speichert sie.
 * Wird alle ~10 Messages aufgerufen.
 */
export async function generateSummary(
  sessionId: string,
  recentMessages: OllamaMessage[],
): Promise<string | null> {
  try {
    // Nur User + Assistant Messages für die Zusammenfassung
    const chatMessages = recentMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-20); // Letzte 20 Messages

    if (chatMessages.length < 4) return null; // Zu wenig für eine Zusammenfassung

    const conversation = chatMessages
      .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
      .join('\n');

    const messages: OllamaMessage[] = [
      { role: 'system', content: SUMMARY_PROMPT },
      { role: 'user', content: conversation },
    ];

    const response = await chat(messages, { temperature: 0.2 });
    const summary = stripThinkingTags(response.message.content).trim();

    if (!summary) return null;

    // Summary + Embedding in DB speichern
    let embeddingBuf: Buffer | null = null;
    try {
      const emb = await embed(summary);
      embeddingBuf = float32ToBuffer(emb);
    } catch {
      // Ohne Embedding speichern
    }

    const row = dbGet<ConversationRow>(
      'SELECT id FROM ai_conversations WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1',
      sessionId
    );

    if (row) {
      if (embeddingBuf) {
        dbRun(
          `UPDATE ai_conversations SET summary = ?, embedding = ?, updated_at = datetime('now') WHERE id = ?`,
          summary, embeddingBuf, row.id
        );
      } else {
        dbRun(
          `UPDATE ai_conversations SET summary = ?, updated_at = datetime('now') WHERE id = ?`,
          summary, row.id
        );
      }
    }

    console.log(`[Summary] Session ${sessionId.slice(0, 8)}...: ${summary.slice(0, 80)}...`);
    return summary;
  } catch (err) {
    console.error('[Summary] Fehler:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ── Last Summary Retrieval ───────────────────────────────────────────────────

/**
 * Holt die letzte Konversations-Zusammenfassung eines Users.
 */
export function getLastSummary(userId?: number): string | null {
  const row = userId
    ? dbGet<{ summary: string | null }>(
        'SELECT summary FROM ai_conversations WHERE user_id = ? AND summary IS NOT NULL ORDER BY updated_at DESC LIMIT 1',
        userId
      )
    : dbGet<{ summary: string | null }>(
        'SELECT summary FROM ai_conversations WHERE summary IS NOT NULL ORDER BY updated_at DESC LIMIT 1'
      );

  return row?.summary ?? null;
}

/**
 * Prüft ob eine Zusammenfassung generiert werden sollte (alle ~10 Messages).
 */
export function shouldGenerateSummary(messageCount: number): boolean {
  return messageCount > 0 && messageCount % 10 === 0;
}
