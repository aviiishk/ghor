'use client';

import { useSimilarListings } from '../hooks';
import { ListingCard } from './ListingCard';

// Horizontal card row at the bottom of listing detail (root CLAUDE.md §2). Renders
// nothing at all when there are no matches — an empty "Similar listings" header is noise.
export function SimilarListings({ listingId }: { listingId: string }) {
  const { data: listings } = useSimilarListings(listingId);
  if (!listings?.length) return null;

  return (
    <section className="mt-12 border-t border-hairline pt-8">
      <h2 className="text-xl font-semibold text-ink mb-5">Similar listings</h2>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x">
        {listings.map((listing) => (
          <div key={listing.id} className="w-72 shrink-0 snap-start">
            <ListingCard listing={listing} />
          </div>
        ))}
      </div>
    </section>
  );
}
