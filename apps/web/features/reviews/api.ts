// Calls apps/api's reviews module (apps/api/src/reviews/) via /api/gateway. Mirrors
// apps/mobile/src/features/reviews/api.ts.
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
  // Whether the signed-in user may write a review (has messaged the owner about this
  // listing, isn't the owner, hasn't already reviewed). Server-decided, not client logic.
  viewer: { canReview: boolean; hasReviewed: boolean };
};

export type AdminReview = Review & { hidden: boolean; listing: { id: string; title: string } };

export async function getReviews(listingId: string, cursor?: string): Promise<ReviewsPage> {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return apiRequest<ReviewsPage>(`/listings/${listingId}/reviews${qs}`);
}

export async function createReview(
  listingId: string,
  input: { rating: number; comment?: string },
): Promise<Review> {
  return apiRequest<Review>(`/listings/${listingId}/reviews`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getAdminReviews(hidden?: boolean): Promise<AdminReview[]> {
  const qs = hidden === undefined ? '' : `?hidden=${hidden}`;
  return apiRequest<AdminReview[]>(`/admin/reviews${qs}`);
}

export async function setReviewHidden(id: string, hidden: boolean): Promise<AdminReview> {
  return apiRequest<AdminReview>(`/admin/reviews/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ hidden }),
  });
}
