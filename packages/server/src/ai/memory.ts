import { dbAll, dbRun, dbGet } from '../db/index.js';
import { chat, stripThinkingTags } from './ai.service.js';
import { embed, float32ToBuffer, semanticSearch } from './vectors.js';
import type { OllamaMessage } from './ai.service.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Memory {
  id: number;
  user_id: number | null;
  category: string;
  content: string;
  confidence: number;
  created_at: string;
  updated_at: string;
}

interface MemoryExtraction {
  action: 'ADD' | 'UPDATE' | 'NOOP';
  category?: 'preference' | 'fact' | 'pattern' | 'context';
  content?: string;
  updateId?: number;
}

// ── Memory Retrieval ─────────────────────────────────────────────────────────

/**
 * Holt die relevantesten Memories für eine Query via semantische Suche.
 */
export async function getRelevantMemories(
  query: string,
  userId?: number,
  topK = 5,
): Promise<Memory[]> {
  // Zuerst semantische Suche über alle Memories
  const results = await semanticSearch(query, 'ai_memories', topK);

  if (results.length === 0) {
    // Fallback: neueste Memories ohne Embedding
    return dbAll<Memory>(
      `SELECT * FROM ai_memories WHERE valid_until IS NULL ORDER BY updated_at DESC LIMIT ?`,
      topK
    );
  }

  const ids = results.map(r => r.id);
  const placeholders = ids.map(() => '?').join(',');
  return dbAll<Memory>(
    `SELECT * FROM ai_memories WHERE id IN (${placeholders}) ORDER BY confidence DESC`,
    ...ids
  );
}

/**
 * Holt alle aktiven Memories eines Users (ohne Embedding-Suche).
 */
export function getAllMemories(userId?: number, limit = 20): Memory[] {
  if (userId) {
    return dbAll<Memory>(
      `SELECT * FROM ai_memories WHERE user_id = ? AND valid_until IS NULL ORDER BY updated_at DESC LIMIT ?`,
      userId, limit
    );
  }
  return dbAll<Memory>(
    `SELECT * FROM ai_memories WHERE valid_until IS NULL ORDER BY updated_at DESC LIMIT ?`,
    limit
  );
}

// ── Memory Storage ───────────────────────────────────────────────────────────

/**
 * Speichert eine neue Memory mit Embedding.
 */
export async function addMemory(
  category: string,
  content: string,
  userId?: number,
  conversationId?: number,
): Promise<number> {
  // Embedding generieren
  let embeddingBuf: Buffer | null = null;
  try {
    const emb = await embed(content);
    embeddingBuf = float32ToBuffer(emb);
  } catch (err) {
    console.warn('[Memory] Embedding-Fehler, speichere ohne Embedding:', err);
  }

  const result = dbRun(
    `INSERT INTO ai_memories (user_id, category, content, source_conversation_id, embedding) VALUES (?, ?, ?, ?, ?)`,
    userId ?? null, category, content, conversationId ?? null, embeddingBuf
  );

  return Number(result.lastInsertRowid);
}

/**
 * Aktualisiert eine bestehende Memory.
 */
export async function updateMemory(id: number, content: string): Promise<void> {
  let embeddingBuf: Buffer | null = null;
  try {
    const emb = await embed(content);
    embeddingBuf = float32ToBuffer(emb);
  } catch {
    // Behalte altes Embedding wenn neues fehlschlägt
  }

  if (embeddingBuf) {
    dbRun(
      `UPDATE ai_memories SET content = ?, embedding = ?, updated_at = datetime('now') WHERE id = ?`,
      content, embeddingBuf, id
    );
  } else {
    dbRun(
      `UPDATE ai_memories SET content = ?, updated_at = datetime('now') WHERE id = ?`,
      content, id
    );
  }
}

/**
 * Invalidiert eine Memory (soft delete via valid_until).
 */
