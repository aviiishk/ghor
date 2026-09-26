// Calls apps/api's new notifications module (apps/api/src/notifications/) — read/mark-read
// only, rows are written server-side wherever the underlying event happens (chat message
// creation, an admin approving/rejecting a listing). See apps/api/STATUS.md.
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
  return apiRequest<Notification[]>('/notifications', { auth: true });
}

export async function markNotificationRead(id: string) {
  return apiRequest<Notification>(`/notifications/${id}/read`, { method: 'PATCH', auth: true });
}

export async function markAllNotificationsRead() {
  return apiRequest<{ updated: number }>('/notifications/read-all', {
    method: 'PATCH',
    auth: true,
  });
}

// Calls apps/api's push-tokens module (apps/api/src/push-tokens/) — separate from the
// notifications endpoints above (different table, different concern: this registers a
// device to receive push, it doesn't read/write in-app notification rows).
// The token this device last registered for the signed-in user, so sign-out can remove
// it (otherwise the previous user's chat notifications keep arriving on a shared phone).
let registeredToken: string | null = null;

export async function registerPushToken(expoPushToken: string, deviceId?: string) {
  const result = await apiRequest<{ id: string }>('/push-tokens', {
    method: 'POST',
    auth: true,
    body: JSON.stringify({ expoPushToken, deviceId }),
  });
  registeredToken = expoPushToken;
  return result;
}

// Best-effort; called from signOut() while the session is still valid.
export async function unregisterPushToken(): Promise<void> {
  if (!registeredToken) return;
  const token = registeredToken;
  registeredToken = null;
  await apiRequest('/push-tokens', {
    method: 'DELETE',
    auth: true,
    body: JSON.stringify({ expoPushToken: token }),
  }).catch(() => {});
}
