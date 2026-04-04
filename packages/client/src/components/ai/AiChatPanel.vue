<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { useAiStore } from '../../stores/ai.store.js';
import type { ChatMessage, ToolCallInfo } from '../../stores/ai.store.js';
import AiPosterCard from './cards/AiPosterCard.vue';
import AiMediaCarousel from './cards/AiMediaCarousel.vue';
import AiDownloadCard from './cards/AiDownloadCard.vue';
import AiStreamCard from './cards/AiStreamCard.vue';
import AiCalendarPreview from './cards/AiCalendarPreview.vue';
import AiActionButtons from './cards/AiActionButtons.vue';

const ai = useAiStore();
const input = ref('');
const messagesEl = ref<HTMLElement | null>(null);

// Quick Actions
const quickActions = [
  { label: 'Downloads', prompt: 'Zeig mir den aktuellen Download-Status' },
  { label: 'Empfehlung', prompt: 'Empfiehl mir einen Film basierend auf meiner Bibliothek' },
  { label: 'Streams', prompt: 'Wer schaut gerade etwas?' },
  { label: 'Kalender', prompt: 'Was kommt diese Woche raus?' },
];

function send(): void {
  if (!input.value.trim() || ai.isStreaming) return;
  ai.sendMessage(input.value);
  input.value = '';
}

function sendQuick(prompt: string): void {
  if (ai.isStreaming) return;
  ai.sendMessage(prompt);
}

function handleKeydown(e: KeyboardEvent): void {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send();
  }
}

function formatToolName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDuration(ns?: number): string {
  if (!ns) return '';
  const ms = ns / 1_000_000;
  return ms > 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

// Auto-scroll bei neuen Messages / Streaming
watch(
  () => ai.lastMessage?.content,
  () => {
    nextTick(() => {
      if (messagesEl.value) {
        messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
      }
    });
  },
);
</script>

<template>
  <div class="ai-chat-panel">
    <!-- Header -->
    <div class="ai-header">
      <div class="ai-header-left">
        <span class="ai-avatar">🤖</span>
        <span class="ai-title">nexarr AI</span>
        <span
          class="ai-status"
          :class="ai.isConnected ? 'connected' : 'disconnected'"
        ></span>
      </div>
      <div class="ai-header-right">
        <button
          v-if="ai.hasMessages"
          class="ai-btn-icon"
          title="Chat leeren"
          @click="ai.clearChat()"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
        <button class="ai-btn-icon" title="Schließen" @click="ai.togglePanel()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Messages -->
    <div ref="messagesEl" class="ai-messages">
      <!-- Empty State -->
      <div v-if="!ai.hasMessages" class="ai-empty">
        <div class="ai-empty-icon">🎬</div>
        <p class="ai-empty-text">Frag mich alles über deine Medien-Bibliothek!</p>
        <div class="ai-quick-actions">
          <button
            v-for="action in quickActions"
            :key="action.label"
            class="ai-quick-btn"
            @click="sendQuick(action.prompt)"
          >
            {{ action.label }}
          </button>
        </div>
      </div>

      <!-- Message List -->
      <template v-for="msg in ai.messages" :key="msg.id">
        <div class="ai-msg" :class="msg.role">
          <!-- Tool Calls -->
          <div v-if="msg.toolCalls?.length" class="ai-tool-calls">
            <div
              v-for="(tc, idx) in msg.toolCalls"
              :key="idx"
              class="ai-tool-call"
              :class="tc.status"
            >
              <span class="ai-tool-icon">
                <template v-if="tc.status === 'running'">⏳</template>
                <template v-else-if="tc.status === 'done'">✅</template>
                <template v-else>❌</template>
              </span>
              <span class="ai-tool-name">{{ formatToolName(tc.name) }}</span>
            </div>
          </div>

          <!-- Content -->
          <div class="ai-msg-content">
            <span v-if="msg.streaming && !msg.content" class="ai-typing">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </span>
            <template v-else>{{ msg.content }}</template>
          </div>

          <!-- Rich Cards -->
          <div v-if="msg.cards?.length" class="ai-cards">
            <template v-for="(card, cidx) in msg.cards" :key="cidx">
              <AiPosterCard
                v-if="card.cardType === 'poster_card'"
                v-bind="card.data as Record<string, unknown>"
              />
              <AiMediaCarousel
                v-else-if="card.cardType === 'media_carousel'"
                v-bind="card.data as Record<string, unknown>"
              />
              <AiDownloadCard
                v-else-if="card.cardType === 'download_card'"
                v-bind="card.data as Record<string, unknown>"
              />
              <AiStreamCard
                v-else-if="card.cardType === 'stream_card'"
                v-bind="card.data as Record<string, unknown>"
              />
              <AiCalendarPreview
                v-else-if="card.cardType === 'calendar_preview'"
                v-bind="card.data as Record<string, unknown>"
              />
              <AiActionButtons
                v-else-if="card.cardType === 'action_buttons'"
                v-bind="card.data as Record<string, unknown>"
              />
            </template>
          </div>

          <!-- Meta -->
          <div v-if="msg.role === 'assistant' && !msg.streaming && msg.totalDuration" class="ai-msg-meta">
            {{ formatDuration(msg.totalDuration) }}
          </div>
        </div>
      </template>

      <!-- Error -->
      <div v-if="ai.error" class="ai-error">
        {{ ai.error }}
      </div>
    </div>

    <!-- Input -->
    <div class="ai-input-area">
      <textarea
        v-model="input"
        class="ai-input"
        placeholder="Nachricht eingeben..."
        rows="1"
        :disabled="ai.isStreaming"
        @keydown="handleKeydown"
      ></textarea>
      <button
        class="ai-send-btn"
        :disabled="!input.trim() || ai.isStreaming"
        @click="send()"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.ai-chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--bg-border);
  overflow: hidden;
}

