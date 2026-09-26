import { ActivityIndicator, FlatList, Image, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useMyListings } from '@/features/listings/hooks';
import { StatusPill } from '@/features/listings/components/StatusPill';
import type { Listing } from '@/features/listings/api';
import { colors } from '@/lib/tokens';

// Owner-only tab (root apps/mobile/design.md's Mobile-only conventions, 2026-07-23
// decision) — only rendered in the tab bar for role="owner", see (tabs)/_layout.tsx.
export default function MyListingsScreen() {
  const { data: listings, isLoading, isError, refetch, isRefetching } = useMyListings();

  return (
    <View className="flex-1 bg-surface">
      <View className="flex-row items-center justify-between px-4 pt-14 pb-3 bg-white">
        <Text className="text-2xl font-bold text-ink">My Listings</Text>
        <Pressable
          onPress={() => router.push('/listing/new')}
          className="w-10 h-10 rounded-full bg-primary items-center justify-center"
        >
          <Plus size={20} color={colors['on-primary']} />
        </Pressable>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-muted text-center">Couldn't load your listings.</Text>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-4 pt-4 pb-8"
          refreshing={isRefetching}
          onRefresh={refetch}
          renderItem={({ item }) => <MyListingRow listing={item} />}
          ListEmptyComponent={
            <View className="items-center justify-center py-20 px-8">
              <Text className="text-muted text-center mb-4">
                You haven't listed a property yet.
              </Text>
              <Pressable
                onPress={() => router.push('/listing/new')}
                className="bg-primary rounded-full px-6 py-3"
              >
                <Text className="text-white font-semibold">List a Property</Text>
              </Pressable>
            </View>
          }
        />
      )}
    </View>
  );
}

function MyListingRow({ listing }: { listing: Listing }) {
  const photo = listing.images[0]?.cloudinaryUrl;
  return (
    <Pressable
      onPress={() => router.push(`/listing/${listing.id}`)}
      className="flex-row items-center bg-white rounded-2xl p-3 mb-3 shadow-sm"
    >
      <View className="w-16 h-16 rounded-xl bg-surface overflow-hidden mr-3">
        {photo ? (
          <Image source={{ uri: photo }} className="w-full h-full" resizeMode="cover" />
        ) : null}
      </View>
      <View className="flex-1">
        <Text className="text-ink font-semibold" numberOfLines={1}>
          {listing.title}
        </Text>
        <Text className="text-muted text-sm mb-2" numberOfLines={1}>
          {listing.locality} · ₹{listing.rent.toLocaleString('en-IN')}/mo
        </Text>
        <StatusPill status={listing.status} />
      </View>
    </Pressable>
  );
}
