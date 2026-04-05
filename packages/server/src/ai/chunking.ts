// ── Text Chunking für RAG Pipeline ───────────────────────────────────────────

export interface Chunk {
  text: string;
  index: number;
  /** Optionaler Titel/Section-Header des Chunks */
  section?: string;
}

/**
 * Teilt einen Text in Chunks mit Überlappung.
 * Zielt auf ~500 Tokens pro Chunk (~2000 Zeichen).
 *
 * @param text - Der zu chunkende Text
 * @param maxChars - Maximale Zeichenzahl pro Chunk (default: 2000 ≈ 500 Tokens)
 * @param overlap - Überlappung in Zeichen (default: 200 ≈ 50 Tokens)
 */
export function chunkText(
  text: string,
  maxChars = 2000,
  overlap = 200,
): Chunk[] {
  if (!text || text.trim().length === 0) return [];
  if (text.length <= maxChars) {
    return [{ text: text.trim(), index: 0 }];
  }

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    let end = start + maxChars;

    // Am Ende des Textes: Rest nehmen
    if (end >= text.length) {
      chunks.push({ text: text.slice(start).trim(), index });
      break;
    }

    // Chunk am Absatz-/Satzende brechen wenn möglich
    const slice = text.slice(start, end);
    const lastParagraph = slice.lastIndexOf('\n\n');
    const lastNewline = slice.lastIndexOf('\n');
    const lastSentence = slice.lastIndexOf('. ');

    if (lastParagraph > maxChars * 0.5) {
      end = start + lastParagraph + 2;
    } else if (lastNewline > maxChars * 0.5) {
      end = start + lastNewline + 1;
    } else if (lastSentence > maxChars * 0.5) {
      end = start + lastSentence + 2;
    }

    chunks.push({ text: text.slice(start, end).trim(), index });
    start = end - overlap;
    index++;
  }

  return chunks;
}

/**
 * Teilt einen Markdown-Text an Section-Headern (## / ###).
 * Jede Section wird als eigener Chunk behandelt, große Sections werden weiter gechunkt.
 */
export function chunkMarkdown(
  markdown: string,
  maxChars = 2000,
  overlap = 200,
): Chunk[] {
  // An ## oder ### Headers splitten
  const sections = markdown.split(/(?=^#{2,3}\s)/m);
  const chunks: Chunk[] = [];
  let index = 0;

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    // Section-Titel extrahieren
    const headerMatch = trimmed.match(/^#{2,3}\s+(.+)/);
    const sectionTitle = headerMatch?.[1]?.trim();

    if (trimmed.length <= maxChars) {
      chunks.push({ text: trimmed, index, section: sectionTitle });
      index++;
    } else {
      // Große Section weiter aufteilen
      const subChunks = chunkText(trimmed, maxChars, overlap);
      for (const sub of subChunks) {
        chunks.push({ text: sub.text, index, section: sectionTitle });
        index++;
      }
    }
  }

  return chunks;
}
