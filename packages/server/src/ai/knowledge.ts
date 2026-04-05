import { dbAll, dbRun, dbGet } from '../db/index.js';
import { embed, embedBatch, float32ToBuffer, semanticSearch } from './vectors.js';
import { chunkText, chunkMarkdown } from './chunking.js';
import type { SearchResult } from './vectors.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface KnowledgeEntry {
  id: number;
  source: string;
  title: string;
  content: string;
  metadata_json: string | null;
  created_at: string;
}

// ── Ingestion Pipeline ───────────────────────────────────────────────────────

/**
 * Ingestiert einen Text-Dokument in die Knowledge Base.
 * Chunking → Embedding → SQLite Speicherung.
 */
export async function ingestDocument(
  source: string,
  title: string,
  content: string,
  metadata?: Record<string, unknown>,
): Promise<number> {
  const chunks = chunkText(content);
  return await storeChunks(source, title, chunks, metadata);
}

/**
 * Ingestiert ein Markdown-Dokument (Section-basiertes Chunking).
 */
export async function ingestMarkdown(
  source: string,
  title: string,
  markdown: string,
  metadata?: Record<string, unknown>,
): Promise<number> {
  const chunks = chunkMarkdown(markdown);
  return await storeChunks(source, title, chunks, metadata);
}

/**
 * Speichert Chunks mit Embeddings in der Knowledge Base.
 */
async function storeChunks(
  source: string,
  title: string,
  chunks: Array<{ text: string; index: number; section?: string }>,
  metadata?: Record<string, unknown>,
): Promise<number> {
  if (chunks.length === 0) return 0;

  // Batch-Embedding
  const texts = chunks.map(c => c.text);
  let embeddings: Float32Array[];
  try {
    embeddings = await embedBatch(texts);
  } catch (err) {
    console.warn('[Knowledge] Batch-Embedding fehlgeschlagen, speichere ohne Embeddings:', err);
    embeddings = [];
  }

  let stored = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkTitle = chunk.section
      ? `${title} – ${chunk.section}`
      : `${title} [${chunk.index + 1}/${chunks.length}]`;

    const meta = {
      ...metadata,
      chunkIndex: chunk.index,
      section: chunk.section,
    };

    const embBuf = embeddings[i] ? float32ToBuffer(embeddings[i]) : null;

    dbRun(
      `INSERT INTO ai_knowledge (source, title, content, metadata_json, embedding) VALUES (?, ?, ?, ?, ?)`,
      source, chunkTitle, chunk.text, JSON.stringify(meta), embBuf
    );
    stored++;
  }

  console.log(`[Knowledge] ${stored} Chunks gespeichert: ${source} / ${title}`);
  return stored;
}

// ── Query ────────────────────────────────────────────────────────────────────

/**
 * Semantische Suche in der Knowledge Base.
 */
export async function searchKnowledge(
  query: string,
  topK = 3,
  source?: string,
): Promise<SearchResult[]> {
  if (source) {
    // Gefiltert nach Source – manuell filtern da semanticSearch das nicht kann
    const allResults = await semanticSearch(query, 'ai_knowledge', topK * 3);
    const rows = dbAll<{ id: number; source: string }>(
      'SELECT id, source FROM ai_knowledge WHERE source = ?', source
    );
    const sourceIds = new Set(rows.map(r => r.id));
    return allResults.filter(r => sourceIds.has(r.id)).slice(0, topK);
  }

  return semanticSearch(query, 'ai_knowledge', topK);
}

// ── Management ───────────────────────────────────────────────────────────────

/**
 * Löscht alle Knowledge-Einträge einer bestimmten Quelle.
 * Nützlich für Re-Ingestion (z.B. nach Update der Hilfe-Texte).
 */
export function deleteBySource(source: string): number {
  const result = dbRun('DELETE FROM ai_knowledge WHERE source = ?', source);
  console.log(`[Knowledge] ${result.changes} Einträge gelöscht für Source: ${source}`);
  return result.changes;
}

/**
 * Gibt Statistiken über die Knowledge Base zurück.
 */
export function getKnowledgeStats(): {
  totalEntries: number;
  withEmbedding: number;
  sources: Array<{ source: string; count: number }>;
} {
  const total = dbGet<{ cnt: number }>('SELECT COUNT(*) as cnt FROM ai_knowledge');
  const withEmb = dbGet<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM ai_knowledge WHERE embedding IS NOT NULL'
  );
  const sources = dbAll<{ source: string; count: number }>(
    'SELECT source, COUNT(*) as count FROM ai_knowledge GROUP BY source'
  );

  return {
    totalEntries: total?.cnt ?? 0,
    withEmbedding: withEmb?.cnt ?? 0,
    sources,
  };
}
