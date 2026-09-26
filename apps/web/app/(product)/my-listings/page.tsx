'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BarChart3, Camera, Home, MapPin, Pencil, Plus } from 'lucide-react';
import { useMyListings, useUpdateListing } from '@/features/listings/hooks';
import type { Listing } from '@/features/listings/api';
import { RatingDisplay } from '@/features/reviews/components/RatingDisplay';
import { EmptyState, Skeleton, StatusBadge, formatRent, type ListingStatus } from '@/components/ui';

// Owner dashboard (redesign 2026-09-26) — not an admin table. Status is the first thing
// an owner scans for, so it's a summary strip (doubling as filters) plus a badge on every
// card's photo, and each card carries the action that status calls for.
const STATUS_ORDER: ListingStatus[] = ['approved', 'pending', 'rejected', 'draft', 'rented'];
const STATUS_LABEL: Record<ListingStatus, string> = {
  approved: 'Live',
  pending: 'In review',
  rejected: 'Needs changes',
  draft: 'Drafts',
  rented: 'Rented',
};
const STATUS_HINT: Record<ListingStatus, string> = {
  approved: 'Visible to renters',
  pending: 'We’re reviewing it — usually within a day',
  rejected: 'Edit it, then resubmit for review',
  draft: 'Only you can see this',
  rented: 'Hidden from search',
};

function OwnerListingCard({ listing }: { listing: Listing }) {
  const update = useUpdateListing(listing.id);
  const [error, setError] = useState<string | null>(null);
  const photo = listing.images[0]?.cloudinaryUrl;

  async function setStatus(status: 'pending' | 'approved' | 'rented') {
    setError(null);
    try {
      await update.mutateAsync({ status });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    }
  }

  const primary =
    listing.status === 'draft' ? { label: 'Submit for review', to: 'pending' as const } :
    listing.status === 'rejected' ? { label: 'Resubmit', to: 'pending' as const } :
    listing.status === 'approved' ? { label: 'Mark rented', to: 'rented' as const } :
    listing.status === 'rented' ? { label: 'Mark available', to: 'approved' as const } :
    null;

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-navy/[0.06] sm:flex-row">
      <Link href={`/listing/${listing.id}`} className="group relative block aspect-[16/10] shrink-0 overflow-hidden bg-surface-sunken sm:aspect-auto sm:w-64">
        {photo ? (
          <Image src={photo} alt={listing.title} fill sizes="(min-width: 640px) 256px, 100vw" className={`object-cover transition-transform duration-700 group-hover:scale-105 ${listing.status === 'rented' ? 'grayscale' : ''}`} />
        ) : (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-1 text-sm text-muted">
            <Camera size={22} aria-hidden /> No photos yet
          </div>
        )}
        <span className="absolute left-3 top-3"><StatusBadge status={listing.status} /></span>
      </Link>

      <div className="flex min-w-0 flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/listing/${listing.id}`} className="line-clamp-1 font-display text-lg font-bold text-ink hover:underline">{listing.title}</Link>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted"><MapPin size={14} aria-hidden /> {listing.locality}</p>
          </div>
          <p className="shrink-0 font-display text-lg font-bold text-ink">
            {formatRent(listing.rent)}<span className="text-xs font-medium text-muted">/mo</span>
          </p>
        </div>

        <p className="mt-2 text-sm text-body">{STATUS_HINT[listing.status]}</p>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1"><Camera size={13} aria-hidden /> {listing.images.length} photo{listing.images.length === 1 ? '' : 's'}</span>
          <RatingDisplay avgRating={listing.avgRating} reviewCount={listing.reviewCount} size="sm" />
        </div>

        {error && <p role="alert" className="mt-3 rounded-xl bg-destructive-pale px-3 py-2 text-sm text-destructive-pressed">{error}</p>}

        <div className="mt-auto flex flex-wrap gap-2 pt-4">
          {primary && (
            <button onClick={() => setStatus(primary.to)} disabled={update.isPending} className={`press h-10 rounded-full px-4 text-sm font-bold text-white disabled:opacity-60 ${primary.to === 'rented' ? 'bg-navy hover:bg-navy-soft' : 'bg-primary hover:bg-primary-pressed'}`}>
              {update.isPending ? 'Updating…' : primary.label}
            </button>
          )}
          <Link href={`/listing/${listing.id}/edit`} className="press inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-ink ring-1 ring-hairline hover:ring-ink/30">
            <Pencil size={15} aria-hidden /> Edit
          </Link>
          {listing.status !== 'draft' && (
            <Link href={`/listing/${listing.id}#insights`} className="press inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-ink ring-1 ring-hairline hover:ring-ink/30">
              <BarChart3 size={15} aria-hidden /> Insights
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export default function MyListingsPage() {
  const { data: listings, isLoading, isError, refetch } = useMyListings();
  const [filter, setFilter] = useState<ListingStatus | 'all'>('all');

  const counts = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = listings?.filter((l) => l.status === s).length ?? 0;
    return acc;
  }, {});
  const shown = (listings ?? []).filter((l) => filter === 'all' || l.status === filter);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">My listings</h1>
          <p className="mt-1 text-muted">Manage your rooms and flats, and see how they&apos;re doing.</p>
        </div>
        <Link href="/listing/new" className="press inline-flex h-12 items-center gap-2 rounded-full bg-primary px-5 font-bold text-white hover:bg-primary-pressed">
          <Plus size={18} aria-hidden /> New listing
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-8 space-y-4">
          <Skeleton className="h-20 rounded-3xl" />
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-44 rounded-3xl" />)}
        </div>
      ) : isError ? (
        <EmptyState icon={Home} title="Couldn’t load your listings" body="Check your connection and try again." action={{ label: 'Try again', onClick: () => refetch() }} />
      ) : !listings?.length ? (
        <EmptyState
          icon={Home}
          title="Your first listing starts here"
          body="Add a room or flat in a few minutes. It’s free to list, and every listing is reviewed before renters see it."
          action={{ label: 'List a property', href: '/listing/new' }}
        />
      ) : (
        <>
          {/* Status summary — doubles as filter tabs. */}
          <div className="-mx-4 mt-8 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-6 sm:px-0">
            {(['all', ...STATUS_ORDER] as const).map((s) => {
              const active = filter === s;
              const n = s === 'all' ? listings.length : counts[s];
              return (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  aria-pressed={active}
                  className={`press min-w-[110px] shrink-0 rounded-2xl p-4 text-left ring-1 transition ${active ? 'bg-navy text-white ring-navy' : 'bg-white text-ink ring-navy/[0.06] hover:ring-navy/20'}`}
                >
                  <span className="block font-display text-2xl font-bold">{n}</span>
                  <span className={`block text-xs font-semibold ${active ? 'text-white/75' : 'text-muted'}`}>{s === 'all' ? 'All' : STATUS_LABEL[s]}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 space-y-4">
            {shown.length ? (
              shown.map((l) => <OwnerListingCard key={l.id} listing={l} />)
            ) : (
              <EmptyState compact icon={Home} title={`No ${filter === 'all' ? '' : STATUS_LABEL[filter as ListingStatus].toLowerCase()} listings`} body="Nothing in this group right now." />
            )}
          </div>
        </>
      )}
    </div>
  );
}
