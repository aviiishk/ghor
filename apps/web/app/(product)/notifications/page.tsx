'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellOff, CheckCheck, ChevronRight, MessageCircle, ShieldCheck, Star, XCircle } from 'lucide-react';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/features/notifications/hooks';
import type { Notification } from '@/features/notifications/api';
import { EmptyState, PageHeader, Skeleton, buttonClass, cx } from '@/components/ui';

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

// Each type gets its own icon, tone and human sentence. Copy only states what the payload
// actually tells us: sender names and listing titles are in payloads written since
// 2026-09-28; older rows fall back to the generic sentence.
type NamedPayload = { senderName?: string | null; listingTitle?: string | null } | null;
const named = (n: Notification) => (n.payload as NamedPayload) ?? {};

const KINDS: Record<
  Notification['type'],
  { icon: typeof Bell; tile: string; title: string; body: (n: Notification) => string; cta: string }
> = {
  new_message: {
    icon: MessageCircle,
    tile: 'text-primary',
    title: 'New message',
    body: (n) => {
      const { senderName, listingTitle } = named(n);
      if (senderName && listingTitle) return `${senderName} messaged you about “${listingTitle}”.`;
      if (listingTitle) return `New message about “${listingTitle}”.`;
      return 'You have a new message in one of your chats.';
    },
    cta: 'Open chat',
  },
  listing_approved: {
    icon: ShieldCheck,
    tile: 'text-success-deep',
    title: 'Your listing is live',
    body: (n) => {
      const { listingTitle } = named(n);
      return `${listingTitle ? `“${listingTitle}” passed review.` : 'It passed review.'} Renters can now find it and message you.`;
    },
    cta: 'View listing',
  },
  listing_rejected: {
    icon: XCircle,
    tile: 'text-destructive-pressed',
    title: 'Your listing needs changes',
    body: (n) => {
      const { listingTitle } = named(n);
      return `${listingTitle ? `“${listingTitle}” wasn’t approved this time.` : 'It wasn’t approved this time.'} Edit the details and resubmit it for review.`;
    },
    cta: 'Fix listing',
  },
  new_review: {
    icon: Star,
    tile: 'text-navy',
    title: 'New review',
    body: (n) => {
      const rating = (n.payload as { rating?: number } | null)?.rating;
      return rating ? `Someone rated your listing ${rating} out of 5.` : 'Someone reviewed your listing.';
    },
    cta: 'See review',
  },
};

// Root CLAUDE.md: this matters more on web than mobile — there's no web push, so this
// centre is how a signed-in web user finds out about messages and moderation decisions.
export default function NotificationsPage() {
  const router = useRouter();
  const { data: notifications, isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const [onlyUnread, setOnlyUnread] = useState(false);

  function handleClick(n: Notification) {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.type === 'new_message' && n.payload?.conversationId) {
      router.push(`/chat/${n.payload.conversationId}`);
    } else if (n.type === 'listing_rejected' && n.payload?.listingId) {
      // "Fix listing" goes straight to the editor, which saves and resubmits in one step.
      router.push(`/listing/${n.payload.listingId}/edit`);
    } else if (n.payload?.listingId) {
      router.push(`/listing/${n.payload.listingId}`);
    }
  }

  const unread = notifications?.filter((n) => !n.readAt).length ?? 0;
  const visible = (notifications ?? []).filter((n) => !onlyUnread || !n.readAt);
  const startOfToday = new Date(new Date().toDateString()).getTime();
  const startOfWeek = startOfToday - 6 * 86_400_000;
  const groups = [
    { label: 'Today', items: visible.filter((n) => new Date(n.createdAt).getTime() >= startOfToday) },
    { label: 'This week', items: visible.filter((n) => { const t = new Date(n.createdAt).getTime(); return t < startOfToday && t >= startOfWeek; }) },
    { label: 'Earlier', items: visible.filter((n) => new Date(n.createdAt).getTime() < startOfWeek) },
  ].filter((g) => g.items.length);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12">
      <PageHeader
        title="Notifications"
        meta={unread ? `${unread} unread` : 'Messages, reviews and updates about your listings'}
        actions={
          unread > 0 ? (
            <button onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending} className={buttonClass('secondary', 'sm')}>
              <CheckCheck size={16} aria-hidden /> Mark all as read
            </button>
          ) : undefined
        }
      />

      {!!notifications?.length && (
        <div role="tablist" aria-label="Show" className="mt-8 inline-flex rounded-full bg-white p-1 ring-1 ring-inset ring-navy/10">
          {([false, true] as const).map((v) => (
            <button
              key={String(v)}
              role="tab"
              aria-selected={onlyUnread === v}
              onClick={() => setOnlyUnread(v)}
              className={cx('h-9 rounded-full px-4 text-sm font-semibold transition-colors', onlyUnread === v ? 'bg-navy text-white' : 'text-body')}
            >
              {v ? `Unread${unread ? ` · ${unread}` : ''}` : 'All'}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="mt-8 space-y-3" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : isError ? (
        <EmptyState icon={BellOff} title="Couldn’t load notifications" body="Check your connection and try again." action={{ label: 'Try again', onClick: () => refetch() }} />
      ) : !groups.length ? (
        <EmptyState
          icon={Bell}
          title={onlyUnread ? 'No unread notifications' : 'You’re all caught up'}
          body="New messages, reviews and updates about your listings will show up here."
        />
      ) : (
        groups.map((g) => (
          <section key={g.label} className="mt-8">
            <h2 className="mb-3 font-display text-lg font-bold text-navy">{g.label}</h2>
            <ul className="divide-y divide-navy/[0.06] overflow-hidden rounded-2xl bg-white ring-1 ring-inset ring-navy/[0.08]">
              {g.items.map((n) => {
                const k = KINDS[n.type] ?? KINDS.new_message;
                const isUnread = !n.readAt;
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => handleClick(n)}
                      className="group relative flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-cream sm:p-5"
                    >
                      <span className={cx('inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cream', isUnread ? k.tile : 'text-muted')}>
                        <k.icon size={20} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className={cx('inline-flex items-center gap-2 text-[15px]', isUnread ? 'font-bold text-ink' : 'font-semibold text-body')}>
                            {isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />}
                            {k.title}
                            {isUnread && <span className="sr-only"> (unread)</span>}
                          </span>
                          <span className={cx('shrink-0 text-xs', isUnread ? 'font-bold text-primary' : 'text-muted')}>{timeAgo(n.createdAt)}</span>
                        </span>
                        <span className={cx('mt-0.5 block text-sm', isUnread ? 'text-body' : 'text-muted')}>{k.body(n)}</span>
                        <span className="mt-2 inline-flex items-center gap-0.5 text-sm font-bold text-primary">
                          {k.cta} <ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                        </span>
                      </span>
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
