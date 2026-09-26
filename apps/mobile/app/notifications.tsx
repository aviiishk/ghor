import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import {
  useNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from '@/features/notifications/hooks';
import type { Notification } from '@/features/notifications/api';
import { colors } from '@/lib/tokens';

const LABEL: Record<Notification['type'], string> = {
  new_message: 'New message',
  listing_approved: 'Listing approved',
  listing_rejected: 'Listing rejected',
  new_review: 'New review',
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationsScreen() {
  const { data: notifications, isLoading, isError, refetch, isRefetching } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  function handlePress(n: Notification) {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.type === 'new_message' && n.payload?.conversationId) {
      router.push(`/chat/${n.payload.conversationId}`);
    } else if (n.payload?.listingId) {
      router.push(`/listing/${n.payload.listingId}`);
    }
  }

  const hasUnread = notifications?.some((n) => !n.readAt);

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Notifications',
          headerRight: () =>
            hasUnread ? (
              <Pressable onPress={() => markAllRead.mutate()}>
                <Text className="text-primary text-sm font-semibold">Mark all read</Text>
              </Pressable>
            ) : null,
        }}
      />
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-muted text-center">Couldn&apos;t load notifications.</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          refreshing={isRefetching}
          onRefresh={refetch}
          contentContainerClassName="px-4 pb-8 pt-2"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handlePress(item)}
              className="flex-row items-start gap-3 py-3.5 border-b border-hairline"
            >
              <View
                className={`w-2 h-2 rounded-full mt-2 ${item.readAt ? 'bg-transparent' : 'bg-primary'}`}
              />
              <View className="flex-1">
                <Text className={`text-ink ${item.readAt ? 'font-medium' : 'font-bold'}`}>
                  {LABEL[item.type] ?? item.type}
                </Text>
                <Text className="text-muted-soft text-xs mt-0.5">{timeAgo(item.createdAt)}</Text>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-20 px-8">
              <Text className="text-muted text-center">You&apos;re all caught up.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
