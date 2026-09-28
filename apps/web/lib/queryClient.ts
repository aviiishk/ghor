import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError, SessionExpiredError } from '@/lib/apiClient';

// A dead session (refresh token revoked/expired but the cookie still present) used to
// leave every screen showing "couldn't load" errors, because middleware.ts only checks
// the cookie exists. Now the first SessionExpiredError clears the cookies and sends the
// user to sign in, returning them to the same page afterwards.
let redirecting = false;
function onSessionExpired(error: unknown) {
  if (!(error instanceof SessionExpiredError) || redirecting || typeof window === 'undefined') return;
  redirecting = true;
  const next = window.location.pathname + window.location.search;
  fetch('/api/auth/logout', { method: 'POST' })
    .catch(() => undefined)
    .finally(() => window.location.replace(`/sign-in?next=${encodeURIComponent(next)}`));
}

const retryable = (error: unknown) =>
  !(error instanceof SessionExpiredError) && !(error instanceof ApiError && error.status < 500);

// Same defaults as apps/mobile/src/lib/queryClient.ts — keep the two in sync.
export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onSessionExpired }),
  mutationCache: new MutationCache({ onError: onSessionExpired }),
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      // Only retry what can succeed on a second try: never an expired session or a 4xx
      // (validation, not found, forbidden) — those just repeat the same failure.
      retry: (count, error) => retryable(error) && count < 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: (count, error) => retryable(error) && count < 1,
    },
  },
});
