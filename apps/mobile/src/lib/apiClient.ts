// Single HTTP client for calling apps/api — root CLAUDE.md §14.2 ("never call apps/api
// outside a feature's api.ts") and §3 (this app is one of three consumers of the same
// backend). Tokens are stored via expo-secure-store, same mechanism the old Supabase
// client used, just for our own JWT pair instead of a Supabase session.
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

const ACCESS_TOKEN_KEY = 'ghor_access_token';
const REFRESH_TOKEN_KEY = 'ghor_refresh_token';

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}

export async function hasSession(): Promise<boolean> {
  return (await getAccessToken()) !== null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Thrown when a request needs auth and there's no valid session left (no token, or a
// refresh attempt failed) — app/_layout.tsx's auth gate catches this to redirect to
// sign-in, distinctly from an ordinary ApiError a screen might want to show inline.
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired');
    this.name = 'SessionExpiredError';
  }
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (Array.isArray(body?.message)) return body.message.join(', ');
    if (typeof body?.message === 'string') return body.message;
  } catch {
    // response body wasn't JSON — fall through to the generic message below
  }
  return `Request failed with status ${res.status}`;
}

function rawRequest(path: string, options: RequestInit = {}): Promise<Response> {
  if (!API_URL) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not set — see .env.development/.env.production',
    );
  }
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
}

// Coalesces concurrent refresh attempts into one in-flight request, so two requests
// hitting 401 at the same moment don't each try to rotate the refresh token (the second
// one would fail — refresh tokens are single-use, see apps/api/src/auth/auth.service.ts).
let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  const res = await rawRequest('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    await clearTokens();
    return null;
  }
  const data = (await res.json()) as { accessToken: string; refreshToken: string };
  await saveTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

/**
 * Call an apps/api endpoint. Pass `auth: true` for guarded routes — the access token is
 * attached automatically, and a single 401 triggers one refresh-and-retry before giving
 * up (throwing SessionExpiredError).
 */
export async function apiRequest<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const { auth, ...rest } = options;
  const headers: Record<string, string> = { ...(rest.headers as Record<string, string>) };

  if (auth) {
    const token = await getAccessToken();
    if (!token) throw new SessionExpiredError();
    headers.Authorization = `Bearer ${token}`;
  }

  let res = await rawRequest(path, { ...rest, headers });

  if (res.status === 401 && auth) {
    if (!refreshInFlight) {
      refreshInFlight = refreshAccessToken().finally(() => {
        refreshInFlight = null;
      });
    }
    const newToken = await refreshInFlight;
    if (!newToken) throw new SessionExpiredError();
    res = await rawRequest(path, {
      ...rest,
      headers: { ...headers, Authorization: `Bearer ${newToken}` },
    });
  }

  if (!res.ok) {
    throw new ApiError(res.status, await parseErrorMessage(res));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
