'use client';

import { useState } from 'react';
import { StarSelector } from './StarSelector';
import { useCreateReview } from '../hooks';
import { Dialog, useToast } from '@/components/ui/overlay';
import { buttonClass, cx, inputBase } from '@/components/ui';
import { friendlyError } from '@/lib/errors';

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
  const [ratingError, setRatingError] = useState(false);
  const createReview = useCreateReview(listingId);
  const toast = useToast();

  async function handleSubmit() {
    setError(null);
    if (rating < 1) {
      setRatingError(true);
      return;
    }
    try {
      await createReview.mutateAsync({ rating, comment: comment.trim() || undefined });
      setRating(0);
      setComment('');
      onClose();
      toast('Review posted. Thanks for helping other renters.');
    } catch (e: unknown) {
      setError(friendlyError(e, 'We couldn’t post your review. Please try again.'));
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Write a review"
      description="How was the place and the owner? Reviews are public and can’t be edited later."
      footer={
        <>
          <button type="button" onClick={onClose} className={buttonClass('ghost')}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={createReview.isPending} className={buttonClass('primary')}>
            {createReview.isPending ? 'Posting…' : 'Post review'}
          </button>
        </>
      }
    >
      <p className="text-sm font-semibold text-navy">Your rating</p>
      <div className="mt-1">
        <StarSelector
          value={rating}
          onChange={(n) => {
            setRating(n);
            setRatingError(false);
          }}
        />
      </div>
      {ratingError && <p className="mt-1 text-sm text-destructive-pressed">Choose between 1 and 5 stars.</p>}

      <label htmlFor="review-comment" className="mt-5 block text-sm font-semibold text-navy">
        Comment <span className="font-normal text-muted">(optional)</span>
      </label>
      <textarea
        id="review-comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Was it as described? Did the owner reply quickly?"
        maxLength={1000}
        rows={4}
        className={cx(inputBase, 'mt-2 resize-none py-3')}
      />
      <p className="mt-1 text-right text-xs text-muted">{comment.length}/1000</p>
      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-destructive-pale px-3 py-2.5 text-sm text-destructive-pressed">
          {error}
        </p>
      )}
    </Dialog>
  );
}
