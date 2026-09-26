import { Image, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BadgeCheck, Camera, MapPin, ShieldCheck } from 'lucide-react-native';
import type { Listing } from '../api';
import { amenityIcon, amenityLabel } from '../amenities';
import { RatingDisplay } from '@/features/reviews/components/RatingDisplay';
import { colors } from '@/lib/tokens';

// DESIGN.md `listing-card`, redesign 2026-09-26 — mirrors apps/web's ListingCard. The photo
// leads (fixed 4:3 so card heights stay consistent down a feed); overlays carry type,
// trust, rent and photo count. Solid 90%-white chips instead of blur — backdrop blur is
// expensive on budget Android and needs an extra native module.
export function ListingCard({ listing, width }: { listing: Listing; width?: number }) {
  const photo = listing.images[0]?.cloudinaryUrl;
  const amenities = Object.entries(listing.amenities ?? {})
    .filter(([, on]) => on)
    .map(([key]) => key);
  const shown = amenities.slice(0, 3);
  const extra = amenities.length - shown.length;
  const verified = listing.status === 'approved';

  return (
    <Pressable
      onPress={() => router.push(`/listing/${listing.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${listing.title}, ₹${listing.rent} per month, ${listing.locality}`}
      className="mb-4 overflow-hidden rounded-3xl bg-white active:opacity-90"
      style={[
        { borderWidth: 1, borderColor: 'rgba(11,27,63,0.06)' },
        width ? { width, marginRight: 12, marginBottom: 0 } : null,
      ]}
    >
      <View className="aspect-[4/3] bg-surface-sunken">
        {photo ? (
          <Image source={{ uri: photo }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Text className="text-xs text-muted-soft">No photo yet</Text>
          </View>
        )}
        <View style={{ position: 'absolute', left: 12, top: 12, flexDirection: 'row', gap: 6 }}>
          <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.92)' }}>
            <Text className="text-xs font-bold capitalize text-ink">{listing.propertyType}</Text>
          </View>
          {verified && (
            <View className="flex-row items-center rounded-full px-2 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.92)', gap: 3 }}>
              <ShieldCheck size={12} color={colors['success-deep']} />
              <Text className="text-xs font-bold text-success-deep">Verified</Text>
            </View>
          )}
        </View>
        {listing.images.length > 1 && (
          <View className="flex-row items-center rounded-full px-2 py-1" style={{ position: 'absolute', right: 12, top: 12, backgroundColor: 'rgba(11,27,63,0.6)', gap: 3 }}>
            <Camera size={12} color="#FFFFFF" />
            <Text className="text-xs font-semibold text-white">{listing.images.length}</Text>
          </View>
        )}
        <View className="flex-row items-baseline rounded-2xl px-3 py-1.5" style={{ position: 'absolute', left: 12, bottom: 12, backgroundColor: 'rgba(255,255,255,0.94)' }}>
          <Text className="text-lg font-bold text-ink">₹{listing.rent.toLocaleString('en-IN')}</Text>
          <Text className="text-xs font-medium text-muted">/mo</Text>
        </View>
      </View>

      <View className="p-4">
        <View className="flex-row items-start justify-between" style={{ gap: 8 }}>
          <Text className="flex-1 text-base font-bold text-ink" numberOfLines={1}>{listing.title}</Text>
          <RatingDisplay avgRating={listing.avgRating} reviewCount={listing.reviewCount} size="sm" />
        </View>
        <View className="mt-1 flex-row items-center" style={{ gap: 4 }}>
          <MapPin size={13} color={colors.muted} />
          <Text className="flex-1 text-sm text-muted" numberOfLines={1}>{listing.locality}, {listing.city}</Text>
        </View>

        {shown.length > 0 && (
          <View className="mt-3 flex-row flex-wrap" style={{ columnGap: 12, rowGap: 6 }}>
            {shown.map((key) => {
              const Icon = amenityIcon(key);
              return (
                <View key={key} className="flex-row items-center" style={{ gap: 4 }}>
                  <Icon size={14} color={colors.primary} />
                  <Text className="text-xs font-semibold text-body">{amenityLabel(key)}</Text>
                </View>
              );
            })}
            {extra > 0 && <Text className="text-xs text-muted">+{extra} more</Text>}
          </View>
        )}

        <View className="mt-3 flex-row items-center border-t border-hairline-soft pt-3" style={{ gap: 6 }}>
          <Text className="text-xs text-muted" numberOfLines={1}>{listing.owner.fullName ?? 'Owner'}</Text>
          {listing.owner.phoneVerified && (
            <View className="flex-row items-center" style={{ gap: 2 }}>
              <BadgeCheck size={13} color={colors['success-deep']} />
              <Text className="text-xs font-semibold text-success-deep">Phone verified</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}
