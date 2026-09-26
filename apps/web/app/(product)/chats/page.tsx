'use client';

import Link from 'next/link';
import { useConversations } from '@/features/chat/hooks';
import { useProfile } from '@/features/auth/hooks';
import type { Conversation } from '@/features/chat/api';

export default function ChatsPage() {
  const { data: conversations, isLoading, isError } = useConversations();
  const { data: profile } = useProfile();

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-ink mb-6">Chats</h1>

      {isLoading ? (
        <p className="text-muted text-center py-20">Loading…</p>
      ) : isError ? (
        <p className="text-muted text-center py-20">Couldn&apos;t load your chats.</p>
      ) : conversations && conversations.length > 0 ? (
        <div className="flex flex-col">
          {conversations.map((c) => (
            <ConversationRow key={c.id} conversation={c} myId={profile?.id} />
          ))}
        </div>
      ) : (
        <p className="text-muted text-center py-20">
          No conversations yet.
          <br />
          Message an owner from a listing to start one.
        </p>
      )}
    </div>
  );
}

function ConversationRow({ conversation, myId }: { conversation: Conversation; myId?: string }) {
  const isSeeker = conversation.seekerId === myId;
  const other = isSeeker ? conversation.owner : conversation.seeker;

  return (
    <Link
      href={`/chat/${conversation.id}`}
      className="flex items-center gap-3 py-3 border-b border-hairline hover:bg-white transition-colors"
    >
      <div className="w-12 h-12 rounded-full bg-primary-light flex items-center justify-center shrink-0">
        <span className="text-primary font-bold">{(other.fullName ?? 'O')[0]!.toUpperCase()}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-ink font-semibold truncate">{other.fullName ?? 'Owner'}</p>
        <p className="text-muted text-sm truncate">{conversation.listing.title}</p>
        {conversation.lastMessage && (
          <p className="text-muted-soft text-xs mt-0.5 truncate">{conversation.lastMessage.body}</p>
        )}
      </div>
    </Link>
  );
}
