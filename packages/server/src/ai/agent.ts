import { chat, stripThinkingTags } from './ai.service.js';
import type { OllamaMessage, OllamaChatChunk } from './ai.service.js';
import { allTools } from './tools.js';
import { selectTools } from './tool-selector.js';
import { executeToolCall, isDestructive } from './executor.js';
import type { ToolResult } from './executor.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AgentResult {
  /** Finale Antwort des Agenten (bereinigt, ohne Thinking-Tags) */
  content: string;
  /** Alle während des Loops ausgeführten Tool-Calls */
  toolCalls: AgentToolCall[];
  /** Anzahl der Loop-Iterationen */
  iterations: number;
  /** Rohes Ollama-Response der letzten Iteration */
  lastResponse: OllamaChatChunk;
}

export interface AgentToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result: ToolResult;
  destructive: boolean;
  iterationIndex: number;
}

// ── Agentic Loop ─────────────────────────────────────────────────────────────

const MAX_ITERATIONS = 5;

/**
 * Führt den Agentic Loop aus: LLM → Tool-Calls → Tool-Ergebnisse → LLM → ...
 * Bis der LLM eine finale Antwort ohne Tool-Calls gibt oder maxIterations erreicht ist.
 *
 * @param messages - Chat-History inkl. System-Prompt und User-Message
 * @param maxIterations - Maximale Anzahl Tool-Call-Iterationen (default: 5)
 */
export async function agentLoop(
  messages: OllamaMessage[],
  maxIterations = MAX_ITERATIONS,
): Promise<AgentResult> {
  const toolCalls: AgentToolCall[] = [];
  let lastResponse: OllamaChatChunk | null = null;

  // Letzte User-Message für Smart Tool Selection extrahieren
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  const selectedTools = selectTools(lastUserMsg?.content ?? '', false);

  for (let i = 0; i < maxIterations; i++) {
    // LLM aufrufen mit smart-gefilterten Tools
    const response = await chat(messages, { temperature: 0.3, tools: selectedTools });
    lastResponse = response;

    // Keine Tool-Calls → finale Antwort
    if (!response.message.tool_calls?.length) {
      return {
        content: stripThinkingTags(response.message.content),
        toolCalls,
        iterations: i + 1,
        lastResponse: response,
      };
    }

    // Assistant-Message mit tool_calls zur History hinzufügen
    messages.push({
      role: 'assistant',
      content: response.message.content || '',
      tool_calls: response.message.tool_calls,
    });

    // Jeden Tool-Call ausführen
    for (const call of response.message.tool_calls) {
      const destructive = isDestructive(call.function.name);

      console.log(
        `[AI Agent] Tool: ${call.function.name}${destructive ? ' ⚠️ DESTRUKTIV' : ''}`,
        JSON.stringify(call.function.arguments)
      );

      const result = await executeToolCall(call);

      toolCalls.push({
        name: call.function.name,
        arguments: call.function.arguments,
        result,
        destructive,
        iterationIndex: i,
      });

      // Tool-Ergebnis als Message an LLM zurückgeben
      messages.push({
        role: 'tool',
        content: JSON.stringify(result),
      });
    }
  }

  // Max Iterations erreicht – trotzdem eine Antwort generieren
  const finalResponse = await chat(messages, { temperature: 0.3 });
  return {
    content: stripThinkingTags(
      finalResponse.message.content
      || 'Ich konnte die Aufgabe nicht vollständig abschließen. Bitte versuche es nochmal.'
    ),
    toolCalls,
    iterations: maxIterations,
    lastResponse: finalResponse,
  };
}

/**
 * Gibt die Tool-Definitionen zurück die an Ollama übergeben werden.
 */
export function getToolDefinitions() {
  return allTools;
}