export function invalidateMemory(id: number): void {
  dbRun(
    `UPDATE ai_memories SET valid_until = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    id
  );
}

// ── Memory Extraction (Post-Processing) ──────────────────────────────────────

const EXTRACTION_PROMPT = `/no_think
Du bist ein Memory-Extraction-System. Analysiere das folgende Gespräch und extrahiere wichtige Fakten über den User.

Antworte NUR mit einem JSON-Array von Operationen. Jede Operation hat:
- "action": "ADD" (neue Erkenntnis), "UPDATE" (bestehende Memory aktualisieren) oder "NOOP" (nichts Neues)
- "category": "preference" | "fact" | "pattern" | "context"
- "content": Der extrahierte Fakt als kurzer Satz (max 100 Zeichen)

Kategorien:
- preference: Vorlieben/Abneigungen (Genre, Qualität, Sprache, Schauspieler)
- fact: Harte Fakten (Name, Haustier, Beruf, Hardware-Setup)
- pattern: Nutzungsmuster (schaut abends, bevorzugt Untertitel, etc.)
- context: Aktuelle Situation (sucht Film für Filmabend, wartet auf Release X)

Regeln:
- Nur extrahieren was der User EXPLIZIT gesagt oder impliziert hat
- Keine Vermutungen über Vorlieben basierend auf einzelnen Anfragen
- NOOP wenn nichts Neues zu lernen ist
- Maximal 3 Extraktionen pro Analyse

Beispiel-Antwort:
[{"action":"ADD","category":"preference","content":"Mag Sci-Fi Filme"},{"action":"NOOP"}]

Bestehende Memories:
{EXISTING_MEMORIES}

Gespräch:`;

/**
 * Extrahiert neue Memories aus einem Gespräch (async, non-blocking).
 * Wird nach jedem Chat im Hintergrund aufgerufen.
 */
export async function extractMemories(
  userMessage: string,
  assistantMessage: string,
  userId?: number,
  conversationId?: number,
): Promise<void> {
  try {
    // Bestehende Memories laden
    const existing = getAllMemories(userId, 10);
    const existingStr = existing.length > 0
      ? existing.map(m => `- [${m.id}] ${m.category}: ${m.content}`).join('\n')
      : 'Keine bestehenden Memories.';

    const prompt = EXTRACTION_PROMPT.replace('{EXISTING_MEMORIES}', existingStr);

    const messages: OllamaMessage[] = [
      { role: 'system', content: prompt },
      {
        role: 'user',
        content: `User: ${userMessage}\nAssistant: ${assistantMessage}`,
      },
    ];

    const response = await chat(messages, { temperature: 0.1 });
    const text = stripThinkingTags(response.message.content).trim();

    // JSON parsen
    let extractions: MemoryExtraction[];
    try {
      // Manchmal wrapped Ollama die Antwort in Markdown-Codeblöcke
      const jsonStr = text.replace(/^```json?\s*/m, '').replace(/\s*```$/m, '').trim();
      extractions = JSON.parse(jsonStr) as MemoryExtraction[];
    } catch {
      console.warn('[Memory] Konnte Extraction-Response nicht parsen:', text.slice(0, 200));
      return;
    }

    if (!Array.isArray(extractions)) return;

    // Extraktionen verarbeiten
    for (const ext of extractions.slice(0, 3)) {
      if (ext.action === 'ADD' && ext.content && ext.category) {
        await addMemory(ext.category, ext.content, userId, conversationId);
        console.log(`[Memory] ADD: [${ext.category}] ${ext.content}`);
      } else if (ext.action === 'UPDATE' && ext.updateId && ext.content) {
        await updateMemory(ext.updateId, ext.content);
        console.log(`[Memory] UPDATE #${ext.updateId}: ${ext.content}`);
      }
    }
  } catch (err) {
    // Non-blocking – Fehler loggen aber nicht propagieren
    console.error('[Memory] Extraction-Fehler:', err instanceof Error ? err.message : err);
  }
}
