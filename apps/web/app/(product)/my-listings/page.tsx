'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BarChart3, Eye, Home, Images, MapPin, MessageCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { useDeleteListing, useListingInsights, useMyListings, useUpdateListing } from '@/features/listings/hooks';
import type { Listing } from '@/features/listings/api';
import { RatingDisplay } from '@/features/reviews/components/RatingDisplay';
import { friendlyError } from '@/lib/errors';
import { Dialog, useToast } from '@/components/ui/overlay';
import {
  Button,
  ButtonLink,
  EmptyState,
  PageHeader,
  Skeleton,
  StatusBadge,
  buttonClass,
  cx,
  formatRent,
  type ListingStatus,
} from '@/components/ui';

// Owner inventory, redesign v2 (2026-09-27) — property management, not a CRUD table.
// Status tabs with counts, photo-led cards, real per-listing numbers from the insights
// endpoint (never estimated), and the one action each status calls for.
const STATUS_ORDER: ListingStatus[] = ['approved', 'pending', 'rejected', 'draft', 'rented'];
const STATUS_LABEL: Record<ListingStatus, string> = {
  approved: 'Live',
  pending: 'In review',
  rejected: 'Needs changes',
  draft: 'Drafts',
  rented: 'Rented',
};
const STATUS_HINT: Record<ListingStatus, string> = {
  approved: 'Visible to renters in search',
  pending: 'GHOR is reviewing it — usually within a day',
  rejected: 'GHOR couldn’t approve this version. Check the photos and details, edit, then resubmit',
  draft: 'Only you can see this',
  rented: 'Hidden from search',
};

const STATUS_DONE: Record<string, string> = {
  pending: 'Submitted for review — we’ll notify you when it’s live.',
  rented: 'Marked as rented. It’s hidden from search.',
  approved: 'Listed again. Renters can find it now.',
};

