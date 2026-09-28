import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './api';

const notificationsKey = ['notifications'] as const;

// Same reasoning as useConversations: the bell's unread count must not go stale.
export function useNotifications() {
  return useQuery({
    queryKey: notificationsKey,
    queryFn: api.getNotifications,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationsKey }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationsKey }),
  });
}
