import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './api';

export const chatKeys = {
  conversations: ['conversations'] as const,
  messages: (conversationId: string) => ['conversations', conversationId, 'messages'] as const,
};

// Unread counts in the nav come from here, and the only socket is inside an open thread —
// so refresh while the tab is visible and on return, or a new enquiry never shows up
// until the user navigates (RC QA 2026-09-28). Background tabs don't poll.
export function useConversations() {
  return useQuery({
    queryKey: chatKeys.conversations,
    queryFn: api.listConversations,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useMessages(conversationId: string) {
  return useInfiniteQuery({
    queryKey: chatKeys.messages(conversationId),
    queryFn: ({ pageParam }) => api.getMessages(conversationId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!conversationId,
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (listingId: string) => api.getOrCreateConversation(listingId),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatKeys.conversations }),
  });
}
