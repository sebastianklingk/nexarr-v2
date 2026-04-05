<script setup lang="ts">
import { useAiStore } from '../../../stores/ai.store.js';

const props = defineProps<{
  buttons?: Array<{ label: string; prompt: string }>;
}>();

const ai = useAiStore();

function handleClick(prompt: string): void {
  if (ai.isStreaming) return;
  ai.sendMessage(prompt);
}
</script>

<template>
  <div class="ai-action-buttons">
    <button
      v-for="btn in (props.buttons ?? [])"
      :key="btn.label"
      class="ai-action-btn"
      :disabled="ai.isStreaming"
      @click="handleClick(btn.prompt)"
    >
      {{ btn.label }}
    </button>
  </div>
</template>

<style scoped>
.ai-action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.ai-action-btn {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: var(--text-xs);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.ai-action-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--text-primary);
}
.ai-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
