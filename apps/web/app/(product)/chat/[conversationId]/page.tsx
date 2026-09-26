'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';
import { useConversations, useMessages, chatKeys } from '@/features/chat/hooks';
import { sendMessageRest, type Message } from '@/features/chat/api';
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

  return (
    <div className="max-w-2xl mx-auto px-6 py-6 flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <div className="pb-4 border-b border-hairline mb-4">
        <h1 className="text-lg font-bold text-ink">{other?.fullName ?? 'Chat'}</h1>
        {conversation && <p className="text-muted text-sm">{conversation.listing.title}</p>}
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col-reverse">
        <div ref={bottomRef} />
        <div className="flex flex-col">
          {isLoading ? (
            <p className="text-muted text-center py-10">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-muted text-center py-10">
              Say hello — ask about the room, availability, or anything else.
            </p>
          ) : (
            <>
              {hasNextPage && (
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="self-center text-sm text-muted font-semibold mb-3"
                >
                  {isFetchingNextPage ? 'Loading…' : 'Load earlier messages'}
                </button>
              )}
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isMine={message.senderId === profile?.id}
                />
              ))}
            </>
          )}
        </div>
      </div>

      <QuickReplies onSelect={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))} />

      <div className="flex items-end gap-2 pt-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message"
          rows={1}
          className="flex-1 border border-hairline rounded-2xl px-4 py-2.5 text-ink resize-none max-h-28"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center disabled:opacity-50 shrink-0"
        >
          →
        </button>
      </div>
    </div>
  );
}

// DESIGN.md's chat-bubble-sent/received: flat fill, no shadow, no speech-bubble tail.
function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  return (
    <div className={`mb-2.5 max-w-[75%] flex ${isMine ? 'self-end justify-end' : 'self-start justify-start'}`}>
      <div
        className={`rounded-2xl px-4 py-2.5 ${
          isMine ? 'bg-chat-sent-bg text-chat-sent-text' : 'bg-chat-received-bg text-chat-received-text'
        }`}
      >
        {message.body}
      </div>
    </div>
  );
}
