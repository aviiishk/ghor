// The BFF proxy: every authenticated apps/api call from client code (features/*/api.ts)
// goes through here, never straight to apps/api from the browser. Reads the httpOnly
// session cookies server-side, attaches the Bearer token, and — since httpOnly cookies
// can't be read or refreshed from browser JS — performs the same single
// refresh-and-retry on a 401 that apps/mobile's lib/apiClient.ts does client-side. This
// keeps both access and refresh tokens fully server-side, matching root CLAUDE.md §3's
// "httpOnly cookie, not localStorage" decision.
import { NextResponse, type NextRequest } from 'next/server';
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


async function proxy(request: NextRequest, params: { path: string[] }) {
  if (!API_URL) {
    return NextResponse.json({ message: 'API_URL is not configured' }, { status: 500 });
  }

  const path = `/${params.path.join('/')}`;
  const search = request.nextUrl.search;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const body =
    request.method === 'GET' || request.method === 'DELETE' ? undefined : await request.text();

  async function forward(token?: string) {
    return fetch(`${API_URL}${path}${search}`, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    });
  }

  let res = await forward(accessToken);
  let refreshed: { accessToken: string; refreshToken: string } | null = null;

  if (res.status === 401) {
    const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
    if (refreshToken) {
      refreshed = await refreshTokens(refreshToken);
      if (refreshed) res = await forward(refreshed.accessToken);
    }
  }

  const responseBody = res.status === 204 ? null : await res.text();
  const response = new NextResponse(responseBody, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });

  if (refreshed) {
    response.cookies.set(ACCESS_COOKIE, refreshed.accessToken, cookieOptions(60 * 15));
    response.cookies.set(REFRESH_COOKIE, refreshed.refreshToken, cookieOptions(60 * 60 * 24 * 30));
  } else if (res.status === 401) {
    // No refresh token, or refresh itself failed — stop treating this as a live session.
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
  }

  return response;
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return proxy(request, await context.params);
}
export async function POST(request: NextRequest, context: RouteContext) {
  return proxy(request, await context.params);
}
export async function PATCH(request: NextRequest, context: RouteContext) {
  return proxy(request, await context.params);
}
export async function DELETE(request: NextRequest, context: RouteContext) {
  return proxy(request, await context.params);
}
