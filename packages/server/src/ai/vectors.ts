import axios from 'axios';
import { env } from '../config/env.js';
import { dbAll } from '../db/index.js';

// ── Constants ────────────────────────────────────────────────────────────────

const EMBED_DIM = 768;

function ollamaBase(): string {
  if (!env.OLLAMA_URL) throw new Error('OLLAMA_URL nicht konfiguriert');
  return env.OLLAMA_URL;
}

// ── Embedding Generation ─────────────────────────────────────────────────────

/**
 * Generiert einen 768-dim Embedding-Vektor für einen Text via Ollama.
 */
export async function embed(text: string): Promise<Float32Array> {
  const { data } = await axios.post<{ embeddings: number[][] }>(
    `${ollamaBase()}/api/embed`,
    {
      model: env.OLLAMA_EMBED_MODEL,
      input: text,
    },
    { timeout: 30_000 }
  );

  if (!data.embeddings?.[0]) {
    throw new Error('Ollama Embedding: Keine Daten zurückgegeben');
  }

  return new Float32Array(data.embeddings[0]);
}

/**
 * Generiert Embeddings für mehrere Texte (Batch – effizienter als Einzelaufrufe).
 */
export async function embedBatch(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return [];

  const { data } = await axios.post<{ embeddings: number[][] }>(
    `${ollamaBase()}/api/embed`,
    {
      model: env.OLLAMA_EMBED_MODEL,
      input: texts,
    },
    { timeout: 60_000 }
  );

  return data.embeddings.map(e => new Float32Array(e));
}

// ── Cosine Similarity ────────────────────────────────────────────────────────

/**
 * Berechnet die Cosine-Similarity zwischen zwei Vektoren.
 * Ergebnis: -1 (gegensätzlich) bis 1 (identisch).
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Float32Array ↔ Buffer ────────────────────────────────────────────────────

/**
 * Konvertiert Float32Array zu Buffer für SQLite BLOB-Speicherung.
 */
export function float32ToBuffer(arr: Float32Array): Buffer {
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
}

/**
 * Konvertiert SQLite BLOB (Buffer/Uint8Array) zurück zu Float32Array.
 */
export function bufferToFloat32(buf: Buffer | Uint8Array): Float32Array {
  // Node.js Buffer → ArrayBuffer → Float32Array
  const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Float32Array(arrayBuf);
}

// ── Semantic Search ──────────────────────────────────────────────────────────

interface EmbeddingRow {
  id: number;
  content: string;
  summary?: string;
  embedding: Buffer | Uint8Array;
}

export interface SearchResult {
  id: number;
  content: string;
  score: number;
}

/**
 * Semantische Suche über eine SQLite-Tabelle mit Embedding-Spalte.
 * Lädt alle Embeddings in Memory und berechnet Cosine-Similarity.
 *
 * Bei <10K Einträgen ist das schnell genug (<50ms).
 */
export async function semanticSearch(
  query: string,
  table: 'ai_memories' | 'ai_knowledge' | 'ai_conversations',
  topK = 5,
  minScore = 0.3,
): Promise<SearchResult[]> {
  const queryEmb = await embed(query);

  // Content-Spalte: bei ai_conversations ist es summary, sonst content
  const contentCol = table === 'ai_conversations' ? 'summary' : 'content';

  const rows = dbAll<EmbeddingRow>(
    `SELECT id, ${contentCol} as content, embedding FROM ${table} WHERE embedding IS NOT NULL`
  );

  return rows
    .map(row => ({
      id: row.id,
      content: row.content,
      score: cosineSimilarity(queryEmb, bufferToFloat32(row.embedding)),
    }))
    .filter(r => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
