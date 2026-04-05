import axios from 'axios';
import { env } from '../config/env.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: OllamaToolCall[];
}

export interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface OllamaTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
  tools?: OllamaTool[];
  options?: {
    num_ctx?: number;
    temperature?: number;
    top_p?: number;
  };
}

export interface OllamaChatChunk {
  model: string;
  message: {
    role: 'assistant';
    content: string;
    tool_calls?: OllamaToolCall[];
  };
  done: boolean;
  total_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function ollamaBase(): string {
  if (!env.OLLAMA_URL) throw new Error('OLLAMA_URL nicht konfiguriert');
  return env.OLLAMA_URL;
}

/**
 * Entfernt <think>...</think> Blöcke aus Qwen3 Hybrid-Thinking Responses.
 * Diese werden intern für Chain-of-Thought genutzt, sollen aber nicht zum User.
 */
export function stripThinkingTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
}

// ── Chat (non-streaming, simple) ─────────────────────────────────────────────

export async function chat(
  messages: OllamaMessage[],
  options?: { temperature?: number; tools?: OllamaTool[] }
): Promise<OllamaChatChunk> {
  const body: OllamaChatRequest = {
    model: env.OLLAMA_CHAT_MODEL,
    messages,
    stream: false,
    tools: options?.tools,
    options: {
      num_ctx: env.OLLAMA_CTX_SIZE,
      temperature: options?.temperature ?? 0.7,
    },
  };

  const { data } = await axios.post<OllamaChatChunk>(
    `${ollamaBase()}/api/chat`,
    body,
    { timeout: 120_000 }
  );

  return data;
}

// ── Chat (streaming) ─────────────────────────────────────────────────────────

export async function* chatStream(
  messages: OllamaMessage[],
  options?: { temperature?: number }
): AsyncGenerator<OllamaChatChunk> {
  const body: OllamaChatRequest = {
    model: env.OLLAMA_CHAT_MODEL,
    messages,
    stream: true,
    options: {
      num_ctx: env.OLLAMA_CTX_SIZE,
      temperature: options?.temperature ?? 0.7,
    },
  };

  const response = await axios.post(
    `${ollamaBase()}/api/chat`,
    body,
    { responseType: 'stream', timeout: 120_000 }
  );

  let buffer = '';

  for await (const rawChunk of response.data) {
    buffer += rawChunk.toString();
    const lines = buffer.split('\n');
    // Letzte (möglicherweise unvollständige) Zeile im Buffer behalten
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        yield JSON.parse(trimmed) as OllamaChatChunk;
      } catch {
        // Partielle JSON-Zeile – ignorieren
      }
    }
  }

  // Restlicher Buffer
  if (buffer.trim()) {
    try {
      yield JSON.parse(buffer.trim()) as OllamaChatChunk;
    } catch {
      // Ignorieren
    }
  }
}

// ── Vision (Image Chat) ─────────────────────────────────────────────────────

export interface OllamaVisionMessage {
  role: 'user' | 'assistant';
  content: string;
  images?: string[];  // Base64-encoded images
}

export async function chatWithImage(
  prompt: string,
  imageBase64: string,
  options?: { model?: string; temperature?: number },
): Promise<string> {
  const model = options?.model ?? env.OLLAMA_VISION_MODEL;
  if (!model) throw new Error('OLLAMA_VISION_MODEL nicht konfiguriert');

  const body = {
    model,
    messages: [{
      role: 'user',
      content: prompt,
      images: [imageBase64],
    }],
    stream: false,
    options: {
      num_ctx: 4096,
      temperature: options?.temperature ?? 0.3,
    },
  };

  const { data } = await axios.post<OllamaChatChunk>(
    `${ollamaBase()}/api/chat`,
    body,
    { timeout: 180_000 },  // Vision can be slow
  );

  return stripThinkingTags(data.message.content);
}

// ── Models ───────────────────────────────────────────────────────────────────

export async function getModels(): Promise<OllamaModel[]> {
  const { data } = await axios.get<{ models: OllamaModel[] }>(
    `${ollamaBase()}/api/tags`,
    { timeout: 5_000 }
  );
  return data.models;
}

// ── Running Models ───────────────────────────────────────────────────────────

export interface OllamaRunningModel {
  name: string;
  model: string;
  size: number;
  size_vram: number;
  expires_at: string;
}

export async function getRunningModels(): Promise<OllamaRunningModel[]> {
  const { data } = await axios.get<{ models: OllamaRunningModel[] }>(
    `${ollamaBase()}/api/ps`,
    { timeout: 5_000 }
  );
  return data.models;
}

// ── Status (Ollama erreichbar?) ──────────────────────────────────────────────

export async function getStatus(): Promise<{
  available: boolean;
  url: string;
  chatModel: string;
  embedModel: string;
  visionModel: string;
  runningModels: OllamaRunningModel[];
}> {
  const url = env.OLLAMA_URL ?? '';
  if (!url) {
    return {
      available: false,
      url: '',
      chatModel: env.OLLAMA_CHAT_MODEL,
      embedModel: env.OLLAMA_EMBED_MODEL,
      visionModel: env.OLLAMA_VISION_MODEL,
      runningModels: [],
    };
  }

  try {
    const running = await getRunningModels();
    return {
      available: true,
      url,
      chatModel: env.OLLAMA_CHAT_MODEL,
      embedModel: env.OLLAMA_EMBED_MODEL,
      visionModel: env.OLLAMA_VISION_MODEL,
      runningModels: running,
    };
  } catch {
    return {
      available: false,
      url,
      chatModel: env.OLLAMA_CHAT_MODEL,
      embedModel: env.OLLAMA_EMBED_MODEL,
      visionModel: env.OLLAMA_VISION_MODEL,
      runningModels: [],
    };
  }
}
