// Calls apps/api's auth module (apps/api/src/auth/) — replaces the Supabase-direct calls
// this file used to make. See apps/mobile/STATUS.md for the rewrite history and
// apps/api/STATUS.md for what's been verified live on the backend side.
import { apiRequest, saveTokens, clearTokens, getRefreshToken } from '@/lib/apiClient';
import { unregisterPushToken } from '@/features/notifications/api';

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

type TokenPair = { accessToken: string; refreshToken: string };

// Takes a Google ID token (obtained client-side, e.g. via expo-auth-session) and
// exchanges it for a GHOR session — mirrors apps/api's POST /auth/google contract.
// Not called from the UI yet: sign-in.tsx's Google button has no client-side OAuth flow
// wired up (no Google Cloud client IDs configured yet) — see apps/mobile/STATUS.md.
export async function signInWithGoogle(idToken: string): Promise<TokenPair> {
  const tokens = await apiRequest<TokenPair>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
  await saveTokens(tokens.accessToken, tokens.refreshToken);
  return tokens;
}

export async function sendPhoneOtp(phone: string): Promise<void> {
  await apiRequest('/auth/otp/send', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function verifyPhoneOtp(phone: string, code: string): Promise<TokenPair> {
  const tokens = await apiRequest<TokenPair>('/auth/otp/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  });
  await saveTokens(tokens.accessToken, tokens.refreshToken);
  return tokens;
}

export async function getProfile(): Promise<Profile> {
  return apiRequest<Profile>('/auth/me', { auth: true });
}

export async function completeOnboarding(values: {
  fullName: string;
  role: 'seeker' | 'owner';
}): Promise<Profile> {
  // apps/api reissues a fresh token pair when onboarding actually changes the role
  // (accessToken/refreshToken are null otherwise) — the pre-onboarding access token's
  // JWT `role` claim would otherwise stay stale (default 'seeker') until it expires.
  const result = await apiRequest<{
    profile: Profile;
    accessToken: string | null;
    refreshToken: string | null;
  }>('/auth/onboarding', {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(values),
  });
  if (result.accessToken && result.refreshToken) {
    await saveTokens(result.accessToken, result.refreshToken);
  }
  return result.profile;
}

export async function updateProfile(values: { fullName: string }): Promise<Profile> {
  return apiRequest<Profile>('/auth/me', {
    method: 'PATCH',
    auth: true,
    body: JSON.stringify(values),
  });
}

// Permanent (root CLAUDE.md §15.4). Refresh tokens are cascade-deleted server-side, so
// there's nothing left to revoke — just clear the local session.
export async function deleteAccount(): Promise<void> {
  await apiRequest('/auth/me', { method: 'DELETE', auth: true });
  await clearTokens();
}

export async function signOut(): Promise<void> {
  // Before revoking the session — the DELETE needs a valid access token.
  await unregisterPushToken();
  const refreshToken = await getRefreshToken();
  if (refreshToken) {
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
        auth: true,
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Best-effort server-side revoke — clear the local session regardless of whether
      // this succeeded, so the user is never stuck unable to sign out.
    }
  }
  await clearTokens();
}
