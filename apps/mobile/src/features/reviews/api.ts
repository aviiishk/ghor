// Calls apps/api's reviews module (apps/api/src/reviews/). Mirrors
// apps/web/features/reviews/api.ts. No admin calls here — moderation is web-only.
import { apiRequest } from '@/lib/apiClient';

export type Review = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  reviewer: { id: string; fullName: string | null };
};

export type ReviewsPage = {
  items: Review[];
  nextCursor: string | null;
  // Server-decided: has messaged the owner about this listing, isn't the owner, hasn't
  // already reviewed. The API enforces the same gate on POST independently.
  viewer: { canReview: boolean; hasReviewed: boolean };
};

export async function getReviews(listingId: string, cursor?: string): Promise<ReviewsPage> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return apiRequest<ReviewsPage>(`/listings/${listingId}/reviews${qs}`, { auth: true });
}

export async function createReview(
  listingId: string,
  input: { rating: number; comment?: string },
): Promise<Review> {
  return apiRequest<Review>(`/listings/${listingId}/reviews`, {
    method: 'POST',
    auth: true,
    body: JSON.stringify(input),
  });
}
