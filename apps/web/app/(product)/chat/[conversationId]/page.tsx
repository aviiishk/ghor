'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BadgeCheck, ExternalLink, MapPin, MessageCircle, SendHorizontal } from 'lucide-react';
import { Avatar, Skeleton, buttonClass, formatRent } from '@/components/ui';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import { useConversations, useMessages, chatKeys } from '@/features/chat/hooks';
import { sendMessageRest, type Conversation, type Message } from '@/features/chat/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { QuickReplies } from '@/features/chat/components/QuickReplies';
import { ConversationList } from '@/features/chat/components/ConversationList';
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
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
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
    <div className="mx-auto max-w-7xl lg:px-8 lg:pb-6 lg:pt-6">
      <div className="grid grid-cols-1 h-[calc(100dvh-64px)] overflow-hidden bg-white lg:h-[calc(100dvh-64px-3rem)] lg:grid-cols-[360px_minmax(0,1fr)] lg:rounded-2xl lg:ring-1 lg:ring-inset lg:ring-navy/[0.08]">
        {/* Desktop sidebar: all conversations */}
        <aside className="hidden min-h-0 flex-col border-r border-navy/[0.08] lg:flex">
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <h1 className="font-display text-2xl font-bold tracking-tight text-navy">Chats</h1>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ConversationList
              conversations={conversations}
              isLoading={!conversations}
              isError={false}
              onRetry={() => undefined}
              myId={profile?.id}
              activeId={conversationId}
            />
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          {/* Header: who you're talking to */}
          <div className="flex items-center gap-3 border-b border-navy/[0.08] bg-white px-3 py-3 sm:px-5">
            <button onClick={() => router.push('/chats')} aria-label="Back to chats" className="rounded-full p-2 text-navy hover:bg-cream lg:hidden">
              <ArrowLeft size={20} />
            </button>
            {other ? <Avatar name={other.fullName} size="md" /> : <Skeleton className="h-11 w-11 rounded-full" />}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate font-display text-[17px] font-bold text-navy">
                {other?.fullName ?? 'Chat'}
                {other?.phoneVerified && <BadgeCheck size={16} className="shrink-0 text-success-deep" aria-label="Phone verified" />}
              </p>
              {conversation && <p className="truncate text-xs text-muted">{isSeeker ? 'Owner' : 'Interested renter'}</p>}
            </div>
            {conversation && (
              <Link href={`/listing/${conversation.listing.id}`} className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-navy underline-offset-4 hover:underline sm:inline-flex">
                View listing <ExternalLink size={14} aria-hidden />
              </Link>
            )}
          </div>

          {/* Listing context — always visible, so the chat is about a specific home */}
          {conversation && (
            <Link href={`/listing/${conversation.listing.id}`} className="group flex items-center gap-3 border-b border-navy/[0.08] bg-cream px-4 py-3 sm:px-5">
              <span className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg bg-cream-deep">
                {cover && <Image src={cover} alt="" fill sizes="64px" className="object-cover" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink group-hover:underline">{conversation.listing.title}</span>
                <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
                  <MapPin size={12} className="text-primary" aria-hidden /> {conversation.listing.locality}
                </span>
              </span>
              <span className="shrink-0 font-display text-lg font-bold text-navy">
                {formatRent(conversation.listing.rent)}
                <span className="text-xs font-medium text-muted">/mo</span>
              </span>
            </Link>
          )}

          {/* Thread */}
          <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto bg-[#FCFAF6] px-4 sm:px-6">
            <div ref={bottomRef} />
            <div className="mx-auto flex w-full max-w-3xl flex-col py-5">
              {isLoading ? (
                <div className="space-y-3" aria-busy="true">
                  <Skeleton className="h-10 w-2/3 rounded-2xl" />
                  <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
                  <Skeleton className="h-10 w-3/5 rounded-2xl" />
                </div>
              ) : isError ? (
                <div className="flex flex-col items-center py-14 text-center">
                  <p className="font-display text-xl font-bold text-navy">This conversation isn’t available</p>
                  <p className="mt-1.5 max-w-sm text-sm text-muted">It may have been deleted, or the link is for someone else’s chat. If it’s yours, check your connection and try again.</p>
                  <div className="mt-5 flex gap-2">
                    <button onClick={() => refetch()} className={buttonClass('secondary', 'sm')}>Try again</button>
                    <Link href="/chats" className={buttonClass('navy', 'sm')}>All chats</Link>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center py-14 text-center">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-primary shadow-lift">
                    <MessageCircle size={26} aria-hidden />
                  </span>
                  <p className="mt-5 font-display text-xl font-bold text-navy">Start the conversation</p>
                  <p className="mt-1.5 max-w-xs text-sm text-muted">
                    Ask about availability, visiting times or the deposit. Tap a suggestion below to begin.
                  </p>
                </div>
              ) : (
                <>
                  {hasNextPage && (
                    <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="mb-3 self-center rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-muted ring-1 ring-inset ring-navy/10">
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

          {/* Composer — hidden when the thread can't be loaded, since a send would only be refused */}
          {!isError && (
            <div className="border-t border-navy/[0.08] bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2.5 sm:px-5">
              <div className="mx-auto max-w-3xl">
                <QuickReplies onSelect={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))} />
                <div className="mt-2 flex items-end gap-2 rounded-2xl bg-cream p-1.5 pl-4 ring-1 ring-inset ring-navy/10 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary">
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
                    className="max-h-32 flex-1 resize-none bg-transparent py-2.5 text-[15px] text-ink outline-none placeholder:text-muted"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!text.trim() || sending}
                    aria-label="Send message"
                    className="press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition disabled:bg-primary-disabled"
                  >
                    <SendHorizontal size={19} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
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
    <div className="my-5 flex justify-center">
      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted ring-1 ring-inset ring-navy/[0.08]">{label}</span>
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
        className={`whitespace-pre-wrap break-words rounded-[20px] px-4 py-2.5 text-[15px] leading-6 ${
          isMine
            ? `bg-chat-sent-bg text-chat-sent-text ${lastInGroup ? 'rounded-br-md' : ''}`
            : `bg-white text-ink ring-1 ring-inset ring-navy/[0.08] ${lastInGroup ? 'rounded-bl-md' : ''}`
        }`}
      >
        {message.body}
      </div>
      {lastInGroup && <span className="mt-1 px-1 text-[11px] text-muted">{time}</span>}
    </div>
  );
}
