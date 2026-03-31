import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { io as createSocket } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type {
  QueueState,
  ArrQueueItem,
  SabnzbdState,
  ClientToServerEvents,
  ServerToClientEvents,
} from '@nexarr/shared';

// ── Store ─────────────────────────────────────────────────────────────────────

export const useQueueStore = defineStore('queue', () => {
  // ── State ──────────────────────────────────────────────────────────────────
  const queueState    = ref<QueueState | null>(null);
  const isConnected   = ref(false);
  const isSubscribed  = ref(false);
  const lastError     = ref<string | null>(null);

  let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

  // ── Getters ────────────────────────────────────────────────────────────────

  const arrItems = computed<ArrQueueItem[]>(() =>
    queueState.value?.arrItems ?? []
  );

  const sabnzbd = computed<SabnzbdState | null>(() =>
    queueState.value?.sabnzbd ?? null
  );

  const totalCount = computed<number>(() =>
    queueState.value?.totalCount ?? 0
  );

  const radarrItems = computed<ArrQueueItem[]>(() =>
    arrItems.value.filter(i => i.app === 'radarr')
  );

  const sonarrItems = computed<ArrQueueItem[]>(() =>
    arrItems.value.filter(i => i.app === 'sonarr')
  );

  const lidarrItems = computed<ArrQueueItem[]>(() =>
    arrItems.value.filter(i => i.app === 'lidarr')
  );

  const isDownloading = computed<boolean>(() =>
    totalCount.value > 0 &&
    (sabnzbd.value ? !sabnzbd.value.paused : false) ||
    arrItems.value.some(i => i.status === 'downloading')
  );

  // ── Socket-Setup ───────────────────────────────────────────────────────────

  function subscribe(): void {
    if (isSubscribed.value && socket?.connected) return;

    if (!socket) {
      socket = createSocket('/', {
        withCredentials: true,
        transports: ['websocket', 'polling'],
      });

      socket.on('connect', () => {
        isConnected.value = true;
        lastError.value   = null;
        socket!.emit('queue:subscribe');
        isSubscribed.value = true;
        console.log('[QueueStore] Socket verbunden, queue abonniert');
      });

      socket.on('disconnect', () => {
        isConnected.value  = false;
        isSubscribed.value = false;
        console.log('[QueueStore] Socket getrennt');
      });

      socket.on('connect_error', (err) => {
        lastError.value   = `Verbindungsfehler: ${err.message}`;
        isConnected.value = false;
      });

      socket.on('queue:update', (data: QueueState) => {
        queueState.value = data;
        lastError.value  = null;
      });
    } else if (socket.connected) {
      socket.emit('queue:subscribe');
      isSubscribed.value = true;
    } else {
      socket.connect();
    }
  }

  function unsubscribe(): void {
    if (socket && isSubscribed.value) {
      socket.emit('queue:unsubscribe');
      isSubscribed.value = false;
    }
  }

  function disconnect(): void {
    if (socket) {
      unsubscribe();
      socket.disconnect();
      socket            = null;
      isConnected.value = false;
      queueState.value  = null;
    }
  }

  return {
    // State
    queueState, isConnected, isSubscribed, lastError,
    // Getters
    arrItems, sabnzbd, totalCount,
    radarrItems, sonarrItems, lidarrItems, isDownloading,
    // Actions
    subscribe, unsubscribe, disconnect,
  };
});
