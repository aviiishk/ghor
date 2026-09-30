'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BadgeCheck, Camera, Check, ExternalLink, Inbox, MapPin, X } from 'lucide-react';
import { usePendingListings, useBulkSetListingStatus } from '@/features/admin/hooks';
import type { Listing } from '@/features/listings/api';
import { amenityIcon, amenityLabel } from '@/features/listings/amenities';
import { EmptyState, Skeleton, buttonClass, formatRent } from '@/components/ui';
import { Dialog, useToast } from '@/components/ui/overlay';
import { friendlyError } from '@/lib/errors';

function waitingFor(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return 'Waiting < 1h';
  if (h < 24) return `Waiting ${h}h`;
  return `Waiting ${Math.floor(h / 24)}d`;
}

// Moderation queue (root CLAUDE.md §7.5: "moderation is a feature") — redesigned
// 2026-09-26 as review cards: the founder needs to SEE the photos and the key facts to
// make a trust decision, not scan a row of text. Oldest first (API order).
function QueueCard({
  listing,
  selected,
  onToggle,
  onDecide,
  busy,
}: {
  listing: Listing;
  selected: boolean;
  onToggle: () => void;
  onDecide: (s: 'approved' | 'rejected') => void;
  busy: boolean;
}) {
  const amenities = Object.entries(listing.amenities ?? {}).filter(([, on]) => on).map(([k]) => k);
  const tooFewPhotos = listing.images.length < 3;
  return (
    <article className={`overflow-hidden rounded-3xl bg-white ring-2 transition ${selected ? 'ring-primary' : 'ring-navy/[0.06]'}`}>
      <div className="flex gap-1 overflow-x-auto bg-surface-sunken p-1 [scrollbar-width:none]">
        {listing.images.length ? (
          listing.images.map((img) => (
            <span key={img.id} className="relative h-32 w-44 shrink-0 overflow-hidden rounded-2xl">
              <Image src={img.cloudinaryUrl} alt="" fill sizes="176px" className="object-cover" />
            </span>
          ))
        ) : (
          <span className="flex h-32 w-full items-center justify-center gap-2 text-sm text-muted"><Camera size={18} aria-hidden /> No photos</span>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-start gap-3">
          <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${listing.title}`} className="mt-1.5 h-4 w-4 shrink-0 accent-primary" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h3 className="font-display text-lg font-bold text-ink">{listing.title}</h3>
              <span className="font-display font-bold text-ink">{formatRent(listing.rent)}<span className="text-xs font-medium text-muted">/mo</span></span>
            </div>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted">
              <span className="inline-flex items-center gap-1"><MapPin size={13} aria-hidden /> {listing.locality}, {listing.city}</span>
              <span className="capitalize">· {listing.propertyType}</span>
              {listing.deposit != null && <span>· Deposit {formatRent(listing.deposit)}</span>}
              <span className="rounded-full bg-warning-pale px-2 py-0.5 text-xs font-bold text-warning-deep">{waitingFor(listing.updatedAt)}</span>
            </p>
            {listing.description && <p className="mt-2 line-clamp-2 text-sm text-body">{listing.description}</p>}
            {amenities.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-body">
                {amenities.map((k) => {
                  const Icon = amenityIcon(k);
                  return <li key={k} className="inline-flex items-center gap-1"><Icon size={13} className="text-primary" aria-hidden /> {amenityLabel(k)}</li>;
                })}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-ink">{listing.owner.fullName ?? 'Owner'}</span>
              {listing.owner.phoneVerified && <span className="inline-flex items-center gap-0.5 font-semibold text-success-deep"><BadgeCheck size={13} aria-hidden /> Phone verified</span>}
              <span className={tooFewPhotos ? 'font-bold text-destructive-pressed' : 'text-muted'}>
                · {listing.images.length} photo{listing.images.length === 1 ? '' : 's'}{tooFewPhotos ? ' (below minimum)' : ''}
              </span>
              <Link href={`/listing/${listing.id}`} target="_blank" className="ml-auto inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                Open <ExternalLink size={12} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-4 flex gap-2 border-t border-hairline-soft pt-4">
          <button onClick={() => onDecide('approved')} disabled={busy} className="press inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-success-deep text-sm font-bold text-white disabled:opacity-60 sm:flex-none sm:px-5">
            <Check size={16} aria-hidden /> Approve
          </button>
          <button onClick={() => onDecide('rejected')} disabled={busy} className="press inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-bold text-destructive-pressed ring-1 ring-destructive/40 hover:bg-destructive-pale disabled:opacity-60 sm:flex-none sm:px-5">
            <X size={16} aria-hidden /> Reject
          </button>
        </div>
      </div>
    </article>
  );
}

export default function AdminListingsQueuePage() {
  const { data: listings, isLoading, isError, refetch } = usePendingListings();
  const bulkSet = useBulkSetListingStatus();
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  // Rejecting is consequential (the owner is notified, the listing leaves the queue) and
  // there's no undo — it always goes through a confirmation. Approving is one click.
  const [confirmReject, setConfirmReject] = useState<string[] | null>(null);
  // The API requires a reason on every moderation decision (shown to the owner on a
  // rejection and kept in the audit log).
  const [rejectReason, setRejectReason] = useState('');

  const toggle = (id: string) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  async function decide(ids: string[], status: 'approved' | 'rejected') {
    if (!ids.length) return;
    const reason = status === 'approved' ? 'Reviewed and approved in the legacy admin console' : rejectReason.trim();
    try {
      const res = await bulkSet.mutateAsync({ ids, status, reason });
      const done = res.results.filter((r) => r.result === 'ok').map((r) => r.id);
      setSelected((prev) => prev.filter((id) => !done.includes(id)));
      const n = done.length === 1 ? 'Listing' : `${done.length} listings`;
      if (done.length) {
        toast(status === 'approved' ? `${n} approved — now live in Browse. The owner was notified.` : `${n} rejected. The owner was notified.`);
      }
      if (res.failed) {
        toast(`${res.failed} couldn’t be updated (already decided, changed by the owner, or missing photos). Refresh the queue.`, 'error');
      }
    } catch (e: unknown) {
      toast(friendlyError(e, 'That didn’t go through. Please try again.'), 'error');
    } finally {
      setConfirmReject(null);
      setRejectReason('');
    }
  }
  const rejectTitle = (ids: string[]) =>
    ids.length === 1 ? listings?.find((l) => l.id === ids[0])?.title ?? 'this listing' : `${ids.length} listings`;
  const allSelected = !!listings?.length && selected.length === listings.length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Listings queue</h1>
          <p className="mt-1 text-muted">{listings?.length ? `${listings.length} waiting for review · oldest first` : 'New listings wait here until you approve them'}</p>
        </div>
        {!!listings?.length && (
          <button onClick={() => setSelected(allSelected ? [] : listings.map((l) => l.id))} className="text-sm font-semibold text-primary hover:underline">
            {allSelected ? 'Clear selection' : 'Select all'}
          </button>
        )}
      </div>

      {selected.length > 0 && (
        <div className="sticky top-20 z-30 mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-navy px-4 py-3 text-white shadow-sheet">
          <span className="text-sm font-semibold">{selected.length} selected</span>
          <div className="ml-auto flex gap-2">
            <button onClick={() => decide(selected, 'approved')} disabled={bulkSet.isPending} className="press h-9 rounded-full bg-success px-4 text-sm font-bold text-navy disabled:opacity-60">Approve all</button>
            <button onClick={() => setConfirmReject(selected)} disabled={bulkSet.isPending} className="press h-9 rounded-full bg-white/10 px-4 text-sm font-bold text-white ring-1 ring-white/20 disabled:opacity-60">Reject all</button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-4">
        {isLoading ? (
          Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-72 rounded-3xl" />)
        ) : isError ? (
          <EmptyState icon={Inbox} title="Couldn’t load the queue" action={{ label: 'Try again', onClick: () => refetch() }} />
        ) : listings?.length ? (
          listings.map((l) => (
            <QueueCard
              key={l.id}
              listing={l}
              selected={selected.includes(l.id)}
              onToggle={() => toggle(l.id)}
              onDecide={(s) => (s === 'rejected' ? setConfirmReject([l.id]) : decide([l.id], 'approved'))}
              busy={bulkSet.isPending}
            />
          ))
        ) : (
          <EmptyState icon={Inbox} title="Queue is clear" body="Nothing is waiting for review. New listings appear here as soon as owners submit them." />
        )}
      </div>

      <Dialog
        open={!!confirmReject}
        onClose={() => setConfirmReject(null)}
        dismissible={!bulkSet.isPending}
        variant="modal"
        size="sm"
        title={`Reject ${confirmReject ? rejectTitle(confirmReject) : ''}?`}
        description="The owner is notified and asked to fix the listing and resubmit it. It won’t appear in Browse."
        footer={
          <>
            <button onClick={() => setConfirmReject(null)} disabled={bulkSet.isPending} className={buttonClass('ghost')}>Cancel</button>
            <button onClick={() => confirmReject && decide(confirmReject, 'rejected')} disabled={bulkSet.isPending || rejectReason.trim().length < 3} className={buttonClass('destructive')}>
              {bulkSet.isPending ? 'Rejecting…' : 'Reject'}
            </button>
          </>
        }
      >
        <label className="block text-sm font-semibold text-ink" htmlFor="reject-reason">Reason (sent to the owner)</label>
        <textarea
          id="reject-reason"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="e.g. Photos don’t show the room being offered"
          className="mt-2 w-full rounded-xl border border-hairline px-3 py-2 text-sm"
        />
      </Dialog>
    </div>
  );
}
