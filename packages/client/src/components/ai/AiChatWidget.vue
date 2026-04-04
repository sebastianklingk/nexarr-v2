<script setup lang="ts">
import { watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAiStore } from '../../stores/ai.store.js';
import AiChatPanel from './AiChatPanel.vue';

const ai = useAiStore();
const router = useRouter();

// Handle AI navigation events
watch(() => ai.pendingNavigation, (nav) => {
  if (nav?.type === 'internal') {
    router.push(nav.path);
    ai.pendingNavigation = null;
  }
});
</script>

<template>
  <div class="ai-widget">
    <!-- Chat Panel -->
    <Transition name="ai-panel">
      <div v-if="ai.isOpen" class="ai-panel-wrapper">
        <AiChatPanel />
      </div>
    </Transition>

    <!-- Floating Button -->
    <button
      class="ai-fab"
      :class="{ active: ai.isOpen, streaming: ai.isStreaming }"
      title="nexarr AI"
      @click="ai.togglePanel()"
    >
      <svg
        v-if="!ai.isOpen"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <svg
        v-else
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.ai-widget {
  position: fixed;
  bottom: var(--space-6);
  right: var(--space-6);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-3);
}

/* ── Panel ── */
.ai-panel-wrapper {
  width: 400px;
  height: 520px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

/* ── FAB ── */
.ai-fab {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border: none;
  border-radius: 50%;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(155, 0, 69, 0.4);
  transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
}
.ai-fab:hover {
  background: var(--accent-hover);
  transform: scale(1.05);
}
.ai-fab.active {
  background: var(--bg-elevated);
  color: var(--text-secondary);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}
.ai-fab.streaming {
  animation: pulse-ring 2s infinite;
}

@keyframes pulse-ring {
  0% { box-shadow: 0 0 0 0 rgba(155, 0, 69, 0.5); }
  70% { box-shadow: 0 0 0 10px rgba(155, 0, 69, 0); }
  100% { box-shadow: 0 0 0 0 rgba(155, 0, 69, 0); }
}

/* ── Panel Transition ── */
.ai-panel-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.ai-panel-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.ai-panel-enter-from {
  opacity: 0;
  transform: translateY(12px) scale(0.95);
}
.ai-panel-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.97);
}
</style>
