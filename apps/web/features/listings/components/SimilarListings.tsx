'use client';

import { useSimilarListings } from '../hooks';
import { ListingCard } from './ListingCard';

// Horizontal card row at the bottom of listing detail (root CLAUDE.md §2). Renders
// nothing at all when there are no matches — an empty "Similar homes" header is noise.
export function SimilarListings({ listingId }: { listingId: string }) {
  const { data: listings } = useSimilarListings(listingId);
  if (!listings?.length) return null;

  return (
    <section className="mt-6 border-t border-navy/[0.08] pt-10">
      <h2 className="font-display text-[1.6rem] font-bold tracking-[-0.025em] text-navy">Similar homes nearby</h2>
      <p className="mt-1 text-muted">Same area, similar rent or near the same college.</p>
      <div className="no-scrollbar -mx-4 mt-6 flex snap-x gap-5 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} variant="rail" />
        ))}
      </div>
    </section>
  );
}
