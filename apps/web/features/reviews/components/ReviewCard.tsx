import { RatingDisplay } from './RatingDisplay';
import type { Review } from '../api';

export function timeAgo(iso: string): string {
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
export function ReviewCard({ review }: { review: Review }) {
  return (
    <div className="bg-white border border-hairline rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3 mb-1">
        <span className="font-semibold text-ink truncate">
          {review.reviewer.fullName ?? 'GHOR user'}
        </span>
        <span className="text-xs text-muted shrink-0">{timeAgo(review.createdAt)}</span>
      </div>
      <RatingDisplay avgRating={review.rating} size="sm" />
      {review.comment && <p className="text-sm text-ink leading-6 mt-2">{review.comment}</p>}
    </div>
  );
}
