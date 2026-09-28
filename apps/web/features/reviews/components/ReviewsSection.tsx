'use client';

import { useState } from 'react';
import { RatingDisplay } from './RatingDisplay';
import { ReviewCard } from './ReviewCard';
import { WriteReviewDialog } from './WriteReviewDialog';
import { useReviews } from '../hooks';
import { Skeleton, buttonClass } from '@/components/ui';
import { Star } from 'lucide-react';

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
    <section id="reviews" className="scroll-mt-24 border-t border-navy/[0.08] py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-[1.6rem] font-bold tracking-[-0.025em] text-navy">Reviews</h2>
          {avgRating != null && <RatingDisplay avgRating={avgRating} reviewCount={reviewCount} />}
        </div>
        {viewer?.canReview && (
          <button
            onClick={() => setWriteOpen(true)}
            className={buttonClass('secondary')}
          >
            Write a review
          </button>
        )}
        {viewer?.hasReviewed && (
          <span className="text-sm text-muted">You&rsquo;ve reviewed this listing</span>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2" aria-busy="true">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="flex items-start gap-4 rounded-2xl bg-white p-5 ring-1 ring-inset ring-navy/[0.08]">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cream-deep text-navy">
            <Star size={20} aria-hidden />
          </span>
          <p className="text-[15px] leading-6 text-body">
            <strong className="block font-semibold text-ink">No reviews yet</strong>
            Only people who&rsquo;ve messaged the owner about this listing can review it, so every review comes from a real enquiry.
          </p>
        </div>
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
