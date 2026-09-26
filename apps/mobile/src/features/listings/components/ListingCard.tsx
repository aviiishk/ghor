import { Image, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Listing } from '../api';
import { RatingDisplay } from '@/features/reviews/components/RatingDisplay';
import { amenityLabel } from '../amenities';

// DESIGN.md's `listing-card`: full-bleed 4:3 photo, no internal padding around it,
// metadata block beneath. Fixed aspect ratio (not the source photo's natural ratio) so
// card height stays consistent down a scrolling feed of very different room photos.
export function ListingCard({ listing }: { listing: Listing }) {
  const photo = listing.images[0]?.cloudinaryUrl;
  const amenities = Object.entries(listing.amenities ?? {})
    .filter(([, on]) => on)
    .map(([key]) => key)
    .slice(0, 3);

  return (
    <Pressable
      onPress={() => router.push(`/listing/${listing.id}`)}
      className="bg-white rounded-2xl overflow-hidden mb-4 shadow-sm"
    >
      <View className="aspect-[4/3] bg-surface">
        {photo ? (
          <Image source={{ uri: photo }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <View className="w-full h-full items-center justify-center">
            <Text className="text-muted-soft text-xs">No photo yet</Text>
          </View>
        )}
      </View>

      <View className="p-4">
        <Text className="text-lg font-semibold text-ink" numberOfLines={1}>
          {listing.title}
        </Text>
        <Text className="text-muted text-sm mb-2" numberOfLines={1}>
          {listing.locality}, {listing.city}
        </Text>

        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-xl font-bold text-ink">
            ₹{listing.rent.toLocaleString('en-IN')}
            <Text className="text-sm font-medium text-muted">/mo</Text>
          </Text>
          <RatingDisplay avgRating={listing.avgRating} reviewCount={listing.reviewCount} size="sm" />
        </View>

        {amenities.length > 0 && (
          <View className="flex-row flex-wrap gap-1.5 mb-2">
            {amenities.map((key) => (
              <View key={key} className="bg-primary-light rounded-full px-2.5 py-1">
                <Text className="text-primary text-xs font-bold">
                  {amenityLabel(key)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View className="flex-row items-center">
          <Text className="text-muted text-xs" numberOfLines={1}>
            {listing.owner.fullName ?? 'Owner'}
          </Text>
          {listing.owner.phoneVerified && (
            <Text className="text-success-deep text-xs font-bold ml-1.5">
              · Phone Verified
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}
