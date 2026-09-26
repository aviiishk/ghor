// Calls apps/api's auth module — same backend apps/mobile's features/auth/api.ts talks
// to, but sendPhoneOtp/verifyPhoneOtp/signOut go through this app's own /api/auth/* route
// handlers (not /api/gateway) because they're the ones that create/destroy the httpOnly
// session cookies. getProfile/completeOnboarding are ordinary authenticated calls, so
// they go through the generic apiRequest()/gateway path like everything else.
import { apiRequest } from '@/lib/apiClient';

export type Profile = {
  id: string;
  fullName: string | null;
  phone: string | null;
  googleId: string | null;
  role: 'seeker' | 'owner' | 'admin';
  banned: boolean;
  createdAt: string;
  phoneVerified: boolean;
  lastActiveAt: string | null;
  idVerificationStatus: 'none' | 'pending' | 'verified' | 'rejected';
};

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (Array.isArray(body?.message)) return body.message.join(', ');
    if (typeof body?.message === 'string') return body.message;
  } catch {
    // not JSON — fall through
  }
  return `Request failed with status ${res.status}`;
}

export async function sendPhoneOtp(phone: string): Promise<void> {
  const res = await fetch('/api/auth/otp/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
}

export async function verifyPhoneOtp(phone: string, code: string): Promise<void> {
  const res = await fetch('/api/auth/otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
}

export async function getProfile(): Promise<Profile> {
  return apiRequest<Profile>('/auth/me');
}

export async function completeOnboarding(values: {
  fullName: string;
  role: 'seeker' | 'owner';
}): Promise<Profile> {
  // Not the generic /api/gateway path — this is a session-mutating route (apps/api may
  // reissue tokens when the role changes, see app/api/auth/onboarding/route.ts) that
  // needs to update the httpOnly cookies, same reasoning as otp/verify below.
  const res = await fetch('/api/auth/onboarding', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res));
  const { profile } = (await res.json()) as { profile: Profile };
  return profile;
}

export async function updateProfile(values: { fullName: string }): Promise<Profile> {
  return apiRequest<Profile>('/auth/me', { method: 'PATCH', body: JSON.stringify(values) });
}

// Permanent (root CLAUDE.md §15.4). The account's refresh tokens are cascade-deleted
// server-side, so the follow-up signOut() is only for clearing this browser's cookies —
// its apps/api /auth/logout call will fail harmlessly against a user that no longer exists.
export async function deleteAccount(): Promise<void> {
  await apiRequest('/auth/me', { method: 'DELETE' });
  await signOut();
}

export async function signOut(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {
    // best-effort — the route handler clears cookies regardless of the apps/api call outcome
  });
}