/* ── Header ── */
.ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--bg-border);
  background: var(--bg-elevated);
  flex-shrink: 0;
}
.ai-header-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.ai-header-right {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.ai-avatar {
  font-size: 20px;
}
.ai-title {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--text-primary);
}
.ai-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: var(--space-1);
}
.ai-status.connected { background: #22c55e; }
.ai-status.disconnected { background: var(--text-muted); }

.ai-btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.ai-btn-icon:hover {
  background: var(--bg-overlay);
  color: var(--text-primary);
}

/* ── Messages ── */
.ai-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.ai-msg {
  max-width: 85%;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.ai-msg.user {
  align-self: flex-end;
}
.ai-msg.assistant {
  align-self: flex-start;
}

.ai-msg-content {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.ai-msg.user .ai-msg-content {
  background: var(--accent);
  color: #fff;
  border-bottom-right-radius: var(--radius-sm);
}
.ai-msg.assistant .ai-msg-content {
  background: var(--bg-overlay);
  color: var(--text-primary);
  border-bottom-left-radius: var(--radius-sm);
}

.ai-msg-meta {
  font-size: var(--text-xs);
  color: var(--text-muted);
  padding-left: var(--space-1);
}

/* ── Tool Calls ── */
.ai-tool-calls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  padding-bottom: var(--space-1);
}
.ai-tool-call {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  background: var(--bg-elevated);
  border: 1px solid var(--bg-border);
  color: var(--text-secondary);
}
.ai-tool-call.done {
  border-color: rgba(34, 197, 94, 0.3);
}
.ai-tool-call.error {
  border-color: rgba(239, 68, 68, 0.3);
}
.ai-tool-icon {
  font-size: 11px;
}
.ai-tool-name {
  font-weight: 600;
}

/* ── Typing Indicator ── */
.ai-typing {
  display: inline-flex;
  gap: 4px;
  padding: 4px 0;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
  animation: typing 1.2s infinite;
}
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes typing {
  0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-3px); }
}

/* ── Empty State ── */
.ai-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: var(--space-3);
  padding: var(--space-8);
}
.ai-empty-icon {
  font-size: 40px;
}
.ai-empty-text {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  text-align: center;
}
.ai-quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: center;
}
.ai-quick-btn {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.ai-quick-btn:hover {
  border-color: var(--accent);
  color: var(--text-primary);
}

/* ── Rich Cards ── */
.ai-cards {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
}

/* ── Error ── */
.ai-error {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  font-size: var(--text-xs);
}

/* ── Input ── */
.ai-input-area {
  display: flex;
  align-items: flex-end;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--bg-border);
  background: var(--bg-elevated);
  flex-shrink: 0;
}
.ai-input {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: var(--text-sm);
  font-family: inherit;
  resize: none;
  outline: none;
  min-height: 36px;
  max-height: 100px;
  transition: border-color 0.15s;
}
.ai-input:focus {
  border-color: var(--accent);
}
.ai-input::placeholder {
  color: var(--text-muted);
}
.ai-input:disabled {
  opacity: 0.5;
}
.ai-send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: var(--radius-md);
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, opacity 0.15s;
}
.ai-send-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}
.ai-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
