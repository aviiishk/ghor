// Thin passthrough — no session cookie involved (you don't have one yet), so this
// doesn't need the /api/gateway proxy's cookie/refresh logic, just a server-side hop so
// the browser never needs apps/api's URL directly.
import { NextResponse, type NextRequest } from 'next/server';

const API_URL = process.env.API_URL;

export async function POST(request: NextRequest) {
  if (!API_URL) {
    return NextResponse.json({ message: 'API_URL is not configured' }, { status: 500 });
  }
  const body = await request.text();
  const res = await fetch(`${API_URL}/auth/otp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  const text = res.status === 204 ? null : await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
