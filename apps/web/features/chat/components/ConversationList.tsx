'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import type { Conversation } from '../api';
import { Avatar, EmptyState, Skeleton, cx, formatRent } from '@/components/ui';

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

// The conversation list, shared by /chats and the desktop sidebar of /chat/[id]
// (redesign v2). Every row answers: who, about which home, what was said last, unread?
export function ConversationList({
  conversations,
  isLoading,
  isError,
  onRetry,
  myId,
  activeId,
}: {
  conversations: Conversation[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  myId?: string;
  activeId?: string;
}) {
  if (isLoading) {
    return (
      <ul aria-busy="true">
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} className="flex items-center gap-4 px-4 py-4">
            <Skeleton className="h-14 w-14 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          </li>
        ))}
      </ul>
    );
  }
  if (isError) {
    return <EmptyState compact icon={MessageCircle} title="Couldn’t load your chats" body="Check your connection and try again." action={{ label: 'Try again', onClick: onRetry }} />;
  }
  if (!conversations?.length) {
    return (
      <EmptyState
        compact
        icon={MessageCircle}
        title="No conversations yet"
        body="Find a place you like and tap “Chat with owner”. Owners are notified straight away."
        action={{ label: 'Browse homes', href: '/browse' }}
      />
    );
  }
  return (
    <ul className="divide-y divide-navy/[0.06]">
      {conversations.map((c) => (
        <ConversationRow key={c.id} conversation={c} myId={myId} active={c.id === activeId} />
      ))}
    </ul>
  );
}

function ConversationRow({ conversation, myId, active }: { conversation: Conversation; myId?: string; active: boolean }) {
  const isSeeker = conversation.seekerId === myId;
  const other = isSeeker ? conversation.owner : conversation.seeker;
  const cover = conversation.listing.images?.[0]?.cloudinaryUrl;
  const unread = active ? 0 : conversation.unreadCount ?? 0;
  const last = conversation.lastMessage;
  const lastIsMine = last?.senderId === myId;

  return (
    <li>
      <Link
        href={`/chat/${conversation.id}`}
        aria-current={active ? 'page' : undefined}
        className={cx('relative flex items-center gap-4 px-4 py-4 transition-colors', active ? 'bg-primary-light/70' : 'hover:bg-cream')}
      >
        {active && <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-primary" aria-hidden />}
        <span className="relative shrink-0">
          <Avatar name={other.fullName} size="lg" />
          <span className="absolute -bottom-1 -right-1 block h-7 w-7 overflow-hidden rounded-lg bg-cream-deep ring-2 ring-white">
            {cover && <Image src={cover} alt="" fill sizes="28px" className="object-cover" />}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className={cx('truncate text-[15px] text-ink', unread ? 'font-bold' : 'font-semibold')}>
              {other.fullName ?? (isSeeker ? 'Owner' : 'Renter')}
            </span>
            <span className={cx('shrink-0 text-xs', unread ? 'font-bold text-primary' : 'text-muted')}>
              {relativeTime(last?.createdAt ?? conversation.lastMessageAt ?? conversation.createdAt)}
            </span>
          </span>
          <span className="block truncate text-xs font-medium text-muted">
            {conversation.listing.title} · {formatRent(conversation.listing.rent)}/mo
          </span>
          <span className="mt-1 flex items-center justify-between gap-3">
            <span className={cx('truncate text-sm', unread ? 'font-semibold text-ink' : 'text-muted')}>
              {last ? `${lastIsMine ? 'You: ' : ''}${last.body}` : 'No messages yet — say hello'}
            </span>
            {unread > 0 && (
              <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}
