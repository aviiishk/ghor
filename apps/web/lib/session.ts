// Server-only session helpers shared by the BFF route handlers (app/api/**).
//
// Refresh de-duplication (code review 2026-09-26): apps/api rotates refresh tokens and
// lets each one be redeemed exactly once. When a page fires several requests at the
// moment the access token expires, each would try to refresh with the same old token;
// one wins, the rest get 401 and — before this — deleted the session cookies, randomly
// logging the user out. Now concurrent (and near-concurrent) refreshes of the same token
// share one apps/api call and all set the same new pair.
//
// Scope: per server process. Multiple serverless instances could still race each other,
// which is much rarer (same user, same instant, different instance); revisit with a
// shared store if it shows up in practice.

type TokenPair = { accessToken: string; refreshToken: string };

const RESULT_TTL_MS = 30_000;
const inflight = new Map<string, Promise<TokenPair | null>>();

export async function refreshTokens(refreshToken: string): Promise<TokenPair | null> {
  const existing = inflight.get(refreshToken);
  if (existing) return existing;

  const attempt = (async () => {
    const res = await fetch(`${process.env.API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    return (await res.json()) as TokenPair;
  })().catch(() => null);

  inflight.set(refreshToken, attempt);
  // Keep the result briefly so requests that arrive just after the winner finished (and
  // still carry the old cookie) reuse it rather than presenting a revoked token.
  attempt.finally(() => {
    setTimeout(() => inflight.delete(refreshToken), RESULT_TTL_MS);
  });
  return attempt;
}
