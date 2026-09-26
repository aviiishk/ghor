// Singleton Socket.io connection to apps/api's ChatGateway — root CLAUDE.md §14.5: one
// connection, joined to a room per active conversation, not a subscription per screen.
// Known gap: the access token is attached once at connect time and never refreshed:
// apps/api's access tokens expire after 15 minutes (see apps/api/.env's
// JWT_ACCESS_EXPIRES_IN), so a chat screen left open past that window will silently stop
// receiving real-time pushes until the app is backgrounded/foregrounded (which
// reconnects with a fresh token via connectSocket()). Reconnecting mid-session on a 401
// isn't built yet — see apps/mobile/STATUS.md.
import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '@/lib/apiClient';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

let socket: Socket | null = null;

export async function connectSocket(): Promise<Socket> {
  if (socket?.connected) return socket;
  if (!API_URL) throw new Error('EXPO_PUBLIC_API_URL is not set');
  const token = await getAccessToken();
  if (!token) throw new Error('No session — cannot connect chat socket');

  socket?.disconnect();
  const next = io(API_URL, {
    // websocket-only: avoids the XHR-polling fallback transport, which needs extra
    // polyfills to work reliably in React Native.
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
