import Link from 'next/link';
import type { Listing } from '../api';
import { RatingDisplay } from '@/features/reviews/components/RatingDisplay';
import { amenityLabel } from '../amenities';

// DESIGN.md's `listing-card`, ported for a grid layout (see app/(product)/browse/page.tsx
// for the multi-column-grid decision) instead of apps/mobile's forced single-column feed.
export function ListingCard({ listing }: { listing: Listing }) {
  const photo = listing.images[0]?.cloudinaryUrl;
  const amenities = Object.entries(listing.amenities ?? {})
    .filter(([, on]) => on)
    .map(([key]) => key)
    .slice(0, 3);

  return (
    <Link
      href={`/listing/${listing.id}`}
      className="block bg-white rounded-2xl overflow-hidden shadow-card hover:shadow-sheet transition-shadow"
    >
      <div className="aspect-[4/3] bg-surface">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={listing.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-muted-soft text-xs">No photo yet</span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-lg font-semibold text-ink truncate">{listing.title}</h3>
        <p className="text-muted text-sm mb-2 truncate">
          {listing.locality}, {listing.city}
        </p>

        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-xl font-bold text-ink">
            ₹{listing.rent.toLocaleString('en-IN')}
            <span className="text-sm font-medium text-muted">/mo</span>
          </p>
          <RatingDisplay avgRating={listing.avgRating} reviewCount={listing.reviewCount} size="sm" />
        </div>

        {amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {amenities.map((key) => (
              <span
                key={key}
                className="bg-primary-light text-primary text-xs font-bold rounded-full px-2.5 py-1"
              >
                {amenityLabel(key)}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center">
          <span className="text-muted text-xs truncate">{listing.owner.fullName ?? 'Owner'}</span>
          {listing.owner.phoneVerified && (
            <span className="text-success-deep text-xs font-bold ml-1.5">
              <span className="text-muted font-normal">·</span> Phone Verified
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
