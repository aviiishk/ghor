'use client';

import { useState } from 'react';
import { StarSelector } from './StarSelector';
import { useCreateReview } from '../hooks';

// Only rendered when the server says viewer.canReview (see ReviewsSection) — the API
// enforces the same gate independently, this just avoids offering a button that 403s.
export function WriteReviewDialog({
  open,
  onClose,
  listingId,
}: {
  open: boolean;
  onClose: () => void;
  listingId: string;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createReview = useCreateReview(listingId);

  if (!open) return null;

  async function handleSubmit() {
    setError(null);
    if (rating < 1) {
      setError('Pick a star rating.');
      return;
    }
    try {
      await createReview.mutateAsync({ rating, comment: comment.trim() || undefined });
      setRating(0);
      setComment('');
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-lg font-bold text-ink mb-1">Write a review</h2>
        <p className="text-muted text-sm mb-4">
          How was this listing and its owner? Reviews are public and can&rsquo;t be edited later.
        </p>

        {error && (
          <div className="bg-destructive-pale text-destructive-pressed rounded-xl px-3 py-2 mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="mb-4">
          <StarSelector value={rating} onChange={setRating} />
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Was it as described? Was the owner responsive? (optional)"
          maxLength={1000}
          rows={4}
          className="w-full border border-hairline rounded-2xl px-4 py-3 text-ink mb-4"
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={createReview.isPending}
          className="w-full bg-primary text-white font-semibold rounded-full py-3.5 mb-2 disabled:opacity-70"
        >
          {createReview.isPending ? 'Posting…' : 'Post review'}
        </button>
        <button type="button" onClick={onClose} className="w-full text-muted font-semibold py-2.5">
          Cancel
        </button>
      </div>
    </div>
  );
}
