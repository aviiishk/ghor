// Singleton Socket.io connection to apps/api's ChatGateway — same shape as
// apps/mobile's src/features/chat/socket.ts, adapted for the cookie-based web session:
// the token is fetched from /api/chat/socket-token (server-side, reads the httpOnly
// cookie) right before connecting, rather than read from local storage.
// Known gap, same as mobile: the token isn't refreshed for the lifetime of an open
// socket, so a chat screen left open past the 15-minute access-token window will
// silently stop receiving real-time pushes until reconnectSocket() runs again.
import { io, type Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

let socket: Socket | null = null;

async function fetchSocketToken(): Promise<string> {
  const res = await fetch('/api/chat/socket-token', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('No session — cannot connect chat socket');
  const { token } = (await res.json()) as { token: string };
  return token;
}

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;
  if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL is not set');

  const token = await fetchSocketToken();
  socket?.disconnect();
  const next = io(API_URL, {
    transports: ['websocket'],
    auth: { token },
  });
  socket = next;

  return new Promise((resolve, reject) => {
    function cleanup() {
      next.off('connect', onConnect);
      next.off('connect_error', onError);
    }
    function onConnect() {
      cleanup();
      resolve(next);
    }
    function onError(err: Error) {
      cleanup();
      reject(err);
    }
    next.on('connect', onConnect);
    next.on('connect_error', onError);
  });
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
