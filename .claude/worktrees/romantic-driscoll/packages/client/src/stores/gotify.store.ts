import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { GotifyMessage } from '@nexarr/shared';

// Toast-Eintrag der im UI angezeigt wird
export interface GotifyToast {
  id: number;
  title: string;
  message: string;
  priority: number;
  date: string;
}

const POLL_INTERVAL = 30_000; // alle 30s pollen

export const useGotifyStore = defineStore('gotify', () => {
  const messages    = ref<GotifyMessage[]>([]);
  const toasts      = ref<GotifyToast[]>([]);
  const isLoading   = ref(false);
  const error       = ref<string | null>(null);
  const configured  = ref(true);

  // Interne Tracking-Variable – welche Message-IDs wurden bereits als Toast gezeigt
  const seenIds     = ref<Set<number>>(new Set());
  let   pollTimer: ReturnType<typeof setInterval> | null = null;
  let   initialized = false;

  const unreadCount = computed(() => messages.value.length);

  async function fetchMessages() {
    try {
      const res = await fetch('/api/gotify/messages?limit=40', { credentials: 'include' });
      if (res.status === 503) { configured.value = false; return; }
      if (!res.ok) throw new Error('Fehler beim Laden');
      configured.value = true;

      const data: GotifyMessage[] = await res.json();
      const newOnes = data.filter(m => !seenIds.value.has(m.id));

      // Neue Nachrichten als Toast anzeigen (max. 3 auf einmal beim ersten Laden ignorieren)
      if (initialized && newOnes.length > 0) {
        for (const msg of newOnes.slice(0, 3)) {
          pushToast(msg);
        }
      }

      // Alle als gesehen markieren
      for (const m of data) seenIds.value.add(m.id);
      messages.value = data;
      error.value = null;
    } catch {
      error.value = 'Gotify nicht erreichbar';
    }
  }

  function pushToast(msg: GotifyMessage) {
    const toast: GotifyToast = {
      id:       msg.id,
      title:    msg.title,
      message:  msg.message,
      priority: msg.priority,
      date:     msg.date,
    };
    toasts.value.push(toast);
    // Nach 6s automatisch entfernen
    setTimeout(() => dismissToast(toast.id), 6_000);
  }

  function dismissToast(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }

  async function deleteMessage(id: number) {
    await fetch(`/api/gotify/messages/${id}`, { method: 'DELETE', credentials: 'include' });
    messages.value = messages.value.filter(m => m.id !== id);
    seenIds.value.delete(id);
  }

  async function deleteAll() {
    await fetch('/api/gotify/messages', { method: 'DELETE', credentials: 'include' });
    messages.value = [];
    seenIds.value.clear();
  }

  async function startPolling() {
    await fetchMessages();
    initialized = true;
    if (!pollTimer) {
      pollTimer = setInterval(fetchMessages, POLL_INTERVAL);
    }
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  return {
    messages, toasts, isLoading, error, configured, unreadCount,
    fetchMessages, startPolling, stopPolling,
    deleteMessage, deleteAll, dismissToast,
  };
});
