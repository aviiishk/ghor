'use client';

import Image from 'next/image';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { useConversations } from '@/features/chat/hooks';
import { useProfile } from '@/features/auth/hooks';
import type { Conversation } from '@/features/chat/api';
import { Avatar, EmptyState, Skeleton, formatRent } from '@/components/ui';

function relativeTime(iso: string | null | undefined): string {
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

// Conversation list, redesign 2026-09-26: every row shows WHICH listing the chat is about
// (photo + title + rent), who it's with, the latest message, and an unread badge.
export default function ChatsPage() {
  const { data: conversations, isLoading, isError, refetch } = useConversations();
  const { data: profile } = useProfile();
  const unread = conversations?.reduce((n, c) => n + (c.unreadCount ?? 0), 0) ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">Chats</h1>
          <p className="mt-1 text-muted">{unread ? `${unread} unread message${unread === 1 ? '' : 's'}` : 'Your conversations with owners and renters'}</p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-3xl bg-white ring-1 ring-navy/[0.06]">
        {isLoading ? (
          <ul aria-busy="true">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="flex items-center gap-4 border-b border-hairline-soft p-4 last:border-0">
                <Skeleton className="h-14 w-14 rounded-2xl" />
                <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3.5 w-2/3" /></div>
              </li>
            ))}
          </ul>
        ) : isError ? (
          <EmptyState icon={MessageCircle} title="Couldn’t load your chats" body="Check your connection and try again." action={{ label: 'Try again', onClick: () => refetch() }} />
        ) : conversations && conversations.length > 0 ? (
          <ul>
            {conversations.map((c) => (
              <ConversationRow key={c.id} conversation={c} myId={profile?.id} />
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={MessageCircle}
            title="Your conversations will appear here"
            body="Find a place you like and tap “Chat with Owner”. Owners are notified straight away."
            action={{ label: 'Browse homes', href: '/browse' }}
          />
        )}
      </div>
    </div>
  );
}

function ConversationRow({ conversation, myId }: { conversation: Conversation; myId?: string }) {
  const isSeeker = conversation.seekerId === myId;
  const other = isSeeker ? conversation.owner : conversation.seeker;
  const cover = conversation.listing.images?.[0]?.cloudinaryUrl;
  const unread = conversation.unreadCount ?? 0;
  const last = conversation.lastMessage;
  const lastIsMine = last?.senderId === myId;

  return (
    <li className="border-b border-hairline-soft last:border-0">
      <Link href={`/chat/${conversation.id}`} className="flex items-center gap-4 p-4 transition-colors hover:bg-cream">
        <span className="relative shrink-0">
          <span className="relative block h-14 w-14 overflow-hidden rounded-2xl bg-surface-sunken">
            {cover && <Image src={cover} alt="" fill sizes="56px" className="object-cover" />}
          </span>
          <span className="absolute -bottom-1.5 -right-1.5 rounded-full ring-2 ring-white">
            <Avatar name={other.fullName} size="sm" />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className={`truncate text-ink ${unread ? 'font-bold' : 'font-semibold'}`}>{other.fullName ?? (isSeeker ? 'Owner' : 'Renter')}</span>
            <span className={`shrink-0 text-xs ${unread ? 'font-bold text-primary' : 'text-muted-soft'}`}>{relativeTime(last?.createdAt ?? conversation.lastMessageAt ?? conversation.createdAt)}</span>
          </span>
          <span className="block truncate text-xs text-muted">
            {conversation.listing.title} · {formatRent(conversation.listing.rent)}/mo
          </span>
          <span className="mt-0.5 flex items-center justify-between gap-3">
            <span className={`truncate text-sm ${unread ? 'font-semibold text-ink' : 'text-muted'}`}>
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
