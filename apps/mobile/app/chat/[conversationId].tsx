import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { Send } from 'lucide-react-native';
import { useConversations, useMessages, chatKeys } from '@/features/chat/hooks';
import { sendMessageRest, type Message } from '@/features/chat/api';
import { connectSocket, disconnectSocket } from '@/features/chat/socket';
import { QuickReplies } from '@/features/chat/components/QuickReplies';
import { useProfile } from '@/features/auth/hooks';
import { colors } from '@/lib/tokens';
import type { Socket } from 'socket.io-client';

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

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const { data: conversations } = useConversations();
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMessages(conversationId);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [socketReady, setSocketReady] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const conversation = conversations?.find((c) => c.id === conversationId);
  const isSeeker = conversation?.seekerId === profile?.id;
  const other = conversation ? (isSeeker ? conversation.owner : conversation.seeker) : undefined;

  const messages = data?.pages.flatMap((page) => page.items) ?? [];

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
        // Real-time connection failed (no session, network issue, etc.) — messages still
        // load over REST via useMessages(), and sends fall back to sendMessageRest().
        // Known gap, not a crash: see apps/mobile/STATUS.md.
      }
    })();

    return () => {
      cancelled = true;
      socketRef.current?.emit('conversation:leave', { conversationId });
      socketRef.current?.off('message:new');
    };
  }, [conversationId, qc]);

  // Socket connection itself outlives a single screen (root CLAUDE.md §14.5 says leave
  // the *room* on cleanup, not necessarily tear down the whole connection) — but with no
  // other screen using it yet, disconnecting here keeps behavior simple and avoids a
  // stale open socket while the user is elsewhere in the app.
  useEffect(() => () => disconnectSocket(), []);

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
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: other?.fullName ?? 'Chat',
        }}
      />

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          inverted
          contentContainerClassName="px-4 py-3"
          renderItem={({ item }) => (
            <MessageBubble message={item} isMine={item.senderId === profile?.id} />
          )}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
            ) : null
          }
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text className="text-muted text-center">
                Say hello — ask about the room, availability, or anything else.
              </Text>
            </View>
          }
        />
      )}

      <QuickReplies onSelect={(t) => setText((prev) => (prev ? `${prev} ${t}` : t))} />

      <View className="flex-row items-end gap-2 px-4 py-3 border-t border-hairline">
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type a message"
          placeholderTextColor={colors['muted-soft']}
          multiline
          className="flex-1 border border-hairline rounded-2xl px-4 py-2.5 text-ink max-h-28"
        />
        <Pressable
          onPress={handleSend}
          disabled={!text.trim() || sending}
          className="w-11 h-11 rounded-full bg-primary items-center justify-center"
          style={{ opacity: !text.trim() || sending ? 0.5 : 1 }}
        >
          <Send size={18} color={colors['on-primary']} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// DESIGN.md's chat-bubble-sent/received: flat fill, no shadow, no speech-bubble tail.
function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  return (
    <View className={`mb-2.5 max-w-[80%] ${isMine ? 'self-end items-end' : 'self-start items-start'}`}>
      <View
        className={`rounded-2xl px-4 py-2.5 ${isMine ? 'bg-chat-sent-bg' : 'bg-chat-received-bg'}`}
      >
        <Text className={isMine ? 'text-chat-sent-text' : 'text-chat-received-text'}>
          {message.body}
        </Text>
      </View>
    </View>
  );
}
