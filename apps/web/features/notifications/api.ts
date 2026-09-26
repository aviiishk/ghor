// Calls apps/api's notifications module via the /api/gateway proxy — read/mark-read only,
// same shape as apps/mobile/src/features/notifications/api.ts.
import { apiRequest } from '@/lib/apiClient';

export type NotificationType =
  | 'new_message'
  | 'listing_approved'
  | 'listing_rejected'
  | 'new_review';

export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  payload: { conversationId?: string; listingId?: string } | null;
  readAt: string | null;
  createdAt: string;
};

export async function getNotifications() {
  return apiRequest<Notification[]>('/notifications');
}

export async function markNotificationRead(id: string) {
  return apiRequest<Notification>(`/notifications/${id}/read`, { method: 'PATCH' });
}

export async function markAllNotificationsRead() {
  return apiRequest<{ updated: number }>('/notifications/read-all', { method: 'PATCH' });
}
