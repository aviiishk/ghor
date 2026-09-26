// Issues a short-lived, single-purpose access token to the browser for the Socket.io
// handshake only. This is a deliberate, narrow exception to "never expose a token to
// browser JS" (see lib/apiClient.ts's comment): a raw WebSocket connection from the
// browser to apps/api can't carry an httpOnly cookie set on this app's origin, and
// proxying a stateful bidirectional Socket.io connection through a second Next.js hop
// isn't worth the complexity here. The token returned is the same short-lived (15m)
// access token the gateway proxy already attaches server-side to every REST call — nothing
// new is being trusted to the client that it doesn't already implicitly rely on.
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { refreshTokens } from '@/lib/session';

const API_URL = process.env.API_URL;
const ACCESS_COOKIE = 'ghor_at';
const REFRESH_COOKIE = 'ghor_rt';

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  };
}


export async function GET() {
  if (!API_URL) {
    return NextResponse.json({ message: 'API_URL is not configured' }, { status: 500 });
  }

  const cookieStore = await cookies();
  let accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  let refreshed: { accessToken: string; refreshToken: string } | null = null;

  if (!accessToken) {
    const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
    if (!refreshToken) {
      return NextResponse.json({ message: 'No session' }, { status: 401 });
    }
    refreshed = await refreshTokens(refreshToken);
    if (!refreshed) {
      return NextResponse.json({ message: 'Session expired' }, { status: 401 });
    }
    accessToken = refreshed.accessToken;
  }

  const response = NextResponse.json({ token: accessToken });
  if (refreshed) {
    response.cookies.set(ACCESS_COOKIE, refreshed.accessToken, cookieOptions(60 * 15));
    response.cookies.set(REFRESH_COOKIE, refreshed.refreshToken, cookieOptions(60 * 60 * 24 * 30));
  }
  return response;
}
