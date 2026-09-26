// Calls apps/api's chat module via the /api/gateway proxy — REST is the fallback/initial
// load path; real-time delivery goes through lib/socket.ts instead. Same DTOs/shapes as
// apps/mobile/src/features/chat/api.ts.
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
    body: JSON.stringify({ listingId }),
  });
}

export async function listConversations(): Promise<Conversation[]> {
  return apiRequest<Conversation[]>('/conversations');
}

export async function getMessages(conversationId: string, cursor?: string) {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return apiRequest<{ items: Message[]; nextCursor: string | null }>(
    `/conversations/${conversationId}/messages${qs}`,
  );
}

export async function sendMessageRest(conversationId: string, body: string): Promise<Message> {
  return apiRequest<Message>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}
