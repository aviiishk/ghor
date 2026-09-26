'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useListing, useUpdateListing } from '@/features/listings/hooks';
import { useCreateConversation } from '@/features/chat/hooks';
import { useProfile } from '@/features/auth/hooks';
import { ReportDialog } from '@/features/reports/components/ReportDialog';
import { RatingDisplay } from '@/features/reviews/components/RatingDisplay';
import { ReviewsSection } from '@/features/reviews/components/ReviewsSection';
import { SimilarListings } from '@/features/listings/components/SimilarListings';
import { ListingInsights } from '@/features/listings/components/ListingInsights';
import { useOwner } from '@/features/owners/hooks';
import { describeResponseTime } from '@/features/owners/api';
import { trackEvent } from '@/lib/analytics';
import { amenityLabel } from '@/features/listings/amenities';

export default function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: listing, isLoading, isError } = useListing(id);
  const { data: profile } = useProfile();
  const updateListing = useUpdateListing(id);
  const createConversation = useCreateConversation();
  const [activeImage, setActiveImage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  // Hooks must run before the early returns below, so this keys off listing?.ownerId.
  const { data: owner } = useOwner(listing?.ownerId);

  if (isLoading) return <p className="text-muted text-center py-24">Loading…</p>;
  if (isError || !listing) {
    return <p className="text-muted text-center py-24">This listing isn&apos;t available anymore.</p>;
  }

  const isOwner = profile?.id === listing.ownerId;
  const amenities = Object.entries(listing.amenities ?? {})
    .filter(([, on]) => on)
    .map(([key]) => key);

  async function handleStatusChange(status: 'pending' | 'approved' | 'rented') {
    setError(null);
    try {
      await updateListing.mutateAsync({ status });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
  }

  async function handleChat() {
    // The core conversion event (root CLAUDE.md §4) — counted on tap, before the
    // conversation request, so a failed request still shows up as intent.
    trackEvent({ eventName: 'contact_tap', listingId: listing!.id, channel: 'chat' });
    setError(null);
    try {
      // Non-null: same closure-narrowing gap as handleCall below — this only ever runs
      // after the `!listing` guard above has already returned early.
      const conversation = await createConversation.mutateAsync(listing!.id);
      router.push(`/chat/${conversation.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not start the conversation');
    }
  }

  function handleCall() {
    // Non-null: this closure only ever runs after the `!listing` guard above has already
    // returned early, but TS can't see that narrowing across a closure boundary — same
    // gap apps/mobile's listing/[id].tsx hit and fixed the same way.
    const phone = listing!.owner.phone;
    trackEvent({ eventName: 'contact_tap', listingId: listing!.id, channel: 'call' });
    if (!phone) {
      alert("This owner hasn't added a phone number yet.");
      return;
    }
    window.location.href = `tel:${phone}`;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <button onClick={() => router.back()} className="text-muted text-sm font-semibold mb-4">
        ← Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8">
        <div>
          <div className="aspect-[4/3] bg-surface rounded-2xl overflow-hidden mb-3">
            {listing.images.length > 0 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={listing.images[activeImage].cloudinaryUrl}
                alt={listing.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-soft">
                No photos yet
              </div>
            )}
          </div>
          {listing.images.length > 1 && (
            <div className="flex gap-2">
              {listing.images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImage(i)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 ${
                    i === activeImage ? 'border-primary' : 'border-transparent'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.cloudinaryUrl} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-bold text-ink mb-1">{listing.title}</h1>
          <p className="text-muted mb-2">
            {listing.locality}, {listing.city}
          </p>
          <div className="mb-3">
            <RatingDisplay avgRating={listing.avgRating} reviewCount={listing.reviewCount} />
          </div>
          <p className="text-3xl font-bold text-ink mb-4">
            ₹{listing.rent.toLocaleString('en-IN')}
            <span className="text-base font-medium text-muted">/mo</span>
          </p>
          {listing.deposit != null && (
            <p className="text-muted mb-4">Deposit: ₹{listing.deposit.toLocaleString('en-IN')}</p>
          )}

          {amenities.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {amenities.map((key) => (
                <span
                  key={key}
                  className="bg-primary-light text-primary text-xs font-bold rounded-full px-3 py-1.5"
                >
                  {amenityLabel(key)}
                </span>
              ))}
            </div>
          )}

          {listing.institutions.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {listing.institutions.map((tag) => (
                <span
                  key={tag.institution.id}
                  className="bg-primary-light text-primary text-xs font-bold rounded-full px-3 py-1.5"
                >
                  Near {tag.institution.name}
                </span>
              ))}
            </div>
          )}

          {listing.description && <p className="text-ink leading-6 mb-5">{listing.description}</p>}

          <div className="border-t border-hairline pt-4 mb-6">
            <p className="text-sm text-muted mb-1">Listed by</p>
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="flex items-center">
                  <Link
                    href={`/owner/${listing.ownerId}`}
                    className="text-ink font-semibold hover:underline"
                  >
                    {listing.owner.fullName ?? 'Owner'}
                  </Link>
                  {listing.owner.phoneVerified && (
                    <span className="text-success-deep text-xs font-bold ml-2">✓ Phone Verified</span>
                  )}
                </div>
                {describeResponseTime(owner?.responseTimeMinutes ?? null) && (
                  <p className="text-xs text-muted mt-0.5">
                    {describeResponseTime(owner?.responseTimeMinutes ?? null)}
                  </p>
                )}
              </div>
              {!isOwner && (
                <button
                  onClick={() => setReportOpen(true)}
                  className="text-muted-soft text-xs font-semibold hover:text-destructive"
                >
                  Report
                </button>
              )}
            </div>
          </div>

          {error && <p className="text-destructive text-sm mb-3">{error}</p>}

          {isOwner ? (
            <div>
              <button
                onClick={() => router.push(`/listing/${listing.id}/edit`)}
                className="w-full border border-hairline text-ink font-semibold rounded-full py-4 mb-3"
              >
                Edit Details
              </button>
              {listing.status === 'draft' && (
                <button
                  onClick={() => handleStatusChange('pending')}
                  disabled={updateListing.isPending}
                  className="w-full bg-primary text-white font-semibold rounded-full py-4 disabled:opacity-70"
                >
                  Submit for Review
                </button>
              )}
              {listing.status === 'pending' && (
                <p className="text-muted text-center py-3">Waiting for approval</p>
              )}
              {listing.status === 'rejected' && (
                <div>
                  <p className="text-destructive text-center text-sm mb-3">
                    This listing was rejected. Fix it with Edit Details, then resubmit.
                  </p>
                  <button
                    onClick={() => handleStatusChange('pending')}
                    disabled={updateListing.isPending}
                    className="w-full bg-primary text-white font-semibold rounded-full py-4 disabled:opacity-70"
                  >
                    Resubmit for Review
                  </button>
                </div>
              )}
              {listing.status === 'approved' && (
                <button
                  onClick={() => handleStatusChange('rented')}
                  disabled={updateListing.isPending}
                  className="w-full border border-hairline text-ink font-semibold rounded-full py-4 disabled:opacity-70"
                >
                  Mark as Rented
                </button>
              )}
              {listing.status === 'rented' && (
                <button
                  onClick={() => handleStatusChange('approved')}
                  disabled={updateListing.isPending}
                  className="w-full bg-primary text-white font-semibold rounded-full py-4 disabled:opacity-70"
                >
                  Mark as Available
                </button>
              )}
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={handleCall}
                className="flex-1 border border-hairline text-ink font-semibold rounded-full py-4"
              >
                Call
              </button>
              <button
                onClick={handleChat}
                className="flex-1 bg-primary text-white font-semibold rounded-full py-4"
              >
                Chat with Owner
              </button>
            </div>
          )}
        </div>
      </div>

      <ReviewsSection
        listingId={listing.id}
        avgRating={listing.avgRating}
        reviewCount={listing.reviewCount}
      />

      {/* Owner-only: their listing's stats, instead of "similar listings" to their own. */}
      {isOwner ? <ListingInsights listingId={listing.id} /> : <SimilarListings listingId={listing.id} />}

      <ReportDialog open={reportOpen} onClose={() => setReportOpen(false)} listingId={listing.id} />
    </div>
  );
}
