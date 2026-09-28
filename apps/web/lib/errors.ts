import { ApiError, SessionExpiredError } from '@/lib/apiClient';

// Turns any thrown error into something a renter or owner can act on. API validation
// messages written for developers ("rent must be a positive number") are replaced by the
// caller's context-specific fallback; readable API messages pass through unchanged.
export function friendlyError(e: unknown, fallback: string): string {
  if (e instanceof SessionExpiredError) return 'Your session has ended. Sign in again to continue.';
  if (e instanceof TypeError && /fetch|network|load failed/i.test(e.message)) {
    return 'Can’t reach GHOR right now. Check your internet connection and try again.';
  }
  if (e instanceof ApiError) {
    if (e.status >= 500) return 'GHOR is having trouble right now. Please try again in a minute.';
    if (e.status === 429) return 'That was a lot of requests in a short time. Wait a moment and try again.';
    if (e.status === 403) return 'You don’t have permission to do that.';
    if (e.status === 404) return 'This no longer exists — it may have been removed.';
    const looksTechnical = /must be|must not|should not|property |is not allowed|constraint|prisma|uuid/i.test(e.message);
    return looksTechnical || !e.message ? fallback : e.message;
  }
  return e instanceof Error && e.message && !/^Request failed/.test(e.message) ? e.message : fallback;
}
