'use client';

import { useRouter } from 'next/navigation';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/features/notifications/hooks';
import type { Notification } from '@/features/notifications/api';

const LABEL: Record<Notification['type'], string> = {
  new_message: 'New message',
  listing_approved: 'Listing approved',
  listing_rejected: 'Listing rejected',
  new_review: 'New review',
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Root CLAUDE.md explicitly calls this out as mattering more on web than mobile — no web
// push exists, so this in-app center is the only place a signed-in web user finds out
// about a new message or a moderation decision without already being in the relevant
// chat/listing.
export default function NotificationsPage() {
  const router = useRouter();
  const { data: notifications, isLoading, isError } = useNotifications();
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

  const hasUnread = notifications?.some((n) => !n.readAt);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink">Notifications</h1>
        {hasUnread && (
          <button
            onClick={() => markAllRead.mutate()}
            className="text-primary text-sm font-semibold"
          >
            Mark all read
          </button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted text-center py-20">Loading…</p>
      ) : isError ? (
        <p className="text-muted text-center py-20">Couldn&apos;t load notifications.</p>
      ) : notifications && notifications.length > 0 ? (
        <div className="flex flex-col">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className="flex items-start gap-3 py-3.5 border-b border-hairline text-left"
            >
              <span
                className={`w-2 h-2 rounded-full mt-2 shrink-0 ${n.readAt ? 'bg-transparent' : 'bg-primary'}`}
              />
              <span className="flex-1">
                <span className={`block text-ink ${n.readAt ? 'font-medium' : 'font-bold'}`}>
                  {LABEL[n.type] ?? n.type}
                </span>
                <span className="block text-muted-soft text-xs mt-0.5">{timeAgo(n.createdAt)}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-muted text-center py-20">You&apos;re all caught up.</p>
      )}
    </div>
  );
}
