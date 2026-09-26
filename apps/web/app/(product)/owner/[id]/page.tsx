'use client';

import { useParams, useRouter } from 'next/navigation';
import { useOwner } from '@/features/owners/hooks';
import { describeLastActive, describeResponseTime } from '@/features/owners/api';
import { ListingCard } from '@/features/listings/components/ListingCard';
import { RatingDisplay } from '@/features/reviews/components/RatingDisplay';

// Root CLAUDE.md §2 "Owner profile page" — the Airbnb host-profile analog: identity,
// verification badges, reputation (aggregate of their listings' reviews), response
// behaviour, and their other approved listings.
export default function OwnerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: owner, isLoading, isError } = useOwner(id);

  if (isLoading) return <p className="text-muted text-center py-24">Loading…</p>;
  if (isError || !owner) {
    return <p className="text-muted text-center py-24">This profile isn&apos;t available.</p>;
  }

  const memberSince = new Date(owner.createdAt).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
  const responseTime = describeResponseTime(owner.responseTimeMinutes);
  const lastActive = describeLastActive(owner.lastActiveAt);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <button onClick={() => router.back()} className="text-muted text-sm font-semibold mb-6">
        ← Back
      </button>

      <div className="bg-white border border-hairline rounded-2xl p-6 mb-10 flex flex-col sm:flex-row gap-6">
        <div className="w-20 h-20 rounded-full bg-primary-light flex items-center justify-center shrink-0">
          <span className="text-primary text-3xl font-bold">
            {(owner.fullName ?? 'O')[0]!.toUpperCase()}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-ink">{owner.fullName ?? 'GHOR owner'}</h1>
          <p className="text-muted text-sm mb-3">
            Member since {memberSince}
            {lastActive && ` · ${lastActive}`}
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {owner.phoneVerified && (
              <span className="bg-success-pale text-success-deep text-xs font-bold rounded-full px-2.5 py-1">
                ✓ Phone Verified
              </span>
            )}
            {owner.idVerificationStatus === 'verified' && (
              <span className="bg-success-pale text-success-deep text-xs font-bold rounded-full px-2.5 py-1">
                ✓ ID Verified
              </span>
            )}
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <dt className="text-xs text-muted mb-1">Rating</dt>
              <dd>
                <RatingDisplay avgRating={owner.avgRating} reviewCount={owner.reviewCount} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted mb-1">Response rate</dt>
              <dd className="text-sm font-semibold text-ink">
                {owner.responseRate != null ? `${owner.responseRate}%` : '—'}
              </dd>
            </div>
            {responseTime && (
              <div className="col-span-2 sm:col-span-1">
                <dt className="text-xs text-muted mb-1">Response time</dt>
                <dd className="text-sm font-semibold text-ink">{responseTime}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <h2 className="text-xl font-semibold text-ink mb-4">
        Listings by {owner.fullName?.split(' ')[0] ?? 'this owner'}
      </h2>
      {owner.listings.length === 0 ? (
        <p className="text-muted">No live listings right now.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {owner.listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
