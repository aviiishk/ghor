// Client-side funnel events → apps/api's POST /events (root CLAUDE.md §14.13). Only the
// actions the server can't observe itself go through here; signup, listing_view,
// chat_started and listing_created are recorded server-side (apps/api/src/events/).
// Rewritten 2026-09-25 from a leftover Supabase-direct insert that, post-pivot, never
// actually recorded anything.
import { apiRequest } from './apiClient';

type ClientEvent =
  | { eventName: 'contact_tap'; listingId: string; channel: 'chat' | 'call' }
  | { eventName: 'listing_shared'; listingId: string };

// Fire-and-forget: never blocks the UI, never throws into the caller.
export function trackEvent(event: ClientEvent): void {
  apiRequest('/events', { method: 'POST', auth: true, body: JSON.stringify(event) }).catch(
    () => {},
  );
}
