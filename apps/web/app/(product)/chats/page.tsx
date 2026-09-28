'use client';

import { MessageCircle } from 'lucide-react';
import { useConversations } from '@/features/chat/hooks';
import { useProfile } from '@/features/auth/hooks';
import { ConversationList } from '@/features/chat/components/ConversationList';
import { PageHeader } from '@/components/ui';

// Chats, redesign v2 (2026-09-27). Phones: a full-width list. Desktop: the same two-pane
// frame as a thread, with nothing selected yet.
export default function ChatsPage() {
  const { data: conversations, isLoading, isError, refetch } = useConversations();
  const { data: profile } = useProfile();
  const unread = conversations?.reduce((n, c) => n + (c.unreadCount ?? 0), 0) ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 sm:pt-12 lg:px-8">
      <PageHeader
        title="Chats"
        meta={unread ? `${unread} unread message${unread === 1 ? '' : 's'}` : 'Your conversations with owners and renters'}
      />
      <div className="mt-8 grid grid-cols-1 overflow-hidden rounded-2xl bg-white ring-1 ring-inset ring-navy/[0.08] lg:h-[calc(100dvh-15rem)] lg:min-h-[520px] lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="overflow-y-auto lg:border-r lg:border-navy/[0.08]">
          <ConversationList conversations={conversations} isLoading={isLoading} isError={isError} onRetry={() => refetch()} myId={profile?.id} />
        </div>
        <div className="hidden flex-col items-center justify-center bg-cream px-10 text-center lg:flex">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-primary shadow-lift">
            <MessageCircle size={28} aria-hidden />
          </span>
          <p className="mt-5 font-display text-xl font-bold text-navy">Pick a conversation</p>
          <p className="mt-1.5 max-w-sm text-muted">Every chat stays attached to the home it’s about, so you always know which place you’re discussing.</p>
        </div>
      </div>
    </div>
  );
}
