// Client-side HTTP helper for calling apps/api — but never directly. Every request goes
// through this app's own /api/gateway/* route handler (see app/api/gateway/[...path]/route.ts),
// which reads the httpOnly session cookies server-side and attaches/refreshes the Bearer
// token. Browser JS never sees an access or refresh token, per root CLAUDE.md §3's
// "httpOnly cookie, not localStorage" decision — this file has no token storage of any
// kind, unlike apps/mobile's lib/apiClient.ts (expo-secure-store).
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Thrown when the gateway reports the session is gone (no cookie, or refresh failed).
// Callers that need a redirect-to-sign-in reaction should catch this specifically.
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

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/gateway${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  if (res.status === 401) throw new SessionExpiredError();
  if (!res.ok) throw new ApiError(res.status, await parseErrorMessage(res));
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
