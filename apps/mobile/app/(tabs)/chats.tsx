import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useConversations } from '@/features/chat/hooks';
import { useProfile } from '@/features/auth/hooks';
import type { Conversation } from '@/features/chat/api';
import { colors } from '@/lib/tokens';

export default function ChatsScreen() {
  const { data: conversations, isLoading, isError, refetch, isRefetching } = useConversations();
  const { data: profile } = useProfile();

  return (
    <View className="flex-1 bg-white">
      <View className="px-4 pt-14 pb-3">
        <Text className="text-2xl font-bold text-ink">Chats</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-muted text-center">Couldn't load your chats.</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-4 pb-8"
          refreshing={isRefetching}
          onRefresh={refetch}
          renderItem={({ item }) => <ConversationRow conversation={item} myId={profile?.id} />}
          ListEmptyComponent={
            <View className="items-center justify-center py-20 px-8">
              <Text className="text-muted text-center">
                No conversations yet.{'\n'}Message an owner from a listing to start one.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function ConversationRow({ conversation, myId }: { conversation: Conversation; myId?: string }) {
  const isSeeker = conversation.seekerId === myId;
  const other = isSeeker ? conversation.owner : conversation.seeker;

  return (
    <Pressable
      onPress={() => router.push(`/chat/${conversation.id}`)}
      className="flex-row items-center py-3 border-b border-hairline"
    >
      <View className="w-12 h-12 rounded-full bg-primary-light items-center justify-center mr-3">
        <Text className="text-primary font-bold">{(other.fullName ?? 'O')[0]!.toUpperCase()}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-ink font-semibold" numberOfLines={1}>
          {other.fullName ?? 'Owner'}
        </Text>
        <Text className="text-muted text-sm" numberOfLines={1}>
          {conversation.listing.title}
        </Text>
        {conversation.lastMessage && (
          <Text className="text-muted-soft text-xs mt-0.5" numberOfLines={1}>
            {conversation.lastMessage.body}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
