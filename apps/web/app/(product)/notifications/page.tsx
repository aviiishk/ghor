'use client';

import { useRouter } from 'next/navigation';
import { Bell, BellOff, ChevronRight, MessageCircle, ShieldCheck, Star, XCircle } from 'lucide-react';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/features/notifications/hooks';
import type { Notification } from '@/features/notifications/api';
import { EmptyState, IconTile, Skeleton } from '@/components/ui';

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// Each type gets its own icon, tone and human sentence (redesign 2026-09-26). Copy only
// states what the payload actually tells us — no sender names or listing titles, because
// the notification payload doesn't carry them.
const KINDS: Record<
  Notification['type'],
  { icon: typeof Bell; tone: 'primary' | 'success' | 'danger' | 'cream'; title: string; body: (n: Notification) => string; cta: string }
> = {
  new_message: { icon: MessageCircle, tone: 'primary', title: 'New message', body: () => 'You have a new message in one of your chats.', cta: 'Open chat' },
  listing_approved: { icon: ShieldCheck, tone: 'success', title: 'Your listing is live', body: () => 'It passed review. Renters can now find it and message you.', cta: 'View listing' },
  listing_rejected: { icon: XCircle, tone: 'danger', title: 'Your listing needs changes', body: () => 'It wasn’t approved this time. Edit the details and resubmit it for review.', cta: 'Fix listing' },
  new_review: {
    icon: Star,
    tone: 'cream',
    title: 'New review',
    body: (n) => {
      const rating = (n.payload as { rating?: number } | null)?.rating;
      return rating ? `Someone rated your listing ${rating} out of 5.` : 'Someone reviewed your listing.';
    },
    cta: 'See review',
  },
};

// Root CLAUDE.md: this matters more on web than mobile — there's no web push, so this
// center is how a signed-in web user finds out about messages and moderation decisions.
export default function NotificationsPage() {
  const router = useRouter();
  const { data: notifications, isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  function handleClick(n: Notification) {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.type === 'new_message' && n.payload?.conversationId) {
      router.push(`/chat/${n.payload.conversationId}`);
    } else if (n.payload?.listingId) {
      router.push(`/listing/${n.payload.listingId}`);
    }
  }

  const unread = notifications?.filter((n) => !n.readAt).length ?? 0;
  const startOfToday = new Date(new Date().toDateString()).getTime();
  const groups = [
    { label: 'Today', items: notifications?.filter((n) => new Date(n.createdAt).getTime() >= startOfToday) ?? [] },
    { label: 'Earlier', items: notifications?.filter((n) => new Date(n.createdAt).getTime() < startOfToday) ?? [] },
  ].filter((g) => g.items.length);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">Notifications</h1>
          <p className="mt-1 text-muted">{unread ? `${unread} unread` : 'Messages, reviews and listing updates'}</p>
        </div>
        {unread > 0 && (
          <button onClick={() => markAllRead.mutate()} className="press h-10 rounded-full px-4 text-sm font-semibold text-primary ring-1 ring-primary/30 hover:bg-primary-light">
            Mark all as read
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="mt-6 space-y-3" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-20 rounded-3xl" />)}
        </div>
      ) : isError ? (
        <EmptyState icon={BellOff} title="Couldn’t load notifications" body="Check your connection and try again." action={{ label: 'Try again', onClick: () => refetch() }} />
      ) : !groups.length ? (
        <EmptyState icon={Bell} title="You’re all caught up" body="New messages, reviews and updates about your listings will show up here." />
      ) : (
        groups.map((g) => (
          <section key={g.label} className="mt-8">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-muted">{g.label}</h2>
            <ul className="space-y-2">
              {g.items.map((n) => {
                const k = KINDS[n.type] ?? KINDS.new_message;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => handleClick(n)}
                      className={`press group flex w-full items-start gap-4 rounded-3xl p-4 text-left ring-1 transition ${
                        n.readAt ? 'bg-white ring-navy/[0.06]' : 'bg-primary-light/60 ring-primary/20'
                      }`}
                    >
                      <IconTile icon={k.icon} tone={k.tone} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className={`text-ink ${n.readAt ? 'font-semibold' : 'font-bold'}`}>{k.title}</span>
                          <span className="shrink-0 text-xs text-muted">{timeAgo(n.createdAt)}</span>
                        </span>
                        <span className="mt-0.5 block text-sm text-body">{k.body(n)}</span>
                        <span className="mt-2 inline-flex items-center gap-0.5 text-sm font-bold text-primary">
                          {k.cta} <ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </span>
                      </span>
                      {!n.readAt && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
