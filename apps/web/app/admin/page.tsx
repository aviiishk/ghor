'use client';

import { useState } from 'react';
import { usePendingListings, useBulkSetListingStatus } from '@/features/admin/hooks';

export default function AdminListingsQueuePage() {
  const { data: listings, isLoading, isError } = usePendingListings();
  const bulkSet = useBulkSetListingStatus();
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleBulk(status: 'approved' | 'rejected') {
    if (selected.length === 0) return;
    await bulkSet.mutateAsync({ ids: selected, status });
    setSelected([]);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-6">Listings Queue</h1>

      {selected.length > 0 && (
        <div className="flex items-center gap-3 bg-white border border-hairline rounded-2xl px-4 py-3 mb-4">
          <span className="text-sm text-muted">{selected.length} selected</span>
          <button
            onClick={() => handleBulk('approved')}
            className="bg-success-deep text-white text-sm font-semibold rounded-full px-4 py-1.5"
          >
            Approve
          </button>
          <button
            onClick={() => handleBulk('rejected')}
            className="bg-destructive-pressed text-white text-sm font-semibold rounded-full px-4 py-1.5"
          >
            Reject
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : isError ? (
        <p className="text-muted">Couldn&apos;t load the queue.</p>
      ) : listings && listings.length > 0 ? (
        <div className="flex flex-col gap-3">
          {listings.map((listing) => (
            <div key={listing.id} className="flex items-center gap-4 bg-white rounded-2xl p-4 shadow-card">
              <input
                type="checkbox"
                checked={selected.includes(listing.id)}
                onChange={() => toggle(listing.id)}
                className="w-4 h-4"
              />
              <div className="w-16 h-16 rounded-xl bg-surface overflow-hidden shrink-0">
                {listing.images[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={listing.images[0].cloudinaryUrl} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-ink font-semibold truncate">{listing.title}</p>
                <p className="text-muted text-sm truncate">
                  {listing.locality}, {listing.city} · ₹{listing.rent.toLocaleString('en-IN')}/mo
                </p>
                <p className="text-muted-soft text-xs">
                  By {listing.owner.fullName ?? 'Owner'} · {listing.images.length} photos
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => bulkSet.mutate({ ids: [listing.id], status: 'approved' })}
                  className="bg-success-deep text-white text-sm font-semibold rounded-full px-4 py-2"
                >
                  Approve
                </button>
                <button
                  onClick={() => bulkSet.mutate({ ids: [listing.id], status: 'rejected' })}
                  className="border border-destructive-pressed text-destructive-pressed text-sm font-semibold rounded-full px-4 py-2"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted">Nothing waiting for review.</p>
      )}
    </div>
  );
}
