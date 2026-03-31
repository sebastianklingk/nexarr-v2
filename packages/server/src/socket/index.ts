import { Server as HttpServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '@nexarr/shared';
import { getAggregatedQueue } from '../services/queue.service.js';

// ── Singleton ─────────────────────────────────────────────────────────────────

let io: SocketServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

// ── Queue-Polling ─────────────────────────────────────────────────────────────

const QUEUE_INTERVAL_MS = 3_000;
let queueTimer: ReturnType<typeof setInterval> | null = null;

function startQueuePolling(): void {
  if (queueTimer) return;

  queueTimer = setInterval(async () => {
    const room = io.sockets.adapter.rooms.get('queue');
    if (!room || room.size === 0) {
      stopQueuePolling();
      return;
    }

    try {
      const state = await getAggregatedQueue();
      io.to('queue').emit('queue:update', state);
    } catch (err) {
      console.error('[Socket] Queue-Poll Fehler:', err);
    }
  }, QUEUE_INTERVAL_MS);

  console.log('[Socket] Queue-Polling gestartet (alle 3s)');
}

function stopQueuePolling(): void {
  if (queueTimer) {
    clearInterval(queueTimer);
    queueTimer = null;
    console.log('[Socket] Queue-Polling gestoppt');
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

export function initSocket(httpServer: HttpServer): typeof io {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'development'
        ? ['http://localhost:5173', 'http://192.168.188.42:5173']
        : false,
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client verbunden: ${socket.id}`);

    // ── Queue Subscription ──────────────────────────────────────────────────
    socket.on('queue:subscribe', () => {
      socket.join('queue');
      console.log(`[Socket] ${socket.id} hat queue abonniert`);

      // Sofort einmal pushen damit der Client nicht 3s wartet
      getAggregatedQueue()
        .then((state) => socket.emit('queue:update', state))
        .catch((err) => console.error('[Socket] Initial queue push Fehler:', err));

      startQueuePolling();
    });

    socket.on('queue:unsubscribe', () => {
      socket.leave('queue');
      // Polling stoppen wenn niemand mehr zuhört
      const room = io.sockets.adapter.rooms.get('queue');
      if (!room || room.size === 0) stopQueuePolling();
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client getrennt: ${socket.id}`);
      const room = io.sockets.adapter.rooms.get('queue');
      if (!room || room.size === 0) stopQueuePolling();
    });
  });

  return io;
}

export function getIo(): typeof io {
  if (!io) throw new Error('Socket.io nicht initialisiert – initSocket() zuerst aufrufen.');
  return io;
}
