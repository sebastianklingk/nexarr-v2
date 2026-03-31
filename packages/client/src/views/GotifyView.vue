<script setup lang="ts">
import { onMounted } from 'vue';
import { useGotifyStore } from '../stores/gotify.store.js';

const store = useGotifyStore();

onMounted(async () => {
  await store.fetchMessages();
});

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function priorityLabel(p: number): string {
  if (p >= 8) return 'Kritisch';
  if (p >= 5) return 'Hoch';
  return 'Normal';
}

function priorityClass(p: number): string {
  if (p >= 8) return 'prio-critical';
  if (p >= 5) return 'prio-high';
  return 'prio-normal';
}
</script>

<template>
  <div class="gotify-view">

    <!-- Header -->
    <div class="view-header">
      <div class="header-left">
        <div class="app-indicator" />
        <h1 class="view-title">Benachrichtigungen</h1>
        <span v-if="store.unreadCount" class="count-badge">{{ store.unreadCount }}</span>
      </div>
      <button
        v-if="store.messages.length"
        class="clear-all-btn"
        @click="store.deleteAll()"
      >
        Alle löschen
      </button>
    </div>

    <!-- Nicht konfiguriert -->
    <div v-if="!store.configured" class="empty-state">
      <div class="empty-icon">🔔</div>
      <p class="empty-title">Gotify nicht konfiguriert</p>
      <p class="empty-sub">GOTIFY_URL und GOTIFY_TOKEN in der .env setzen</p>
    </div>

    <!-- Fehler -->
    <div v-else-if="store.error" class="empty-state">
      <div class="empty-icon">⚠️</div>
      <p class="empty-title">{{ store.error }}</p>
    </div>

    <!-- Leer -->
    <div v-else-if="!store.messages.length" class="empty-state">
      <div class="empty-icon">✓</div>
      <p class="empty-title">Keine Nachrichten</p>
      <p class="empty-sub">Gotify ist leer</p>
    </div>

    <!-- Nachrichten-Liste -->
    <div v-else class="messages-list">
      <TransitionGroup name="msg">
        <div
          v-for="msg in store.messages"
          :key="msg.id"
          class="message-card"
        >
          <div class="msg-left">
            <span :class="['prio-dot', priorityClass(msg.priority)]" :title="priorityLabel(msg.priority)" />
          </div>
          <div class="msg-body">
            <div class="msg-header">
              <p class="msg-title">{{ msg.title }}</p>
              <span :class="['prio-badge', priorityClass(msg.priority)]">{{ priorityLabel(msg.priority) }}</span>
            </div>
            <p class="msg-text">{{ msg.message }}</p>
            <p class="msg-date">{{ formatDate(msg.date) }}</p>
          </div>
          <button class="msg-delete" title="Löschen" @click="store.deleteMessage(msg.id)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>

  </div>
</template>

<style scoped>
.gotify-view {
  padding: var(--space-6);
  max-width: 800px;
  margin: 0 auto;
}

/* Header */
.view-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.app-indicator {
  width: 4px;
  height: 28px;
  background: var(--gotify);
  border-radius: 2px;
}

.view-title {
  font-size: var(--text-xl);
  font-weight: 700;
  color: var(--text-primary);
}

.count-badge {
  background: var(--gotify);
  color: #fff;
  font-size: var(--text-xs);
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 99px;
}

.clear-all-btn {
  background: var(--bg-elevated);
  border: 1px solid var(--bg-border);
  color: var(--text-tertiary);
  font-size: var(--text-sm);
  padding: 6px 14px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all .15s ease;
}

.clear-all-btn:hover {
  border-color: #ef4444;
  color: #ef4444;
}

/* Empty */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  gap: var(--space-3);
  text-align: center;
}

.empty-icon { font-size: 48px; }

.empty-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-secondary);
}

.empty-sub {
  font-size: var(--text-sm);
  color: var(--text-muted);
}

/* Messages */
.messages-list { display: flex; flex-direction: column; gap: var(--space-3); }

.message-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  background: var(--bg-surface);
  border: 1px solid var(--bg-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  transition: border-color .15s ease;
}

.message-card:hover { border-color: var(--gotify); }

.msg-left { padding-top: 4px; }

.prio-dot {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.prio-critical { background: #ef4444; }
.prio-high     { background: #f59e0b; }
.prio-normal   { background: var(--gotify); }

.msg-body { flex: 1; min-width: 0; }

.msg-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-1);
}

.msg-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prio-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 99px;
  flex-shrink: 0;
}

.prio-badge.prio-critical { background: rgba(239,68,68,.15); color: #ef4444; }
.prio-badge.prio-high     { background: rgba(245,158,11,.15); color: #f59e0b; }
.prio-badge.prio-normal   { background: rgba(0,96,168,.15); color: var(--gotify); }

.msg-text {
  font-size: var(--text-sm);
  color: var(--text-tertiary);
  line-height: 1.6;
  word-break: break-word;
}

.msg-date {
  font-size: var(--text-xs);
  color: var(--text-muted);
  margin-top: var(--space-2);
}

.msg-delete {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  transition: color .15s ease;
  flex-shrink: 0;
}

.msg-delete:hover { color: #ef4444; }

/* TransitionGroup */
.msg-enter-active { transition: all 0.25s ease; }
.msg-leave-active { transition: all 0.2s ease; position: absolute; width: 100%; }
.msg-enter-from   { opacity: 0; transform: translateY(-8px); }
.msg-leave-to     { opacity: 0; transform: translateX(20px); }
.msg-move         { transition: transform 0.25s ease; }
</style>
