// Calls apps/api's chat module (apps/api/src/chat/) — REST is the fallback/initial-load
// path; real-time delivery goes through socket.ts's Socket.io connection instead (root
// CLAUDE.md §14.5). Both paths hit the same ChatService methods server-side, so a
// message sent over either transport looks identical to every client.
import { apiRequest } from '@/lib/apiClient';

export type ConversationParty = { id: string; fullName: string | null; phoneVerified: boolean };
export type ConversationListingSummary = {
  id: string;
  title: string;
  rent: number;
  city: string;
  locality: string;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

export type Conversation = {
  id: string;
  listingId: string;
  seekerId: string;
  ownerId: string;
  createdAt: string;
  lastMessageAt: string | null;
  listing: ConversationListingSummary;
  seeker: ConversationParty;
  owner: ConversationParty;
  lastMessage: Message | null;
};

export async function getOrCreateConversation(listingId: string): Promise<Conversation> {
  return apiRequest<Conversation>('/conversations', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ listingId }),
  });
}

export async function listConversations(): Promise<Conversation[]> {
  return apiRequest<Conversation[]>('/conversations', { auth: true });
}

export async function getMessages(conversationId: string, cursor?: string) {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return apiRequest<{ items: Message[]; nextCursor: string | null }>(
    `/conversations/${conversationId}/messages${qs}`,
    { auth: true },
  );
}

// REST fallback send — the chat screen normally sends over the socket connection
// instead (see socket.ts), falling back to this only if the socket isn't connected.
export async function sendMessageRest(conversationId: string, body: string): Promise<Message> {
  return apiRequest<Message>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ body }),
  });
}
