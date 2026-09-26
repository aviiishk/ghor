'use client';

import { useState } from 'react';
import { RatingDisplay } from './RatingDisplay';
import { ReviewCard } from './ReviewCard';
import { WriteReviewDialog } from './WriteReviewDialog';
import { useReviews } from '../hooks';

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
  const [writeOpen, setWriteOpen] = useState(false);

  const reviews = data?.pages.flatMap((p) => p.items) ?? [];
  const viewer = data?.pages[0]?.viewer;

  return (
    <section className="mt-12 border-t border-hairline pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-ink">Reviews</h2>
          <RatingDisplay avgRating={avgRating} reviewCount={reviewCount} />
        </div>
        {viewer?.canReview && (
          <button
            onClick={() => setWriteOpen(true)}
            className="border border-primary text-primary font-semibold rounded-full px-5 py-2.5"
          >
            Write a review
          </button>
        )}
        {viewer?.hasReviewed && (
          <span className="text-sm text-muted">You&rsquo;ve reviewed this listing</span>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p className="text-muted">
          No reviews yet. People who&rsquo;ve messaged the owner about this listing can leave one.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </div>
      )}

      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mt-4 text-primary font-semibold disabled:opacity-60"
        >
          {isFetchingNextPage ? 'Loading…' : 'Show more reviews'}
        </button>
      )}

      <WriteReviewDialog
        open={writeOpen}
        onClose={() => setWriteOpen(false)}
        listingId={listingId}
      />
    </section>
  );
}
