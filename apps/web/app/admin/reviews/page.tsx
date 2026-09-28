'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAdminReviews, useSetReviewHidden } from '@/features/reviews/hooks';
import { RatingDisplay } from '@/features/reviews/components/RatingDisplay';

const FILTERS: { label: string; value: boolean | undefined }[] = [
  { label: 'Visible', value: false },
  { label: 'Hidden', value: true },
  { label: 'All', value: undefined },
];

// Reviews go live immediately (root CLAUDE.md §2) — this page is the after-the-fact lever:
// hide/unhide only. Hiding recomputes the listing's avgRating/reviewCount server-side.
export default function AdminReviewsPage() {
  const [hidden, setHidden] = useState<boolean | undefined>(false);
  const { data: reviews, isLoading, isError } = useAdminReviews(hidden);
  const setReviewHidden = useSetReviewHidden();

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-4">Reviews</h1>

      <div className="flex gap-2 mb-6">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => setHidden(f.value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              hidden === f.value ? 'bg-primary text-white' : 'bg-white text-ink'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : isError ? (
        <p className="text-muted">Couldn&apos;t load reviews.</p>
      ) : reviews && reviews.length > 0 ? (
        <div className="flex flex-col gap-3">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white rounded-2xl p-4 shadow-card">
              <div className="flex items-center justify-between mb-2">
                <RatingDisplay avgRating={review.rating} size="sm" />
                <span className="text-muted-soft text-xs">
                  {new Date(review.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <Link
                href={`/listing/${review.listing.id}`}
                className="text-ink font-semibold mb-1 block hover:underline"
              >
                {review.listing.title}
              </Link>
              {review.comment ? (
                <p className="text-ink text-sm mb-3">{review.comment}</p>
              ) : (
                <p className="text-muted-soft text-sm italic mb-3">No comment</p>
              )}
              <div className="flex items-center justify-between">
                <p className="text-muted-soft text-xs">
                  By {review.reviewer.fullName ?? 'GHOR user'}
                  {review.hidden && ' · hidden'}
                </p>
                <button
                  onClick={() => setReviewHidden.mutate({ id: review.id, hidden: !review.hidden })}
                  disabled={setReviewHidden.isPending}
                  className={`text-sm font-semibold rounded-full px-4 py-2 disabled:opacity-60 ${
                    review.hidden
                      ? 'border border-hairline text-ink'
                      : 'bg-destructive-pressed text-white'
                  }`}
                >
                  {review.hidden ? 'Unhide' : 'Hide'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted">No reviews here.</p>
      )}
    </div>
  );
}
