import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { RatingDisplay } from './RatingDisplay';
import { WriteReviewSheet } from './WriteReviewSheet';
import { useReviews } from '../hooks';
import type { Review } from '../api';
import { colors } from '@/lib/tokens';

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

// DESIGN.md `review-card`: this review's own rating (not the aggregate), comment, date.
function ReviewCard({ review }: { review: Review }) {
  return (
    <View className="bg-white border border-hairline rounded-2xl p-4 mb-3">
      <View className="flex-row items-center justify-between mb-1">
        <Text className="font-semibold text-ink flex-1 mr-3" numberOfLines={1}>
          {review.reviewer.fullName ?? 'GHOR user'}
        </Text>
        <Text className="text-xs text-muted">{timeAgo(review.createdAt)}</Text>
      </View>
      <RatingDisplay avgRating={review.rating} size="sm" />
      {review.comment && <Text className="text-sm text-ink leading-5 mt-2">{review.comment}</Text>}
    </View>
  );
}

// Rendered inside listing/[id].tsx's ScrollView — a plain mapped list, not a FlatList
// (no nested virtualized lists), paged with an explicit "Show more" instead of scroll.
export function ReviewsSection({
  listingId,
  avgRating,
  reviewCount,
}: {
  listingId: string;
  avgRating: number | null;
  reviewCount: number;
}) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useReviews(listingId);
  const [writeVisible, setWriteVisible] = useState(false);

  const reviews = data?.pages.flatMap((p) => p.items) ?? [];
  const viewer = data?.pages[0]?.viewer;

  return (
    <View className="border-t border-hairline pt-5 mt-5">
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center">
          <Text className="text-xl font-semibold text-ink mr-3">Reviews</Text>
          <RatingDisplay avgRating={avgRating} reviewCount={reviewCount} />
        </View>
        {viewer?.canReview && (
          <Pressable
            onPress={() => setWriteVisible(true)}
            className="border border-primary rounded-full px-4 py-2"
          >
            <Text className="text-primary font-semibold text-sm">Write a review</Text>
          </Pressable>
        )}
      </View>
      {viewer?.hasReviewed && (
        <Text className="text-sm text-muted mb-3">You've reviewed this listing.</Text>
      )}

      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : reviews.length === 0 ? (
        <Text className="text-muted">
          No reviews yet. People who've messaged the owner about this listing can leave one.
        </Text>
      ) : (
        reviews.map((r) => <ReviewCard key={r.id} review={r} />)
      )}

      {hasNextPage && (
        <Pressable onPress={() => fetchNextPage()} disabled={isFetchingNextPage} className="py-2">
          <Text className="text-primary font-semibold">
            {isFetchingNextPage ? 'Loading…' : 'Show more reviews'}
          </Text>
        </Pressable>
      )}

      <WriteReviewSheet
        visible={writeVisible}
        onClose={() => setWriteVisible(false)}
        listingId={listingId}
      />
    </View>
  );
}
