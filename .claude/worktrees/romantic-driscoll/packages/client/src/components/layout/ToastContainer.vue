<script setup lang="ts">
import { useGotifyStore } from '../../stores/gotify.store.js';

const gotify = useGotifyStore();

function priorityClass(p: number): string {
  if (p >= 8) return 'toast--critical';
  if (p >= 5) return 'toast--high';
  return 'toast--normal';
}

function priorityLabel(p: number): string {
  if (p >= 8) return '🔴';
  if (p >= 5) return '🟡';
  return '🔵';
}
</script>

<template>
  <Teleport to="body">
    <div class="toast-container" aria-live="polite">
      <TransitionGroup name="toast">
        <div
          v-for="toast in gotify.toasts"
          :key="toast.id"
          :class="['toast', priorityClass(toast.priority)]"
          @click="gotify.dismissToast(toast.id)"
        >
          <div class="toast-header">
            <span class="toast-priority">{{ priorityLabel(toast.priority) }}</span>
            <span class="toast-app">Gotify</span>
            <button class="toast-close" @click.stop="gotify.dismissToast(toast.id)">×</button>
          </div>
          <p class="toast-title">{{ toast.title }}</p>
          <p class="toast-message">{{ toast.message }}</p>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  bottom: var(--space-5);
  right: var(--space-5);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  pointer-events: none;
}

.toast {
  pointer-events: all;
  width: 320px;
  background: var(--bg-elevated);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  border-left: 3px solid var(--gotify);
}

.toast--critical { border-left-color: #ef4444; }
.toast--high     { border-left-color: #f59e0b; }
.toast--normal   { border-left-color: var(--gotify); }

.toast-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.toast-priority { font-size: 12px; }

.toast-app {
  font-size: var(--text-xs);
  color: var(--gotify);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex: 1;
}

.toast-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
}

.toast-close:hover { color: var(--text-primary); }

.toast-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toast-message {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* TransitionGroup Animationen */
.toast-enter-active { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.toast-leave-active { transition: all 0.2s ease-in; }
.toast-enter-from   { opacity: 0; transform: translateX(100%); }
.toast-leave-to     { opacity: 0; transform: translateX(110%); }
.toast-move         { transition: transform 0.3s ease; }
</style>
