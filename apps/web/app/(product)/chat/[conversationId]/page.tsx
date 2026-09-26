'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BadgeCheck, MessageCircle, SendHorizontal } from 'lucide-react';
import { Avatar, Skeleton, formatRent } from '@/components/ui';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import { useConversations, useMessages, chatKeys } from '@/features/chat/hooks';
import { sendMessageRest, type Conversation, type Message } from '@/features/chat/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { QuickReplies } from '@/features/chat/components/QuickReplies';
import { useProfile } from '@/features/auth/hooks';

type MessagesPage = { items: Message[]; nextCursor: string | null };

function prependMessage(
  qc: ReturnType<typeof useQueryClient>,
  conversationId: string,
  message: Message,
) {
  qc.setQueryData<InfiniteData<MessagesPage>>(chatKeys.messages(conversationId), (old) => {
    if (!old) return old;
    const alreadyPresent = old.pages.some((page) => page.items.some((m) => m.id === message.id));
    if (alreadyPresent) return old;
    const [firstPage, ...rest] = old.pages;
    return {
      ...old,
      pages: [{ ...firstPage!, items: [message, ...firstPage!.items] }, ...rest],
    };
  });
}

export default function ChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const qc = useQueryClient();
  const router = useRouter();
  const { data: profile } = useProfile();
  const { data: conversations } = useConversations();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMessages(conversationId);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const conversation = conversations?.find((c) => c.id === conversationId);
  const isSeeker = conversation?.seekerId === profile?.id;
  const other = conversation ? (isSeeker ? conversation.owner : conversation.seeker) : undefined;

  // API returns newest-first (cursor pagination, same convention as the listings feed);
  // reverse for natural oldest-at-top, newest-at-bottom chat rendering on web.
  const messages = [...(data?.pages.flatMap((page) => page.items) ?? [])].reverse();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const socket = await connectSocket();
        if (cancelled) return;
        socketRef.current = socket;

        socket.on('message:new', (message: Message) => {
          if (message.conversationId === conversationId) {
            prependMessage(qc, conversationId, message);
          }
        });

        await new Promise<void>((resolve, reject) => {
          socket.emit(
            'conversation:join',
            { conversationId },
            (ack: { joined?: string; error?: string }) => {
              if (ack?.joined) resolve();
              else reject(new Error(ack?.error ?? 'Failed to join conversation'));
            },
          );
        });
        if (!cancelled) setSocketReady(true);
      } catch {
        // Real-time connection failed — messages still load over REST via
        // useMessages(), and sends fall back to sendMessageRest(). See STATUS.md.
      }
    })();

    return () => {
      cancelled = true;
      socketRef.current?.emit('conversation:leave', { conversationId });
      socketRef.current?.off('message:new');
    };
  }, [conversationId, qc]);

  useEffect(() => () => disconnectSocket(), []);

  // The first messages page is what marks this thread read server-side (apps/api
  // ChatService.getMessages). Mirror that in the cached conversation list straight away —
  // an unmount-time invalidate alone left a stale "1 unread" badge (found in QA,
  // 2026-09-27) because the list is cached fresh for 2 minutes.
  const firstPageLoaded = !!data;
  useEffect(() => {
    if (!firstPageLoaded) return;
    qc.setQueryData<Conversation[]>(chatKeys.conversations, (old) =>
      old?.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
    );
  }, [firstPageLoaded, conversationId, qc]);
  useEffect(() => () => void qc.invalidateQueries({ queryKey: chatKeys.conversations }), [qc]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  async function handleSend() {
    const body = text.trim();
    if (!body || sending) return;
    setText('');
    setSending(true);
    try {
      const socket = socketRef.current;
      if (socket?.connected && socketReady) {
        const message = await new Promise<Message>((resolve, reject) => {
          socket.emit(
            'message:send',
            { conversationId, body },
            (ack: Message & { error?: string }) => {
              if (ack?.id) resolve(ack);
              else reject(new Error(ack?.error ?? 'Failed to send'));
            },
          );
        });
        prependMessage(qc, conversationId, message);
      } else {
        const message = await sendMessageRest(conversationId, body);
        prependMessage(qc, conversationId, message);
      }
    } catch {
      setText(body);
    } finally {
      setSending(false);
    }
  }

  const cover = conversation?.listing.images?.[0]?.cloudinaryUrl;

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-0 sm:px-6" style={{ height: 'calc(100dvh - 64px)' }}>
      {/* Header: who you're talking to + which listing it's about */}
      <div className="flex items-center gap-3 border-b border-navy/[0.06] bg-white px-4 py-3 sm:mt-4 sm:rounded-t-3xl sm:px-5">
        <button onClick={() => router.push('/chats')} aria-label="Back to chats" className="-ml-1 rounded-full p-2 text-body hover:bg-surface">
          <ArrowLeft size={20} />
        </button>
        {other ? <Avatar name={other.fullName} size="md" /> : <Skeleton className="h-11 w-11 rounded-full" />}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-display font-bold text-ink">
            {other?.fullName ?? 'Chat'}
            {other?.phoneVerified && <BadgeCheck size={16} className="shrink-0 text-success-deep" aria-label="Phone verified" />}
          </p>
          <p className="truncate text-xs text-muted">{isSeeker ? 'Owner' : 'Interested renter'}</p>
        </div>
        {conversation && (
          <Link href={`/listing/${conversation.listing.id}`} className="press hidden max-w-[260px] items-center gap-3 rounded-2xl bg-cream p-2 pr-4 ring-1 ring-navy/[0.06] sm:flex">
            <span className="relative h-11 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-sunken">
              {cover && <Image src={cover} alt="" fill sizes="56px" className="object-cover" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-ink">{conversation.listing.title}</span>
              <span className="block text-xs text-muted">{formatRent(conversation.listing.rent)}/mo · {conversation.listing.locality}</span>
            </span>
          </Link>
        )}
      </div>
      {conversation && (
        <Link href={`/listing/${conversation.listing.id}`} className="flex items-center gap-3 border-b border-navy/[0.06] bg-cream px-4 py-2.5 sm:hidden">
          <span className="relative h-9 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-sunken">
            {cover && <Image src={cover} alt="" fill sizes="48px" className="object-cover" />}
          </span>
          <span className="min-w-0 truncate text-sm">
            <strong className="text-ink">{conversation.listing.title}</strong>{' '}
            <span className="text-muted">· {formatRent(conversation.listing.rent)}/mo</span>
          </span>
        </Link>
      )}

      {/* Thread */}
      <div className="flex flex-1 flex-col-reverse overflow-y-auto bg-white px-4 sm:px-5">
        <div ref={bottomRef} />
        <div className="flex flex-col py-4">
          {isLoading ? (
            <div className="space-y-3" aria-busy="true">
              <Skeleton className="h-10 w-2/3 rounded-2xl" />
              <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
              <Skeleton className="h-10 w-3/5 rounded-2xl" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary">
                <MessageCircle size={26} aria-hidden />
              </span>
              <p className="mt-4 font-display text-lg font-bold text-ink">Start the conversation</p>
              <p className="mt-1 max-w-xs text-sm text-muted">
                Ask about availability, visiting times or the deposit. Tap a suggestion below to begin.
              </p>
            </div>
          ) : (
            <>
              {hasNextPage && (
                <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="mb-3 self-center rounded-full bg-surface px-4 py-1.5 text-xs font-semibold text-muted">
                  {isFetchingNextPage ? 'Loading…' : 'Load earlier messages'}
                </button>
              )}
              {messages.map((message, i) => {
                const prev = messages[i - 1];
                const nextMsg = messages[i + 1];
                const newDay = !prev || dayKey(prev.createdAt) !== dayKey(message.createdAt);
                const lastInGroup =
                  !nextMsg || nextMsg.senderId !== message.senderId || dayKey(nextMsg.createdAt) !== dayKey(message.createdAt);
                return (
                  <div key={message.id} className="flex flex-col">
                    {newDay && <DaySeparator iso={message.createdAt} />}
                    <MessageBubble message={message} isMine={message.senderId === profile?.id} lastInGroup={lastInGroup} />
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-navy/[0.06] bg-white px-4 pb-4 pt-2 sm:mb-4 sm:rounded-b-3xl sm:px-5">
        <QuickReplies onSelect={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))} />
        <div className="mt-2 flex items-end gap-2 rounded-3xl bg-surface p-1.5 pl-4 ring-1 ring-hairline focus-within:ring-2 focus-within:ring-primary">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Write a message…"
            aria-label="Message"
            rows={1}
            maxLength={4000}
            className="max-h-32 flex-1 resize-none bg-transparent py-2 text-ink outline-none placeholder:text-muted-soft"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            aria-label="Send message"
            className="press inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white transition disabled:bg-primary-disabled"
          >
            <SendHorizontal size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function dayKey(iso: string) {
  return new Date(iso).toDateString();
}

function DaySeparator({ iso }: { iso: string }) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  const label =
    d.toDateString() === today.toDateString()
      ? 'Today'
      : d.toDateString() === yesterday.toDateString()
        ? 'Yesterday'
        : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <div className="my-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-muted-soft">
      <span className="h-px flex-1 bg-hairline-soft" />
      {label}
      <span className="h-px flex-1 bg-hairline-soft" />
    </div>
  );
}

// DESIGN.md chat bubbles: flat fill, no shadow. Consecutive messages from one sender are
// grouped (tight spacing), and only the last in a group shows its time.
function MessageBubble({ message, isMine, lastInGroup }: { message: Message; isMine: boolean; lastInGroup: boolean }) {
  const time = new Date(message.createdAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return (
    <div className={`flex max-w-[80%] flex-col ${isMine ? 'items-end self-end' : 'items-start self-start'} ${lastInGroup ? 'mb-3' : 'mb-1'}`}>
      <div
        className={`whitespace-pre-wrap break-words rounded-3xl px-4 py-2.5 leading-6 ${
          isMine
            ? `bg-chat-sent-bg text-chat-sent-text ${lastInGroup ? 'rounded-br-lg' : ''}`
            : `bg-chat-received-bg text-chat-received-text ${lastInGroup ? 'rounded-bl-lg' : ''}`
        }`}
      >
        {message.body}
      </div>
      {lastInGroup && <span className="mt-1 px-1 text-[11px] text-muted-soft">{time}</span>}
    </div>
  );
}
