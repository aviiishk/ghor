import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useOwner } from '@/features/owners/hooks';
import { describeLastActive, describeResponseTime } from '@/features/owners/api';
import { ListingCard } from '@/features/listings/components/ListingCard';
import { RatingDisplay } from '@/features/reviews/components/RatingDisplay';
import { colors } from '@/lib/tokens';

// Root CLAUDE.md §2 "Owner profile page" — mirrors apps/web's /owner/[id]. The profile
// card is the FlatList header so the whole screen scrolls as one list.
export default function OwnerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: owner, isLoading, isError } = useOwner(id);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (isError || !owner) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Stack.Screen options={{ headerShown: true, title: '' }} />
        <Text className="text-muted text-center">This profile isn't available.</Text>
      </View>
    );
  }

  const memberSince = new Date(owner.createdAt).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
  const responseTime = describeResponseTime(owner.responseTimeMinutes);
  const lastActive = describeLastActive(owner.lastActiveAt);

  return (
    <View className="flex-1 bg-surface">
      <Stack.Screen options={{ headerShown: false }} />
      <FlatList
        data={owner.listings}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        ListHeaderComponent={
          <View>
            <View className="pt-14 pb-2">
              <Pressable
                onPress={() => router.back()}
                className="w-10 h-10 rounded-full bg-white items-center justify-center"
                accessibilityLabel="Back"
              >
                <ArrowLeft size={20} color={colors.ink} />
              </Pressable>
            </View>

            <View className="bg-white rounded-2xl p-5 mb-6 mt-2">
              <View className="w-16 h-16 rounded-full bg-primary-light items-center justify-center mb-3">
                <Text className="text-primary text-2xl font-bold">
                  {(owner.fullName ?? 'O')[0]!.toUpperCase()}
                </Text>
              </View>
              <Text className="text-xl font-bold text-ink">{owner.fullName ?? 'GHOR owner'}</Text>
              <Text className="text-muted text-sm mb-3">
                Member since {memberSince}
                {lastActive ? ` · ${lastActive}` : ''}
              </Text>

              <View className="flex-row flex-wrap gap-2 mb-4">
                {owner.phoneVerified && (
                  <View className="bg-success-pale rounded-full px-2.5 py-1">
                    <Text className="text-success-deep text-xs font-bold">✓ Phone Verified</Text>
                  </View>
                )}
                {owner.idVerificationStatus === 'verified' && (
                  <View className="bg-success-pale rounded-full px-2.5 py-1">
                    <Text className="text-success-deep text-xs font-bold">✓ ID Verified</Text>
                  </View>
                )}
              </View>

              <View className="flex-row gap-6">
                <View>
                  <Text className="text-xs text-muted mb-1">Rating</Text>
                  <RatingDisplay avgRating={owner.avgRating} reviewCount={owner.reviewCount} />
                </View>
                <View>
                  <Text className="text-xs text-muted mb-1">Response rate</Text>
                  <Text className="text-sm font-semibold text-ink">
                    {owner.responseRate != null ? `${owner.responseRate}%` : '—'}
                  </Text>
                </View>
              </View>
              {responseTime && <Text className="text-sm text-ink mt-3">{responseTime}</Text>}
            </View>

            <Text className="text-lg font-semibold text-ink mb-3">
              Listings by {owner.fullName?.split(' ')[0] ?? 'this owner'}
            </Text>
          </View>
        }
        renderItem={({ item }) => <ListingCard listing={item} />}
        ListEmptyComponent={<Text className="text-muted">No live listings right now.</Text>}
      />
    </View>
  );
}
