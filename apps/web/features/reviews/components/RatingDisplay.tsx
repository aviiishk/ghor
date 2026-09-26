import { Star } from 'lucide-react';

// DESIGN.md `rating-display` + `new-listing-badge`: an ink (never gold) star, the number
// at body-strong, the count muted — deliberately quiet next to the rent. Listings with no
// visible reviews get the "New" badge instead; never a fabricated 0.0.
export function RatingDisplay({
  avgRating,
  reviewCount,
  size = 'md',
}: {
  avgRating: number | null;
  reviewCount?: number;
  size?: 'sm' | 'md';
}) {
  const text = size === 'sm' ? 'text-xs' : 'text-sm';
  if (avgRating == null) {
    return (
      <span className={`bg-surface text-muted ${text} font-semibold rounded-full px-2.5 py-1`}>
        New
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 ${text}`}>
      <Star size={size === 'sm' ? 12 : 14} className="fill-ink text-ink" aria-hidden />
      <span className="font-semibold text-ink">{avgRating.toFixed(1)}</span>
      {reviewCount != null && <span className="text-muted">({reviewCount})</span>}
      <span className="sr-only">
        out of 5{reviewCount != null ? `, ${reviewCount} reviews` : ''}
      </span>
    </span>
  );
}
