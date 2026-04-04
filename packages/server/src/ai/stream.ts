import type { Socket } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  AiMessagePayload,
} from '@nexarr/shared';
import crypto from 'node:crypto';
import { chat, chatStream, stripThinkingTags } from './ai.service.js';
import type { OllamaMessage } from './ai.service.js';
import { buildSystemPrompt } from './personality.js';
import {
  getConversationMessages,
  upsertConversation,
} from './conversations.js';
import { allTools } from './tools.js';
import { executeToolCall, isDestructive } from './executor.js';
import { extractMemories } from './memory.js';
import { generateSummary, shouldGenerateSummary } from './summary.js';

type AiSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

const MAX_TOOL_ITERATIONS = 5;

/**
 * Registriert den ai:message Handler auf einem Socket.
 *
 * Ablauf:
 * 1. Erste Ollama-Anfrage mit Tools (non-streaming) → prüfen ob Tool-Calls
 * 2. Falls Tool-Calls: ausführen, Ergebnis zurück an LLM (Loop, max 5 Iterationen)
 *    Während des Loops: ai:tool_call Events ans Frontend senden
 * 3. Finale Antwort (ohne Tool-Calls): Token-für-Token streamen via ai:token
 */
export function registerAiHandlers(socket: AiSocket): void {
  socket.on('ai:message', async (data: AiMessagePayload) => {
    const { message, sessionId: clientSessionId } = data;
    const sessionId = clientSessionId || crypto.randomUUID();

    if (!message || typeof message !== 'string') {
      socket.emit('ai:error', { sessionId, error: 'Nachricht ist leer.' });
      return;
    }

    try {
      const systemPrompt = await buildSystemPrompt(message);
      const history = getConversationMessages(sessionId);

      const messages: OllamaMessage[] = [
        { role: 'system', content: systemPrompt },
        ...history,
        { role: 'user', content: message },
      ];

      // ── Tool-Loop (non-streaming) ──────────────────────────────────────
      for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
        const response = await chat(messages, { temperature: 0.3, tools: allTools });

        // Keine Tool-Calls → streame die finale Antwort
        if (!response.message.tool_calls?.length) {
          // Finale Antwort als Stream senden
          await streamFinalResponse(socket, sessionId, messages);
          break;
        }

        // Tool-Calls ausführen
        messages.push({
          role: 'assistant',
          content: response.message.content || '',
          tool_calls: response.message.tool_calls,
        });

        for (const call of response.message.tool_calls) {
          const destructive = isDestructive(call.function.name);
          console.log(
            `[AI Stream] Tool: ${call.function.name}${destructive ? ' ⚠️' : ''}`,
            JSON.stringify(call.function.arguments)
          );

          socket.emit('ai:tool_call', {
            sessionId,
            name: call.function.name,
            arguments: call.function.arguments,
          });

          const result = await executeToolCall(call);

          socket.emit('ai:tool_call', {
            sessionId,
            name: call.function.name,
            arguments: call.function.arguments,
            result: { success: result.success, error: result.error },
          });

          // Navigation / Card Actions
          if (result.success && result.data && typeof result.data === 'object') {
            const data = result.data as Record<string, unknown>;
            const action = data._action as { type: string; path?: string; url?: string } | undefined;
            if (action?.type === 'navigate' && action.path) {
              socket.emit('ai:navigate', { sessionId, path: action.path });
            } else if (action?.type === 'open_url' && action.url) {
              socket.emit('ai:open_url', { sessionId, url: action.url });
            }
            const cardType = data._cardType as string | undefined;
            if (cardType) {
              socket.emit('ai:card', {
                sessionId,
                cardType: cardType as import('@nexarr/shared').AiCardType,
                data,
              });
            }
          }

          messages.push({
            role: 'tool',
            content: JSON.stringify(result),
          });
        }

        // Nach der letzten Iteration: Stream die finale Antwort
        if (i === MAX_TOOL_ITERATIONS - 1) {
          await streamFinalResponse(socket, sessionId, messages);
        }
      }

      // ── History speichern ──────────────────────────────────────────────
      // Wir speichern nur User + Assistant (ohne System/Tool Messages)
      // Die finale Antwort wurde im streamFinalResponse verarbeitet

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unbekannter Fehler';
      console.error('[AI] Stream-Fehler:', errMsg);
      socket.emit('ai:error', { sessionId, error: errMsg });
    }
  });
}

/**
 * Streamt die finale Antwort Token für Token ans Frontend.
 * Danach wird die History in der DB gespeichert.
 */
async function streamFinalResponse(
  socket: AiSocket,
  sessionId: string,
  messages: OllamaMessage[],
): Promise<void> {
  // Streaming-Request OHNE Tools → LLM gibt direkt Antwort-Text
  let fullResponse = '';

  for await (const chunk of chatStream(messages)) {
    if (chunk.message.content) {
      fullResponse += chunk.message.content;
      socket.emit('ai:token', {
        sessionId,
        token: chunk.message.content,
        done: false,
      });
    }

    if (chunk.done) {
      const cleanResponse = stripThinkingTags(fullResponse);
      socket.emit('ai:token', {
        sessionId,
        token: '',
        done: true,
        fullResponse: cleanResponse,
        model: chunk.model,
        evalCount: chunk.eval_count,
        totalDuration: chunk.total_duration,
      });

      // History speichern
      const history = getConversationMessages(sessionId);
      // Finde die letzte User-Message
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      const updatedHistory: OllamaMessage[] = [
        ...history,
        { role: 'user', content: lastUserMsg?.content || '' },
        { role: 'assistant', content: cleanResponse },
      ];

      const trimmed = updatedHistory.length > 40
        ? updatedHistory.slice(-40)
        : updatedHistory;

      upsertConversation(sessionId, trimmed);

      // Post-Processing (async, non-blocking)
      const userContent = lastUserMsg?.content || '';
      extractMemories(userContent, cleanResponse).catch(() => {});
      if (shouldGenerateSummary(trimmed.length)) {
        generateSummary(sessionId, trimmed).catch(() => {});
      }
    }
  }
}
