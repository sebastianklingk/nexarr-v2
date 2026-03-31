import { Server as HttpServer } from 'node:http';
import { Server as SocketServer } from 'socket.io';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '@nexarr/shared';

let io: SocketServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

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

    socket.on('queue:subscribe', () => {
      socket.join('queue');
    });

    socket.on('queue:unsubscribe', () => {
      socket.leave('queue');
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client getrennt: ${socket.id}`);
    });
  });

  return io;
}

export function getIo(): typeof io {
  if (!io) throw new Error('Socket.io nicht initialisiert. initSocket() zuerst aufrufen.');
  return io;
}
