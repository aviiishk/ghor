'use client';

import Link from 'next/link';
import { useMyListings } from '@/features/listings/hooks';
import { StatusPill } from '@/features/listings/components/StatusPill';

// Owner-only page (root CLAUDE.md's role-conditional decision) — reachable regardless of
// role, but only linked from TopNav for role="owner", same pattern as apps/mobile's
// href-null tab hiding.
export default function MyListingsPage() {
  const { data: listings, isLoading, isError } = useMyListings();

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-ink">My Listings</h1>
        <Link
          href="/listing/new"
          className="bg-primary text-white text-sm font-semibold rounded-full px-5 py-2.5"
        >
          + New Listing
        </Link>
      </div>

      {isLoading ? (
        <p className="text-muted text-center py-20">Loading…</p>
      ) : isError ? (
        <p className="text-muted text-center py-20">Couldn&apos;t load your listings.</p>
      ) : listings && listings.length > 0 ? (
        <div className="flex flex-col gap-3">
          {listings.map((listing) => (
            <Link
              key={listing.id}
              href={`/listing/${listing.id}`}
              className="flex items-center bg-white rounded-2xl p-3 shadow-card hover:shadow-sheet transition-shadow"
            >
              <div className="w-16 h-16 rounded-xl bg-surface overflow-hidden mr-4 shrink-0">
                {listing.images[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={listing.images[0].cloudinaryUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-ink font-semibold truncate">{listing.title}</p>
                <p className="text-muted text-sm mb-2 truncate">
                  {listing.locality} · ₹{listing.rent.toLocaleString('en-IN')}/mo
                </p>
                <StatusPill status={listing.status} />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-muted mb-4">You haven&apos;t listed a property yet.</p>
          <Link
            href="/listing/new"
            className="inline-block bg-primary text-white font-semibold rounded-full px-6 py-3"
          >
            List a Property
          </Link>
        </div>
      )}
    </div>
  );
}
