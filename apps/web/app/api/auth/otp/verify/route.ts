// The one place a session gets created: exchanges an OTP for a token pair from apps/api,
// then sets both as httpOnly cookies and returns success only (never the raw tokens) to
// the browser. Mirrors apps/mobile's verifyPhoneOtp() saving tokens via saveTokens(), just
// server-side instead of expo-secure-store.
import { NextResponse, type NextRequest } from 'next/server';

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

export async function POST(request: NextRequest) {
  if (!API_URL) {
    return NextResponse.json({ message: 'API_URL is not configured' }, { status: 500 });
  }
  const body = await request.text();
  const res = await fetch(`${API_URL}/auth/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const tokens = (await res.json()) as { accessToken: string; refreshToken: string };
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, cookieOptions(60 * 15));
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(60 * 60 * 24 * 30));
  return response;
}
