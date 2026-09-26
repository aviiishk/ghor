// A session-mutating auth route, not a plain gateway pass-through: apps/api reissues a
// fresh token pair when onboarding actually changes the role (see
// apps/api/src/auth/auth.service.ts's completeOnboarding — the pre-onboarding access
// token's JWT `role` claim would otherwise stay stale until it expires). This needs to
// update the httpOnly cookies the same way otp/verify does, which the generic
// /api/gateway proxy has no reason to know how to do for an arbitrary response body.
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


export async function PATCH(request: NextRequest) {
  if (!API_URL) {
    return NextResponse.json({ message: 'API_URL is not configured' }, { status: 500 });
  }

  const cookieStore = await cookies();
  let accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const body = await request.text();

  async function forward(token?: string) {
    return fetch(`${API_URL}/auth/onboarding`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    });
  }

  let res = await forward(accessToken);
  let refreshedFromExpiry: { accessToken: string; refreshToken: string } | null = null;

  if (res.status === 401) {
    const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
    if (refreshToken) {
      refreshedFromExpiry = await refreshTokens(refreshToken);
      if (refreshedFromExpiry) {
        accessToken = refreshedFromExpiry.accessToken;
        res = await forward(accessToken);
      }
    }
  }

  if (!res.ok) {
    const text = await res.text();
    const response = new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
    if (refreshedFromExpiry) {
      response.cookies.set(ACCESS_COOKIE, refreshedFromExpiry.accessToken, cookieOptions(60 * 15));
      response.cookies.set(
        REFRESH_COOKIE,
        refreshedFromExpiry.refreshToken,
        cookieOptions(60 * 60 * 24 * 30),
      );
    }
    return response;
  }

  const result = (await res.json()) as {
    profile: unknown;
    accessToken: string | null;
    refreshToken: string | null;
  };
  const response = NextResponse.json({ profile: result.profile });

  if (result.accessToken && result.refreshToken) {
    response.cookies.set(ACCESS_COOKIE, result.accessToken, cookieOptions(60 * 15));
    response.cookies.set(REFRESH_COOKIE, result.refreshToken, cookieOptions(60 * 60 * 24 * 30));
  } else if (refreshedFromExpiry) {
    response.cookies.set(ACCESS_COOKIE, refreshedFromExpiry.accessToken, cookieOptions(60 * 15));
    response.cookies.set(
      REFRESH_COOKIE,
      refreshedFromExpiry.refreshToken,
      cookieOptions(60 * 60 * 24 * 30),
    );
  }
  return response;
}
