import { ScrollView, Text, View } from 'react-native';
import { useSimilarListings } from '../hooks';
import { ListingCard } from './ListingCard';

// Horizontal card row at the bottom of listing detail (root CLAUDE.md §2). A plain
// horizontal ScrollView (≤6 items), not a FlatList, since it sits inside the detail
// screen's vertical ScrollView. Renders nothing when there are no matches.
export function SimilarListings({ listingId }: { listingId: string }) {
  const { data: listings } = useSimilarListings(listingId);
  if (!listings?.length) return null;

  return (
    <View className="border-t border-hairline pt-5 mt-5">
      <Text className="text-xl font-semibold text-ink mb-4">Similar listings</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 12, paddingRight: 20 }}
        style={{ marginHorizontal: -20, paddingLeft: 20 }}
      >
        {listings.map((listing) => (
          <View key={listing.id} style={{ width: 260 }}>
            <ListingCard listing={listing} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
