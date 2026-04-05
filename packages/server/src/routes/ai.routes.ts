import { Router } from 'express';
import * as aiService from '../ai/ai.service.js';
import { buildSystemPrompt } from '../ai/personality.js';
import {
  getConversationMessages,
  upsertConversation,
} from '../ai/conversations.js';
import { agentLoop } from '../ai/agent.js';
import { extractMemories } from '../ai/memory.js';
import { generateSummary, shouldGenerateSummary } from '../ai/summary.js';
import type { OllamaMessage } from '../ai/ai.service.js';
import { getKnowledgeStats } from '../ai/knowledge.js';
import { seedKnowledge, reseedKnowledge } from '../ai/knowledge-seed.js';
import { analyzeLibrary, generateLibraryProfile } from '../ai/library-analysis.js';
import crypto from 'node:crypto';

const router = Router();

// ── GET /api/ai/status – Ollama-Erreichbarkeit & Config ─────────────────────

router.get('/status', async (_req, res, next) => {
  try {
    const status = await aiService.getStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/ai/models – Verfügbare Ollama-Modelle ──────────────────────────

router.get('/models', async (_req, res, next) => {
  try {
    const models = await aiService.getModels();
    res.json(models);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/ai/chat – Agent-Chat mit Tool Calling ────────────────────────

router.post('/chat', async (req, res, next) => {
  try {
    const { message, sessionId } = req.body as {
      message?: string;
      sessionId?: string;
    };

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message ist erforderlich' });
      return;
    }

    const sid = sessionId || crypto.randomUUID();
    const systemPrompt = await buildSystemPrompt(message);

    // History aus DB laden
    const history = getConversationMessages(sid);

    // Messages zusammenbauen
    const messages: OllamaMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: message },
    ];

    // Agentic Loop – LLM kann Tools aufrufen
    const result = await agentLoop(messages);

    // History updaten (nur User + Assistant, keine Tool-Messages)
    const updatedHistory: OllamaMessage[] = [
      ...history,
      { role: 'user', content: message },
      { role: 'assistant', content: result.content },
    ];

    const trimmed = updatedHistory.length > 40
      ? updatedHistory.slice(-40)
      : updatedHistory;

    upsertConversation(sid, trimmed);

    // Post-Processing (async, non-blocking – Fehler werden nur geloggt)
    extractMemories(message, result.content).catch(() => {});
    if (shouldGenerateSummary(trimmed.length)) {
      generateSummary(sid, trimmed).catch(() => {});
    }

    res.json({
      sessionId: sid,
      message: result.content,
      toolCalls: result.toolCalls.map(tc => ({
        name: tc.name,
        arguments: tc.arguments,
        success: tc.result.success,
        destructive: tc.destructive,
      })),
      iterations: result.iterations,
      model: result.lastResponse.model,
      evalCount: result.lastResponse.eval_count,
      totalDuration: result.lastResponse.total_duration,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/ai/knowledge/stats – Knowledge-Base Statistiken ───────────────

router.get('/knowledge/stats', (_req, res) => {
  const stats = getKnowledgeStats();
  res.json(stats);
});

// ── POST /api/ai/knowledge/seed – Knowledge-Seeds neu laden ────────────────

router.post('/knowledge/seed', async (_req, res, next) => {
  try {
    await reseedKnowledge();
    const stats = getKnowledgeStats();
    res.json({ message: 'Knowledge-Seeds neu geladen', stats });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/ai/library/stats – Bibliotheks-Statistiken ───────────────────

router.get('/library/stats', async (_req, res, next) => {
  try {
    const stats = await analyzeLibrary();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/ai/library/analyze – Geschmacksprofil generieren ─────────────

router.post('/library/analyze', async (_req, res, next) => {
  try {
    const profile = await generateLibraryProfile();
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

export { router as aiRouter };
