import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from './api';
import { listingsKeys } from '@/features/listings/hooks';

export const reviewsKeys = {
  list: (listingId: string) => ['reviews', listingId] as const,
};

export function useReviews(listingId: string) {
  return useInfiniteQuery({
    queryKey: reviewsKeys.list(listingId),
    queryFn: ({ pageParam }) => api.getReviews(listingId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!listingId,
  });
}

export function useCreateReview(listingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { rating: number; comment?: string }) =>
      api.createReview(listingId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reviewsKeys.list(listingId) });
      // avgRating/reviewCount live on the listing itself (denormalized server-side).
      qc.invalidateQueries({ queryKey: listingsKeys.detail(listingId) });
      qc.invalidateQueries({ queryKey: ['listings', 'browse'] });
    },
  });
}