function OwnerListingCard({ listing }: { listing: Listing }) {
  const update = useUpdateListing(listing.id);
  const remove = useDeleteListing();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function deleteDraft() {
    try {
      await remove.mutateAsync(listing.id);
      setConfirmDelete(false);
      toast('Draft deleted');
    } catch (e: unknown) {
      setConfirmDelete(false);
      setError(friendlyError(e, 'We couldn’t delete this draft. Please try again.'));
    }
  }
  const [error, setError] = useState<string | null>(null);
  const hasStats = listing.status !== 'draft';
  const { data: insights } = useListingInsights(listing.id, hasStats);
  const photo = listing.images[0]?.cloudinaryUrl;

  async function setStatus(status: 'pending' | 'approved' | 'rented') {
    setError(null);
    try {
      await update.mutateAsync({ status });
      toast(STATUS_DONE[status] ?? 'Listing updated');
    } catch (e: unknown) {
      setError(friendlyError(e, 'We couldn’t update this listing. Please try again.'));
    }
  }

  // Publishing needs 3+ photos: a draft short of that gets "Add photos" (Edit page) instead
  // of a Submit button that can only fail.
  const draftBlocked = listing.status === 'draft' && listing.images.length < 3;
  const primary =
    listing.status === 'draft' ? (draftBlocked ? null : { label: 'Submit for review', to: 'pending' as const, variant: 'primary' as const }) :
    listing.status === 'rejected' ? { label: 'Resubmit', to: 'pending' as const, variant: 'primary' as const } :
    listing.status === 'approved' ? { label: 'Mark as rented', to: 'rented' as const, variant: 'navy' as const } :
    listing.status === 'rented' ? { label: 'Relist', to: 'approved' as const, variant: 'primary' as const } :
    null;

  return (
    <article
      className={cx(
        'group grid overflow-hidden rounded-2xl bg-white ring-1 ring-inset sm:grid-cols-[280px_minmax(0,1fr)]',
        listing.status === 'rejected' ? 'ring-destructive/30' : 'ring-navy/[0.08]',
      )}
    >
      <Link href={`/listing/${listing.id}`} className="relative block aspect-[16/10] overflow-hidden bg-cream-deep sm:aspect-auto sm:min-h-[210px]">
        {photo ? (
          <Image
            src={photo}
            alt={listing.title}
            fill
            sizes="(min-width: 640px) 280px, 100vw"
            className={cx('object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]', listing.status === 'rented' && 'grayscale')}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1.5 text-sm font-medium text-muted">
            <Images size={22} aria-hidden /> No photos yet
          </div>
        )}
        <span className="absolute left-3 top-3"><StatusBadge status={listing.status} /></span>
        {listing.images.length > 0 && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-navy/70 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
            <Images size={12} aria-hidden /> {listing.images.length}
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link href={`/listing/${listing.id}`} className="line-clamp-1 font-display text-xl font-bold tracking-tight text-navy hover:underline">
              {listing.title}
            </Link>
            <p className="mt-1 flex items-center gap-1 text-sm text-muted">
              <MapPin size={14} className="text-primary" aria-hidden /> {listing.locality}, {listing.city}
            </p>
          </div>
          <p className="shrink-0 text-right font-display leading-none text-navy">
            <span className="text-xl font-bold">{formatRent(listing.rent)}</span>
            <span className="block pt-1 text-xs font-medium text-muted">per month</span>
          </p>
        </div>

        <p className={cx('mt-3 text-sm', listing.status === 'rejected' ? 'font-semibold text-destructive-pressed' : 'text-body')}>
          {draftBlocked
            ? `Add ${3 - listing.images.length} more photo${3 - listing.images.length === 1 ? '' : 's'} to submit this for review (it has ${listing.images.length}).`
            : STATUS_HINT[listing.status]}
        </p>

        {hasStats && (
          <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5">
              <Eye size={15} className="text-muted" aria-hidden />
              <dt className="sr-only">Views</dt>
              <dd><strong className="text-navy">{insights ? insights.totals.views : '—'}</strong> <span className="text-muted">{insights?.totals.views === 1 ? 'view' : 'views'}</span></dd>
            </div>
            <div className="flex items-center gap-1.5">
              <MessageCircle size={15} className="text-muted" aria-hidden />
              <dt className="sr-only">Enquiries</dt>
              <dd><strong className="text-navy">{insights ? insights.totals.inquiries : '—'}</strong> <span className="text-muted">{insights?.totals.inquiries === 1 ? 'enquiry' : 'enquiries'}</span></dd>
            </div>
            <div className="flex items-center"><RatingDisplay avgRating={listing.avgRating} reviewCount={listing.reviewCount} size="sm" /></div>
          </dl>
        )}

        {error && <p role="alert" className="mt-3 rounded-xl bg-destructive-pale px-3 py-2 text-sm text-destructive-pressed">{error}</p>}

        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          {draftBlocked && (
            <Link href={`/listing/${listing.id}/edit`} className={buttonClass('primary', 'sm')}>
              <Images size={15} aria-hidden /> Add photos
            </Link>
          )}
          {primary && (
            <Button size="sm" variant={primary.variant} onClick={() => setStatus(primary.to)} disabled={update.isPending}>
              {update.isPending ? 'Updating…' : primary.label}
            </Button>
          )}
          <Link href={`/listing/${listing.id}/edit`} className={buttonClass('secondary', 'sm')}>
            <Pencil size={15} aria-hidden /> Edit
          </Link>
          <Link href={`/listing/${listing.id}`} className={buttonClass('ghost', 'sm')}>
            <Eye size={15} aria-hidden /> {listing.status === 'approved' ? 'View' : 'Preview'}
          </Link>
          {hasStats && (
            <Link href={`/listing/${listing.id}#insights`} className={buttonClass('ghost', 'sm')}>
              <BarChart3 size={15} aria-hidden /> Insights
            </Link>
          )}
          {listing.status === 'draft' && (
            <button onClick={() => setConfirmDelete(true)} className={cx(buttonClass('ghost', 'sm'), 'ml-auto !text-muted hover:!text-destructive-pressed')}>
              <Trash2 size={15} aria-hidden /> Delete draft
            </button>
          )}
        </div>
      </div>
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        dismissible={!remove.isPending}
        variant="modal"
        size="sm"
        title="Delete this draft?"
        description={`“${listing.title}” will be removed. Drafts were never visible to renters, so nobody else is affected.`}
        footer={
          <>
            <button onClick={() => setConfirmDelete(false)} disabled={remove.isPending} className={buttonClass('ghost')}>Keep it</button>
            <button onClick={deleteDraft} disabled={remove.isPending} className={buttonClass('destructive')}>
              {remove.isPending ? 'Deleting…' : 'Delete draft'}
            </button>
          </>
        }
      />
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
  const needsAction = counts.rejected! + counts.draft!;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 sm:pt-12 lg:px-8">
      <PageHeader
        kicker="Your homes"
        title="My listings"
        meta={
          listings?.length
            ? `${counts.approved} live${counts.pending ? ` · ${counts.pending} in review` : ''}${needsAction ? ` · ${needsAction} need${needsAction === 1 ? 's' : ''} your attention` : ''}`
            : 'Rooms and flats you list on GHOR appear here.'
        }
        // The top nav already has this button from md up; showing both put two identical
        // primary CTAs on screen.
        actions={<ButtonLink href="/listing/new" icon={Plus} className="md:hidden">List a property</ButtonLink>}
      />

      {isLoading ? (
        <div className="mt-10 space-y-4" aria-busy="true">
          <Skeleton className="h-11 w-2/3 rounded-full" />
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-52 rounded-2xl" />)}
        </div>
      ) : isError ? (
        <EmptyState icon={Home} title="Couldn’t load your listings" body="Check your connection and try again." action={{ label: 'Try again', onClick: () => refetch() }} />
      ) : !listings?.length ? (
        <div className="mt-10 overflow-hidden rounded-3xl bg-navy text-white">
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="p-8 sm:p-12">
              <h2 className="font-display text-[clamp(1.9rem,3.4vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.03em]">Your first listing takes about three minutes.</h2>
              <p className="mt-4 max-w-md text-lg leading-8 text-white/75">It’s free to list. Add a few photos, set the rent, and GHOR reviews it before renters see it — then enquiries come straight to you.</p>
              <ol className="mt-7 space-y-3 text-white/85">
                {['Basics and rent', 'Locality — never your exact address', 'Three or more photos', 'Submit for a quick review'].map((s, i) => (
                  <li key={s} className="flex items-center gap-3">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold">{i + 1}</span> {s}
                  </li>
                ))}
              </ol>
              <ButtonLink href="/listing/new" size="lg" icon={Plus} className="mt-9">List a property</ButtonLink>
            </div>
            <div className="relative hidden min-h-[380px] lg:block" aria-hidden>
              <Image src="/landing/photos/room-simple.jpg" alt="" fill sizes="40vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/10 to-transparent" />
              <span className="absolute bottom-4 right-4 rounded-full bg-navy/70 px-2.5 py-1 text-[11px] font-semibold text-white/85">Illustrative photo</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Status tabs */}
          <div role="tablist" aria-label="Filter by status" className="no-scrollbar -mx-4 mt-10 flex gap-2 overflow-x-auto border-b border-navy/[0.08] px-4 sm:mx-0 sm:px-0">
            {(['all', ...STATUS_ORDER] as const).map((s) => {
              const active = filter === s;
              const n = s === 'all' ? listings.length : counts[s];
              if (s !== 'all' && !n) return null;
              return (
                <button
                  key={s}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(s)}
                  className={cx(
                    '-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-2 pb-3 pt-1 text-[15px] font-semibold transition-colors',
                    active ? 'border-navy text-navy' : 'border-transparent text-muted hover:text-ink',
                  )}
                >
                  {s === 'all' ? 'All' : STATUS_LABEL[s]}
                  <span className={cx('rounded-full px-2 py-0.5 text-xs font-bold', active ? 'bg-navy text-white' : 'bg-navy/[0.07] text-navy')}>{n}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 space-y-4">
            {shown.map((l) => <OwnerListingCard key={l.id} listing={l} />)}
          </div>
        </>
      )}
    </div>
  );
}
