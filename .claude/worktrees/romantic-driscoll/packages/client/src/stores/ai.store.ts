import { defineStore } from 'pinia';
import { ref, computed, nextTick } from 'vue';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  AiTokenPayload,
  AiErrorPayload,
  AiToolCallPayload,
  AiNavigatePayload,
  AiOpenUrlPayload,
  AiCardPayload,
  AiCardType,
} from '@nexarr/shared';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AiCard {
  cardType: AiCardType;
  data: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  /** Streaming: Antwort wird gerade aufgebaut */
  streaming?: boolean;
  /** Tool-Calls die während dieser Antwort ausgeführt wurden */
  toolCalls?: ToolCallInfo[];
  /** Rich Media Cards von Tool-Results */
  cards?: AiCard[];
  /** Base64 Bild (für Vision-Messages) */
  image?: string;
  /** Modell + Performance Infos */
  model?: string;
  evalCount?: number;
  totalDuration?: number;
}

export interface ToolCallInfo {
  name: string;
  arguments: Record<string, unknown>;
  status: 'running' | 'done' | 'error';
  error?: string;
}

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// ── Store ────────────────────────────────────────────────────────────────────

export const useAiStore = defineStore('ai', () => {
  // State
  const messages = ref<ChatMessage[]>([]);
  const isStreaming = ref(false);
  const isConnected = ref(false);
  const sessionId = ref<string | null>(null);
  const error = ref<string | null>(null);
  const isOpen = ref(false);
  const pendingNavigation = ref<{ type: 'internal'; path: string } | null>(null);

  let socket: AppSocket | null = null;
  let msgCounter = 0;

  // Getters
  const hasMessages = computed(() => messages.value.length > 0);
  const lastMessage = computed(() =>
    messages.value.length > 0 ? messages.value[messages.value.length - 1] : null
  );

  // ── Socket Setup ──────────────────────────────────────────────────────────

  function ensureSocket(): AppSocket {
    if (socket) return socket;

    socket = io('/', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      isConnected.value = true;
      error.value = null;
    });

    socket.on('disconnect', () => {
      isConnected.value = false;
      if (isStreaming.value) {
        isStreaming.value = false;
        // Markiere letzte Message als fertig
        const last = messages.value[messages.value.length - 1];
        if (last?.streaming) last.streaming = false;
      }
    });

    socket.on('ai:token', (data: AiTokenPayload) => {
      if (sessionId.value && data.sessionId !== sessionId.value) return;

      if (!sessionId.value) sessionId.value = data.sessionId;

      const last = messages.value[messages.value.length - 1];

      if (data.done) {
        // Streaming fertig
        if (last?.streaming) {
          last.content = data.fullResponse || last.content;
          last.streaming = false;
          last.model = data.model;
          last.evalCount = data.evalCount;
          last.totalDuration = data.totalDuration;
        }
        isStreaming.value = false;
      } else {
        // Token anhängen
        if (last?.streaming) {
          last.content += data.token;
        }
      }
    });

    socket.on('ai:error', (data: AiErrorPayload) => {
      if (sessionId.value && data.sessionId !== sessionId.value) return;

      error.value = data.error;
      isStreaming.value = false;

      const last = messages.value[messages.value.length - 1];
      if (last?.streaming) {
        last.streaming = false;
        last.content = last.content || `Fehler: ${data.error}`;
      }
    });

    socket.on('ai:tool_call', (data: AiToolCallPayload) => {
      if (sessionId.value && data.sessionId !== sessionId.value) return;

      const last = messages.value[messages.value.length - 1];
      if (!last?.streaming) return;

      if (!last.toolCalls) last.toolCalls = [];

      if (data.result) {
        // Update: Tool-Call ist fertig
        const existing = last.toolCalls.find(
          tc => tc.name === data.name && tc.status === 'running'
        );
        if (existing) {
          existing.status = data.result.success ? 'done' : 'error';
          existing.error = data.result.error;
        }
      } else {
        // Neuer Tool-Call gestartet
        last.toolCalls.push({
          name: data.name,
          arguments: data.arguments,
          status: 'running',
        });
      }
    });

    socket.on('ai:navigate', (data: AiNavigatePayload) => {
      if (sessionId.value && data.sessionId !== sessionId.value) return;
      pendingNavigation.value = { type: 'internal', path: data.path };
    });

    socket.on('ai:open_url', (data: AiOpenUrlPayload) => {
      if (sessionId.value && data.sessionId !== sessionId.value) return;
      window.open(data.url, '_blank');
    });

    socket.on('ai:card', (data: AiCardPayload) => {
      if (sessionId.value && data.sessionId !== sessionId.value) return;
      const last = messages.value[messages.value.length - 1];
      if (!last?.streaming) return;
      if (!last.cards) last.cards = [];
      last.cards.push({ cardType: data.cardType, data: data.data });
    });

    return socket;
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  function sendMessage(text: string, image?: string): void {
    if (!text.trim() || isStreaming.value) return;

    const sock = ensureSocket();
    error.value = null;

    // User-Message hinzufügen
    messages.value.push({
      id: `msg-${++msgCounter}`,
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
      image,
    });

    // Leere Assistant-Message als Streaming-Platzhalter
    messages.value.push({
      id: `msg-${++msgCounter}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      streaming: true,
    });

    isStreaming.value = true;

    sock.emit('ai:message', {
      message: text.trim(),
      sessionId: sessionId.value ?? undefined,
      image,
    });
  }

  function clearChat(): void {
    messages.value = [];
    sessionId.value = null;
    error.value = null;
    isStreaming.value = false;
  }

  function togglePanel(): void {
    isOpen.value = !isOpen.value;
    if (isOpen.value && !socket) {
      ensureSocket();
    }
  }

  function disconnect(): void {
    if (socket) {
      socket.disconnect();
      socket = null;
      isConnected.value = false;
    }
  }

  return {
    // State
    messages,
    isStreaming,
    isConnected,
    sessionId,
    error,
    isOpen,
    pendingNavigation,
    // Getters
    hasMessages,
    lastMessage,
    // Actions
    sendMessage,
    clearChat,
    togglePanel,
    disconnect,
  };
});
