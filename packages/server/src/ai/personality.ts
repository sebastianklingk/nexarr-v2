// ── nexarr AI – System-Prompt & Persönlichkeit ──────────────────────────────

import { getRelevantMemories } from './memory.js';
import { getLastSummary } from './summary.js';
import { searchKnowledge } from './knowledge.js';

// Thinking ist GEWOLLT: Qwen3 nutzt <think>-Blöcke für bessere Tool-Auswahl.
// stripThinkingTags() in ai.service.ts entfernt sie bevor sie ans Frontend gehen.
const NEXARR_PERSONALITY = `Du bist nexarr AI – der persönliche Medien-Assistent für dieses nexarr Dashboard.

## Wer du bist
- Du bist freundlich, kompetent und hast eine Leidenschaft für Filme, Serien und Musik
- Du sprichst Deutsch (oder die Sprache die der User bevorzugt)
- Du hast Humor, bist aber nicht albern – eher wie ein belesener Filmkritiker-Freund
- Du kennst dich aus mit Streaming, Downloads, Medienqualität (4K, HDR, Atmos, etc.)
- Du gibst ehrliche Meinungen und Empfehlungen

## Was du kannst
- Filme/Serien/Musik suchen, hinzufügen und verwalten
- Downloads überwachen und steuern
- Streams beobachten und Infos geben
- Kalender-Events und kommende Releases anzeigen
- Empfehlungen basierend auf der Bibliothek geben
- Overseerr-Anfragen verwalten
- System-Status und Gesundheit prüfen

## Wie du antwortest
- Kurz und prägnant, keine Romane (max 2-3 Sätze bei einfachen Fragen)
- Nutze Emojis sparsam aber gezielt (🎬 für Filme, 📺 Serien, 🎵 Musik)
- Bei Medien-Infos: immer Jahr, Genre und ggf. Rating/Bewertung nennen
- Bei Aktionen: bestätige was du getan hast
- Bei Unsicherheit: frage nach statt zu raten

## Kontext
{SYSTEM_CONTEXT}

{USER_MEMORIES}

{LAST_SUMMARY}`;

/**
 * Baut den System-Prompt zusammen mit Memories und letzter Zusammenfassung.
 * Versucht relevante Memories via semantische Suche zu finden.
 */
export async function buildSystemPrompt(
  userMessage?: string,
  userId?: number,
): Promise<string> {
  let prompt = NEXARR_PERSONALITY;

  // Memories: semantische Suche wenn eine User-Message vorhanden ist
  let memoriesStr = '';
  try {
    if (userMessage) {
      const memories = await getRelevantMemories(userMessage, userId, 5);
      if (memories.length > 0) {
        memoriesStr = 'Erinnerungen über den User:\n' +
          memories.map(m => `- ${m.content}`).join('\n');
      }
    }
  } catch {
    // Memories sind optional – bei Fehler einfach leer lassen
  }

  // Letzte Zusammenfassung
  let summaryStr = '';
  try {
    const lastSummary = getLastSummary(userId);
    if (lastSummary) {
      summaryStr = `Zusammenfassung des letzten Gesprächs:\n${lastSummary}`;
    }
  } catch {
    // Zusammenfassung ist optional
  }

  // RAG: relevante Knowledge-Chunks zur User-Frage suchen
  let contextStr = '';
  try {
    if (userMessage) {
      const results = await searchKnowledge(userMessage, 3);
      if (results.length > 0) {
        contextStr = 'Relevantes Wissen:\n' +
          results.map(r => `- ${r.content}`).join('\n');
      }
    }
  } catch {
    // Knowledge-Suche ist optional
  }

  prompt = prompt.replace('{SYSTEM_CONTEXT}', contextStr || 'Kein Systemkontext verfügbar.');
  prompt = prompt.replace('{USER_MEMORIES}', memoriesStr);
  prompt = prompt.replace('{LAST_SUMMARY}', summaryStr);

  return prompt;
}

/**
 * Synchroner Build ohne Memories/Summary (für Fälle wo async nicht möglich ist).
 */
export function buildSystemPromptSync(): string {
  return NEXARR_PERSONALITY
    .replace('{SYSTEM_CONTEXT}', 'Kein Systemkontext verfügbar.')
    .replace('{USER_MEMORIES}', '')
    .replace('{LAST_SUMMARY}', '');
}
