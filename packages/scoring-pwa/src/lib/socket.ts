import { io, type Socket } from 'socket.io-client';

let cached: Socket | null = null;

export function getSocket(): Socket {
  if (cached) return cached;
  const url = import.meta.env.VITE_ENGINE_URL ?? 'http://localhost:8080';
  cached = io(url, {
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
    transports: ['websocket', 'polling'],
  });
  return cached;
}
