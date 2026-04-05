import { ref, onUnmounted } from 'vue';
import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@nexarr/shared';

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;
let refCount = 0;

function getSocket(): AppSocket {
  if (!socket) {
    socket = io('/', {
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      console.log('[Socket] Verbunden:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Getrennt:', reason);
    });
  }
  return socket;
}

export function useSocket() {
  refCount++;
  const sock = getSocket();

  const isConnected = ref(sock.connected);

  sock.on('connect', () => { isConnected.value = true; });
  sock.on('disconnect', () => { isConnected.value = false; });

  onUnmounted(() => {
    refCount--;
    if (refCount <= 0 && socket) {
      socket.disconnect();
      socket = null;
      refCount = 0;
    }
  });

  return { socket: sock, isConnected };
}
