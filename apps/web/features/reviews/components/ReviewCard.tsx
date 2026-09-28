import { RatingDisplay } from './RatingDisplay';
import { Avatar } from '@/components/ui';
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
    <div className="rounded-2xl bg-white p-5 ring-1 ring-inset ring-navy/[0.08]">
      <div className="flex items-center gap-3">
        <Avatar name={review.reviewer.fullName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{review.reviewer.fullName ?? 'GHOR user'}</p>
          <p className="text-xs text-muted">{timeAgo(review.createdAt)}</p>
        </div>
        <RatingDisplay avgRating={review.rating} size="sm" />
      </div>
      {review.comment && <p className="mt-3 text-[15px] leading-6 text-body">{review.comment}</p>}
    </div>
  );
}
