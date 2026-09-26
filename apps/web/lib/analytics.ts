// Client-side funnel events → apps/api's POST /events via the gateway (root CLAUDE.md
// §14.13). Mirrors apps/mobile/src/lib/analytics.ts — only actions the server can't see
// itself; everything else is recorded server-side (apps/api/src/events/).
import { apiRequest } from './apiClient';

type ClientEvent =
  | { eventName: 'contact_tap'; listingId: string; channel: 'chat' | 'call' }
  | { eventName: 'listing_shared'; listingId: string };

// Fire-and-forget: never blocks the UI, never throws into the caller.
export function trackEvent(event: ClientEvent): void {
  apiRequest('/events', { method: 'POST', body: JSON.stringify(event) }).catch(() => {});
}
