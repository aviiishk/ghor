import { Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { colors } from '@/lib/tokens';

// DESIGN.md `rating-display` + `new-listing-badge`: an ink (never gold) star, the number
// at body-strong, the count muted — deliberately quiet next to the rent. No visible
// reviews → the "New" badge instead; never a fabricated 0.0.
export function RatingDisplay({
  avgRating,
  reviewCount,
  size = 'md',
}: {
  avgRating: number | null;
  reviewCount?: number;
  size?: 'sm' | 'md';
}) {
  const text = size === 'sm' ? 'text-xs' : 'text-sm';
  if (avgRating == null) {
    return (
      <View className="bg-surface rounded-full px-2.5 py-1 self-start">
        <Text className={`text-muted ${text} font-semibold`}>New</Text>
      </View>
    );
  }
  return (
    <View
      className="flex-row items-center"
      accessible
      accessibilityLabel={`Rated ${avgRating.toFixed(1)} out of 5${
        reviewCount != null ? `, ${reviewCount} reviews` : ''
      }`}
    >
      <Star size={size === 'sm' ? 12 : 14} color={colors.ink} fill={colors.ink} />
      <Text className={`${text} font-semibold text-ink ml-1`}>{avgRating.toFixed(1)}</Text>
      {reviewCount != null && <Text className={`${text} text-muted ml-1`}>({reviewCount})</Text>}
    </View>
  );
}
