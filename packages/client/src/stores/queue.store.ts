import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { io as createSocket } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type {
  QueueState,
  ArrQueueItem,
  SabnzbdState,
  NormalizedSlot,
  DownloaderSummary,
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

  /** @deprecated Nutze `slots` + `downloaders` – bleibt für Dashboard-Widgets vorhanden */
  const sabnzbd = computed<SabnzbdState | null>(() =>
    queueState.value?.sabnzbd ?? null
  );

  /** Normalisierte Slots aller konfigurierten Downloader */
  const slots = computed<NormalizedSlot[]>(() =>
    queueState.value?.slots ?? []
  );

  /** Zusammenfassung pro Downloader (für Header-Controls + Stats-Bar) */
  const downloaders = computed<DownloaderSummary[]>(() =>
    queueState.value?.downloaders ?? []
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
    slots.value.some(s => s.status === 'downloading') ||
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
    arrItems, sabnzbd, slots, downloaders, totalCount,
    radarrItems, sonarrItems, lidarrItems, isDownloading,
    // Actions
    subscribe, unsubscribe, disconnect,
  };
});
